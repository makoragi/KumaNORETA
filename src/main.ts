import './style.css'
import { collectBusEstimationDiagnostics, rankBusCandidates } from './domain/busEstimator'
import { calculateEta } from './domain/eta'
import { getCurrentPosition } from './services/gps'
import { loadStaticGtfsData } from './services/gtfsJp'
import { fetchVehiclePositions } from './services/gtfsRt'
import type { BusEstimationDiagnostics } from './types'
import { renderApp } from './ui/render'

async function bootstrap() {
  const root = document.querySelector<HTMLDivElement>('#app')
  if (!root) throw new Error('App root element was not found')

  const [positionResult, staticData, vehicles] = await Promise.all([
    getCurrentPosition(),
    loadStaticGtfsData(),
    fetchVehiclePositions(),
  ])

  const position = positionResult.position
  const candidates = rankBusCandidates(position, vehicles, staticData.trips, staticData.routes)
  const candidate = candidates[0]
  const rawDiagnostics = collectBusEstimationDiagnostics(position, vehicles, staticData.trips, staticData.routes)
  const isMockVehicleSource = import.meta.env.VITE_GTFS_RT_USE_MOCK !== 'false'
  const diagnostics: BusEstimationDiagnostics = {
    ...rawDiagnostics,
    candidateCount: candidates.length,
    positionSource: positionResult.source,
    vehicleSource: isMockVehicleSource ? 'mock' : 'gtfs-rt',
    note:
      !isMockVehicleSource && vehicles.length > 0 && rawDiagnostics.matchedVehicles === 0
        ? '実GTFS-RTの tripId と静的GTFSのモック便データが一致していないため、候補化できていない可能性があります。'
        : undefined,
  }
  const destinationStopId = staticData.stops.at(-1)?.id
  const eta = candidate && destinationStopId ? calculateEta(candidate, destinationStopId, staticData.stops) : undefined

  renderApp({ root, position, candidate, candidates, diagnostics, eta, stops: staticData.stops })

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
    })
  }
}

bootstrap().catch((error: unknown) => {
  console.error(error)
  document.querySelector<HTMLDivElement>('#app')!.innerHTML = '<p>アプリの初期化に失敗しました。</p>'
})
