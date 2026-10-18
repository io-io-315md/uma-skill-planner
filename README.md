# UMAPLAN

ウマ娘の対人戦に向けて、コース・作戦・育成キャラ・サポート編成からスキルと継承・白因子の準備を整理するWebアプリです。

**[アプリを開く](https://io-io-315md.github.io/uma-skill-planner/)**

## 使えること

- 11月京都芝3000m LoH、12月中山芝2500mチャンミのコース別スキル候補
- 全271衣装の育成キャラ、563枚のサポートカード、覚醒Lv1〜7の照合
- 所持ヒント・イベントと、白因子で補う候補・継承元の表示
- 45枚のカードの詳細イベント択。未指定の択は取得経路に含めません
- 金スキルと下位白の区別、同キャラサポートの併用防止
- 継承進化の本人所持・直接親条件、9人／12人の順位条件の区別
- 準備チェック、候補の見送り、シナリオ等の手動取得経路
- 複数プランの端末保存、TXTコピー、JSON書き出し・読み込み
- スマートフォン対応、ホーム画面への追加、初回アクセス後のオフライン利用

2026年10月18日確認。10月チャンミは対象外。2027年1〜3月は公式予定だけ表示し、未発表コースの推奨は出しません。

## 起動

Node.js 22以降。外部パッケージのインストールは不要です。

```sh
node tools/serve.mjs
```

ブラウザーで http://127.0.0.1:4173 を開きます。`file://`で直接開くとJSONを読み込めません。

```sh
node tools/validate-data.mjs
node --test
```

npmがある環境では `npm start`、`npm run check`、`npm test` も使えます。

## GitHub Pages

`dist/`だけで動く静的アプリです。このリポジトリはGitHub Pagesを設定済みで、mainへのpush後にチェック・公開を行います。手動実行もできます。フォークして利用する場合は、Settings → Pages → Sourceを「GitHub Actions」に設定してください。推論・APIキー・バックエンドは不要です。Pagesの利用可否はリポジトリの公開範囲とGitHubプランによります。[GitHub公式手順](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

## 判定の範囲

優先度は攻略資料に基づく編集上の目安で、勝率や効果量のシミュレーション結果ではありません。全候補の取得を必須とするものでもありません。

「編成から取得候補」は、所持ヒントの抽選やイベントの条件を満たせば取得できる経路を表します。詳細択が未登録のイベントは「イベント条件を確認」と表示します。白因子候補は登録された取得経路との差分で、因子が必ず発動するという表示ではありません。

キャラの進化スキルの効果量比較や、最終ステータスからの必要回復量の計算は行いません。育成シナリオ固有・共通イベント等も自動で計上せず、各候補の「別ルートで取得する予定にする」で補います。シナリオ報酬は択や成功条件を持つため、無条件に取得済みとは扱いません。

## データ更新

`dist/recommendations.js`に公式開催条件・コース別推奨・参照元、`dist/data/catalog.json`にキャラ／サポートとスキルの対応を分離しています。動作時に外部DBを取りに行かないため、提供元の停止で照合が壊れません。

```sh
node tools/update-data.mjs
```

公開DBを`research/`へ取得します。`tools/build-data.mjs`の公開日カットオフ、推奨規則・開催予定を資料と照合して更新してから、次を実行します。

```sh
node tools/build-data.mjs
node tools/validate-data.mjs
node --test
```

自動ダウンロードだけではコース条件・推奨・新カードのイベント択は更新されません。出典の日付・現行仕様を確認してください。

## 出典

- [Cygames｜10月〜3月 対戦レースイベント](https://dmg.umamusume.jp/news/detail/?id=3483)
- [GameTora｜日本版スキル・育成キャラ・サポートカードDB](https://gametora.com/ja/umamusume)（公開マニフェストから取得）
- [ウマ娘ラボ｜2026年11月 京都3000m](https://umamusumelabo.com/event/loh/loh-kyoto3000-202611)
- [GameWith｜2026年12月 チャンミ長距離](https://gamewith.jp/uma-musume/article/show/578925)
- [神ゲー攻略｜11月LoH](https://kamigame.jp/umamusume/page/438640407664972073.html)、[12月チャンミ](https://kamigame.jp/umamusume/page/443708416242747935.html)
- [Tsuyuchan-jp/umamusume-data](https://github.com/Tsuyuchan-jp/umamusume-data)（スキル階層・45枚のイベント択）
- [GameWith｜継承進化スキル](https://gamewith.jp/uma-musume/article/show/574331)、[U-tools｜連綿](https://xn--gck1f423k.xn--1bvt37a.tools/skills/204622)

本ツールは非公式です。ゲームの権利は株式会社Cygames等の権利者に帰属します。保存先はブラウザーのlocalStorageで、プランをサーバーへ送信しません。Google Fontsを外部読み込みしますが、利用できない場合はシステムフォントを使います。
