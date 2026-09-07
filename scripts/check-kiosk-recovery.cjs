const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../kiosk/index.html'),'utf8');
function section(start,end){return html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start)));}
async function run(storageFails){
  const button={};const results=[];let calls=0;
  const ctx={Promise,Date,AbortController,clearTimeout,setTimeout:fn=>setTimeout(fn,10),
    fetch:()=>{calls++;return new Promise(()=>{});},KING_SB_URL:'https://test.invalid',KING_SB_KEY:'fixture',
    state:{classAttendance:[],sbUrl:'https://test.invalid',sbKey:'fixture'},classCheckInBusy:false,classMode:'weekend',
    ClassAttendance:{find:()=>({id:'fixture',kind:'weekend',day:'sun',label:'테스트'}),dateKey:()=> '2026-09-06',dayKey:()=> 'sun'},
    document:{getElementById:()=>button},showResult:(...args)=>results.push(args),renderClassPanel:()=>{},
    saveData:()=>{if(storageFails)throw new Error('quota');}};
  vm.createContext(ctx);
  vm.runInContext(section('  function classRpc(', '  var classRetryBusy='),ctx);
  await ctx.checkInResolvedClass({name:'테스트',kingStudentId:'fixture',classId:'fixture'},ctx.ClassAttendance.find());
  assert.equal(ctx.classCheckInBusy,false);assert.equal(button.disabled,false);
  assert.equal(ctx.state.classAttendance.length,storageFails?0:1);
  assert.equal(results[0][0],storageFails?'err':'warn');
  assert.equal(calls,storageFails?0:1);
}
(async()=>{await run(false);await run(true);console.log('PASS: stalled server and storage errors release confirmation; unsaved attendance rolls back.');})().catch(e=>{console.error(e);process.exitCode=1;});
