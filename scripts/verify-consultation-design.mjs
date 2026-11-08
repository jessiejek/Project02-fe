// Local test fixture only. Never finalizes a visit or writes prescriptions/clinical fields.
import { chromium, expect } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const phase=process.env.CAPTURE_PHASE||'after';
const dir=join(process.cwd(),'test-results/consultation-design');mkdirSync(dir,{recursive:true});
const password=/public const string DevPassword = "([^"]+)"/.exec(readFileSync('../Project02-be/src/ClinicApp.Infrastructure/DevDataSeeder.cs','utf8'))[1];
const booking='5eeab017-4481-44f3-be42-897acf879569',base='http://localhost:3001';
const browser=await chromium.launch({headless:true,executablePath:join(homedir(),'Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing')});
const blocked=[],errors=[],checks={};
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
 await context.route('**/*',route=>{
  const r=route.request(),u=new URL(r.url());
  if(!['127.0.0.1','localhost'].includes(u.hostname))return route.abort();
  if(!['GET','HEAD','OPTIONS'].includes(r.method())&&!/\/api\/(session\/(login|refresh)|auth\/(login|refresh))|\/hubs\//.test(u.pathname)&&u.pathname!=='/__nextjs_original-stack-frames'){
   blocked.push({method:r.method(),path:u.pathname});return route.abort();
  }
  return route.continue();
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/login');await page.getByLabel('Email',{exact:true}).fill('doctor@clinic.test');await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Log in',exact:true}).click();await page.waitForURL('**/doctor/dashboard',{timeout:10000}).catch(async e=>{console.log('Login debug:',page.url(),await page.locator('body').innerText(),blocked);throw e;});
 await page.goto(base+'/doctor/consultation2/'+booking);await page.waitForLoadState('networkidle');
 await expect(page.getByText('Test Patient',{exact:false}).first()).toBeVisible();
 await page.waitForFunction(()=>document.querySelector('main textarea'));
 if(phase==='after'){
  const editor=page.locator('main .clinical-note-field textarea').first();
  checks.chiefEditorWidth=(await editor.boundingBox()).width;
  assert(checks.chiefEditorWidth>800,'Clinical notes dominate the desktop workspace');
  const selectedVisit=page.getByRole('button',{name:'New visit',exact:true});
  await expect(selectedVisit).toHaveAttribute('aria-pressed','true');
  await expect(selectedVisit).toHaveClass(/bg-primary text-on-primary/);
  checks.selectedVisitHasSolidBrandHighlight=true;
  for(const label of ['Chief complaint','Subjective','Objective','Assessment','Plan'])await expect(page.getByLabel(label,{exact:false}).first()).toBeVisible();
  await expect(page.locator('main button.bg-primary:visible:not([aria-pressed])')).toHaveCount(1);
  // Prove an untouched visit stays untouched across the 30-second autosave interval.
  await page.waitForTimeout(31000);
  checks.untouchedAutosaveNoop=blocked.length===0;
  assert.deepEqual(blocked,[],'Viewing must not create an empty draft');
 }
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No page overflow');
  await page.screenshot({path:join(dir,`${phase}-consultation-${width}.png`),fullPage:false});
  if(width===1440&&phase==='after'){
   await page.evaluate(()=>window.scrollTo(0,300));
   await page.screenshot({path:join(dir,'after-soap-1440.png'),fullPage:false});
   await page.evaluate(()=>window.scrollTo(0,0));
  }
 }
 await page.setViewportSize({width:1440,height:1000});
 const nav=page.getByRole('navigation',{name:'Consultation sections'});
 for(const [name,pattern]of [['vitals',/Vital Signs/],['diagnosis',/Diagnosis/],['prescription',/Prescription/],['orders',/Lab Orders/],['follow-up',/Follow-up/],['certificate',/Medical Certificate/],['vaccinations',/Vaccinations/],['fees',/Professional Fee Decision/]]){
  await nav.getByRole('button',{name:pattern}).click();
  await page.waitForLoadState('networkidle');
  if(phase==='after')await expect(page.locator('main button.bg-primary:visible:not([aria-pressed])')).toHaveCount(1);
  await page.screenshot({path:join(dir,`${phase}-${name}-1440.png`),fullPage:false});
  if(phase==='after'&&name==='prescription'){
   await page.getByRole('tab',{name:'Templates',exact:true}).click();
   await expect(page.locator('main button.bg-primary:visible:not([aria-pressed])')).toHaveCount(1);
   await page.getByRole('tab',{name:'New Prescription',exact:true}).click();
  }
 }
 await page.getByRole('button',{name:'View Patient History',exact:true}).click();
 await expect(page.getByRole('tab',{name:'Consultations',exact:true})).toBeVisible();
 await page.screenshot({path:join(dir,`${phase}-history-1440.png`),fullPage:false});
 if(phase==='after')for(const name of ['Vitals','Prescriptions','Lab Results','Documents','Vaccinations']){
  await page.getByRole('tab',{name,exact:true}).click();
  await page.screenshot({path:join(dir,`after-history-${name.toLowerCase().replaceAll(' ','-')}-1440.png`),fullPage:false});
 }
 if(phase==='after')await page.getByRole('tab',{name:'Consultations',exact:true}).click();
 if(phase==='after'){
  await page.getByRole('button',{name:'Close',exact:true}).click();
  const patientPattern='**/api/patients/3ed27e56-07d5-4731-84af-f07e06f4f019';
  let releaseHistory;
  const historyGate=new Promise(resolve=>{releaseHistory=resolve;});
  const slowHistory=async route=>{await historyGate;return route.continue();};
  await context.route(patientPattern,slowHistory);
  await page.getByRole('button',{name:'View Patient History',exact:true}).click();
  await expect(page.getByRole('tab',{name:'Consultations',exact:true})).not.toBeVisible();
  await page.screenshot({path:join(dir,'after-history-loading-1440.png'),fullPage:false});
  releaseHistory();
  await expect(page.getByRole('tab',{name:'Consultations',exact:true})).toBeVisible();
  await context.unroute(patientPattern,slowHistory);
  await page.getByRole('button',{name:'Close',exact:true}).click();
  const failedHistory=route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Simulated history outage for read-only UI verification'})});
  await context.route(patientPattern,failedHistory);
  await page.getByRole('button',{name:'View Patient History',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Patient history unavailable',exact:true})).toBeVisible();
  await page.waitForTimeout(250); // Capture the settled dialog rather than its entrance opacity.
  await page.screenshot({path:join(dir,'after-history-error-1440.png'),fullPage:false});
  await context.unroute(patientPattern,failedHistory);
  await page.getByRole('button',{name:'Try again',exact:true}).click();
  await expect(page.getByRole('tab',{name:'Consultations',exact:true})).toBeVisible();
  checks.historyLoadingErrorAndRetry=true;
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await nav.getByRole('button',{name:/Clinical notes/}).click();
  await page.emulateMedia({reducedMotion:'reduce'});
  checks.reducedMotion=await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
  await page.screenshot({path:join(dir,'after-reduced-motion-1440.png'),fullPage:false});
 }
 assert.deepEqual(errors,[],'No uncaught UI errors');
 if(phase==='after')assert.deepEqual(blocked,[],'No clinical writes should be needed for viewing or inspecting panels');
 writeFileSync(join(dir,`${phase}-results.json`),JSON.stringify({checks,errors,blocked},null,2));
 console.log(`${phase} captures saved: ${dir}; no fields edited, no clinical save/complete/prescription actions clicked`);
}finally{await browser.close()}
