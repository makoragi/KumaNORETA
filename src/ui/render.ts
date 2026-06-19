import type {
  BusCandidate,
  BusEstimationDiagnostics,
  Coordinates,
  EtaResult,
  NearbyStop,
  Stop,
  TripProgress,
} from '../types'

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
        ${isSelected ? 'このバスの選択を解除' : 'このバスを選ぶ'}
      </button>
    </li>
  `
}

function renderCurrentSegment(progress?: TripProgress): string {
  if (!progress) return '選択中のバスが決まると表示します'

  switch (progress.state) {
    case 'single-stop-trip':
      return `${progress.nextStop?.name ?? 'この便'} のみの便です`
    case 'at-final-stop':
      return `${progress.nextStop?.name ?? '終点'} 付近`
    case 'between-stops':
    case 'before-first-stop':
      return `${progress.previousStop?.name ?? '不明'} と ${progress.nextStop?.name ?? '不明'} の間`
  }
}

function renderSelectionMode(selectedTripId?: string): string {
  if (selectedTripId) {
    return '手動で固定中'
  }

  return '自動推定中'
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
        <p class="muted">ページを再読み込みしても戻らない場合は、ブラウザの開発者ツールで詳細を確認してください。</p>
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
  destinationStops: Stop[]
  onSelectCandidate: (tripId: string) => void
  onSelectDestination: (stopId: string) => void
  selectedDestinationStopId?: string
  selectedTripId?: string
  stops: Stop[]
  tripProgress?: TripProgress
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
    destinationStops,
    onSelectCandidate,
    onSelectDestination,
    selectedDestinationStopId,
    selectedTripId,
    stops,
    tripProgress,
  } = params

  const emptyState =
    diagnostics.totalVehicles === 0
      ? '車両データを取得できていません。通信状況を確認してしばらく待ってください。'
      : diagnostics.matchedVehicles === 0
        ? '車両データは取得できましたが、現在地と一致する候補が見つかっていません。'
        : '推定範囲内の車両はありません。候補から近いバスを選んでください。'

  const candidateSummary = selectedTripId
    ? `選択中のバスを変更する (${candidates.length}件の候補)`
    : `近いバス候補を表示する (${candidates.length}件)`

  const nearbyStopsSummary =
    nearbyStops.length > 0 ? `近い停留所を確認する (${nearbyStops.length}件)` : '近い停留所を確認する'

  root.innerHTML = `
    <main class="app-shell">
      <section class="hero">
        <p class="eyebrow">Kumamoto bus ride companion</p>
        <h1>KumaNORETA</h1>
        <p>いま乗っているバスを推定して、降車停留所までの到着見込みをすぐ確認できます。</p>
      </section>

      <section class="status-strip">
        <div class="status-chip">
          <span class="status-chip-label">現在地</span>
          <strong>精度 約${Math.round(position.accuracyMeters)}m</strong>
          <span>緯度 ${position.latitude.toFixed(4)} / 経度 ${position.longitude.toFixed(4)}</span>
        </div>
        <div class="status-chip">
          <span class="status-chip-label">位置ソース</span>
          <strong>${diagnostics.positionSource}</strong>
          <span>車両更新 ${formatTime(diagnostics.vehicleFetchedAt)}</span>
        </div>
        <div class="status-chip">
          <span class="status-chip-label">表示モード</span>
          <strong>${renderSelectionMode(selectedTripId)}</strong>
          <span>候補 ${diagnostics.candidateCount}件</span>
        </div>
      </section>

      <section class="priority-grid">
        <article class="card priority-card">
          <div class="section-heading">
            <div>
              <p class="panel-label">優先表示</p>
              <h2>表示中のバス</h2>
            </div>
            ${
              activeCandidate
                ? `<p class="mode-pill ${selectedTripId ? 'mode-pill-selected' : ''}">${renderSelectionMode(selectedTripId)}</p>`
                : ''
            }
          </div>
          ${
            activeCandidate
              ? `
                <p class="route" style="--route-color:${activeCandidate.route.color}">${activeCandidate.route.shortName}</p>
                <p class="candidate-title primary-title">${activeCandidate.route.longName}</p>
                <p class="muted">距離 約${Math.round(activeCandidate.distanceMeters)}m / 信頼度 ${Math.round(activeCandidate.confidence * 100)}%</p>
                <p class="segment-note">現在位置: ${renderCurrentSegment(tripProgress)}</p>
                <p class="muted">${activeCandidate.reason}</p>
                ${
                  selectedTripId
                    ? `<button class="ghost-button" data-trip-id="${selectedTripId}" type="button">バス選択を解除</button>`
                    : `<p class="selection-note">候補一覧から選ぶと、このバス表示を固定できます。</p>`
                }
              `
              : `<p>${emptyState}</p>`
          }
        </article>

        <article class="card priority-card eta-card">
          <div class="section-heading">
            <div>
              <p class="panel-label">最優先</p>
              <h2>降車停留所と ETA</h2>
            </div>
          </div>
          <label for="destination">降車停留所</label>
          <select id="destination" ${destinationStops.length > 0 ? '' : 'disabled'}>
            ${destinationStops
              .map(
                (stop) =>
                  `<option value="${stop.id}" ${selectedDestinationStopId === stop.id ? 'selected' : ''}>${stop.name}</option>`,
              )
              .join('')}
          </select>
          ${
            eta
              ? `
                <p class="eta">${eta.stop.name} に ${formatTime(eta.estimatedArrival)} ごろ到着見込み</p>
                <div class="eta-meta">
                  <p><strong>あと約${eta.minutesUntilArrival}分</strong></p>
                  <p>残り約${Math.round(eta.remainingDistanceMeters)}m</p>
                  <p>${eta.source === 'distance-model' ? '停留所距離ベース推定' : eta.source}</p>
                </div>
              `
              : '<p>表示するバスが決まると ETA を表示します。</p>'
          }
          ${
            stops.length > 0
              ? `<p class="muted">この便の停留所数: ${stops.length} 件</p>`
              : '<p class="muted">バスが決まると降車停留所を選べます。</p>'
          }
        </article>
      </section>

      <details class="card collapsible-card" ${selectedTripId ? '' : 'open'}>
        <summary>${candidateSummary}</summary>
        <div class="collapsible-body">
          <div class="section-heading">
            <div>
              <h2>近いバス候補</h2>
              <p class="muted">自動推定の候補です。手動で選ぶと表示対象を固定できます。</p>
            </div>
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
        </div>
      </details>

      <details class="card collapsible-card">
        <summary>${nearbyStopsSummary}</summary>
        <div class="collapsible-body">
          <div class="section-heading">
            <div>
              <h2>近い停留所</h2>
              <p class="muted">候補が出ない場合の現在地確認用です。</p>
            </div>
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
        </div>
      </details>

      <details class="card collapsible-card diagnostics-card">
        <summary>推定診断を表示する</summary>
        <div class="collapsible-body">
          <div class="section-heading">
            <div>
              <h2>推定診断</h2>
              <p class="muted">通常は使わない確認用情報です。</p>
            </div>
          </div>
          <div class="diagnostics-grid">
            <p><strong>車両データソース:</strong> ${diagnostics.vehicleSource}</p>
            <p><strong>最終更新:</strong> ${formatTime(diagnostics.vehicleFetchedAt)}（約15秒ごと更新）</p>
            <p><strong>取得車両数:</strong> ${diagnostics.totalVehicles} 台</p>
            <p><strong>trip/route 一致数:</strong> ${diagnostics.matchedVehicles} 台</p>
            <p><strong>推定範囲内の一致車両:</strong> ${diagnostics.nearbyMatchedVehicles} 台</p>
            <p><strong>表示候補数:</strong> ${diagnostics.candidateCount} 件</p>
          </div>
          ${diagnostics.note ? `<p class="diagnostics-note">${diagnostics.note}</p>` : ''}
        </div>
      </details>
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

  const destinationSelect = root.querySelector<HTMLSelectElement>('#destination')
  destinationSelect?.addEventListener('change', () => {
    if (destinationSelect.value) {
      onSelectDestination(destinationSelect.value)
    }
  })
}
