import type { BusCandidate, BusEstimationDiagnostics, Coordinates, EtaResult, NearbyStop, Stop } from '../types'

const formatTime = (date: Date) =>
  new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date)

function renderCandidateCard(params: {
  candidate: BusCandidate
  estimatedTripId?: string
  rank: number
  selectedTripId?: string
}): string {
  const { candidate, estimatedTripId, rank, selectedTripId } = params
  const isEstimated = candidate.trip.id === estimatedTripId
  const isSelected = candidate.trip.id === selectedTripId

  return `
    <li class="candidate-item ${isSelected ? 'candidate-item-selected' : ''}">
      <div class="candidate-item-header">
        <div class="candidate-badges">
          <p class="route" style="--route-color:${candidate.route.color}">${candidate.route.shortName}</p>
          ${isEstimated ? '<span class="candidate-badge">自動推定</span>' : ''}
          ${isSelected ? '<span class="candidate-badge candidate-badge-selected">選択中</span>' : ''}
        </div>
        <p class="candidate-rank">候補 ${rank}</p>
      </div>
      <p class="candidate-title">${candidate.route.longName}</p>
      ${candidate.isWithinMatchingRange ? '' : '<p class="status-badge">推定範囲外</p>'}
      <p class="muted">距離 約${Math.round(candidate.distanceMeters)}m / 信頼度 ${Math.round(candidate.confidence * 100)}%</p>
      <p class="muted">${candidate.reason}</p>
      <button class="candidate-select-button" data-trip-id="${candidate.trip.id}" type="button">
        ${isSelected ? 'このバスの選択を解除' : 'このバスを選択'}
      </button>
    </li>
  `
}

export function renderLoadingApp(root: HTMLElement): void {
  root.innerHTML = `
    <main class="app-shell">
      <section class="hero">
        <p class="eyebrow">Kumamoto bus ride companion</p>
        <h1>KumaNORETA</h1>
        <p>GTFS-JP と車両位置データを読み込んでいます。</p>
      </section>

      <section class="card">
        <h2>読み込み中</h2>
        <p class="muted">候補の推定と ETA を準備しています。</p>
      </section>
    </main>
  `
}

export function renderFatalError(root: HTMLElement): void {
  root.innerHTML = `
    <main class="app-shell">
      <section class="hero">
        <p class="eyebrow">Kumamoto bus ride companion</p>
        <h1>KumaNORETA</h1>
        <p>アプリの初期化に失敗しました。</p>
      </section>

      <section class="card">
        <h2>エラー</h2>
        <p class="muted">ページを再読み込みしても直らない場合は、ブラウザの開発者ツールを確認してください。</p>
      </section>
    </main>
  `
}

