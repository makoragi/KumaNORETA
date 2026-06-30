# アーキテクチャ設計メモ

## 概要

KumaNORETA は、スマートフォンの GPS と GTFS-JP / GTFS-Realtime を組み合わせて、現在地付近のバス候補と到着見込みを表示するブラウザアプリです。

## 主な構成

- GPS 取得: ブラウザの Geolocation API から現在地を取得する
- GTFS-RT 取得: `VehiclePositions` と `TripUpdates` を取得する
- GTFS-JP 読み込み: 事業者別または全事業者結合の静的 GTFS JSON を読み込む
- 候補バス推定: GPS と車両位置を照合して近い便を推定する
- ETA 表示: GTFS-RT と仮の ETA ロジックを使って到着見込みを出す
- UI 表示: 候補、信頼度、停留所、ETA を描画する

## GTFS-Realtime の扱い

- アプリが現在参照している GTFS-RT は `VehiclePositions` と `TripUpdates` のみ
- `VITE_TRANSIT_DATASET` に応じて単独事業者または全事業者の GTFS-RT を読む
- `Alerts` の上流 URL は設定ファイルにあるが、取得処理・表示処理とも未実装
- Cloudflare Worker は CORS 回避と短時間キャッシュのためのプロキシとして使う
- `VITE_GTFS_RT_PROXY_URL` は Worker のベース URL で、VehiclePositions と TripUpdates の両方に使う

## 事業者対応

- 対応事業者は `config/transit-operators.json` で管理する
- 現在の対象は `toshibus`, `sankobus`, `kumabus`, `dentetsu`
- `VITE_TRANSIT_DATASET=all` のときは全事業者をまとめて読み込む
- `VITE_TRANSIT_DATASET` が個別値のときはその事業者だけを読み込む

## MVP 前提

- 初期段階ではモックデータで画面と推定ロジックを成立させる
- 実データ取得は `VITE_GTFS_RT_USE_MOCK=false` のときに有効化する
