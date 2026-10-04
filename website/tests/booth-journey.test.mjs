import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as core from '../src/booth/core.js';
import {createEditingConfirmation} from '../src/booth/editingConfirmation.mjs';
import {reconcileOffsets} from '../src/booth/photoPosition.js';

// Exercise the real Booth coordinator with controlled service responses. Child
// camera/upload components are boundaries; no camera, account or debit is real.
const compiled=ts.transpileModule(await readFile(new URL('../src/booth/Booth.tsx',import.meta.url),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022},
}).outputText;
function harness({cost=100,role='host',invite=null}={}) {
  const cells=[], hooks=[]; let cursor=0, dirty=false, effects=[], tree, debits=0, commit;
  const charge={cost,busy:false,error:'',receipt:'',reserve:async()=>{},reset:()=>{},complete:()=>{debits++;return new Promise(resolve=>{commit=()=>{charge.receipt='Confirmed';resolve();};});}};
  const party={room:null,busy:false,error:'',ended:false,
    end(){this.room=null;},
    async create(settings){this.room={code:'ABCDEF',token:'host-token',role,settings,host:{online:true,ready:true},guest:{online:false,ready:false},bothReady:false};return this.room;},
    async join(){return this.create({layout:'A',template:null,source:'camera'});},
    async check(){return this.room;}, async ready(){},
  };
  const react={
    useState(initial){const i=cursor++;if(!(i in cells))cells[i]=typeof initial==='function'?initial():initial;return[cells[i],value=>{const next=typeof value==='function'?value(cells[i]):value;if(!Object.is(next,cells[i])){cells[i]=next;dirty=true;}}];},
    useRef(value){const i=cursor++;if(!(i in cells))cells[i]={current:value};return cells[i];},
    useEffect(fn,deps){const i=cursor++;const previous=hooks[i];if(!previous||!deps||deps.some((v,n)=>!Object.is(v,previous.deps?.[n])))effects.push(()=>{previous?.cleanup?.();hooks[i]={deps,cleanup:fn()};});},
  }; react.useLayoutEffect=react.useEffect;
  const exports={};
  const require=name=>{
    if(name==='react')return react;
    if(name==='react/jsx-runtime')return{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props}),Fragment:'Fragment'};
    if(name==='./core')return core;
    if(name==='./photoPosition.js')return{reconcileOffsets};
    if(name==='./frameAssets')return{prefetchFrames:()=>()=>{}};
    if(name==='./useRoom')return{useRoom:()=>party};
    if(name==='./useSessionCharge')return{useSessionCharge:()=>charge};
    if(name==='./editingConfirmation.mjs')return{createEditingConfirmation};
    return new Proxy({}, {get:(_,key)=>String(key)});
  };
  runInNewContext(compiled,{exports,require,crypto,console,window:{setTimeout,clearTimeout,addEventListener(){},removeEventListener(){},scrollTo(){}},document:{getElementById:()=>null}});
  const leaveGuard={current:()=>{}};
  function render(){let count=0;do{dirty=false;cursor=0;effects=[];tree=exports.Booth({active:true,invite,leaveGuard});for(const effect of effects)effect();if(++count>20)throw new Error('Unstable render');}while(dirty);return tree;}
  function find(type,predicate=()=>true){render();let result;function walk(node){if(!node||result)return;if(Array.isArray(node)){node.forEach(walk);return;}if(node.type===type&&predicate(node.props)){result=node.props;return;}walk(node.props?.children);}walk(tree);return result;}
  async function flush(){for(let i=0;i<12;i++)await Promise.resolve();render();}
  async function start(mode='solo',source='upload'){
    find('Instructions').onContinue(); find('ModeScreen').onChoose(mode);
    assert.ok(find('SourceScreen')); find('SourceScreen').onChoose(source);
    if(mode==='duo'&&source==='camera')find('DuoChoice').onCreate();
    assert.ok(find('LayoutScreen')); assert.equal(find('EditScreen'),undefined);
    find('LayoutScreen').onNext();await flush();
    if(mode==='duo'&&source==='camera'){
      party.room.bothReady=true;party.room.guest={online:true,ready:true};
      find('WaitingRoom').onContinue();await flush();
    }
  }
  return {find,render,flush,start,party,charge,leaveGuard,debits:()=>debits,commit:()=>commit?.()};
}

