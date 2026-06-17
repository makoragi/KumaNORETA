import type { BusCandidate, Coordinates, EtaResult, Stop } from '../types'

const formatTime = (date: Date) =>
  new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date)

export function renderApp(params: {
  root: HTMLElement
  position: Coordinates
  candidate?: BusCandidate
  eta?: EtaResult
  stops: Stop[]
}): void {
  const { root, position, candidate, eta, stops } = params
  root.innerHTML = `
    <main class="app-shell">
      <section class="hero">
        <p class="eyebrow">Kumamoto bus ride companion</p>
        <h1>KumaNORETA</h1>
        <p>いま乗っているバスを推定し、降車停留所への到着予想時刻を表示します。</p>
      </section>
      <section class="card grid">
        <div>
          <h2>現在位置</h2>
          <p>緯度 ${position.latitude.toFixed(4)} / 経度 ${position.longitude.toFixed(4)}</p>
          <p class="muted">精度 約${Math.round(position.accuracyMeters)}m</p>
        </div>
        <div>
          <h2>推定中のバス</h2>
          ${
            candidate
              ? `<p class="route" style="--route-color:${candidate.route.color}">${candidate.route.shortName}</p>
                 <p>${candidate.route.longName}</p>
                 <p class="muted">信頼度 ${Math.round(candidate.confidence * 100)}% / ${candidate.reason}</p>`
              : '<p>候補が見つかりませんでした。</p>'
          }
        </div>
      </section>
      <section class="card">
        <h2>降車停留所とETA</h2>
        <label for="destination">降車停留所</label>
        <select id="destination" disabled>
          ${stops.map((stop) => `<option ${eta?.stop.id === stop.id ? 'selected' : ''}>${stop.name}</option>`).join('')}
        </select>
        ${
          eta
            ? `<p class="eta">${eta.stop.name} に ${formatTime(eta.estimatedArrival)} ごろ到着予定</p>
               <p class="muted">あと約${eta.minutesUntilArrival}分（${eta.source === 'mock' ? 'モック計算' : 'GTFS-RT'}）</p>`
            : '<p>到着予想を計算できませんでした。</p>'
        }
      </section>
    </main>
  `
}
