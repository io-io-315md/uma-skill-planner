# UMAPLAN

ウマ娘の対人戦に向けて、コース・作戦・育成キャラ・サポート編成からスキルと継承・白因子の準備を整理するWebアプリです。

**[アプリを開く](https://io-io-315md.github.io/uma-skill-planner/)**

## 使えること

- 11月京都芝3000m LoH、12月中山芝2500mチャンミのコース別スキル候補
- 全271衣装の育成キャラ、563枚のサポートカードの照合。覚醒は各キャラの最大Lvで判定
- PCではスキル一覧を2列表示。各スキルに高・中・低の優先度と理由を表示し、絞り込み可能
- キャラは衣装ごとのアイコン、サポカは各カードのイラストを表示（834点を同梱）
- 本育成のキャラ・6枚の編成から、レースごとに必要な継承固有の候補・白因子を表示
- 因子名をタップすると、因子周回のキャラ・編成案・イベント択・優先スキルを表示。周回側は別に編集・保存
- 所持ヒント・イベントと、白因子で補う候補・継承元の表示
- 45枚のカードの詳細イベント択。本育成は金スキル側、因子周回は目的の白スキル側も選択可能
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

優先度は攻略資料に基づく高・中・低の3段階の目安で、勝率や効果量のシミュレーション結果ではありません。全候補の取得を必須とするものでもありません。京都3000mでは右回り・秋ウマ娘を高、京都レース場を低に分けます。真髄・体は消費分も走り切れる持久力を確保する前提で高としています。発動条件や脚質による違い、出典は各スキルの詳細から確認できます。

編成別の因子周回記事は、サポートから取得できるスキルを因子目標から外している場合があります。その順位を取得優先度に直接転用せず、取得優先度と編成から不足する因子候補を別々に判定します。[優先度調査の整理](docs/priority-research.md)

「編成から取得候補」は、所持ヒントの抽選やイベントの条件を満たせば取得できる経路を表します。詳細択が未登録のイベントは「イベント条件を確認」と表示します。白因子候補は登録された取得経路との差分で、因子が必ず発動するという表示ではありません。

本育成では、金スキルと引き換えになる白スキル択を取得経路に含めません。たとえばパワーファインの金スキル側を使う場合、真髄・体は不足因子として残します。因子周回の編成では白スキル択を指定でき、本育成の編成・不足判定・準備済みチェックとは独立して保存します。旧版で本育成に設定した白択も補正します。

周回の編成案は対象因子と他の不足白因子の取得経路をまとめるための案です。実測の最適編成ではなく、所持・凸数・レースボーナス・相性は評価していません。各カードや周回キャラは変更できます。金スキルの因子化は扱わず、上位スキルを習得できる場合も対象は下位の白因子です。[本育成と因子周回の仕様](docs/factor-workflow.md)

キャラの進化スキルの効果量比較や、最終ステータスからの必要回復量の計算は行いません。本育成のシナリオ固有・共通イベント等は自動計上せず、各候補の「別ルートで取得する予定にする」で補います。因子周回では取得方法にURAを選ぶと真髄・体／力／速の対決イベントを候補に加えます。成功・習得・因子化を保証する表示ではありません。

## データ更新

`dist/recommendations.js`に公式開催条件・コース別推奨・参照元、`dist/priorities.js`にコース・脚質別の優先度と理由、`dist/data/catalog.json`にキャラ／サポートとスキルの対応を分離しています。動作時に外部DBを取りに行かないため、提供元の停止で照合が壊れません。

```sh
node tools/update-data.mjs
```

公開DBを`research/`へ取得します。`tools/build-data.mjs`の公開日カットオフ、推奨規則・開催予定を資料と照合して更新してから、次を実行します。

```sh
node tools/build-data.mjs
node tools/download-artwork.mjs
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
- [マチカネ競馬民｜2026年11月LoH準備](https://note.com/tender_peony946/n/nd895ce63b609)、[dai｜先行の因子設計](https://note.com/light_bear2389/n/n6bb1895d9c7d)、[逃げの因子設計](https://note.com/light_bear2389/n/n4767c0507205)
- [ウマ娘ラボ｜真髄スキルの解説](https://umamusumelabo.com/beginner/sinzui-skill-kaisetu)、[GameWith｜真髄・体](https://gamewith.jp/uma-musume/article/show/374185)
- [ウマ娘ラボ｜パワーファインのイベント択](https://umamusumelabo.com/chara_support/ssr-finemotion-power)、[Game8｜因子周回](https://game8.jp/umamusume/460250)、[GameWith｜URAの真髄取得](https://gamewith.jp/uma-musume/article/show/376170)

本ツールは非公式です。ゲーム・画像の権利は株式会社Cygames等の権利者に帰属します。キャラ・サポカ画像の取得元はGameToraで、各画像の取得元URLをカタログに記録しています。画像はローカル配信し、閲覧した画像をオフライン用にキャッシュします。保存先はブラウザーのlocalStorageで、プランをサーバーへ送信しません。Google Fontsを外部読み込みしますが、利用できない場合はシステムフォントを使います。
