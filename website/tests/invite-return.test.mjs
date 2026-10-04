import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rememberBoothReturn,consumeBoothReturn,safeBoothReturn} from '../src/auth/inviteReturn.js';
const storage=()=>{const values=new Map();return{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};};
test('invitation survives auth navigation and is consumed once after sign in',()=>{
 const s=storage();rememberBoothReturn('#booth?invite=abc.def',s,100);assert.equal(consumeBoothReturn(s,200),'#booth?invite=abc.def');assert.equal(consumeBoothReturn(s,201),null);
});
test('expired invitations and external return destinations are rejected',()=>{
 const s=storage();rememberBoothReturn('#booth?invite=abc',s,0);assert.equal(consumeBoothReturn(s,3600001),null);
 for(const value of ['https://evil.example','//evil.example','#account','#booth?invite=','#booth?invite=%0A'])assert.equal(safeBoothReturn(value),null);
 assert.equal(safeBoothReturn('#booth?invite=abc&redirect=https://evil.example'),'#booth?invite=abc');
});
test('unavailable session storage does not break login',()=>{
 const s={getItem(){throw Error();},setItem(){throw Error();}};rememberBoothReturn('#booth',s);assert.equal(consumeBoothReturn(s),null);
});
