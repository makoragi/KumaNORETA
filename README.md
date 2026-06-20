# KumaNORETA（くまのれた）

KumaNORETAは、熊本県内のGTFS-JP / GTFS-RealtimeデータとスマートフォンGPSを活用し、現在乗車中のバスを推定して降車停留所への到着予想時刻（ETA）を表示するWebアプリです。

名前は「熊本」+「乗れた」+「NOR-ETA」から来ています。

## コンセプト

Googleマップなどの経路検索は「乗る前」の案内に強い一方で、KumaNORETAは「乗った後」の支援に特化します。

- 今、自分がどのバスに乗っているかを推定する
- 降りたい停留所を選ぶ
- 到着予想時刻を表示する
- 家族への迎車共有に使える情報を出す

## MVPで用意したもの

- Vite + TypeScriptのWebアプリ土台
- Web App ManifestとService WorkerによるPWAの最小構成
- GitHub Pages公開用のVite `base`設定とActionsワークフロー
- GPS / GTFS-RT / GTFS-JP / 乗車中バス推定 / ETA / UI表示の責務分離
- モックデータによる推定結果とETA表示
- `docs/`配下の設計ドキュメント雛形
- `data/`配下のGTFS-JP、GTFS-RT、サンプルデータ配置先

## 技術スタック

- TypeScript
- Vite
- PWA
- GitHub Pages
- GTFS-JP
- GTFS-Realtime

## ディレクトリ構成

```text
.
├── .github/workflows/deploy.yml  # GitHub Pagesデプロイ
├── data/                         # GTFS-JP/GTFS-RT/サンプルデータ配置先
├── docs/                         # 設計ドキュメント
├── public/                       # PWA manifest / service worker / icon
└── src/
    ├── domain/                   # 推定・ETAなどのドメインロジック
    ├── mocks/                    # MVP用モックデータ
    ├── services/                 # GPS / GTFS取得・読込
    ├── ui/                       # UI描画
    ├── main.ts                   # アプリ起動
    └── types.ts                  # 共有型定義
```

## 開発

Codex 同梱ランタイムかローカル Node.js を使う前提で、依存関係は `pnpm-lock.yaml` に固定しています。

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm` や `corepack` が使えない環境では、ローカルに入っている `node` とリポジトリ内の `node_modules` を直接使えます。

```powershell
node .\node_modules\vite\bin\vite.js --host 0.0.0.0
```

現在地推定をテストしたい場合は、`.env` に以下を設定すると GPS を固定値で上書きできます。

```bash
VITE_GPS_OVERRIDE_ENABLED=true
VITE_GPS_OVERRIDE_LATITUDE=32.8031
VITE_GPS_OVERRIDE_LONGITUDE=130.7079
VITE_GPS_OVERRIDE_ACCURACY_METERS=10
```

`VITE_GPS_OVERRIDE_ENABLED=true` のときだけ有効です。無効時は従来どおりブラウザ GPS を使い、取得できなければモック位置へフォールバックします。

## ビルド

```bash
pnpm build
```

`pnpm` なしで実行する場合:

```powershell
node .\node_modules\typescript\bin\tsc
node .\node_modules\vite\bin\vite.js build
```

## GTFS-JP Sync
```powershell
pnpm gtfs:sync
```

`pnpm gtfs:sync` は熊本都市バスのGTFS-JP配信 (`https://km.bus-vision.jp/gtfs/toshibus/gtfsFeed`) を取得し、展開済みデータを `data/gtfs-jp/toshibus/` に、ブラウザ読込用の正規化JSONを `public/gtfs/toshibus-static.json` に生成します。

4事業者統合版を生成する場合:

```powershell
pnpm gtfs:sync:all
```

`pnpm` なしで実行する場合は、PowerShell スクリプトを直接呼び出してください。

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sync-gtfs-jp.ps1 -DatasetId toshibus
powershell -ExecutionPolicy Bypass -File .\scripts\sync-gtfs-jp.ps1 -DatasetId all
```

`VITE_TRANSIT_DATASET=all` を使う前に、必ず `-DatasetId all` か `pnpm gtfs:sync:all` で `public/gtfs/kumamoto-buses-static.json` を生成してください。未生成のままでもアプリは熊本都市バス単体へフォールバックしますが、4事業者統合モードにはなりません。
詳細は [docs/gtfs-jp-sync.md](docs/gtfs-jp-sync.md) を参照してください。

## Local Preview

GitHub Pages へ出る production build をローカルで確認するには、以下を実行します。

```powershell
pnpm check:pages
pnpm preview:pages
```

`pnpm` がグローバルに無い環境でも、PowerShell スクリプト側で Codex 同梱ランタイムの `pnpm` / `node` にフォールバックします。

`preview:pages` は `build` 後に `http://127.0.0.1:4173/KumaNORETA/` で preview を起動します。GitHub Pages と同じ `base` パス配下で確認してください。

## GitHub Pages公開

GitHub Actions の `Deploy to GitHub Pages` ワークフローでは `corepack` 経由の `pnpm install --frozen-lockfile` と `pnpm build` を使い、ローカル preview と同じ依存関係・同じビルド手順で `dist/` を GitHub Pages へデプロイします。

リポジトリ名に合わせて `vite.config.ts` の `base` は `/KumaNORETA/` に設定しています。

## 今後の設計メモ

- [アーキテクチャ設計メモ](docs/architecture.md)
- [データソース整理](docs/data-sources.md)
