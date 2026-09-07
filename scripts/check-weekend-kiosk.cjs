const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../kiosk/index.html'),'utf8');
for(const f of ['../kiosk/index.html','../index.html']){
 const source=fs.readFileSync(require('node:path').join(__dirname,f),'utf8');
 for(const script of source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new vm.Script(script[1]);
}
const code=html.slice(html.indexOf('  function classRpc('),html.indexOf('  var classRetryBusy='));
async function run(assigned){
 const recorded=[],messages=[];
 const ctx={Promise,Date,AbortController,clearTimeout,setTimeout,
 state:{classAttendance:[],sbUrl:'https://example.test',sbKey:'test'},classCheckInBusy:false,classMode:'weekend',classTeacherPin:'test-pin',
 WeekendRoster:{load:async()=>({}),assignments:()=>assigned},
 ClassAttendance:{find:id=>({id,kind:'weekend',day:'sat',label:id}),dateKey:()=> '2026-09-12',dayKey:()=> 'sat'},
 document:{getElementById:()=>({})},showResult:(...m)=>messages.push(m),saveData:()=>{},renderClassPanel:()=>{},
 fetch:async(url,opt)=>{recorded.push(JSON.parse(opt.body));return {ok:true,json:async()=>({checked_in_at:'2026-09-12T05:30:00Z'})};}};
 vm.createContext(ctx);vm.runInContext(code,ctx);
 await ctx.checkInRegularClass({name:'전반 테스트',kingStudentId:'a',classId:'hanbaek_sat_1030'});
 return {recorded,messages};
}
(async()=>{
 const transferred=await run(['hanbaek_sat_1430']);assert.equal(transferred.recorded[0].p_class_id,'hanbaek_sat_1430');
 assert.equal((await run([])).recorded.length,0);
 assert.equal((await run(['hanbaek_sat_1030','hanbaek_sat_1430'])).recorded.length,0);
 console.log('PASS: both HTML scripts compile; check-in uses date-specific transfer; missing/ambiguous assignments never create attendance');
})().catch(e=>{console.error(e);process.exitCode=1;});
