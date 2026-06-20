import type { LocationDebugMode, LocationDebugOption, PositionSource } from '../services/gps'
import type { GtfsRtCollectionFetchStatus } from '../services/gtfsRt'
import type {
  BusCandidate,
  BusEstimationDiagnostics,
  Coordinates,
  EtaResult,
  NearbyStop,
  Stop,
  TripProgress,
  TripUpdate,
} from '../types'

type DelayPresentation = {
  badgeClass: string
  badgeText: string
  detailText: string
}

export type FatalErrorDetails = {
  phase?: string
  message?: string
  stack?: string
  hint?: string
}

const formatTime = (date: Date) =>
  new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date)

function renderPositionSource(source: PositionSource): string {
  switch (source) {
    case 'browser':
      return 'GPS'
    case 'debug-preset':
      return 'デバッグ地点'
    case 'mock-fallback':
      return 'フォールバック'
  }
}

function renderTripUpdatesStatus(status: GtfsRtCollectionFetchStatus): string {
  switch (status) {
    case 'ok':
      return 'GTFS-RT'
    case 'mock':
      return 'モック'
    case 'failed':
      return '取得失敗'
  }
}

function resolveDelayPresentation(
  tripUpdate: TripUpdate | undefined,
  tripUpdatesFetchStatus: GtfsRtCollectionFetchStatus,
): DelayPresentation {
  if (tripUpdatesFetchStatus === 'failed') {
    return {
      badgeClass: 'delay-badge-unknown',
      badgeText: '遅延不明',
      detailText: 'TripUpdates の取得に失敗しました',
    }
  }

  if (!tripUpdate) {
    return {
      badgeClass: 'delay-badge-unknown',
      badgeText: '情報なし',
      detailText: tripUpdatesFetchStatus === 'mock' ? 'モックの遅延情報を表示中' : 'この便の遅延情報は未取得です',
    }
  }

  if (tripUpdate.delaySeconds === undefined) {
    return {
      badgeClass: 'delay-badge-unknown',
      badgeText: '遅延不明',
      detailText: '遅延秒数が含まれていません',
    }
  }

  const roundedMinutes = Math.round(Math.abs(tripUpdate.delaySeconds) / 60)
  if (roundedMinutes === 0) {
    return {
      badgeClass: 'delay-badge-on-time',
      badgeText: '定時',
      detailText: 'ほぼ定刻です',
    }
  }

  if (tripUpdate.delaySeconds > 0) {
    return {
      badgeClass: 'delay-badge-late',
      badgeText: `${roundedMinutes}分遅れ`,
      detailText: `${roundedMinutes}分遅れです`,
    }
  }

  return {
    badgeClass: 'delay-badge-early',
    badgeText: `${roundedMinutes}分早着`,
    detailText: `${roundedMinutes}分早着です`,
  }
}

function renderCurrentSegment(progress?: TripProgress): string {
  if (!progress) return '乗車中の区間を特定できませんでした'

  switch (progress.state) {
    case 'single-stop-trip':
      return `${progress.nextStop?.name ?? '終点'}のみの便です`
    case 'at-final-stop':
      return `${progress.nextStop?.name ?? '終点'}に到着済みです`
    case 'before-first-stop':
      return `${progress.nextStop?.name ?? '始発停留所'}へ向かう前です`
    case 'between-stops':
      return `${progress.previousStop?.name ?? '前停留所'} と ${progress.nextStop?.name ?? '次停留所'} の間です`
  }
}

function renderLocationModeSummary(
  selectedLocationMode: LocationDebugMode,
  locationDebugOptions: LocationDebugOption[],
): string {
  return locationDebugOptions.find((option) => option.id === selectedLocationMode)?.label ?? 'GPSを使う'
}

function captureDetailsOpenState(root: HTMLElement): Map<string, boolean> {
  return new Map(
    Array.from(root.querySelectorAll<HTMLDetailsElement>('details[data-panel-id]')).map((details) => [
      details.dataset.panelId ?? '',
      details.open,
    ]),
  )
}

function renderDetailsOpenAttribute(
  openStates: Map<string, boolean>,
  panelId: string,
  defaultOpen: boolean,
): string {
  return (openStates.get(panelId) ?? defaultOpen) ? 'open' : ''
}

