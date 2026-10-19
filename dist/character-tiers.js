// 執筆者本人の当該開催向け公開情報を比較した編集評価。実測勝率ではない。
export const TIER_VERIFIED_AT = '2026-10-19';
export const TIER_ORDER = ['S', 'A', 'B'];
export const TIER_LABELS = { S:'突出した最有力', A:'有力候補', B:'編成・条件次第' };
export const TIER_SOURCES = {
  kyotoLab: {
    name:'ルネ｜ウマ娘ラボ', courseId:'2026-11-loh', platform:'blog', publishedAt:'2026-10-14', contentAsOf:'2026-10-14',
    title:'11月LoH・京都3000mの必須知識とおすすめウマ娘',
    url:'https://umamusumelabo.com/event/loh/loh-kyoto3000-202611',
    scope:'2026年11月LoH・京都芝3000m',
    note:'6衣装のおすすめ度と先行中心の環境評価を参照。'
  },
  kyotoNeko: {
    name:'Neko長明｜note', courseId:'2026-11-loh', platform:'note', publishedAt:'2026-10-03', contentAsOf:'2026-10-03',
    title:'ウマ娘、１１月LoHの先行を考える',
    url:'https://note.com/neko_chomei/n/nd60a8bf6f5d4',
    scope:'2026年11月LoH・先行比較',
    note:'公開部分の本育成キャラ比較を参照。順位条件による不発と安定性を重視。親候補の表とは区別し、有料部分は使用しない。'
  },
  kyotoMammoth: {
    name:'20マンモス｜note', courseId:'2026-11-loh', platform:'note', publishedAt:'2026-10-07', contentAsOf:'2026-10-07',
    title:'長距離リグヒ(2026年11月)メモ',
    url:'https://note.com/200000is/n/ne3b44f91b8a0',
    scope:'2026年11月LoH・京都芝3000m',
    note:'強そうなウマの候補と覚醒Lv7マックイーンへの言及を参照。候補間の順位付けはなく、新シナリオ予想は確定情報として使わない。'
  }
};
const evidence = (source, note) => ({ source, note });
const entry = (characterId, costume, tier, styles, reason, caution, opinions, options={}) =>
  ({ characterId, costume, tier, styles, reason, caution, opinions, ...options });

