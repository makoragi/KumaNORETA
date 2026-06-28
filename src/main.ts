import './style.css'
import { defaultTransitDatasetId, isTransitOperatorId } from './config/transit'
import {
  collectBusEstimationDiagnostics,
  findBusCandidateByTripId,
  findNearbyStops,
  rankBusCandidates,
  rankNearbyBusCandidates,
} from './domain/busEstimator'
import { calculateEta, estimateTripProgress } from './domain/eta'
import {
  getCurrentPosition,
  loadLocationDebugMode,
  locationDebugOptions,
  persistLocationDebugMode,
  type LocationDebugMode,
} from './services/gps'
import { loadStaticGtfsData } from './services/gtfsJp'
import {
  fetchTripUpdatesWithStatus,
  fetchVehiclePositions,
  type GtfsRtCollectionFetchStatus,
} from './services/gtfsRt'
import type { BusCandidate, BusEstimationDiagnostics, Stop, TripUpdate, VehiclePosition } from './types'
import { renderApp, renderLoadingApp, renderRuntimeError } from './ui/render'

const MAP_NEARBY_RADIUS_METERS = 1_200
const SELECTED_TRIP_STORAGE_KEY = 'kumanoreta:selectedTripId'
const SELECTED_DESTINATION_STORAGE_KEY = 'kumanoreta:selectedDestinationStopId'

function buildTripUpdatesByTripId(tripUpdates: TripUpdate[]) {
  return new Map(tripUpdates.map((tripUpdate) => [tripUpdate.tripId, tripUpdate]))
}

function loadPersistedValue(key: string): string | undefined {
  try {
    return window.localStorage.getItem(key) ?? undefined
  } catch {
    return undefined
  }
}

function persistValue(key: string, value?: string): void {
  try {
    if (value) {
      window.localStorage.setItem(key, value)
    } else {
      window.localStorage.removeItem(key)
    }
  } catch {
    // Ignore storage failures and keep the in-memory selection.
  }
}

function normalizeError(error: unknown): { message: string; stack?: string; hint?: string } {
  if (error instanceof Error) {
    const lower = `${error.name} ${error.message}`.toLowerCase()
    const hint = lower.includes('fetch')
      ? 'ネットワークや CORS、GTFS-RT の取得設定を確認してください。'
      : lower.includes('geolocation') || lower.includes('permission')
        ? '位置情報の利用許可を確認してください。'
        : lower.includes('app root')
          ? 'HTML の #app 要素が見つかりません。'
          : 'ブラウザの開発者ツールに詳細が出ている可能性があります。'

    return {
      message: error.message || error.name,
      stack: error.stack,
      hint,
    }
  }

  return {
    message: typeof error === 'string' ? error : JSON.stringify(error),
    hint: '原因不明のエラーが発生しました。',
  }
}

function renderErrorState(root: HTMLElement, phase: string, error: unknown): void {
  const normalized = normalizeError(error)
  renderRuntimeError(root, {
    phase,
    message: normalized.message,
    stack: normalized.stack,
    hint: normalized.hint,
  })
}

