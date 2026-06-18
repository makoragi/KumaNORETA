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

```bash
npm install
npm run dev
```

## ビルド

```bash
npm run build
```

## Local Preview

GitHub Pages へ出る production build をローカルで確認するには、以下を実行します。

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\local-build-check.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\local-pages-preview.ps1
```

`local-pages-preview.ps1` は `build` 後に `http://127.0.0.1:4173/KumaNORETA/` で preview を起動します。

## GitHub Pages公開

GitHub Actionsの `Deploy to GitHub Pages` ワークフローで `dist/` をGitHub Pagesへデプロイします。

リポジトリ名に合わせて `vite.config.ts` の `base` は `/KumaNORETA/` に設定しています。

## 今後の設計メモ

- [アーキテクチャ設計メモ](docs/architecture.md)
- [データソース整理](docs/data-sources.md)
