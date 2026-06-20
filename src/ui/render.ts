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

function renderSelectionMode(selectedTripId?: string): string {
  return selectedTripId ? '手動選択中' : '自動推定中'
}

function renderLocationModeSummary(
  selectedLocationMode: LocationDebugMode,
  locationDebugOptions: LocationDebugOption[],
): string {
  return locationDebugOptions.find((option) => option.id === selectedLocationMode)?.label ?? 'GPSを使う'
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
        <p class="muted">候補バス、遅延、ETA を準備しています。</p>
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
        <p class="muted">ページを再読み込みしても直らない場合は、ブラウザの開発者ツールで詳細を確認してください。</p>
      </section>
    </main>
  `
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

  root.innerHTML = `
    <main class="app-shell">
      <section class="hero">
        <p class="eyebrow">Kumamoto bus ride companion</p>
        <h1>KumaNORETA</h1>
        <p>いま乗っているバスを推定して、次の降車停留所までの到着見込みを表示します。</p>
      </section>

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
          <span class="status-chip-label">推定モード</span>
          <strong>${renderSelectionMode(selectedTripId)}</strong>
          <span>候補 ${diagnostics.candidateCount}件</span>
        </div>
      </section>

      <section class="priority-grid">
        <article class="card priority-card">
          <div class="section-heading">
            <div>
              <p class="panel-label">最優先表示</p>
              <h2>乗車中のバス</h2>
            </div>
            ${activeCandidate ? `<p class="mode-pill ${selectedTripId ? 'mode-pill-selected' : ''}">${renderSelectionMode(selectedTripId)}</p>` : ''}
          </div>
          ${
            activeCandidate
              ? `
                <p class="route" style="--route-color:${activeCandidate.route.color}">${activeCandidate.route.shortName}</p>
                <p class="candidate-title primary-title">${activeCandidate.route.longName}</p>
                <p class="delay-summary">
                  <span class="delay-badge ${activeDelayPresentation.badgeClass}">${activeDelayPresentation.badgeText}</span>
                  <span>${activeDelayPresentation.detailText}</span>
                </p>
                <p class="muted">距離 約${Math.round(activeCandidate.distanceMeters)}m / 信頼度 ${Math.round(activeCandidate.confidence * 100)}%</p>
                <p class="segment-note">現在位置: ${renderCurrentSegment(tripProgress)}</p>
                <p class="muted">${activeCandidate.reason}</p>
                ${
                  selectedTripId
                    ? `<button class="ghost-button" data-trip-id="${selectedTripId}" type="button">バス選択を解除</button>`
                    : '<p class="selection-note">候補が違う場合は、下の一覧から手動で切り替えできます。</p>'
                }
              `
              : `<p>${emptyState}</p>`
          }
        </article>

        <article class="card priority-card eta-card">
          <div class="section-heading">
            <div>
              <p class="panel-label">次に降りる</p>
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
                  <p>${eta.source === 'distance-model' ? '距離モデル推定' : eta.source}</p>
                </div>
              `
              : '<p>乗車中のバスを特定すると ETA を表示します。</p>'
          }
          ${
            stops.length > 0
              ? `<p class="muted">この便の停留所数: ${stops.length} 件</p>`
              : '<p class="muted">バスを特定すると降車停留所を選べます。</p>'
          }
        </article>
      </section>

      <details class="card collapsible-card" ${selectedTripId ? '' : 'open'}>
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

      <details class="card collapsible-card">
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

      <details class="card collapsible-card diagnostics-card">
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

  const locationModeSelect = root.querySelector<HTMLSelectElement>('#location-mode')
  locationModeSelect?.addEventListener('change', () => {
    onSelectLocationMode(locationModeSelect.value as LocationDebugMode)
  })
}
