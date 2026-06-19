# データソース整理

## GTFS-JP

- 配置場所: `data/gtfs-jp/toshibus/`
- 配信元: `https://km.bus-vision.jp/gtfs/toshibus/gtfsFeed`
- 想定ファイル: `stops.txt`, `routes.txt`, `trips.txt`, `stop_times.txt`, `calendar.txt`, `agency.txt`
- 同期コマンド: `pnpm gtfs:sync`
- ブラウザ読込用の生成物: `public/gtfs/toshibus-static.json`
- 利用想定: 停留所、路線、便、停車順、営業日情報を取得する

## GTFS-Realtime

- 配置場所: Cloudflare Workerのエッジプロキシ経由で取得
- 種別: VehiclePositions, TripUpdates, ServiceAlerts
- 利用想定: WorkerがCORSを付与し、ブラウザが15秒ごとに取得する
- 熊本都市バスの公開GTFS-RT:
  - `TripUpdates`: `https://km.bus-vision.jp/realtime/toshibus_trip_update.bin`
  - `VehiclePositions`: `https://km.bus-vision.jp/realtime/toshibus_vpos_update.bin`
  - `Alerts`: `https://km.bus-vision.jp/realtime/toshibus_alrt_update.bin`
- `VehiclePosition` 取得設定:
  - `worker/`をCloudflare Workersへデプロイし、Repository Variable `VITE_GTFS_RT_PROXY_URL` にWorkerのURLを設定する
  - ブラウザは `${VITE_GTFS_RT_PROXY_URL}/vehicle-positions` を15秒ごとに読み込む
  - Worker側では上流への負荷を抑えながら鮮度を保つため10秒だけキャッシュする
  - `CLOUDFLARE_API_TOKEN`と`CLOUDFLARE_ACCOUNT_ID`をRepository Secretsに設定すると専用ワークフローでWorkerをデプロイできる
  - `VITE_GTFS_RT_VEHICLE_POSITIONS_URL`: ブラウザが読むVehiclePositions URLを明示的に変更する場合に使用
  - GitHub Actionsでは同じRepository Variableを上流VehiclePositionsの取得URLとして使用する
  - `VITE_GTFS_RT_TRIP_UPDATES_URL`: TripUpdates の配信URL
  - `VITE_GTFS_RT_ALERTS_URL`: Alerts の配信URL
  - `VITE_GTFS_RT_USE_MOCK`: `false` にすると実データ取得を有効化。未設定または `false` 以外はモックを使う
  - `VITE_GTFS_RT_API_KEY`: 必要な場合のAPIキー
  - `VITE_GTFS_RT_API_KEY_HEADER`: APIキー送信ヘッダ名。既定値は `x-api-key`
  - `VITE_GTFS_RT_AUTH_TOKEN`: Bearer トークンが必要な場合に使用

## サンプルデータ

- 配置場所: `data/samples/`
- 用途: 開発・テスト用の最小データセット
