import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeCharacterName,matchesCharacterName} from '../dist/name-search.js';
import {selectSupportCandidates} from '../dist/support-picker.js';

const catalog=JSON.parse(fs.readFileSync(new URL('../dist/data/catalog.json',import.meta.url)));

test('名前の一部をひらがな・カタカナ・半角カナ・空白入りで検索できる',()=>{
  const character={characterName:'エフフォーリア',name:'[衣装タイトル]エフフォーリア'};
  for(const query of ['えふ','エフ','ｴﾌ','ふぉーりあ',' フォー リア ']){
    assert.equal(matchesCharacterName(character,query),true,query);
  }
  assert.equal(normalizeCharacterName('ヴ・ガッツ ＡｂＣ'),'ゔ・がっつabc');
  assert.equal(matchesCharacterName(character,''),true);
  assert.equal(matchesCharacterName(character,'  '),true);
  assert.equal(matchesCharacterName(character,'ていおー'),false);
  assert.equal(matchesCharacterName({name:'[衣装]エフフォーリア'},'えふ'),false,'衣装込みの表示名にはフォールバックしない');
});

test('育成ウマは全衣装、サポカは全レアリティで同じ名前の部分一致を使う',()=>{
  const expectedCharacters=catalog.characters.filter(c=>c.characterName==='トウカイテイオー').map(c=>c.id);
  assert.ok(expectedCharacters.length>1);
  for(const query of ['とうかい','ていおー','ﾄｳｶｲ ﾃｲｵｰ']){
    assert.deepEqual(catalog.characters.filter(c=>matchesCharacterName(c,query)).map(c=>c.id),expectedCharacters,query);
    const supports=selectSupportCandidates(catalog.supports,{context:'farming',query});
    assert.deepEqual(supports.map(c=>c.id).sort((a,b)=>a-b),catalog.supports.filter(c=>c.characterName==='トウカイテイオー').map(c=>c.id).sort((a,b)=>a-b));
    assert.deepEqual([...new Set(supports.map(c=>c.rarity))].sort(),['R','SR','SSR']);
  }
  assert.deepEqual(selectSupportCandidates(catalog.supports,{query:'えふ'}).map(c=>c.id),[30311]);
  assert.deepEqual(selectSupportCandidates(catalog.supports,{context:'farming',query:'えふ'}).map(c=>c.id),[30311,10146]);
});

test('衣装名・カードのタイトルにだけある単語ではヒットしない',()=>{
  for(const query of ['天才的ユートピア','ゆーとぴあ','ゆかし','ていおー・おー']){
    assert.deepEqual(selectSupportCandidates(catalog.supports,{context:'farming',query}),[],query);
  }
  for(const query of ['トップ・オブ・ジョイフル','びよんど','ほらいずん']){
    assert.deepEqual(catalog.characters.filter(c=>matchesCharacterName(c,query)),[],query);
  }
  const teio=catalog.supports.find(c=>c.id===30275);
  assert.equal(teio.title,'[天才的ユートピア]');
  assert.equal(matchesCharacterName(teio,'ていおー'),true,'表示用のタイトルは維持し、名前で選べる');
});

test('カタログの全育成ウマ・全サポカがタイトルと独立したキャラ名で検索できる',()=>{
  for(const item of [...catalog.characters,...catalog.supports]){
    assert.ok(item.characterName,'キャラ名なし: '+item.id);
    assert.equal(matchesCharacterName(item,item.characterName),true,String(item.id));
    assert.equal(matchesCharacterName({...item,title:'検索対象外の衣装名',name:'[検索対象外の衣装名]'+item.characterName},'検索対象外'),false,String(item.id));
  }
});
