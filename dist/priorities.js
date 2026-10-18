// 取得優先度。特定デッキを前提にした「因子周回の順位」とは分けて扱う。
// 優先度が高い場合も発動条件・持久力・本体の加速を確認する。勝率計算ではない。
export const PRIORITIES = { 1: '高', 2: '中', 3: '低' };

const RULES = {
  'レースの真髄・体': { priority: 1, reason: '白スキルで終盤の速度を大きく補える。持久力消費を織り込んで走り切れる構成で最優先。', conditionLabel: '持久力確保前提', sources: ['shinzui','shinzuiBody','longSkills'] },
  '右回り○': { priority: 1, reason: '両コースで確実に条件が一致するスピード緑。○を確保し、スキルPtに余裕があれば◎へ。', sources: ['noteKyoto','noteNakayama'] },
  '秋ウマ娘○': { priority: 1, reason: '京都3000mの秋条件で使うスピード緑。コース条件が一致するため優先して確保。', sources: ['noteKyoto','noteKyotoFront'] },
  '冬ウマ娘○': { priority: 1, reason: '中山2500mの冬条件で使うスピード緑。サポートで取れない編成では因子を優先。', sources: ['december','noteNakayama'] },
  '京都レース場○': { priority: 3, reason: 'スタミナを補う緑。主加速・スピード緑・主要速度を先に確保し、スタミナ不足なら優先度を上げる。', sources: ['noteKyotoFront','noteKyotoEscape'] },
  '中山レース場○': { priority: 3, reason: 'スタミナ補強用。スピード緑や終盤加速を確保した後、必要なスタミナと残りPtで判断。', sources: ['noteNakayama'] },
  '非根幹距離○': { priority: 3, reason: 'スタミナ補強用。条件は一致するが、スピード緑・主加速と同じ必須度にはしない。', sources: ['noteKyotoFront','noteNakayama'] },
  '良バ場○': { priority: 3, reason: '良バ場でパワーを補う。スピード緑や主要速度を確保した後に検討。', sources: ['december','noteKyotoFront'] },
  '晴れの日○': { priority: 3, reason: '根性補強用。発動条件は一致するが、取得Ptはスピード緑や主要速度を先に使う。', sources: ['december'] },
  '自制心': { priority: 1, reason: '掛かりを抑えて長距離の安定性を補う。特にLoHでは事故を減らす候補として優先。', byCourse: { '2026-12-cm': 2 }, sources: ['noteKyotoFront','noteKyotoEscape','noteNakayama'] },
  '連綿': { priority: 2, reason: '継承3個以上で効果が増える中盤速度。育成キャラ・編成で取れない場合は因子の優先候補。', conditionLabel: '継承スキル3個以上で強化', sources: ['noteKyotoFront','noteKyotoEscape','renmen'] },
  '登山家': { priority: 2, reason: '京都3000mの序盤・終盤の上り坂で使う加速。発動位置で働きが変わるため、主加速を確保して追加。', conditionLabel: '発動する坂で効果が変わる', sources: ['noteKyotoFront','noteKyotoEscape','november2'] },
  'ウマ好み': { priority: 1, reason: '序盤の位置取りを補う重要な速度。先行・差し・追込で優先して確保。', sources: ['november2','december2'] },
  '天才肌': { priority: 3, reason: '賢さ条件を満たす長距離育成の補強候補。掛かり対策の自制心やスピード緑を先に検討。', conditionLabel: '基礎賢さ1200以上', sources: ['noteKyotoFront','noteKyotoEscape'] },
  'レースの真髄・力': { priority: 2, byStyle: { '逃げ': 3, '先行': 3 }, reason: '最終盤の追い越し対象がいる構成で優先。先頭を維持する逃げでは発動しにくく、優先度を下げる。', sources: ['shinzui','noteNakayama'] },
  'レースの真髄・速': { priority: 3, reason: '終盤前の速度補強。真髄・体や主な中盤速度を揃えた後の追加候補。', sources: ['shinzui'] },
  '先駆け': { priority: 1, reason: '逃げのスタート加速。先手必勝を含め、序盤に前を取るための軸。', sources: ['november','december','database'] },
  '地固め': { priority: 1, reason: '逃げの序盤加速の軸。序盤に発動する緑など3スキルも一緒に用意する。', conditionLabel: '序盤にスキル3回発動', sources: ['november','december','database'] },
  'アオハル点火・賢': { priority: 2, reason: '逃げの危険回避・ポジションセンスと併用して序盤の横移動を補う。単体で速度を上げるスキルではない。', conditionLabel: '逃げの序盤移動セット', sources: ['noteKyotoEscape','database'] },
  '下り坂巧者': { priority: 2, byCourse: { '2026-11-loh': 3 }, reason: '中山では中盤の下り坂で使う速度候補。京都では加速中と重なる発動もあるため一段下げる。', sources: ['november2','noteNakayama','database'] },
  '内弁慶': { priority: 2, reason: '長距離の最終コーナー速度。内ラチ条件を満たす構成で優先し、中山では夢錦の発動補助にも使う。', sources: ['november2','december','database'] },
  '余勢を駆って': { priority: 2, reason: '京都の上り坂で使う先行速度。序盤にも坂があるため位置取りの補助候補。', sources: ['november2','noteKyotoFront','database'] },
  '十万バリキ': { priority: 2, reason: '京都の上り坂で使う差し速度。序盤の坂で位置取りを補える発動も狙う。', sources: ['november2','database'] },
  '登竜門': { priority: 2, reason: '京都の上り坂で使う追込速度。序盤にも坂があるコースで優先を上げる。', sources: ['november2','database'] },
  '垂れウマ回避': { priority: 2, reason: '先行以下の補助加速候補。前を塞がれる条件があり、主加速を揃えてから追加する。', conditionLabel: '前を塞がれることが条件', sources: ['november2','december2','database'] },
  '迷いなし': { priority: 1, reason: '逃げの主加速候補。万里一空または本体加速との構成で確保する。', sources: ['november','december'] },
  '勇気の一歩': { priority: 1, reason: '先行の直線ラストスパート加速。順位条件がない主加速として優先。', sources: ['november','december'] },
  '本領発揮': { priority: 2, reason: '先頭から4バ身以内を維持する先行の加速候補。ショーダウンや本体の進化加速との重複を確認。', sources: ['november','december'] },
  '影より速く': { priority: 1, reason: '差しの順位条件がない直線加速。絶塵または本体の有効加速と合わせて主加速を確保。', sources: ['november','december'] },
  'がむしゃら': { priority: 2, reason: '中団以降で使う差しの加速。無我夢中・本体加速との重複と、持久力消費を確認する。', conditionLabel: '順位条件・持久力消費あり', sources: ['november','december'] },
  '直線一気': { priority: 1, reason: '追込の主加速。迫る影または本体の同系統の加速で確保する。', sources: ['november','december'] },
  '光れ！弾けろ！超新星爆発！': { priority: 1, reason: '逃げ・先行の継承進化。後半速度とラストスパート加速を兼ねる優先継承。', conditionLabel: '本人所持・直接の親が必要', sources: ['november','december','inheritance'] },
  '黄金を訪ねて': { priority: 1, reason: '差し・追込の継承進化。後半速度とラストスパート加速を兼ねる優先継承。', conditionLabel: '本人所持・直接の親が必要', sources: ['november','december','inheritance'] }
};

export function resolvePriority(rule, courseId, style) {
  const detail = RULES[rule.name];
  return {
    priority: detail?.byCourse?.[courseId] ?? detail?.byStyle?.[style] ?? detail?.priority ?? rule.priority,
    priorityReason: detail?.reason ?? rule.reason,
    conditionLabel: detail?.conditionLabel ?? rule.conditionLabel ?? '',
    prioritySources: detail?.sources ?? rule.sources
  };
}
