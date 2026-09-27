import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cacheForAccount,clearAccountCaches} from '../src/firebase/accountCache.ts';
test('late responses remain in their originating account cache',()=>{
 const values:Record<string,string>={};
 globalThis.localStorage={getItem:(key:string)=>values[key]??null,setItem:(key:string,value:string)=>{values[key]=value;},removeItem:(key:string)=>{delete values[key];},clear:()=>{},key:()=>null,get length(){return Object.keys(values).length;}};
 const a=cacheForAccount('alice'),b=cacheForAccount('bob');
 a.setItem('dfmc_club_cache_1','alice-data');
 assert.equal(b.getItem('dfmc_club_cache_1'),null);
 b.setItem('dfmc_club_cache_1','bob-data');
 a.setItem('dfmc_club_cache_1','late-alice-data');
 assert.equal(b.getItem('dfmc_club_cache_1'),'bob-data');
 assert.equal(a.getItem('dfmc_club_cache_1'),'late-alice-data');
});
