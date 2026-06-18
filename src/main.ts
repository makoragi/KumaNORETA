import './style.css'
import { estimateCurrentBus } from './domain/busEstimator'
import { calculateEta } from './domain/eta'
import { getCurrentPosition } from './services/gps'
import { loadStaticGtfsData } from './services/gtfsJp'
import { fetchVehiclePositions } from './services/gtfsRt'
import { renderApp } from './ui/render'

async function bootstrap() {
  const root = document.querySelector<HTMLDivElement>('#app')
  if (!root) throw new Error('App root element was not found')

  const [position, staticData, vehicles] = await Promise.all([
    getCurrentPosition(),
    loadStaticGtfsData(),
    fetchVehiclePositions(),
  ])

  const candidate = estimateCurrentBus(position, vehicles, staticData.trips, staticData.routes)
  const destinationStopId = staticData.stops.at(-1)?.id
  const eta = candidate && destinationStopId ? calculateEta(candidate, destinationStopId, staticData.stops) : undefined

  renderApp({ root, position, candidate, eta, stops: staticData.stops })

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
