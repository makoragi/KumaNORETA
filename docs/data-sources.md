# データソース整理

## GTFS-JP

- 事業者ごとの取得元は `config/transit-operators.json` に定義している
  - `toshibus`: `https://km.bus-vision.jp/gtfs/toshibus/gtfsFeed`
  - `sankobus`: `https://km.bus-vision.jp/gtfs/sankobus/gtfsFeed`
  - `kumabus`: `https://km.bus-vision.jp/gtfs/kumabus/gtfsFeed`
  - `dentetsu`: `https://km.bus-vision.jp/gtfs/dentetsu/gtfsFeed`
- 展開先: `data/gtfs-jp/{operatorId}/`
- 主なファイル: `stops.txt`, `routes.txt`, `trips.txt`, `stop_times.txt`, `calendar.txt`, `agency.txt`
- 同期コマンド:
  - 単独事業者: `pnpm gtfs:sync`
  - 全事業者結合: `pnpm gtfs:sync:all`
- ブラウザ向け生成物:
  - 単独事業者: `public/gtfs/{operatorId}-static.json`
  - 全事業者結合: `public/gtfs/kumamoto-buses-static.json`

## GTFS-Realtime

- 上流フィード種別:
  - `VehiclePositions`
  - `TripUpdates`
  - `Alerts` (`ServiceAlerts`)
- 熊本の各事業者ごとに上流 URL は `config/transit-operators.json` に定義している

### Cloudflare Worker でホストしているもの

- `VITE_GTFS_RT_PROXY_URL` には Cloudflare Worker のベース URL を設定する
- Worker 実装は `worker/src/index.js`
- Worker が公開しているエンドポイントは次の 2 系統のみ
  - `${VITE_GTFS_RT_PROXY_URL}/vehicle-positions`
  - `${VITE_GTFS_RT_PROXY_URL}/trip-updates`
- 事業者別エンドポイントもある
  - `${VITE_GTFS_RT_PROXY_URL}/vehicle-positions/{operatorId}`
  - `${VITE_GTFS_RT_PROXY_URL}/trip-updates/{operatorId}`
- 現状、`/alerts` エンドポイントは Worker に存在しない

### フロントエンドで実際に使っているもの

- `fetchVehiclePositions()` は Worker または上流の `VehiclePositions` を読む
- `fetchTripUpdatesWithStatus()` は Worker または上流の `TripUpdates` を読む
- どちらも実装は `src/services/gtfsRt.ts` にある
- 対象事業者は `VITE_TRANSIT_DATASET` に応じて切り替わる
  - 単独事業者ならその事業者のみ読む
  - `all` なら `config/transit-operators.json` の全事業者を読む
- `Alerts` を取得する処理は現状存在しない

### 環境変数の意味

- `VITE_GTFS_RT_PROXY_URL`: Cloudflare Worker のベース URL。VehiclePositions と TripUpdates の両方で使う
- `VITE_GTFS_RT_VEHICLE_POSITIONS_URL`: `toshibus` 単独表示時に限り、VehiclePositions 直取得先を上書きする場合に使う
- `VITE_GTFS_RT_TRIP_UPDATES_URL`: `toshibus` 単独表示時に限り、TripUpdates 直取得先を上書きする場合に使う
- `VITE_GTFS_RT_ALERTS_URL`: 型定義にはあるが、現状のアプリでは未使用
- `VITE_GTFS_RT_USE_MOCK`: `false` のときだけ実データを使う。それ以外はモック
- `VITE_GTFS_RT_API_KEY`: 必要な場合の API キー
- `VITE_GTFS_RT_API_KEY_HEADER`: API キー送信ヘッダ名。既定値は `x-api-key`
- `VITE_GTFS_RT_AUTH_TOKEN`: Bearer トークンが必要な場合に使う

### Cloudflare Worker の設定

- Worker 名と上流 URL 定義は `worker/wrangler.toml` にある
- 現状の `vars` にあるのは VehiclePositions / TripUpdates 用のみ
- 事業者別にも `*_TOSHIBUS`, `*_SANKOBUS`, `*_KUMABUS`, `*_DENTETSU` が定義されている
- `Alerts` 用の Worker 環境変数は定義されていない

## サンプルデータ

- 配置場所: `data/samples/`
- 用途: 開発・検証用のサンプルデータセット