async function bootstrap() {
  const root = document.querySelector<HTMLDivElement>('#app')
  if (!root) throw new Error('App root element was not found')
  renderLoadingApp(root)

  window.addEventListener('error', (event) => {
    console.error('Unhandled error', event.error)
    renderErrorState(root, 'runtime error', event.error ?? event.message)
  })

  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection', event.reason)
    renderErrorState(root, 'unhandled promise rejection', event.reason)
  })

  let selectedLocationMode: LocationDebugMode = loadLocationDebugMode()
  const staticData = await loadStaticGtfsData()
  const activeDatasetId =
    staticData.metadata.datasetId === 'all'
      ? 'all'
      : staticData.metadata.datasetId && isTransitOperatorId(staticData.metadata.datasetId)
        ? staticData.metadata.datasetId
        : defaultTransitDatasetId
  let positionResult = await getCurrentPosition(selectedLocationMode)
  const stopsById = new Map(staticData.stops.map((stop) => [stop.id, stop]))
  const isMockVehicleSource = import.meta.env.VITE_GTFS_RT_USE_MOCK !== 'false'

  let refreshInProgress = false
  let selectedTripId = loadPersistedValue(SELECTED_TRIP_STORAGE_KEY)
  let selectedDestinationStopId = loadPersistedValue(SELECTED_DESTINATION_STORAGE_KEY)
  let selectedCandidate: BusCandidate | undefined
  let latestVehicles: VehiclePosition[] = []
  let latestTripUpdates: TripUpdate[] = []
  let latestTripUpdatesStatus: GtfsRtCollectionFetchStatus = isMockVehicleSource ? 'mock' : 'failed'
  let latestVehicleFetchedAt = new Date()

  const buildCandidateStops = (candidate?: BusCandidate): Stop[] =>
    candidate
      ? candidate.trip.stopIds
          .map((stopId) => stopsById.get(stopId))
          .filter((stop): stop is Stop => stop !== undefined)
      : []

  const buildDestinationStops = (candidateStops: Stop[], nextStopIndex?: number): Stop[] => {
    if (candidateStops.length === 0) return []
    if (nextStopIndex === undefined) return candidateStops
    return candidateStops.slice(Math.max(0, Math.min(nextStopIndex, candidateStops.length - 1)))
  }

  const renderCurrentState = () => {
    const tripUpdatesByTripId = buildTripUpdatesByTripId(latestTripUpdates)
    const position = positionResult.position
    const nearbyStops = findNearbyStops(position, staticData.stops)
    const candidates = rankBusCandidates(position, latestVehicles, staticData.trips, staticData.routes, staticData.stops)
    const mapCandidates = rankNearbyBusCandidates(
      position,
      latestVehicles,
      staticData.trips,
      staticData.routes,
      staticData.stops,
      MAP_NEARBY_RADIUS_METERS,
    )
    const estimatedCandidate = candidates.find((item) => item.isWithinMatchingRange)
    const rawDiagnostics = collectBusEstimationDiagnostics(position, latestVehicles, staticData.trips, staticData.routes)

    if (selectedTripId) {
      selectedCandidate =
        findBusCandidateByTripId(
          selectedTripId,
          position,
          latestVehicles,
          staticData.trips,
          staticData.routes,
          staticData.stops,
        ) ??
        mapCandidates.find((candidate) => candidate.trip.id === selectedTripId) ??
        candidates.find((candidate) => candidate.trip.id === selectedTripId) ??
        selectedCandidate
    } else {
      selectedCandidate = undefined
    }

    const activeCandidate = selectedTripId ? selectedCandidate : estimatedCandidate
    const candidateStops = buildCandidateStops(activeCandidate)
    const tripProgress = activeCandidate ? estimateTripProgress(activeCandidate, staticData.stops) : undefined
    const destinationStops = buildDestinationStops(candidateStops, tripProgress?.nextStopIndex)

    if (!destinationStops.some((stop) => stop.id === selectedDestinationStopId)) {
      selectedDestinationStopId = destinationStops.at(-1)?.id
      persistValue(SELECTED_DESTINATION_STORAGE_KEY, selectedDestinationStopId)
    }

    const eta =
      activeCandidate && selectedDestinationStopId
        ? calculateEta(activeCandidate, selectedDestinationStopId, staticData.stops, tripProgress)
        : undefined

    const diagnostics: BusEstimationDiagnostics = {
      ...rawDiagnostics,
      candidateCount: candidates.length,
      positionSource: positionResult.source,
      vehicleFetchedAt: latestVehicleFetchedAt,
      vehicleSource: isMockVehicleSource ? 'mock' : 'gtfs-rt',
      note:
        !isMockVehicleSource && latestVehicles.length > 0 && rawDiagnostics.matchedVehicles === 0
          ? 'GTFS-RT の tripId と静的 GTFS の対応が取れない車両が含まれている可能性があります。'
          : undefined,
    }

    renderApp({
      root,
      position,
      activeCandidate,
      activeTripUpdate: activeCandidate ? tripUpdatesByTripId.get(activeCandidate.trip.id) : undefined,
      candidates,
      mapCandidates,
      diagnostics,
      estimatedCandidate,
      eta,
      nearbyStops,
      destinationStops,
      locationDebugOptions,
      onSelectCandidate: (tripId) => {
        if (selectedTripId === tripId) {
          selectedTripId = undefined
          selectedCandidate = undefined
        } else {
          selectedTripId = tripId
          selectedCandidate =
            mapCandidates.find((candidate) => candidate.trip.id === tripId) ??
            candidates.find((candidate) => candidate.trip.id === tripId)
        }

        persistValue(SELECTED_TRIP_STORAGE_KEY, selectedTripId)
        renderCurrentState()
      },
      onSelectDestination: (stopId) => {
        selectedDestinationStopId = stopId
        persistValue(SELECTED_DESTINATION_STORAGE_KEY, selectedDestinationStopId)
        renderCurrentState()
      },
      onRefreshLocation: async () => {
        positionResult = await getCurrentPosition(selectedLocationMode)
        await refreshVehicles()
      },
      onSelectLocationMode: async (mode) => {
        selectedLocationMode = mode
        persistLocationDebugMode(mode)
        positionResult = await getCurrentPosition(mode)
        renderCurrentState()
      },
      selectedLocationMode,
      selectedDestinationStopId,
      selectedTripId,
      stops: candidateStops,
      tripUpdatesFetchStatus: latestTripUpdatesStatus,
      tripUpdatesByTripId,
      tripProgress,
    })
  }

  const refreshVehicles = async () => {
    if (refreshInProgress) return
    refreshInProgress = true

    try {
      const [vehicles, tripUpdatesResult] = await Promise.all([
        fetchVehiclePositions(activeDatasetId),
        fetchTripUpdatesWithStatus(activeDatasetId),
      ])

      latestVehicles = vehicles
      latestTripUpdates = tripUpdatesResult.tripUpdates
      latestTripUpdatesStatus = tripUpdatesResult.status as GtfsRtCollectionFetchStatus
      latestVehicleFetchedAt = new Date()

      renderCurrentState()
    } catch (error) {
      console.error('Failed during vehicle refresh', error)
      renderErrorState(root, 'vehicle refresh', error)
    } finally {
      refreshInProgress = false
    }
  }

  await refreshVehicles()

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
    })
  }
}

bootstrap().catch((error: unknown) => {
  console.error(error)
  const root = document.querySelector<HTMLDivElement>('#app')
  if (root) {
    renderErrorState(root, 'bootstrap', error)
  }
})
