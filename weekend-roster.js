(function(root){
 'use strict';
 function required(date){var d=new Date(date+'T12:00:00+09:00').getUTCDay();return d===6?['chidong_sat_1800','hanbaek_sat_1030','hanbaek_sat_1430']:d===0?['chidong_sun_1430','hanbaek_sun_1030']:[];}
 function validate(snapshot,date){
  if(!snapshot||snapshot.date!==date||!snapshot.version)throw Error(date+' 맥가이 명단 확인 필요');
  var cs=snapshot.classes;
  if(!Array.isArray(cs)||JSON.stringify(cs.map(function(c){return c.class_id;}).sort())!==JSON.stringify(required(date)))throw Error('수업 명단이 완전하지 않습니다.');
  cs.forEach(function(c){if(!Array.isArray(c.student_ids)||c.student_ids.length!==c.expected_count||new Set(c.student_ids).size!==c.student_ids.length||c.student_ids.some(function(id){return typeof id!=='string'||!id;}))throw Error('학생 명단 검증 실패');});
  return snapshot;
 }
 function assignments(snapshot,date,id){validate(snapshot,date);return snapshot.classes.filter(function(c){return c.student_ids.indexOf(id)!==-1;}).map(function(c){return c.class_id;});}
 function rows(snapshot,date,students){
  validate(snapshot,date);var out=[];
  snapshot.classes.forEach(function(c){c.student_ids.forEach(function(id){var matches=students.filter(function(s){return s.id===id;});if(matches.length!==1)throw Error('국어왕 학생 연결 확인 필요');out.push(Object.assign({},matches[0],{class_id:c.class_id}));});});return out;
 }
 function label(snapshot){return snapshot.date+' · 맥가이 명단 v'+snapshot.version+' · 확인 '+new Date(snapshot.source_checked_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});}
 function diff(before,after){
  validate(after,after.date);if(before&&before.version)validate(before,after.date);
  function map(s){var m={};(s&&s.classes||[]).forEach(function(c){c.student_ids.forEach(function(id){(m[id]||(m[id]=[])).push(c.class_id);});});Object.keys(m).forEach(function(id){m[id].sort();});return m;}
  var a=map(before),b=map(after),changes=[];
  Array.from(new Set(Object.keys(a).concat(Object.keys(b)))).sort().forEach(function(id){if(JSON.stringify(a[id])!==JSON.stringify(b[id]))changes.push({student_id:id,type:!a[id]?'added':!b[id]?'removed':'transferred',before:a[id]||[],after:b[id]||[]});});return changes;
 }
 function load(url,key,date,pin){
  if(!required(date).length)return Promise.resolve(null);
  if(!pin)return Promise.reject(Error('관리자 인증 후 명단을 확인해 주세요.'));
  var controller=new AbortController(),timer=setTimeout(function(){controller.abort();},8000);
  return fetch(url.replace(/\/+$/,'')+'/rest/v1/rpc/read_weekend_roster',{method:'POST',cache:'no-store',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({p_date:date,p_pin:pin}),signal:controller.signal}).then(function(r){if(!r.ok)throw Error('맥가이 명단 서버 확인 필요');return r.json();}).then(function(r){return validate(r,date);}).finally(function(){clearTimeout(timer);});
 }
 var api={required:required,validate:validate,assignments:assignments,rows:rows,label:label,diff:diff,load:load};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.WeekendRoster=api;
})(typeof window==='object'?window:this);
