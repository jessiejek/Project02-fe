import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';
const root = new URL('../',import.meta.url);
const read = path => readFileSync(new URL(path,root),'utf8');
const container = {exports:{}};
vm.runInNewContext(ts.transpileModule(read('components/doctor/appointments/model.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:container,exports:container.exports});
const {mapAppointments,orderedAppointments,filterAppointments,focusAppointment,visitDate,appointmentAction}=container.exports;
const row=(id,queueNumber,status='CheckedIn',appointmentDate='2026-11-08')=>({id,queueNumber,status,appointmentDate,patientName:`Test ${id}`,patientCode:`LOCAL-${id}`,paymentStatus:null,visitType:'Consultation'});
const ids=rows=>Array.from(rows,r=>r.id);

test('doctor queue naturally sorts prefixed queue numbers without mutating input',()=>{
 const rows=[row('10','Q-10'),row('2','Q-2'),row('1','Q-001')];
 assert.deepEqual(ids(orderedAppointments(rows,'today')),['1','2','10']);assert.deepEqual(ids(rows),['10','2','1']);
});
test('doctor queue places unassigned numbers last, and ties sort symmetrically by patient name',()=>{
 const rows=[row('Z',null),row('A',null),row('2','Q-2')];
 assert.deepEqual(ids(orderedAppointments(rows,'today')),['2','A','Z']);
 assert.deepEqual(ids(orderedAppointments([...rows].reverse(),'today')),['2','A','Z']);
});
test('appointment history places visit dates ahead of queue number',()=>{
 assert.deepEqual(ids(orderedAppointments([row('old','Q-1','Completed','2026-10-01'),row('new','Q-40','Completed','2026-11-08')],'all')),['new','old']);
});
test('focus resumes an in-progress consultation before starting another',()=>{
 const rows=[row('waiting','Q-1'),row('active','Q-2','InProgress')];assert.equal(focusAppointment(rows).id,'active');
});
test('focus chooses only actionable patients and remains empty without them',()=>{
 assert.equal(focusAppointment([row('done','Q-1','Completed')]),undefined);
 assert.equal(focusAppointment([row('done','Q-1','Completed'),row('next','Q-2')]).id,'next');
});
for(const [label,query]of [['name','test a'],['patient ID','local-a'],['queue','q-12']]){
 test(`appointment search matches ${label} without case or extra-whitespace issues`,()=>assert.deepEqual(ids(filterAppointments([row('A','Q-12'),row('B','Q-20')],'all',`  ${query.toUpperCase()}  `)),['A']));
}
test('clinical status filters do not include cancelled, future-confirmed or completed visits in clinic',()=>{
 const rows=['CheckedIn','InProgress','Completed','Cancelled','Confirmed'].map((s,i)=>row(String(i),`Q-${i}`,s));
 assert.deepEqual(ids(filterAppointments(rows,'active','')),['0','1']);assert.deepEqual(ids(filterAppointments(rows,'waiting','')),['0']);assert.deepEqual(ids(filterAppointments(rows,'completed','')),['2']);
});
test('missing payments remain unknown; absent patient names are honest, not invented',()=>{
 const mapped=mapAppointments([{booking_id:'a',patients:null,payments:null,appointment_date:'2026-11-08',queue_number:null,status:'Confirmed',visit_type:'FollowUp'}])[0];
 assert.equal(mapped.paymentStatus,null);assert.equal(mapped.patientName,'Patient name unavailable');assert.equal(mapped.visitType,'Follow-up');
});
test('dates have a fixed Manila presentation and invalid dates do not crash or normalize silently',()=>{
 assert.equal(visitDate('2026-11-08'),'Nov 8, 2026');
 for(const input of ['', 'not-a-date','2026-99-99','2026-02-30'])assert.equal(visitDate(input),'Date unavailable');
});
test('actions preserve the clinical workflow destinations without triggering mutations',()=>{
 assert.equal(appointmentAction(row('a','Q-1')).href,'/doctor/consultation2/a');
 assert.equal(appointmentAction(row('a','Q-1','InProgress')).label,'Resume consultation');
 assert.equal(appointmentAction(row('a','Q-1','Completed')).href,'/doctor/appointments/a');
});
function* files(path){for(const entry of readdirSync(path,{withFileTypes:true})){const full=join(path,entry.name);if(entry.isDirectory())yield*files(full);else if(entry.name.endsWith('.tsx'))yield full;}}
test('all doctor routes use single interactive links, never nested link/button controls',()=>{
 for(const path of files(fileURLToPath(new URL('app/doctor',root)))){
  const source=readFileSync(path,'utf8'),tree=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  function visit(node,insideLink=false){const link=ts.isJsxElement(node)&&['Link','a'].includes(node.openingElement.tagName.getText(tree));
   if(insideLink&&(ts.isJsxElement(node)||ts.isJsxSelfClosingElement(node))){const tag=(ts.isJsxElement(node)?node.openingElement:node).tagName.getText(tree);assert.ok(!['Button','button','Link','a'].includes(tag),`${path}: nested ${tag}`);}
   ts.forEachChild(node,child=>visit(child,insideLink||link));
  }visit(tree);
 }
});
test('doctor dashboard removes fabricated hours and role-inappropriate payment links',()=>{
 const source=read('app/doctor/dashboard/page.tsx');assert.doesNotMatch(source,/Shift.*8:00|Tomorrow.*8:00|href=.*staff\/payments/);assert.match(source,/customError/);
});
test('doctor safety context remains readable and never converts unknown payment into unpaid',()=>{
 const banner=read('components/doctor/ConsultPatientBanner.tsx');assert.match(banner,/Allergies:/);assert.match(banner,/Not recorded/);assert.doesNotMatch(banner,/paymentStatus === "Paid" \? "Paid" : "Unpaid"|max-w-\[6\.5rem\]/);
});
test('doctor-only styling and transient feedback respect reduced motion',()=>{
 const css=read('app/doctor/doctor.css');assert.match(css,/prefers-reduced-motion:\s*reduce/);assert.match(css,/animation:\s*none/);
 assert.match(read('components/doctor/VitalsEditor.tsx'),/Your entries are still here/);
});
