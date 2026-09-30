import {test} from 'node:test';
import assert from 'node:assert/strict';
import {findCell} from '../src/cellName.js';
const docs=names=>names.map(name=>({data:()=>({name})}));
test('cell names match with or without spaces and a trailing 셀',()=>{
  const cells=docs(['장미소','둔산제일교회','기쁨셀']);
  for(const input of ['장미소','장미소셀','장미소 셀',' 장 미 소 셀 ']) assert.equal(findCell(cells,input)?.data().name,'장미소');
  for(const input of ['기쁨','기쁨셀','기쁨 셀']) assert.equal(findCell(cells,input)?.data().name,'기쁨셀');
  for(const input of ['','셀','장미','장미소셀셀']) assert.equal(findCell(cells,input),undefined);
});
