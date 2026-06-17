# データソース整理

## GTFS-JP

- 配置場所: `data/gtfs-jp/`
- 想定ファイル: `stops.txt`, `routes.txt`, `trips.txt`, `stop_times.txt`, `calendar.txt`, `agency.txt`
- 注意点: 事業者ごとの差異、文字コード、更新頻度を確認する。

## GTFS-Realtime

- 配置場所: `data/gtfs-rt/` または外部エンドポイントから取得
- 想定フィード: VehiclePositions, TripUpdates, ServiceAlerts
- 注意点: CORS、APIキー、protobufデコード方法を確認する。

## サンプルデータ

- 配置場所: `data/samples/`
- 用途: 開発・テスト・デモ用の最小データセット。
