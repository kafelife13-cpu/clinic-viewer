// Input is a fresh, complete browser-observed lesson list. Never a monthly roster.
const fs=require('node:fs'),path=require('node:path');
const R=require('../weekend-roster');
function prepare(source,users,checkedAt){
 if(!Array.isArray(source)||!source.length)throw Error('No source lessons');
 const dates=[...new Set(source.map(c=>c.date))].sort();
 if(dates.length!==2||R.required(dates[0]).length!==3||R.required(dates[1]).length!==2||Date.parse(dates[1])-Date.parse(dates[0])!==86400000)throw Error('Both days of one weekend are required');
 const snapshots=dates.map(date=>({date,version:1,source_checked_at:checkedAt,classes:source.filter(c=>c.date===date).map(c=>{
  const names=c.students?c.students.map(s=>s.name):c.names.trim().split(/\s+/);
  if(names.length!==c.expected_count)throw Error('Source count mismatch '+c.class_id);
  const student_ids=names.map(name=>{const found=users.filter(u=>u.role==='student'&&u.status==='active'&&u.name===name&&u.school===c.school);if(found.length!==1)throw Error('Student mapping needs review: '+name+' / '+c.school);return found[0].id;}).sort();
  return {class_id:c.class_id,expected_count:c.expected_count,student_ids};
 }).sort((a,b)=>a.class_id.localeCompare(b.class_id))}));
 snapshots.forEach(s=>R.validate(s,s.date));return snapshots;
}
function sqlFor(snapshots){const quote=s=>"'"+String(s).replace(/'/g,"''")+"'";
 return 'begin;\n'+snapshots.map(s=>'select private.import_weekend_roster('+quote(s.date)+'::date,'+quote(s.source_checked_at)+'::timestamptz,'+quote(JSON.stringify(s.classes))+'::jsonb);').join('\n')+'\ncommit;\n'+snapshots.map(s=>'select public.read_weekend_roster('+quote(s.date)+'::date);').join('\n');
}
if(require.main===module){
 const [sourcePath,usersPath,outDir,checkedAt]=process.argv.slice(2);
 if(!checkedAt||!Number.isFinite(Date.parse(checkedAt)))throw Error('Provide actual browser observation timestamp');
 const snapshots=prepare(JSON.parse(fs.readFileSync(sourcePath)),JSON.parse(fs.readFileSync(usersPath)),checkedAt);
 fs.mkdirSync(outDir,{recursive:true});fs.writeFileSync(path.join(outDir,'weekend-roster-import.sql'),sqlFor(snapshots));fs.writeFileSync(path.join(outDir,'weekend-roster-preview.json'),JSON.stringify(snapshots,null,2));
 console.log(JSON.stringify(snapshots.map(s=>({date:s.date,classes:s.classes.map(c=>({class_id:c.class_id,count:c.expected_count}))}))));
}
module.exports={prepare,sqlFor};
