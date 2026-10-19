// 攻略執筆者・攻略班の見解を比較した編集上の評価。勝率の実測値ではない。
export const TIER_VERIFIED_AT = '2026-10-19';
export const TIER_ORDER = ['S', 'A', 'B'];
export const TIER_LABELS = { S:'突出した最有力', A:'有力候補', B:'編成・条件次第' };
export const TIER_SOURCES = {
  kyotoLab: {
    name:'ルネ｜ウマ娘ラボ', courseId:'2026-11-loh',
    title:'11月LoH・京都3000mのおすすめウマ娘',
    url:'https://umamusumelabo.com/event/loh/loh-kyoto3000-202611',
    note:'10月14日版。先行中心の環境評価と、6衣装のおすすめ度を参照。'
  },
  kyotoWith: {
    name:'GameWith攻略班', courseId:'2026-11-loh',
    title:'2026年11月LoH・おすすめキャラと育成',
    url:'https://gamewith.jp/uma-musume/article/show/574934',
    note:'おすすめ度と衣装別の長所を参照。逃げも高く評価している。'
  },
  kyotoKami: {
    name:'神ゲー攻略班', courseId:'2026-11-loh',
    title:'2026年11月LoH・キャラTierと編成',
    url:'https://kamigame.jp/umamusume/page/443456827678534026.html',
    note:'最上位3衣装と編成例を参照。逃げの環境面と後方の安定性を慎重に評価。'
  },
  nakayamaWith: {
    name:'GameWith攻略班', courseId:'2026-12-cm',
    title:'2026年12月チャンミ・おすすめキャラと育成',
    url:'https://gamewith.jp/uma-musume/article/show/578925',
    note:'衣装別おすすめ度と中山2500mでの強みを参照。'
  },
  nakayamaKami: {
    name:'神ゲー攻略班', courseId:'2026-12-cm',
    title:'2026年12月チャンミ・おすすめキャラと脚質',
    url:'https://kamigame.jp/umamusume/page/443708416242747935.html',
    note:'おすすめキャラの並びと脚質評価を参照。先行を高く、逃げを慎重に評価。過去開催の統計は使用しない。'
  }
};
const evidence = (source, note) => ({ source, note });
const entry = (characterId, costume, tier, styles, reason, caution, opinions, options={}) =>
  ({ characterId, costume, tier, styles, reason, caution, opinions, ...options });

