const assert=require('node:assert/strict');
const W=require('../weekend-roster');
const snapshot={date:'2026-09-12',version:1,classes:W.required('2026-09-12').map(class_id=>({class_id,student_ids:[],expected_count:0}))};
let requests=0;
global.fetch=async(url,options)=>{requests++;const body=JSON.parse(options.body);assert.equal(body.p_date,snapshot.date);return {ok:body.p_pin==='test-pin',json:async()=>snapshot};};
(async()=>{
 await assert.rejects(W.load('https://example.test','public',snapshot.date),/인증/);
 assert.equal(requests,0);
 await assert.rejects(W.load('https://example.test','public',snapshot.date,'wrong'));
 assert.deepEqual(await W.load('https://example.test','public',snapshot.date,'test-pin'),snapshot);
 console.log('PASS: missing PIN fails closed, rejected PIN returns no roster, valid PIN is sent in request body.');
})().catch(e=>{console.error(e);process.exitCode=1;});
