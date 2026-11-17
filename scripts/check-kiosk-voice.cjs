const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'kiosk/index.html'),'utf8');
function section(start,end){const i=html.indexOf(start);assert.ok(i>=0,start);return html.slice(i,html.indexOf(end,i));}
const ClassAttendance=require(path.join(root,'class-attendance.js'));
const WeekendRoster=Object.assign({},require(path.join(root,'weekend-roster.js')));
const snapshot={date:'2026-11-21',version:3,classes:[
  {class_id:'hanbaek_sat_1030',expected_count:3,student_ids:['k1','k2','k3']},
  {class_id:'hanbaek_sat_1430',expected_count:1,student_ids:['k4']},
  {class_id:'chidong_sat_1800',expected_count:0,student_ids:[]}]};
let now,rpcCalls=0,loadFails=false;
class FakeDate extends Date{constructor(...a){a.length?super(...a):super(now.getTime());}}
const spoken=[],status={textContent:''};
const ctx={Date:FakeDate,ClassAttendance,WeekendRoster,Promise,setInterval:()=>{},saveData:()=>{},classTeacherPin:'pin',
  classRpc:()=>{rpcCalls++;return Promise.resolve([{student_id:'k2',class_id:'hanbaek_sat_1030',lesson_date:'2026-11-21',checked_in_at:'x'}]);},
  navigator:{userActivation:{hasBeenActive:true}},SpeechSynthesisUtterance:function(t){this.text=t;},
  document:{getElementById:()=>status},
  state:{noShowAlerted:{},sbUrl:'https://test.invalid',sbKey:'k',
    students:[{name:'김민수',kingStudentId:'k1'},{name:'이지은',kingStudentId:'k2'},{name:'박서준',kingStudentId:'k3'},{name:'최유나',kingStudentId:'k4'}],
    classAttendance:[{student_id:'k3',class_id:'hanbaek_sat_1030',lesson_date:'2026-11-21',synced:false}]}};
WeekendRoster.load=()=>loadFails?Promise.reject(new Error('맥가이 명단 서버 확인 필요')):Promise.resolve(snapshot);
ctx.window={speechSynthesis:{getVoices:()=>[{lang:'ko-KR'}],cancel:()=>{},speak:u=>spoken.push(u.text)}};
const tick=()=>new Promise(r=>setTimeout(r,0));
(async()=>{
  now=new Date('2026-11-18T09:12:00Z'); // 수요일 18:12 — 클리닉 시간이라도 읽지 않는다
  vm.createContext(ctx);
  vm.runInContext(section('  // ---------------- NO-SHOW VOICE ANNOUNCEMENT',"  document.getElementById('voiceSaveBtn')"),ctx);
  await tick();assert.equal(rpcCalls,0);assert.deepEqual(spoken,[]);
  now=new Date('2026-11-21T01:35:00Z'); // 토 10:35 — 시작 후 5분, 아직
  ctx.checkVoiceNoShows();await tick();assert.equal(rpcCalls,0);
  ctx.classTeacherPin='';now=new Date('2026-11-21T01:42:00Z'); // 명단 인증 전에는 읽지 않고 기록도 남기지 않는다
  ctx.checkVoiceNoShows();await tick();await tick();assert.deepEqual(spoken,[]);assert.match(status.textContent,/명단 인증/);
  ctx.classTeacherPin='pin';loadFails=true;ctx.checkVoiceNoShows();await tick();await tick();assert.deepEqual(spoken,[]);
  loadFails=false;ctx.checkVoiceNoShows();await tick();await tick();
  // 서버 출석(k2)과 패드 전송 대기(k3)는 제외, 14:30 수업은 아직
  assert.deepEqual(spoken,['한백 오전 10시 30분 수업, 아직 안 온 학생은 김민수, 1명입니다.']);
  ctx.checkVoiceNoShows();await tick();await tick();assert.equal(spoken.length,1,'수업마다 한 번만');
  now=new Date('2026-11-21T05:45:00Z'); // 14:45
  ctx.checkVoiceNoShows();await tick();await tick();
  assert.equal(spoken[1],'한백 오후 2시 30분 수업, 아직 안 온 학생은 최유나, 1명입니다.');
  ctx.state.voiceOn=false;ctx.state.noShowAlerted={};ctx.checkVoiceNoShows();await tick();await tick();assert.equal(spoken.length,2);
  console.log('PASS: voice reads weekend class no-shows once per class, never on clinic days, and waits for roster authorization.');
})().catch(e=>{console.error(e);process.exitCode=1;});