test('insufficient points show a popup and never open capture or debit',async()=>{
  const ui=harness();
  ui.charge.reserve=async()=>{ui.charge.error='You need 100 points to continue.';throw new Error(ui.charge.error);};
  await ui.start('solo','camera');
  const warning=ui.find('WarningNotice',p=>p.title==='Before you continue');
  assert.ok(warning);
  assert.equal(warning.children[0].props.children,'You need 100 points to continue.');
  assert.equal(ui.find('SessionScreen'),undefined);
  assert.equal(ui.debits(),0);
});

test('authenticated invite opens the waiting room without choosing a mode or charging the guest',async()=>{
 const ui=harness({role:'guest',invite:'invitation-token'});let received;
 const join=ui.party.join.bind(ui.party);ui.party.join=async(code,invite)=>{received=invite;return join(code);};
 ui.render();await new Promise(resolve=>setTimeout(resolve,10));await ui.flush();
 assert.equal(received,'invitation-token');assert.ok(ui.find('WaitingRoom'));assert.equal(ui.debits(),0);
});
test('expired invite stays on join screen with error instead of entering a room',async()=>{
 const ui=harness({role:'guest',invite:'expired'});ui.party.join=async()=>{ui.party.error='This invitation expired.';return null;};
 ui.render();await new Promise(resolve=>setTimeout(resolve,10));await ui.flush();
 assert.equal(ui.find('JoinRoom').error,'This invitation expired.');assert.equal(ui.find('WaitingRoom'),undefined);
});
test('solo upload follows source/layout/capture/confirmation/design/export without early deduction', async()=>{
  const ui=harness(); await ui.start();
  ui.find('UploadScreen').onPhotos(['one','two','three']);ui.find('UploadScreen').onNext();await ui.flush();
  let modal=ui.find('BoothDialog',p=>p.title==='Proceed to Editing?');
  assert.equal(modal.open,true);assert.equal(ui.debits(),0);assert.equal(ui.find('EditScreen'),undefined);
  modal.onCancel();await ui.flush();assert.ok(ui.find('UploadScreen'));assert.equal(ui.debits(),0);
  ui.find('UploadScreen').onNext();await ui.flush();
  modal=ui.find('BoothDialog',p=>p.title==='Proceed to Editing?');modal.onConfirm();modal.onConfirm();await ui.flush();
  assert.equal(ui.debits(),1);assert.equal(ui.find('EditScreen'),undefined);
  ui.commit();await ui.flush();
  const editor=ui.find('EditScreen');assert.equal(editor.stage,'design');assert.equal(editor.card.shots.length,3);
  editor.onContinue();assert.equal(ui.find('EditScreen').stage,'export');
  ui.find('EditScreen').onDesign();assert.equal(ui.find('EditScreen').stage,'design');assert.equal(ui.debits(),1);
});

test('Duo uploads skip invitations and use the same free-trial confirmation boundary', async()=>{
  const ui=harness({cost:0});await ui.start('duo','upload');
  assert.ok(ui.find('DuoUploadScreen'));assert.equal(ui.party.room,null);
  ui.find('DuoUploadScreen').onNext(['pair1','pair2','pair3']);await ui.flush();
  const modal=ui.find('BoothDialog',p=>p.title==='Proceed to Editing?');
  assert.equal(modal.confirmLabel,'Confirm & Use Free Trial');assert.equal(ui.debits(),0);
  modal.onConfirm();await ui.flush();ui.commit();await ui.flush();assert.equal(ui.find('EditScreen').stage,'design');
});