export const COURSE_TIERS = {
  '2026-11-loh': {
    status:'published',
    conditions:{venue:'京都',surface:'芝',distance:3000,runners:12,type:'LoH',turn:'右・外',season:'秋',weather:'ランダム',going:'ランダム',time:'昼'},
    sourceIds:['kyotoLab','kyotoMammoth','kyotoNeko'],
    context:'上位入着の安定性を重視。10月3〜14日の当該開催向け公開情報を比較し、Sはラーメントプロに絞った。新シナリオ実装前の暫定評価。',
    disagreement:'ルドルフはラボで最高評価、Neko長明の先行表ではA。逃げはNeko長明が選択肢として残す一方、より新しいラボ記事は環境に慎重。星評価や先行内の順位を、そのまま総合Tierには置き換えていない。',
    entries:[
      entry(107703,'ラーメン','S',['先行'],
        'ラボの最上位評価とnoteの先行Sが一致。自前の終盤加速の安定性を高く評価。',
        '固有の回復条件を満たす。同キャラのクリスマス衣装からは継承できない。',
        [evidence('kyotoLab','10/14：おすすめ5/5、先行の最有力候補'),evidence('kyotoNeko','10/3：先行比較表の唯一のS')]),
      entry(101703,'ハロウィン','A',['先行','差し'],
        '自前加速と長距離での進化の伸びを評価。最有力とする記事もあるが、先行比較の評価差を残してA。',
        '緑スキル7種などの条件を整える。noteのAは先行運用の評価で、差しの格付けではない。',
        [evidence('kyotoLab','10/14：おすすめ5/5、差し・先行の候補'),evidence('kyotoNeko','10/3：先行比較でA'),evidence('kyotoMammoth','10/7：有力候補として言及')],{mixed:true}),
      entry(101301,'通常','A',['先行'],
        '覚醒Lv7の強化を評価。ラボとnoteの先行比較がともに有力候補に挙げる。',
        '最大覚醒での評価。別衣装のマックイーンにはこの評価を適用しない。',
        [evidence('kyotoLab','10/14：おすすめ4/5、覚醒Lv7を評価'),evidence('kyotoNeko','10/3：先行比較でA'),evidence('kyotoMammoth','10/7：覚醒Lv7の注目候補')]),
      entry(108902,'水着','A',['先行'],
        '進化したショーダウンが有効。ラボの推奨とnoteの先行Aが一致する候補。',
        '回復付き固有を含め、最終的な持久力と取得スキルを編成で整える。',
        [evidence('kyotoLab','10/14：おすすめ4/5、上位狙いでも候補'),evidence('kyotoNeko','10/3：先行比較でA')]),
      entry(114101,'通常','A',['先行'],
        '安定した自前加速をラボが評価。noteの先行Bとの評価差も踏まえてA。',
        '本人は自身の継承進化を使えない。この制約も含め、手持ちの継承と比較する。',
        [evidence('kyotoLab','10/14：おすすめ4/5'),evidence('kyotoNeko','10/3：先行比較でB、本人の継承進化制約にも言及')],{mixed:true}),
      entry(102503,'花嫁','A',['差し'],
        '差しの有力候補としてラボとnoteが言及。回復と終盤性能を評価する。',
        'ラボは7月中山3600mより評価を抑えている。過去開催の強さをそのまま流用しない。',
        [evidence('kyotoLab','10/14：おすすめ4/5、差しの有力候補'),evidence('kyotoMammoth','10/7：有力候補として言及')]),
      entry(106803,'新衣装・赤','B',['逃げ'],
        'noteでは猫マヤノと並ぶ長距離の逃げ候補。先行以外の編成を検討する場合に。',
        '新しいラボ記事は逃げ全体に慎重。上位先行と同等の安定性が確認されたという評価ではない。',
        [evidence('kyotoNeko','10/3：長距離の有力な逃げ2人の一人'),evidence('kyotoLab','10/14：個別採点はなく、逃げ全体には慎重')],{mixed:true}),
      entry(102403,'ハロウィン','B',['逃げ'],
        '複数のnoteが長距離の逃げ候補として挙げる。逃げ編成を用意する場合の選択肢。',
        '新シナリオのリンク効果を強さに加算していない。ラボの逃げ環境への慎重な見方も確認する。',
        [evidence('kyotoNeko','10/3：長距離の有力な逃げ2人の一人'),evidence('kyotoMammoth','10/7：有力候補として言及'),evidence('kyotoLab','10/14：個別採点はなく、逃げ全体には慎重')],{mixed:true}),
      entry(102303,'メカ','B',['先行'],
        'noteが中盤固有を理由に候補として挙げる。上位先行を揃えられない場合などに比較。',
        '候補としての根拠が中心で、上位組と同等という複数者の一致は確認できていない。',
        [evidence('kyotoMammoth','10/7：中盤固有を評価した候補。順位付けはしていない')],{limitedEvidence:true}),
      entry(105702,'正月','B',['追込'],
        'noteが長いスパートを活かす候補として言及。追込を使う場合の検討枠。',
        '今回の公開資料では比較評価が少ない。先行上位と同等の安定性が示されたという意味ではない。',
        [evidence('kyotoMammoth','10/7：固有を評価した候補。順位付けはしていない')],{limitedEvidence:true})
    ]
  },
  '2026-12-cm': {
    status:'withheld',
    conditions:{venue:'中山',surface:'芝',distance:2500,runners:9,type:'チャンミ',turn:'右・内',season:'冬',weather:'晴',going:'良',time:'昼'},
    sourceIds:[],entries:[],
    pendingReason:'2026年12月の開催を対象にした新しいnoteの比較記事を確認できていないため、Tierの掲載を保留しています。',
    pendingDetail:'2026年1月の同コース記事や、京都3000mの評価は流用しません。確認日：2026年10月19日。スキル・因子の一覧は引き続き使えます。'
  }
};

export function getCourseTier(course) {
  const board=COURSE_TIERS[course?.id];
  if(!course?.confirmed||!board)return null;
  return Object.entries(board.conditions).every(([key,value])=>course[key]===value)?board:null;
}