export function renderApp(params: {
  root: HTMLElement
  position: Coordinates
  activeCandidate?: BusCandidate
  estimatedCandidate?: BusCandidate
  candidates: BusCandidate[]
  diagnostics: BusEstimationDiagnostics
  eta?: EtaResult
  nearbyStops: NearbyStop[]
  onSelectCandidate: (tripId: string) => void
  selectedTripId?: string
  stops: Stop[]
}): void {
  const {
    root,
    position,
    activeCandidate,
    estimatedCandidate,
    candidates,
    diagnostics,
    eta,
    nearbyStops,
    onSelectCandidate,
    selectedTripId,
    stops,
  } = params

  const emptyState =
    diagnostics.totalVehicles === 0
      ? '車両データを取得できていません。通信状況を確認してしばらく待ってください。'
      : diagnostics.matchedVehicles === 0
        ? '車両データは取得できましたが、現在地と一致する候補がまだ見つかっていません。'
        : '推定範囲内の車両はありません。上位の候補から現在地に近いバスを確認してください。'

  root.innerHTML = `
    <main class="app-shell">
      <section class="hero">
        <p class="eyebrow">Kumamoto bus ride companion</p>
        <h1>KumaNORETA</h1>
        <p>いま乗っているバスを推定して、降車停留所までの到着見込みを表示します。</p>
      </section>

      <section class="card grid">
        <div>
          <h2>現在地</h2>
          <p>緯度 ${position.latitude.toFixed(4)} / 経度 ${position.longitude.toFixed(4)}</p>
          <p class="muted">精度 約${Math.round(position.accuracyMeters)}m</p>
          <p class="muted">位置情報ソース ${diagnostics.positionSource}</p>
        </div>
        <div>
          <h2>表示中のバス</h2>
          ${
            activeCandidate
              ? `<p class="route" style="--route-color:${activeCandidate.route.color}">${activeCandidate.route.shortName}</p>
                 <p>${activeCandidate.route.longName}</p>
                 <p class="muted">距離 約${Math.round(activeCandidate.distanceMeters)}m / 信頼度 ${Math.round(activeCandidate.confidence * 100)}%</p>
                 <p class="muted">${activeCandidate.reason}</p>
                 <p class="selection-note">${
                   selectedTripId
                     ? '手動で選択したバスを表示中です。候補一覧の同じボタンをもう一度押すと解除できます。'
                     : '現在は自動推定中です。下の候補から選ぶと、そのバスを優先して表示します。'
                 }</p>`
              : `<p>${emptyState}</p>`
          }
        </div>
      </section>

      <section class="card diagnostics-card">
        <div class="section-heading">
          <h2>推定診断</h2>
          <p class="muted">推定が出ないときの手掛かりです。</p>
        </div>
        <div class="diagnostics-grid">
          <p><strong>車両データソース:</strong> ${diagnostics.vehicleSource}</p>
          <p><strong>最終更新:</strong> ${formatTime(diagnostics.vehicleFetchedAt)}（15秒ごと更新）</p>
          <p><strong>取得車両数:</strong> ${diagnostics.totalVehicles}台</p>
          <p><strong>trip/route 一致数:</strong> ${diagnostics.matchedVehicles}台</p>
          <p><strong>推定範囲内の一致車両:</strong> ${diagnostics.nearbyMatchedVehicles}台</p>
          <p><strong>表示候補数:</strong> ${diagnostics.candidateCount}件</p>
        </div>
        ${diagnostics.note ? `<p class="diagnostics-note">${diagnostics.note}</p>` : ''}
      </section>

      <section class="card">
        <div class="section-heading">
          <h2>近いバス候補</h2>
          <p class="muted">自動推定の候補です。手動で選ぶと更新後も保持します。</p>
        </div>
        ${
          candidates.length > 0
            ? `<ol class="candidate-list">
                ${candidates
                  .map((candidate, index) =>
                    renderCandidateCard({
                      candidate,
                      estimatedTripId: estimatedCandidate?.trip.id,
                      rank: index + 1,
                      selectedTripId,
                    }),
                  )
                  .join('')}
              </ol>`
            : `<p>${emptyState}</p>`
        }
      </section>

      <section class="card">
        <div class="section-heading">
          <h2>近い停留所</h2>
          <p class="muted">推定候補が出ない場合の位置確認用です。</p>
        </div>
        ${
          nearbyStops.length > 0
            ? `<ol class="candidate-list">${nearbyStops
                .map(
                  ({ stop, distanceMeters }, index) => `
                    <li class="candidate-item">
                      <div class="candidate-item-header">
                        <p class="candidate-title">${stop.name}</p>
                        <p class="candidate-rank">近い順 ${index + 1}</p>
                      </div>
                      <p class="muted">現在地から約${Math.round(distanceMeters)}m</p>
                    </li>`,
                )
                .join('')}</ol>`
            : '<p>近くの停留所は見つかりませんでした。</p>'
        }
      </section>

      <section class="card">
        <h2>降車停留所と ETA</h2>
        <label for="destination">降車停留所</label>
        <select id="destination" disabled>
          ${stops.map((stop) => `<option ${eta?.stop.id === stop.id ? 'selected' : ''}>${stop.name}</option>`).join('')}
        </select>
        ${
          eta
            ? `<p class="eta">${eta.stop.name} に ${formatTime(eta.estimatedArrival)} ごろ到着予定</p>
               <p class="muted">あと約${eta.minutesUntilArrival}分 / ${eta.source === 'mock' ? 'モック推定' : 'GTFS-RT'}</p>`
            : '<p>表示するバスが決まると ETA を表示します。</p>'
        }
      </section>
    </main>
  `

  root.querySelectorAll<HTMLButtonElement>('[data-trip-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const tripId = button.dataset.tripId
      if (tripId) {
        onSelectCandidate(tripId)
      }
    })
  })
}
