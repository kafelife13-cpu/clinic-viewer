const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const path=require('node:path');
const html=fs.readFileSync(process.env.KIOSK_HTML||path.join(__dirname,'../kiosk/index.html'),'utf8');
function section(start,end){const at=html.indexOf(start);assert(at>=0);const to=html.indexOf(end,at);assert(to>at);return html.slice(at,to);}
const cloud=section('  function markAttendanceSynced(', '  function syncAttendanceToKing(');
const click=section("  document.getElementById('confirmBtn').addEventListener('click'", '\n  renderPhone();');
const tick=()=>new Promise(r=>setImmediate(r));
function setup({response={ok:true,status:201},storageFails=false,logFails=false,networkError=false,stalled=false,shortTimeout=false,abort=true}={}){
 const badges=[],results=[],button={disabled:false},student={id:'local-fixture',name:'fixture',days:['thu'],phone:'0000'};
 let clickHandler,calls=0,resolveFetch;
 const pending=new Promise(resolve=>resolveFetch=resolve);
 const context={Promise,Date,clearTimeout,setTimeout:shortTimeout?fn=>setTimeout(fn,10):setTimeout,
  state:{sbUrl:'https://fixture.invalid',sbKey:'fixture',attendance:[]},DAY_LABELS:{thu:'목'},
  cloudAttendanceStudentId:()=> 'fixture',saveData:()=>{if(storageFails)throw Error('QuotaExceededError');},
  logSync:()=>{if(logFails)throw Error('QuotaExceededError');},setSyncBadge:(...x)=>badges.push(x),
  fetch:()=>{calls++;return networkError?Promise.reject(Error('Failed to fetch')):stalled?new Promise(()=>{}):pending;},
  document:{getElementById:()=>({...button,addEventListener:(event,fn)=>clickHandler=fn})},
  digitsOnly:x=>x,phone:'0000',findActiveStudent:()=>student,classMode:'clinic',
  operationalDate:d=>d,todayKey:()=> '2026-10-29',dayKeyOf:()=> 'thu',uid:()=> 'attendance-fixture',
  showResult:(...x)=>results.push(x),syncAttendanceToKing:()=>Promise.resolve(false),
  adminOpen:false,refreshAttendancePanel:()=>{},recordUnknownAttempt:()=>{},checkInRegularClass:()=>{}
 };
 if(abort)context.AbortController=AbortController;
 context.document.getElementById=()=>button;button.addEventListener=(event,fn)=>clickHandler=fn;
 vm.createContext(context);vm.runInContext(cloud,context);vm.runInContext(click,context);
 return {context,badges,results,button,click:()=>clickHandler(),calls:()=>calls,resolve:()=>resolveFetch(response)};
}
(async()=>{
 let t=setup();t.click();assert.equal(t.results.length,0,'must not report completion before HTTP acknowledgement');assert.equal(t.button.disabled,true);t.resolve();await tick();assert.equal(t.results[0][0],'ok');assert.equal(t.context.state.attendance[0].synced,true);assert.equal(t.button.disabled,false);
 t=setup({response:{ok:false,status:403,text:async()=>JSON.stringify({code:'42501',message:'permission denied'})}});t.click();t.resolve();await tick();assert.equal(t.results[0][0],'warn');assert.match(t.badges.at(-1)[1],/403.*42501/);assert.equal(t.context.state.attendance[0].synced,false);t.click();assert.equal(t.calls(),1);assert.match(t.results.at(-1)[3],/전송 대기/);
 for(const failure of ['storageFails','logFails']){t=setup({[failure]:true});t.context.state.attendance.push({id:'fixture',synced:false});const p=t.context.syncAttendanceToCloud({name:'fixture'},'thu','20:00','fixture','2026-10-29T11:00:00Z');t.resolve();assert.equal(await p,true);assert.equal(t.context.state.attendance[0].synced,true);assert.match(t.badges.at(-1)[1],/서버 저장 완료.*기기 저장공간/);assert.doesNotMatch(t.badges.at(-1)[1],/인터넷/);}
 t=setup({networkError:true});t.click();await tick();assert.equal(t.results[0][0],'warn');assert.equal(t.button.disabled,false);assert.equal(t.context.state.attendance[0].synced,false);
 t=setup({stalled:true,shortTimeout:true,abort:false});t.click();await new Promise(r=>setTimeout(r,30));assert.equal(t.button.disabled,false);assert.equal(t.results[0][0],'warn');assert.match(t.badges.at(-1)[1],/응답 지연/);
 t=setup();t.context.state.sbUrl='';assert.equal(await t.context.syncAttendanceToCloud({},'thu'),false);assert.equal(t.calls(),0);
 console.log('PASS: completion waits for server; HTTP failure stays pending; local storage/log failures preserve server acknowledgement; network/timeout release input; missing config stays pending. All network calls mocked, student-data writes 0.');
})().catch(e=>{console.error(e);process.exitCode=1;});