export const COURSE_TIERS = {
  '2026-11-loh': {
    conditions:{venue:'京都',surface:'芝',distance:3000,runners:12,type:'LoH',turn:'右・外',season:'秋',weather:'ランダム',going:'ランダム',time:'昼'},
    sourceIds:['kyotoLab','kyotoWith','kyotoKami'],
    context:'LoHの上位入着の安定性を重視。先行中心という見解を軸に、後方の進路や逃げの編成条件も考慮。',
    disagreement:'逃げはGameWithで高評価。一方、ウマ娘ラボ・神ゲー攻略は現在のキャラとサポカ環境を慎重に見ているため、本表ではBに整理。',
    entries:[
      entry(107703,'ラーメン','S',['先行'],
        '加速の安定性と終盤火力を両立。複数資料が最上位の先行候補として評価。',
        '固有用の回復を十分に確保。同キャラのクリスマス衣装は継承できない。',
        [evidence('kyotoLab','おすすめ5/5'),evidence('kyotoWith','おすすめ5/5'),evidence('kyotoKami','最上位SS+の3衣装に選出')]),
      entry(101703,'ハロウィン','S',['先行','差し'],
        '固有加速と進化の終盤性能が強み。先行・差しの両方で最有力候補。',
        '緑スキル7種などの条件を整える。資料によって推奨する作戦は異なる。',
        [evidence('kyotoLab','おすすめ5/5・差し中心に評価'),evidence('kyotoWith','おすすめ5/5・先行/差し'),evidence('kyotoKami','最上位SS+・先行を推奨')]),
      entry(114101,'通常','S',['先行'],
        '順位に左右されない固有加速がLoH向き。中盤の位置取りと回復も補える。',
        '本人には自身の継承進化を付けられない。ウマ娘ラボは上の2衣装より一段低い評価。',
        [evidence('kyotoLab','おすすめ4/5'),evidence('kyotoWith','おすすめ5/5'),evidence('kyotoKami','最上位SS+の3衣装に選出')],{mixed:true}),
      entry(102503,'花嫁','A',['差し'],
        '回復付き固有と進化が強力。後方脚質から選ぶ有力な一人。',
        '後方の進路事故には注意。7月の中山3600mと同じ性能評価にはしない。',
        [evidence('kyotoLab','おすすめ4/5'),evidence('kyotoWith','おすすめ5/5'),evidence('kyotoKami','後方入りの編成例に採用')]),
      entry(108902,'水着','A',['先行'],
        '回復付き固有と進化加速がコースに合う。先行の有力な代替候補。',
        '最上位組と比べた終盤速度の不足を補いたい。',
        [evidence('kyotoLab','おすすめ4/5'),evidence('kyotoWith','おすすめ4/5'),evidence('kyotoKami','その他おすすめに掲載')]),
      entry(101301,'通常','A',['先行'],
        '覚醒Lv7の進化加速を評価。京都長距離に合う自前スキルが揃う。',
        '最大覚醒での評価。同じマックイーンでも別衣装はこの評価の対象外。',
        [evidence('kyotoLab','おすすめ4/5・覚醒Lv7を評価'),evidence('kyotoWith','おすすめ4/5')]),
      entry(111501,'通常','A',['追込'],
        '固有と進化加速で終盤の追い上げを狙える追込候補。',
        'LoHでは後方の進路事故と、先行2人と組む場合の追い比べに注意。',
        [evidence('kyotoWith','おすすめ5/5'),evidence('kyotoKami','先行2＋追込1の編成例に採用')]),
      entry(102403,'ハロウィン','B',['逃げ'],
        '自前回復と逃げ加速が長所。逃げを使うなら候補になる。',
        '逃げ全体の評価が分かれる。先頭を取れない展開や逃げ同士の対面に注意。',
        [evidence('kyotoWith','おすすめ5/5'),evidence('kyotoKami','逃げ候補・対面による不安定さを指摘')],{mixed:true}),
      entry(106803,'新衣装・赤','B',['逃げ'],
        '序中盤から終盤まで補える逃げ候補。先行と組む編成例もある。',
        '逃げの環境評価は割れる。自前回復の不足と固有の順位条件を補いたい。',
        [evidence('kyotoWith','おすすめ5/5'),evidence('kyotoKami','逃げ1＋先行2の編成例に採用')],{mixed:true}),
      entry(113701,'通常','B',['逃げ'],
        '中盤の位置取りと進化加速を持つ逃げ候補。',
        '本表は逃げ運用の評価。大逃げ同士の対面では持久力面のリスクが大きい。',
        [evidence('kyotoWith','おすすめ4/5'),evidence('kyotoKami','逃げ運用を大逃げより推奨')])
    ]
  },
  '2026-12-cm': {
    conditions:{venue:'中山',surface:'芝',distance:2500,runners:9,type:'チャンミ',turn:'右・内',season:'冬',weather:'晴',going:'良',time:'昼'},
    sourceIds:['nakayamaWith','nakayamaKami'],
    context:'中山2500mの終盤加速と先行の強さを重視した暫定評価。新シナリオ実装前の資料を参照。',
    disagreement:'GameWithは逃げ・追込にも高評価。神ゲー攻略の先行重視という見解も踏まえ、脚質内のおすすめ度を全体Tierへそのまま置き換えてはいない。',
    entries:[
      entry(107703,'ラーメン','S',['先行'],
        '固有と進化の終盤性能が強い。両資料で先行の筆頭候補。',
        '回復を複数確保し固有の不発を抑える。クリスマス衣装の継承は不可。',
        [evidence('nakayamaWith','おすすめ5/5・特におすすめの一人'),evidence('nakayamaKami','先行候補の先頭に掲載')]),
      entry(101703,'ハロウィン','S',['先行','差し'],
        '高い終盤火力が持ち味。先行・差しのどちらでも最上位候補として整理。',
        '緑スキルなどの条件を満たす育成が前提。作戦は手持ちサポカと合わせる。',
        [evidence('nakayamaWith','おすすめ5/5・特におすすめの一人'),evidence('nakayamaKami','先行上位・差しでも特に強力と評価')]),
      entry(114101,'通常','A',['先行'],
        '自前加速・速度・回復のバランスが良い先行候補。',
        '本人には自身の継承進化を使えない。Sとの差はアプリ側の暫定的な整理。',
        [evidence('nakayamaWith','おすすめ5/5'),evidence('nakayamaKami','先行候補の上位に掲載')]),
      entry(102503,'花嫁','A',['差し'],
        '固有回復と進化の終盤性能で対抗。差しから選ぶ有力候補。',
        '進化速度はこのコースで最大強化にならない。先行優勢の見解も考慮。',
        [evidence('nakayamaWith','おすすめ5/5・特におすすめの一人'),evidence('nakayamaKami','差し筆頭候補・進化の強化段階を解説')]),
      entry(111501,'通常','A',['追込'],
        '有効な進化加速を自前で持つ。追込のエース候補。',
        '追込全体は神ゲー攻略で先行より低評価。短い最終直線で届く形を作る。',
        [evidence('nakayamaWith','おすすめ5/5'),evidence('nakayamaKami','追込候補の先頭に掲載')],{mixed:true}),
      entry(108902,'水着','A',['先行'],
        '順位条件のない進化加速を評価。先行編成の追加候補。',
        '最上位の先行に対して、終盤の速度も確保したい。',
        [evidence('nakayamaWith','おすすめ4/5'),evidence('nakayamaKami','先行おすすめに掲載')]),
      entry(106402,'クリスマス','B',['逃げ'],
        '有馬向けの大逃げ候補。先行を牽引する役割も検討できる。',
        '大逃げ運用を前提に検討。逃げの総合評価は資料間で大きく分かれる。',
        [evidence('nakayamaWith','おすすめ5/5'),evidence('nakayamaKami','大逃げ候補・牽引役として評価')],{mixed:true}),
      entry(102403,'ハロウィン','B',['逃げ'],
        '自前回復で持久力を補いやすい逃げ候補。',
        'GameWithは高評価だが、神ゲー攻略は逃げ全体に慎重。編成込みで検討。',
        [evidence('nakayamaWith','おすすめ5/5'),evidence('nakayamaKami','逃げおすすめに掲載・脚質評価は慎重')],{mixed:true}),
      entry(106803,'新衣装・赤','B',['逃げ'],
        '序中盤と終盤を補える逃げ候補。逃げを採用する編成向け。',
        'キャラ単体の高評価と、現在の逃げ環境の評価を分けて判断。',
        [evidence('nakayamaWith','おすすめ5/5'),evidence('nakayamaKami','逃げおすすめに掲載・脚質評価は慎重')],{mixed:true}),
      entry(111901,'通常','B',['追込'],
        '有馬に合う固有と終盤火力を評価した追込候補。',
        '神ゲー攻略の追込候補内では優先順位が低め。手持ちと仕上がりで選ぶ。',
        [evidence('nakayamaWith','おすすめ4/5'),evidence('nakayamaKami','追込おすすめに掲載')])
    ]
  }
};

export function getCourseTier(course) {
  const board=COURSE_TIERS[course?.id];
  if(!course?.confirmed||!board)return null;
  return Object.entries(board.conditions).every(([key,value])=>course[key]===value)?board:null;
}
