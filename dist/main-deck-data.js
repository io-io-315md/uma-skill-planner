// 公開攻略・金スキル条件を照合した初期案。育成性能の実測順位ではない。
export const MAIN_DECK_GUIDE={
  revision:'2026-10-28.1',verifiedAt:'2026-10-28',scenario:'駿大祭',fixedSupportId:30323,
  sources:{
    scenarioOfficial:{name:'Cygames｜駿大祭シナリオ公開',url:'https://umamusume.jp/news/detail?id=3516',kind:'2026年10月26日・公式発表'},
    shuntaisaiDecks:{name:'ルネ｜駿大祭・5種類のサポカ編成',url:'https://umamusumelabo.com/ikusei/syuntaisai-syoniti',kind:'2026年10月26日・実装後の育成例'},
    mayanoLab:{name:'ルネ｜パワーマヤノの金スキル3択と性能',url:'https://umamusumelabo.com/chara_support/ssr-mayano-power',kind:'2026年10月25日・公開性能の解説'},
    mayanoNote:{name:'れい｜パワーマヤノ・距離ごとの金スキル択',url:'https://note.com/umamusume_sui/n/ne9c02b44875e',kind:'2026年10月26日・noteの公開部分'},
    scenarioNote:{name:'Neko長明｜駿大祭の攻略・実装2日目',url:'https://note.com/neko_chomei/n/n4717cbd2f79c',kind:'2026年10月27日・noteの公開部分'},
    mayanoData:{name:'GameTora｜パワーマヤノ・スキルとイベント',url:'https://gametora.com/ja/umamusume/supports/30322-mayano-top-gun',kind:'2026年10月28日照合・日本版データ'},
    azumaData:{name:'GameTora｜SSR吾妻・スキルとイベント',url:'https://gametora.com/ja/umamusume/supports/30323-azuma',kind:'2026年10月28日照合・日本版データ'}
  },
  policy:'スピード2・スタミナ1・パワー1・賢さ1・友人1の5種類。マヤノは汎用候補だが後方へ固定せず、差し・追込は脚質に合う金スキルを持つパワー枠を優先。距離に合うイベント択だけを選ぶ。',
  defaults:{'逃げ':[30302,30298,30307,30322,30289],'先行':[30302,30311,30304,30322,30289],'差し':[30302,30317,30304,30297,30289],'追込':[30302,30312,30278,30321,30289]},
  pools:{speed:[30302,30311,30317,30312,30298,30275,30242,30272],stamina:[30304,30307,30281,30278,30279,30303],power:[30322,30297,30321,30277,30283,30256,30287],wit:[30289,30319,30320,30306,30288]},
  events:[
    {courseId:'2026-11-loh',distance:3000,surface:'芝',venue:'京都',sourceIds:['shuntaisaiDecks','mayanoNote','scenarioNote','mayanoData','azumaData','november'],decks:{'逃げ':[30302,30298,30307,30322,30289],'先行':[30302,30311,30304,30322,30289],'差し':[30302,30317,30304,30297,30289],'追込':[30302,30312,30278,30321,30289]}},
    {courseId:'2026-12-cm',distance:2500,surface:'芝',venue:'中山',sourceIds:['shuntaisaiDecks','mayanoNote','scenarioNote','mayanoData','azumaData','december'],decks:{'逃げ':[30302,30298,30307,30322,30289],'先行':[30302,30311,30304,30322,30289],'差し':[30302,30317,30304,30297,30289],'追込':[30302,30312,30278,30321,30289]}}
  ]
};
