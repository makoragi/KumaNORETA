import './style.css'
import { collectBusEstimationDiagnostics, findNearbyStops, rankBusCandidates } from './domain/busEstimator'
import { calculateEta } from './domain/eta'
import { getCurrentPosition } from './services/gps'
import { loadStaticGtfsData } from './services/gtfsJp'
import { fetchVehiclePositions } from './services/gtfsRt'
import type { BusEstimationDiagnostics, Stop } from './types'
import { renderApp, renderFatalError, renderLoadingApp } from './ui/render'

const VEHICLE_REFRESH_INTERVAL_MS = 15_000

async function bootstrap() {
  const root = document.querySelector<HTMLDivElement>('#app')
  if (!root) throw new Error('App root element was not found')
  renderLoadingApp(root)

  const [positionResult, staticData] = await Promise.all([
    getCurrentPosition(),
    loadStaticGtfsData(),
  ])

  const position = positionResult.position
  const nearbyStops = findNearbyStops(position, staticData.stops)
  const stopsById = new Map(staticData.stops.map((stop) => [stop.id, stop]))
  const isMockVehicleSource = import.meta.env.VITE_GTFS_RT_USE_MOCK !== 'false'
  let refreshInProgress = false

  const refreshVehicles = async () => {
    if (refreshInProgress) return
    refreshInProgress = true

    try {
      const vehicles = await fetchVehiclePositions()
      const vehicleFetchedAt = new Date()
      const candidates = rankBusCandidates(position, vehicles, staticData.trips, staticData.routes)
      const candidate = candidates.find((item) => item.isWithinMatchingRange)
      const rawDiagnostics = collectBusEstimationDiagnostics(position, vehicles, staticData.trips, staticData.routes)
      const diagnostics: BusEstimationDiagnostics = {
        ...rawDiagnostics,
        candidateCount: candidates.length,
        positionSource: positionResult.source,
        vehicleSource: isMockVehicleSource ? 'mock' : 'gtfs-rt',
        vehicleFetchedAt,
        note:
          !isMockVehicleSource && vehicles.length > 0 && rawDiagnostics.matchedVehicles === 0
            ? '実GTFS-RTの tripId と静的GTFSの便データが一致していないため、候補化できていない可能性があります。'
            : undefined,
      }
      const destinationStopId = candidate?.trip.stopIds.at(-1)
      const eta =
        candidate && destinationStopId ? calculateEta(candidate, destinationStopId, staticData.stops) : undefined
      const candidateStops: Stop[] = candidate
        ? candidate.trip.stopIds
            .map((stopId) => stopsById.get(stopId))
            .filter((stop): stop is Stop => stop !== undefined)
        : []

      renderApp({ root, position, candidate, candidates, diagnostics, eta, stops: candidateStops, nearbyStops })
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
