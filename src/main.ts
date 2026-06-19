import './style.css'
import { collectBusEstimationDiagnostics, findNearbyStops, rankBusCandidates } from './domain/busEstimator'
import { calculateEta, estimateTripProgress } from './domain/eta'
import { getCurrentPosition } from './services/gps'
import { loadStaticGtfsData } from './services/gtfsJp'
import { fetchTripUpdates, fetchVehiclePositions } from './services/gtfsRt'
import type { BusCandidate, BusEstimationDiagnostics, Stop, TripUpdate } from './types'
import { renderApp, renderFatalError, renderLoadingApp } from './ui/render'

const VEHICLE_REFRESH_INTERVAL_MS = 15_000
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

async function bootstrap() {
  const root = document.querySelector<HTMLDivElement>('#app')
  if (!root) throw new Error('App root element was not found')
  renderLoadingApp(root)

  const [positionResult, staticData] = await Promise.all([getCurrentPosition(), loadStaticGtfsData()])

  const position = positionResult.position
  const nearbyStops = findNearbyStops(position, staticData.stops)
  const stopsById = new Map(staticData.stops.map((stop) => [stop.id, stop]))
  const isMockVehicleSource = import.meta.env.VITE_GTFS_RT_USE_MOCK !== 'false'

  let refreshInProgress = false
  let selectedTripId = loadPersistedValue(SELECTED_TRIP_STORAGE_KEY)
  let selectedDestinationStopId = loadPersistedValue(SELECTED_DESTINATION_STORAGE_KEY)
  let selectedCandidate: BusCandidate | undefined

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

  const refreshVehicles = async () => {
    if (refreshInProgress) return
    refreshInProgress = true

    try {
      const [vehicles, tripUpdates] = await Promise.all([fetchVehiclePositions(), fetchTripUpdates()])
      const vehicleFetchedAt = new Date()
      const tripUpdatesByTripId = buildTripUpdatesByTripId(tripUpdates)
      const candidates = rankBusCandidates(position, vehicles, staticData.trips, staticData.routes)
      const estimatedCandidate = candidates.find((item) => item.isWithinMatchingRange)
      const rawDiagnostics = collectBusEstimationDiagnostics(position, vehicles, staticData.trips, staticData.routes)

      selectedCandidate = selectedTripId
        ? candidates.find((candidate) => candidate.trip.id === selectedTripId)
        : undefined

      const activeCandidate = selectedCandidate ?? estimatedCandidate
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
        vehicleFetchedAt,
        vehicleSource: isMockVehicleSource ? 'mock' : 'gtfs-rt',
        note:
          !isMockVehicleSource && vehicles.length > 0 && rawDiagnostics.matchedVehicles === 0
            ? 'GTFS-RT の tripId と静的 GTFS の便データが一致していない可能性があります。'
            : undefined,
      }

      renderApp({
        root,
        position,
        activeCandidate,
        activeTripUpdate: activeCandidate ? tripUpdatesByTripId.get(activeCandidate.trip.id) : undefined,
        candidates,
        diagnostics,
        estimatedCandidate,
        eta,
        nearbyStops,
        destinationStops,
        onSelectCandidate: (tripId) => {
          if (selectedTripId === tripId) {
            selectedTripId = undefined
            selectedCandidate = undefined
          } else {
            selectedTripId = tripId
            selectedCandidate = candidates.find((candidate) => candidate.trip.id === tripId)
          }

          persistValue(SELECTED_TRIP_STORAGE_KEY, selectedTripId)
          void refreshVehicles()
        },
        onSelectDestination: (stopId) => {
          selectedDestinationStopId = stopId
          persistValue(SELECTED_DESTINATION_STORAGE_KEY, selectedDestinationStopId)
          void refreshVehicles()
        },
        selectedDestinationStopId,
        selectedTripId,
        stops: candidateStops,
        tripUpdatesByTripId,
        tripProgress,
      })
    } finally {
      refreshInProgress = false
    }
  }

  await refreshVehicles()

  if (!isMockVehicleSource) {
    window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshVehicles()
      }
    }, VEHICLE_REFRESH_INTERVAL_MS)
  }

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
    renderFatalError(root)
  }
})