test('last camera shot never auto-debits; explicit confirmation precedes editing', async()=>{
  const ui=harness();await ui.start('solo','camera');
  for(let i=0;i<3;i++){ui.find('SessionScreen').onShot(i,'photo'+i);await ui.flush();}
  assert.equal(ui.debits(),0);assert.equal(ui.find('EditScreen'),undefined);
  const permitted=ui.find('SessionScreen').beforeReview();await ui.flush();
  ui.find('BoothDialog',p=>p.title==='Proceed to Editing?').onConfirm();await ui.flush();
  assert.equal(ui.find('EditScreen'),undefined);ui.commit();assert.equal(await permitted,true);
  ui.find('SessionScreen').onNext(true);assert.equal(ui.find('EditScreen').stage,'design');
});

for(const role of ['host','guest'])test(`Duo ${role} exit is confirmed even with zero photos, and disconnect is modal`,async()=>{
  const ui=harness({role});await ui.start('duo','camera');
  ui.find('SessionScreen').onBack();
  let leave=ui.find('LeaveDialog');assert.equal(leave.open,true);assert.equal(leave.duo,true);
  leave.onCancel();assert.ok(ui.find('SessionScreen'));assert.ok(ui.party.room);
  ui.find('SessionScreen').onPartnerConnection(true);ui.render();
  ui.find('SessionScreen').onPartnerConnection(false);ui.render();
  const lost=ui.find('BoothDialog',p=>p.title==='Partner Disconnected');assert.equal(lost.open,true);
  lost.onCancel();assert.equal(ui.find('BoothDialog',p=>p.title==='Partner Disconnected').open,false);
  assert.ok(ui.find('SessionScreen'));assert.ok(ui.party.room);assert.equal(ui.debits(),0);
  ui.find('SessionScreen').onBack();ui.find('LeaveDialog').onConfirm();assert.equal(ui.party.room,null);
});

test('Duo guest enters shared editing without a debit or a payment dialog',async()=>{
  const ui=harness({role:'guest'});await ui.start('duo','camera');
  ui.find('SessionScreen').onSharedPhotos(['one','two','three']);
  ui.find('SessionScreen').onNext(true); // Host's confirmed edit event.
  assert.equal(ui.find('EditScreen').stage,'design');assert.equal(ui.debits(),0);
  assert.equal(ui.find('BoothDialog',p=>p.title==='Proceed to Editing?').open,false);
});

test('disconnect acknowledgement resets after reconnect and room expiry also opens the dialog',async()=>{
  const ui=harness();await ui.start('duo','camera');
  ui.find('SessionScreen').onPartnerConnection(true);ui.render();
  ui.find('SessionScreen').onPartnerConnection(false);ui.render();
  ui.find('BoothDialog',p=>p.title==='Partner Disconnected').onCancel();ui.render();
  ui.find('SessionScreen').onPartnerConnection(true);ui.render();
  ui.find('SessionScreen').onPartnerConnection(false);ui.render();
  assert.equal(ui.find('BoothDialog',p=>p.title==='Partner Disconnected').open,true);
  ui.find('BoothDialog',p=>p.title==='Partner Disconnected').onCancel();
  ui.find('SessionScreen').onPartnerConnection(true);ui.render();
  ui.party.ended=true;
  assert.equal(ui.find('BoothDialog',p=>p.title==='Partner Disconnected').open,true);
  ui.find('BoothDialog',p=>p.title==='Partner Disconnected').onConfirm();
  assert.ok(ui.find('ModeScreen'));assert.equal(ui.party.room,null);
});

test('header navigation uses the Duo exit guard and cancellation retains the session',async()=>{
  const ui=harness();await ui.start('duo','camera');let navigated=false;
  ui.leaveGuard.current(()=>{navigated=true;});
  assert.equal(ui.find('LeaveDialog').open,true);assert.equal(navigated,false);
  ui.find('LeaveDialog').onCancel();assert.ok(ui.find('SessionScreen'));assert.equal(navigated,false);
  ui.leaveGuard.current(()=>{navigated=true;});ui.find('LeaveDialog').onConfirm();
  assert.equal(navigated,true);assert.equal(ui.party.room,null);
});
