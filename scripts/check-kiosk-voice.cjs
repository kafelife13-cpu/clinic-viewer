const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../kiosk/index.html'),'utf8');
function section(start,end){const i=html.indexOf(start);assert.ok(i>=0,start);return html.slice(i,html.indexOf(end,i));}
let now=new Date(2026,10,16,18,12);
class FakeDate extends Date{constructor(...a){a.length?super(...a):super(now.getTime());}}
const spoken=[],saved=[];
const ctx={Date:FakeDate,DAY_KEYS:['sun','mon','tue','wed','thu','fri','sat'],setInterval:()=>{},
  navigator:{userActivation:{hasBeenActive:true}},
  SpeechSynthesisUtterance:function(text){this.text=text;},
  document:{getElementById:()=>({textContent:''})},saveData:()=>saved.push(1),
  state:{noShowAlerted:{},students:[
    {id:'a',name:'김민수',days:['mon'],time:'6-8시'},
    {id:'b',name:'이지은',days:['mon'],time:'6-8시'},
    {id:'c',name:'박서준',days:['mon'],time:'6-8시'},
    {id:'c2',name:'박 서준',days:['mon'],time:'6-8시',weekStart:'2026-11-16'},
    {id:'d',name:'최유나',days:['mon'],time:'7-9시'},
    {id:'e',name:'정하늘',days:['tue'],time:'6-8시'}],
   attendance:[{studentId:'c',date:'2026-11-16'}]}};
ctx.window={speechSynthesis:{getVoices:()=>[{lang:'ko-KR'}],cancel:()=>{},speak:u=>spoken.push(u.text)}};
vm.createContext(ctx);
vm.runInContext(section('  function operationalDate(','  function uid()'),ctx);
vm.runInContext(section('  function parseStartTime(','  function checkNoShows('),ctx);
vm.runInContext(section('  // ---------------- NO-SHOW VOICE ANNOUNCEMENT',"  document.getElementById('voiceSaveBtn')"),ctx);
// 로드 시점(18:12, 시작 후 12분): 6시 미출석자만 한 번 읽는다. 이름 공백이 달라도 같은 학생으로 본다.
assert.deepEqual(spoken,['오후 6시 클리닉, 아직 안 온 학생은 김민수, 이지은, 2명입니다.']);
ctx.checkVoiceNoShows();assert.equal(spoken.length,1,'같은 시간대는 다시 읽지 않는다');
now=new Date(2026,10,16,19,5);ctx.checkVoiceNoShows();assert.equal(spoken.length,1,'7시 클리닉은 10분 전까지 읽지 않는다');
ctx.state.attendance.push({studentId:'d',date:'2026-11-16'});
now=new Date(2026,10,16,19,10);ctx.checkVoiceNoShows();assert.equal(spoken.length,1,'모두 왔으면 읽지 않는다');
// 패드를 늦게 켜면(시작 후 70분 초과) 지난 시간대를 읽지 않는다.
ctx.state.noShowAlerted={};now=new Date(2026,10,16,19,15);ctx.checkVoiceNoShows();assert.equal(spoken.length,1);
// 화면을 한 번도 누르지 않았으면 기록하지 않고 다음 확인 때 읽는다.
ctx.navigator.userActivation.hasBeenActive=false;now=new Date(2026,10,16,18,30);ctx.checkVoiceNoShows();
assert.equal(spoken.length,1);assert.equal(ctx.state.noShowAlerted['2026-11-16:voice:18:00'],undefined);
ctx.navigator.userActivation.hasBeenActive=true;ctx.checkVoiceNoShows();assert.equal(spoken.length,2);
ctx.state.voiceOn=false;ctx.state.noShowAlerted={};ctx.checkVoiceNoShows();assert.equal(spoken.length,2,'꺼져 있으면 읽지 않는다');
console.log('PASS: no-show voice reads each clinic slot once after the delay, skips arrivals, stale slots, and disabled mode.');