function renderEtaAccent(eta?: EtaResult): string {
  if (!eta) {
    return `
      <div class="eta-empty">
        <p class="eta-empty-title">ETA 待機中</p>
        <p class="eta-empty-copy">バスが見つかると、残り時間を大きく表示します。</p>
      </div>
    `
  }

  return `
    <div class="eta-accent">
      <p class="eta-kicker">ETA</p>
      <div class="eta-countdown" aria-label="到着まであと約${eta.minutesUntilArrival}分">
        <span class="eta-countdown-prefix">あと</span>
        <span class="eta-countdown-value">${eta.minutesUntilArrival}</span>
        <span class="eta-countdown-suffix">分</span>
      </div>
      <p class="eta-stop-name">${eta.stop.name}</p>
      ${eta.scheduledArrival ? `<p class="eta-arrival-time">定刻 ${formatTime(eta.scheduledArrival)} ごろ</p>` : ''}
      <p class="eta-arrival-time">${formatTime(eta.estimatedArrival)} ごろ到着見込み</p>
      <p class="eta-dialect">もうすぐたい。</p>
    </div>
  `
}

function renderCandidateCard(params: {
  candidate: BusCandidate
  estimatedTripId?: string
  rank: number
  selectedTripId?: string
  tripUpdate?: TripUpdate
  tripUpdatesFetchStatus: GtfsRtCollectionFetchStatus
}): string {
  const { candidate, estimatedTripId, rank, selectedTripId, tripUpdate, tripUpdatesFetchStatus } = params
  const isEstimated = candidate.trip.id === estimatedTripId
  const isSelected = candidate.trip.id === selectedTripId
  const delayPresentation = resolveDelayPresentation(tripUpdate, tripUpdatesFetchStatus)

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
      ${candidate.isWithinMatchingRange ? '' : '<p class="status-badge">推定対象外</p>'}
      <p class="muted">遅延: ${delayPresentation.detailText}</p>
      <p class="muted">距離 約${Math.round(candidate.distanceMeters)}m / 信頼度 ${Math.round(candidate.confidence * 100)}%</p>
      <p class="muted">${candidate.reason}</p>
      <button class="candidate-select-button" data-trip-id="${candidate.trip.id}" type="button">
        ${isSelected ? 'このバスの選択を解除' : 'このバスを選ぶ'}
      </button>
    </li>
  `
}

function renderShell(root: HTMLElement, copy: string, body: string): void {
  root.innerHTML = `
    <main class="app-shell">
      <section class="hero">
        <div class="hero-copy">
          <h1 class="brand-title"><span class="brand-title-main">KumaNOR</span><span class="brand-title-accent">ETA</span></h1>
          <p class="hero-lead">${copy}</p>
        </div>
      </section>
      ${body}
    </main>
  `
}

export function renderLoadingApp(root: HTMLElement): void {
  renderShell(
    root,
    'いま乗っとるバス、いつ着くと？',
    `
      <section class="status-strip">
        <div class="status-chip"><span class="status-chip-label">状態</span><strong>読み込み中</strong><span>初期データを取得しています</span></div>
        <div class="status-chip"><span class="status-chip-label">路線</span><strong>候補スキャン</strong><span>周辺の車両を照合しています</span></div>
        <div class="status-chip"><span class="status-chip-label">ETA</span><strong>準備中</strong><span>表示領域を構成しています</span></div>
      </section>
      <section class="card stack-card">
        <h2>読み込み中</h2>
        <p class="muted">候補バス、遅延、ETA を準備しています。</p>
      </section>
    `,
  )
}

export function renderFatalError(root: HTMLElement): void {
  renderShell(
    root,
    'いま乗っとるバス、いつ着くと？',
    `
      <section class="card stack-card">
        <h2>エラー</h2>
        <p class="muted">ページを再読み込みしても直らない場合は、ブラウザの開発者ツールで詳細を確認してください。</p>
      </section>
    `,
  )
}

export function renderRuntimeError(root: HTMLElement, details?: FatalErrorDetails): void {
  const metadata = [
    details?.phase ? `<p><strong>発生箇所:</strong> ${details.phase}</p>` : '',
    details?.message ? `<p><strong>エラー:</strong> ${details.message}</p>` : '',
    details?.hint ? `<p><strong>想定原因:</strong> ${details.hint}</p>` : '',
  ]
    .filter(Boolean)
    .join('')

  const stack = details?.stack
    ? `
      <details class="fatal-stack">
        <summary>技術詳細を表示</summary>
        <pre>${details.stack}</pre>
      </details>
    `
    : ''

  renderShell(
    root,
    '画面の表示に失敗しました',
    `
      <section class="card stack-card">
        <h2>エラー</h2>
        <p class="muted">
          空白表示のままにならないよう、検出した例外をこの画面に切り替えています。
          ブラウザや通信の問題か、描画処理の例外かを下の情報で切り分けできます。
        </p>
        ${metadata ? `<div class="diagnostics-grid">${metadata}</div>` : ''}
        ${stack}
      </section>
    `,
  )
}

export function renderApp(params: {
  root: HTMLElement
  position: Coordinates
  activeCandidate?: BusCandidate
  activeTripUpdate?: TripUpdate
  estimatedCandidate?: BusCandidate
  candidates: BusCandidate[]
  diagnostics: BusEstimationDiagnostics
  eta?: EtaResult
  nearbyStops: NearbyStop[]
  destinationStops: Stop[]
  locationDebugOptions: LocationDebugOption[]
  onRefreshLocation: () => void | Promise<void>
  onSelectCandidate: (tripId: string) => void
  onSelectDestination: (stopId: string) => void
  onSelectLocationMode: (mode: LocationDebugMode) => void | Promise<void>
  selectedLocationMode: LocationDebugMode
  selectedDestinationStopId?: string
  selectedTripId?: string
  stops: Stop[]
  tripUpdatesByTripId: Map<string, TripUpdate>
  tripUpdatesFetchStatus: GtfsRtCollectionFetchStatus
  tripProgress?: TripProgress
}): void {
  const detailsOpenStates = captureDetailsOpenState(params.root)
  const {
    root,
    position,
    activeCandidate,
    activeTripUpdate,
    estimatedCandidate,
    candidates,
    diagnostics,
    eta,
    nearbyStops,
    destinationStops,
    locationDebugOptions,
    onRefreshLocation,
    onSelectCandidate,
    onSelectDestination,
    onSelectLocationMode,
    selectedLocationMode,
    selectedDestinationStopId,
    selectedTripId,
    stops,
    tripUpdatesByTripId,
    tripUpdatesFetchStatus,
    tripProgress,
  } = params

  const emptyState =
    diagnostics.totalVehicles === 0
      ? '車両データを取得できていません。通信状況かプロキシ設定を確認してください。'
      : diagnostics.matchedVehicles === 0
        ? '現在地の近くで一致する候補バスが見つかりませんでした。'
        : '候補バスはありますが、乗車中と判断できる車両はありませんでした。'

  const candidateSummary = selectedTripId
    ? `選択中のバスを含む候補 (${candidates.length}件)`
    : `近いバス候補を表示する (${candidates.length}件)`

  const nearbyStopsSummary =
    nearbyStops.length > 0 ? `近くの停留所を表示する (${nearbyStops.length}件)` : '近くの停留所を表示する'

  const activeDelayPresentation = resolveDelayPresentation(activeTripUpdate, tripUpdatesFetchStatus)
  const locationModeSummary = renderLocationModeSummary(selectedLocationMode, locationDebugOptions)
  const busDetectionState = activeCandidate ? '検出中' : '探索中'
  const routeTitle = activeCandidate?.route.longName ?? 'まだ候補バスを特定できていません'

  renderShell(
    root,
    'いま乗っとるバス、いつ着くと？',
    `
      <section class="status-strip">
        <div class="status-chip">
          <span class="status-chip-label">現在地</span>
          <strong>精度 約${Math.round(position.accuracyMeters)}m</strong>
          <span>緯度 ${position.latitude.toFixed(4)} / 経度 ${position.longitude.toFixed(4)}</span>
        </div>
        <div class="status-chip">
          <span class="status-chip-label">位置ソース</span>
          <strong>${renderPositionSource(diagnostics.positionSource)}</strong>
          <span>車両更新 ${formatTime(diagnostics.vehicleFetchedAt)}</span>
        </div>
        <div class="status-chip">
          <span class="status-chip-label">検出状態</span>
          <strong>${busDetectionState}</strong>
          <span>候補 ${diagnostics.candidateCount}件</span>
        </div>
      </section>

      <section class="priority-grid">
        ${
          activeCandidate
            ? `
              <details class="card stack-card collapsible-card bus-focus-panel" data-panel-id="bus-focus" ${renderDetailsOpenAttribute(detailsOpenStates, 'bus-focus', true)}>
                <summary class="bus-focus-summary">
                  <div class="bus-focus-summary-main">
                    <p class="route" style="--route-color:${activeCandidate.route.color}">${activeCandidate.route.shortName}</p>
                  </div>
                  <p class="bus-focus-summary-title">${routeTitle}</p>
                  <div class="bus-focus-summary-meta">
                    <p><span>現在位置</span><strong>${renderCurrentSegment(tripProgress)}</strong></p>
                    <p><span>遅延</span><strong>${activeDelayPresentation.detailText}</strong></p>
                  </div>
                </summary>
                <div class="collapsible-body bus-focus-body">
                  <div class="bus-focus-card">
                    <div class="bus-focus-facts">
                      <div class="info-pair">
                        <span>距離</span>
                        <strong>約${Math.round(activeCandidate.distanceMeters)}m</strong>
                      </div>
                      <div class="info-pair">
                        <span>信頼度</span>
                        <strong>${Math.round(activeCandidate.confidence * 100)}%</strong>
                      </div>
                    </div>
                    <p class="bus-focus-note">${activeCandidate.reason}</p>
                    ${
                      selectedTripId
                        ? `<button class="ghost-button" data-trip-id="${selectedTripId}" type="button">バス選択を解除</button>`
                        : '<p class="selection-note">候補が違うときは、下の一覧から切り替えできるけん安心です。</p>'
                    }
                  </div>

                  <div class="location-panel">
                    <div>
                      <p class="location-panel-label">GPS / 位置取得</p>
                      <p class="location-panel-copy">現在は ${locationModeSummary}</p>
                    </div>
                    <button class="gps-button" type="button" id="refresh-location">
                      <span class="gps-button-icon" aria-hidden="true"></span>
                      <span>GPSを取り直す</span>
                    </button>
                  </div>
                </div>
              </details>
            `
            : `
              <article class="card stack-card">
                <div class="section-heading">
                  <div>
                    <p class="panel-label">現在のバス</p>
                    <h2>乗車中の候補</h2>
                  </div>
                </div>
                <div class="empty-panel"><p>${emptyState}</p></div>
                <div class="location-panel">
                  <div>
                    <p class="location-panel-label">GPS / 位置取得</p>
                    <p class="location-panel-copy">現在は ${locationModeSummary}</p>
                  </div>
                  <button class="gps-button" type="button" id="refresh-location">
                    <span class="gps-button-icon" aria-hidden="true"></span>
                    <span>GPSを取り直す</span>
                  </button>
                </div>
              </article>
            `
        }

        <article class="card stack-card eta-card">
          <div class="section-heading section-heading-tight">
            <div>
              <p class="panel-label panel-label-accent">ETA Focus</p>
              <h2>降車停留所と残り時間</h2>
            </div>
          </div>

          ${renderEtaAccent(eta)}

          <div class="eta-controls">
            <label for="destination">降車停留所</label>
            <select id="destination" ${destinationStops.length > 0 ? '' : 'disabled'}>
              ${destinationStops
                .map(
                  (stop) =>
                    `<option value="${stop.id}" ${selectedDestinationStopId === stop.id ? 'selected' : ''}>${stop.name}</option>`,
                )
                .join('')}
            </select>
          </div>

          ${
            eta
              ? `
                <div class="eta-meta">
                  <p><span>残り距離</span><strong>約${Math.round(eta.remainingDistanceMeters)}m</strong></p>
                  <p><span>推定方法</span><strong>${eta.source === 'distance-model' ? '距離モデル推定' : eta.source}</strong></p>
                </div>
              `
              : '<p class="muted">乗車中のバスを特定すると ETA を表示します。</p>'
          }

          ${
            stops.length > 0
              ? `<p class="muted eta-footnote">この便の停留所数: ${stops.length} 件</p>`
              : '<p class="muted eta-footnote">バスを特定すると降車停留所を選べます。</p>'
          }
        </article>
      </section>

      <details class="card collapsible-card" data-panel-id="candidates" ${renderDetailsOpenAttribute(detailsOpenStates, 'candidates', !selectedTripId)}>
        <summary>${candidateSummary}</summary>
        <div class="collapsible-body">
          <div class="section-heading">
            <div>
              <h2>近いバス候補</h2>
              <p class="muted">自動推定の候補です。違う場合は手動で選択してください。</p>
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
                        tripUpdate: tripUpdatesByTripId.get(candidate.trip.id),
                        tripUpdatesFetchStatus,
                      }),
                    )
                    .join('')}
                </ol>`
              : `<p>${emptyState}</p>`
          }
        </div>
      </details>

      <details class="card collapsible-card" data-panel-id="nearby-stops" ${renderDetailsOpenAttribute(detailsOpenStates, 'nearby-stops', false)}>
        <summary>${nearbyStopsSummary}</summary>
        <div class="collapsible-body">
          <div class="section-heading">
            <div>
              <h2>近くの停留所</h2>
              <p class="muted">現在地から近い順に並べています。</p>
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

      <details class="card collapsible-card diagnostics-card" data-panel-id="diagnostics" ${renderDetailsOpenAttribute(detailsOpenStates, 'diagnostics', false)}>
        <summary>デバッグ情報を表示する</summary>
        <div class="collapsible-body">
          <div class="section-heading">
            <div>
              <h2>診断情報</h2>
              <p class="muted">動作確認用の内部状態です。</p>
            </div>
          </div>
          <div class="debug-controls">
            <label class="debug-controls-label" for="location-mode">位置デバッグ</label>
            <div class="debug-controls-row">
              <select id="location-mode" class="status-select debug-select">
                ${locationDebugOptions
                  .map(
                    (option) =>
                      `<option value="${option.id}" ${selectedLocationMode === option.id ? 'selected' : ''}>${option.label}</option>`,
                  )
                  .join('')}
              </select>
              <span class="muted debug-current-location">現在: ${locationModeSummary}</span>
            </div>
          </div>
          <div class="diagnostics-grid">
            <p><strong>位置ソース:</strong> ${renderPositionSource(diagnostics.positionSource)}</p>
            <p><strong>車両ソース:</strong> ${diagnostics.vehicleSource}</p>
            <p><strong>最終更新:</strong> ${formatTime(diagnostics.vehicleFetchedAt)}</p>
            <p><strong>総車両数:</strong> ${diagnostics.totalVehicles} 台</p>
            <p><strong>trip/route 一致:</strong> ${diagnostics.matchedVehicles} 台</p>
            <p><strong>近距離一致:</strong> ${diagnostics.nearbyMatchedVehicles} 台</p>
            <p><strong>候補件数:</strong> ${diagnostics.candidateCount} 件</p>
            <p><strong>TripUpdates:</strong> ${renderTripUpdatesStatus(tripUpdatesFetchStatus)}</p>
            <p><strong>選択 tripId:</strong> ${selectedTripId ?? '-'}</p>
            <p><strong>選択 routeId:</strong> ${activeCandidate?.trip.routeId ?? '-'}</p>
            <p><strong>推測 tripId:</strong> ${estimatedCandidate?.trip.id ?? '-'}</p>
            <p><strong>推測 routeId:</strong> ${estimatedCandidate?.trip.routeId ?? '-'}</p>
            <p><strong>表示 vehicleId:</strong> ${activeCandidate?.vehicle.vehicleId ?? '-'}</p>
            <p><strong>車両時刻:</strong> ${activeCandidate ? formatTime(activeCandidate.vehicle.timestamp) : '-'}</p>
            <p><strong>TripUpdate時刻:</strong> ${activeTripUpdate ? formatTime(activeTripUpdate.timestamp) : '-'}</p>
          </div>
          ${diagnostics.note ? `<p class="diagnostics-note">${diagnostics.note}</p>` : ''}
        </div>
      </details>
    `,
  )

  root.querySelectorAll<HTMLButtonElement>('[data-trip-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const tripId = button.dataset.tripId
      if (tripId) {
        onSelectCandidate(tripId)
      }
    })
  })

  root.querySelector<HTMLButtonElement>('#refresh-location')?.addEventListener('click', () => {
    void onRefreshLocation()
  })

  const destinationSelect = root.querySelector<HTMLSelectElement>('#destination')
  destinationSelect?.addEventListener('change', () => {
    if (destinationSelect.value) {
      onSelectDestination(destinationSelect.value)
    }
  })

  const locationModeSelect = root.querySelector<HTMLSelectElement>('#location-mode')
  locationModeSelect?.addEventListener('change', () => {
    void onSelectLocationMode(locationModeSelect.value as LocationDebugMode)
  })
}
