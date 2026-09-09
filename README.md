# 星読み（自分専用ホロスコープアプリ）

出生データから**天文学的に正確な**ホロスコープを計算する、自分専用の占星術ウェブアプリ。
Windows で開発し、完成後は iPhone の Safari で開いて「ホーム画面に追加」してアプリのように使う。
将来的に四柱推命アプリと統合する前提で設計している。

- サーバー不要・完全クライアント動作（GitHub Pages で無料公開可能）
- 開発者登録・課金は一切不要
- データはスマホ内（localStorage）に保存

## できること（現状：フェーズ1〜4完了）

- 入力：生年月日／出生時刻（分単位）／出生地（地名検索・緯度経度自動）
- 計算：太陽星座・月星座・アセンダント／10天体＋ドラゴンヘッドの黄経／プラシーダス・ハウス／アスペクト
- 表示：ホロスコープ・ホイール（SVG）／天体配置表／ハウス表／アスペクト一覧
- カテゴリ別ビュー（総合／金運／恋愛・結婚／健康／仕事・キャリア／対人）
  各カテゴリで意味を持つ配置（星座・ハウス・支配星・アスペクト）を選び、
  参照データと配置データを合成して解説文を表示。解説データは `src/interpret/` にあり追記で充実可能。
- 時期運（トランジット）：基準日を指定し、現在の天体運行と出生図の関係
  （木星〜冥王星のアスペクト・ハウス通過、正確化のおおよその時期）を計算・表示
- プロフィールの保存・切替・バックアップ書き出し／読み込み

## 精度について

- 天体位置：`astronomy-engine`（VSOP87 / ELP2000 準拠）。その日の分点基準（トロピカル）の視黄経。
  NASA JPL Horizons と比較して **誤差およそ 1 分角**。
- アセンダント・MC：恒星時・黄道傾斜・緯度からの球面三角計算。
  `astronomy-engine` の地平座標変換で「実際に地平線上／子午線上にあるか」を自動テストで検証済み。
- プラシーダス・ハウス：半昼弧を時間で 3 分割する古典的反復法。中間カスプが
  「時角 ＝ 係数 × 半昼弧」を満たすことを自動テストで検証済み。
- タイムゾーン：`tz-lookup`（緯度経度→IANA）＋ Luxon（歴史的サマータイム込みで UTC 変換）。
  国境付近など判定が怪しい場合は「固定 UTC オフセット」を手動指定できる。

## 開発

```bash
npm install
npm run dev        # 開発サーバー http://localhost:5173
npm run build      # 型チェック＋本番ビルド → dist/
npm run preview    # ビルド結果の確認
npm test           # 計算の自己検証（Node 標準テストランナー）
npm run icons      # SVG から PWA/iOS 用 PNG アイコンを再生成
```

必要環境：Node 20 以上（開発は Node 24 で確認）。

## iPhone で「アプリ化」する手順

1. GitHub Pages の URL（下記で公開後）を iPhone の Safari で開く。
   ※ 公開前に試すだけなら、同じ Wi-Fi 上で `npm run dev -- --host` して `http://<PCのIP>:5173`。
2. 画面下の共有ボタン → 「ホーム画面に追加」。
3. 追加されたアイコンから起動すると、アドレスバーなしの全画面（standalone）で動く。
   HTTPS（GitHub Pages）ならオフラインでも起動する（Service Worker が本番ビルドで有効）。

## GitHub Pages への公開手順

このフォルダ（`astro-app`）を**単独のリポジトリの直下**として公開する前提。
`.github/workflows/deploy.yml` を同梱しており、`main` へ push すると自動でビルド→デプロイする。

1. GitHub で新しいリポジトリを作る（例: `hoshiyomi`）。GitHub Pages を無料で使うなら **public** にする。
   このアプリはサーバー・APIキー不要で、公開しても差し支えないコードのみ。
2. このフォルダで初回コミットして push（`git init` 済みなら push だけ）:

   ```bash
   git remote add origin https://github.com/<ユーザー名>/<リポジトリ名>.git
   git branch -M main
   git push -u origin main
   ```

3. GitHub のリポジトリ → **Settings → Pages → Build and deployment → Source** を
   **「GitHub Actions」** に設定する。
4. 以降 `main` に push するたびに Actions が走り、数分で
   `https://<ユーザー名>.github.io/<リポジトリ名>/` に反映される。

- `vite.config.ts` の `base: './'` によりリポジトリ名に依存せず動く。
- 別リポジトリのサブフォルダに置く場合は、ワークフローに `working-directory` と
  `path` / `cache-dependency-path` を追加してそのフォルダを指す。

## データ保存と四柱推命アプリとの統合

- 出生データの共通スキーマは [`src/domain/birthData.ts`](src/domain/birthData.ts) に定義。
  これを**両アプリで共有する契約**として扱う（`schemaVersion` で版管理）。
- 計算層（`src/astro/`）と解釈層（`src/interpret/`）を分離しているため、
  将来は同じ器に「四柱推命モジュール」を並べて載せられる。
- プロフィールのエクスポート JSON（`{ kind: "astro-app/profiles", version, profiles }`）を
  四柱推命アプリ側の入力に流用する想定。

## ディレクトリ

```
src/
  domain/      出生データの共通スキーマ・プロフィール永続化
  geo/         地名検索（内蔵cities.json＋Nominatim）・タイムゾーン解決
  astro/       天体位置・ハウス・アスペクト・チャート組み立て
  interpret/   カテゴリ別分析（解説データはフェーズ3で拡充）
  ui/          画面（フォーム・ホイールSVG・結果表示）
public/
  data/cities.json   内蔵の主要地点データ
  icons/             アプリアイコン
  sw.js              Service Worker（オフライン対応）
test/          計算の自己検証
```

## ロードマップ

- ~~フェーズ3：ネイタルのカテゴリ別解説文~~（完了）
- ~~フェーズ4：トランジット計算と時期運の表示~~（完了 / `src/astro/transits.ts`・`src/interpret/transit/`）
- ~~フェーズ5：PWA 仕上げ・公開手順の整備~~（完了。あとは GitHub でリポジトリを作って push するだけ）
- 将来：四柱推命モジュールの統合、True Node/Mean Node 切替、キロン等の追加天体、ハウス方式の選択、解説データの拡充、プログレス（二次進行）
