import type { BusCandidate, BusEstimationDiagnostics, Coordinates, EtaResult, NearbyStop, Stop } from '../types'

const formatTime = (date: Date) =>
  new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date)

export function renderLoadingApp(root: HTMLElement): void {
  root.innerHTML = `
    <main class="app-shell">
      <section class="hero">
        <p class="eyebrow">Kumamoto bus ride companion</p>
        <h1>KumaNORETA</h1>
        <p>GTFS-JP と車両データを読み込んでいます。</p>
      </section>

      <section class="card">
        <h2>読み込み中</h2>
        <p class="muted">初回は静的ダイヤデータの取得に少し時間がかかることがあります。</p>
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
        <p class="muted">ページを再読み込みしても改善しない場合は、ブラウザのキャッシュ削除を試してください。</p>
      </section>
    </main>
  `
}

function renderCandidateItem(candidate: BusCandidate, rank: number): string {
  return `
    <li class="candidate-item">
      <div class="candidate-item-header">
        <p class="route" style="--route-color:${candidate.route.color}">${candidate.route.shortName}</p>
        <p class="candidate-rank">候補 ${rank}</p>
      </div>
      <p class="candidate-title">${candidate.route.longName}</p>
      ${candidate.isWithinMatchingRange ? '' : '<p class="status-badge">推定範囲外・参考</p>'}
      <p class="muted">
        距離 約${Math.round(candidate.distanceMeters)}m / 信頼度 ${Math.round(candidate.confidence * 100)}%
      </p>
      <p class="muted">${candidate.reason}</p>
    </li>
  `
}

export function renderApp(params: {
  root: HTMLElement
  position: Coordinates
  candidate?: BusCandidate
  candidates: BusCandidate[]
  diagnostics: BusEstimationDiagnostics
  eta?: EtaResult
  stops: Stop[]
  nearbyStops: NearbyStop[]
}): void {
  const { root, position, candidate, candidates, diagnostics, eta, stops, nearbyStops } = params
  const emptyState =
    diagnostics.totalVehicles === 0
      ? '車両データを取得できませんでした。通信状況または配信元の状態を確認してください。'
      : diagnostics.matchedVehicles === 0
        ? '車両データは取得できましたが、路線・便データとの紐付けに失敗しました。'
        : '推定範囲内の車両はありません。下の「近いバス」に範囲外の車両を参考表示します。'

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
          <p class="muted">位置ソース ${diagnostics.positionSource}</p>
        </div>
        <div>
          <h2>推定中のバス</h2>
          ${
            candidate
              ? `<p class="route" style="--route-color:${candidate.route.color}">${candidate.route.shortName}</p>
                 <p>${candidate.route.longName}</p>
                 <p class="muted">
                   距離 約${Math.round(candidate.distanceMeters)}m / 信頼度 ${Math.round(candidate.confidence * 100)}%
                 </p>
                 <p class="muted">${candidate.reason}</p>`
              : `<p>${emptyState}</p>`
          }
        </div>
      </section>

      <section class="card diagnostics-card">
        <div class="section-heading">
          <h2>候補診断</h2>
          <p class="muted">候補が出ないときの切り分け用です。</p>
        </div>
        <div class="diagnostics-grid">
          <p><strong>車両ソース:</strong> ${diagnostics.vehicleSource}</p>
          <p><strong>最終更新:</strong> ${formatTime(diagnostics.vehicleFetchedAt)}（15秒間隔）</p>
          <p><strong>取得車両数:</strong> ${diagnostics.totalVehicles}件</p>
          <p><strong>trip/route 紐付け成功:</strong> ${diagnostics.matchedVehicles}件</p>
          <p><strong>推定範囲内の紐付け成功車両:</strong> ${diagnostics.nearbyMatchedVehicles}件</p>
          <p><strong>表示候補数:</strong> ${diagnostics.candidateCount}件</p>
        </div>
        ${
          diagnostics.note
            ? `<p class="diagnostics-note">${diagnostics.note}</p>`
            : ''
        }
      </section>

      <section class="card">
        <div class="section-heading">
          <h2>近いバス候補</h2>
          <p class="muted">距離制限を設けず、取得できた車両を現在地に近い順で最大3件表示します。</p>
        </div>
        ${
          candidates.length > 0
            ? `<ol class="candidate-list">${candidates.map((item, index) => renderCandidateItem(item, index + 1)).join('')}</ol>`
            : `<p>${emptyState}</p>`
        }
      </section>

      <section class="card">
        <div class="section-heading">
          <h2>現在地に近いバス停</h2>
          <p class="muted">車両候補の有無にかかわらず表示します。</p>
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
            : '<p>静的データにバス停がありません。データ取得状態を確認してください。</p>'
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
               <p class="muted">あと約${eta.minutesUntilArrival}分（${eta.source === 'mock' ? 'モック計算' : 'GTFS-RT'}）</p>`
            : '<p>先頭候補が確定したら ETA を表示します。</p>'
        }
      </section>
    </main>
  `
}
