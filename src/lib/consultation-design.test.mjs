import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require=createRequire(import.meta.url);
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const page=read('app/doctor/consultation2/[bookingId]/page.tsx');
test('clinical notes are full-width, labelled editors without pre-filled clinical findings',()=>{
 const container={exports:{}};vm.runInNewContext(ts.transpileModule(read('components/doctor/ClinicalNoteField.tsx'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module:container,exports:container.exports,require});
 const html=renderToStaticMarkup(React.createElement(container.exports.ClinicalNoteField,{id:'chief',label:'Chief complaint',hint:'Reason for visit',value:'',onChange:()=>{},tools:null,required:true}));
 assert.match(html,/for="chief"/);assert.match(html,/aria-required="true"/);assert.match(html,/aria-describedby="chief-hint"/);assert.match(html,/<textarea[^>]*><\/textarea>/);
 assert.doesNotMatch(page,/lg:grid-cols-\[15rem_minmax/);assert.match(page,/sm:grid-cols-2/);
});
test('clinical completion, allergy and prescription review requirements are preserved',()=>{
 assert.match(page,/const REQUIRED_SECTIONS = \[0, 1, 2, 3, 6\]/);
 assert.match(page,/allergiesNeedPrescriptionReview/);assert.match(page,/noMedsConfirmed/);assert.match(page,/disabled=\{!canComplete \|\| savingDraft\}/);
});
test('background save uses the latest callback only when changed, idle and not finalized',()=>{
 assert.match(page,/latestDraftSave\.current = handleSaveDraft/);
 assert.match(page,/formDirtyRef\.current && !draftSaveInFlight\.current && !consultationFinalizedRef\.current/);
 assert.match(page,/if \(draftSaveInFlight\.current \|\| consultationFinalizedRef\.current\) return/);
 assert.match(page,/completeBaselineRef\.current = snapshotBeingSaved/);
 assert.match(page,/currentFormSnapshot\(\) !== savedDraftSnapshot/);
});
test('save feedback is persistent and does not pretend an error was saved',()=>{
 assert.match(page,/aria-live="polite" aria-atomic="true"/);assert.match(page,/Not saved — your entries are still here/);assert.match(page,/timeZone: "Asia\/Manila"/);
 assert.match(read('components/doctor/SoapFieldToolbar.tsx'),/finally \{ setSaving\(false\)/);
 assert.match(page,/Draft loaded · no new changes/);
 assert.match(page,/visitType === vt\s*\? "border-primary bg-primary text-on-primary"/);
 assert.match(read('components/doctor/PatientHistoryModal.tsx'),/Patient history unavailable/);
 assert.match(read('components/doctor/PatientHistoryModal.tsx'),/if \(!patientRow\) throw/);
});
test('clinical surface uses radius math, tabular figures and reduced-motion feedback',()=>{
 const css=read('app/doctor/consultation2/[bookingId]/consultation.css');assert.match(css,/calc\(var\(--consult-panel-radius\) - var\(--consult-panel-padding\)\)/);assert.match(css,/tabular-nums/);assert.match(css,/prefers-reduced-motion: reduce/);
});
