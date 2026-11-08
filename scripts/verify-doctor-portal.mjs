// Read-only local doctor UI verification. Normal login; never creates/edits clinical records.
import { chromium, expect } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const origin = process.env.PREVIEW_URL || 'http://127.0.0.1:3001';
const phase = process.env.CAPTURE_PHASE || 'after';
const output = join(process.cwd(), 'test-results/doctor-portal'); mkdirSync(output,{recursive:true});
const seed=readFileSync('../Project02-be/src/ClinicApp.Infrastructure/DevDataSeeder.cs','utf8');
const password=/public const string DevPassword = "([^"]+)"/.exec(seed)[1];
const browser=await chromium.launch({headless:true,executablePath:join(homedir(),'Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing')});
const results=[],blocked=[];let page;
try {
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
 await context.route('**/*',route=>{
  const req=route.request(),url=new URL(req.url());
  if(!['127.0.0.1','localhost'].includes(url.hostname))return route.abort();
  // Next's local dev symbolication POST only reads source locations; it is not a clinical write.
  if(!['GET','HEAD','OPTIONS'].includes(req.method()) && url.pathname !== '/__nextjs_original-stack-frames' && !/\/api\/(session\/(login|refresh)|auth\/(login|refresh))|\/hubs\//.test(url.pathname)){
   blocked.push({method:req.method(),path:url.pathname});return route.abort();
  }
  return route.continue();
 });
 page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/login');await page.getByLabel('Email',{exact:true}).fill('doctor@clinic.test');await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Log in',exact:true}).click();await page.waitForURL('**/doctor/dashboard',{timeout:30000});
 // This is the application's normal token endpoint for this fresh login, never a saved session.
 const {token}=await (await context.request.get(origin+'/api/session/token')).json();assert.ok(token);
 const get=async path=>{const response=await context.request.get('http://127.0.0.1:5055'+path,{headers:{Authorization:`Bearer ${token}`}});assert.equal(response.status(),200,path);return response.json()};
 const me=await get('/api/staff-accounts/me');
 const bookings=await get('/api/bookings?doctorId='+me.staff_id);
 const own=(Array.isArray(bookings)?bookings:bookings.items).filter(row=>row.doctor_id===me.staff_id);
 const groups=await get('/api/prescription-groups?doctorId='+me.staff_id);
 const rx=(Array.isArray(groups)?groups:groups.items).find(row=>row.booking_id&&row.patient_id);
 const booking=own.find(row=>row.booking_id===rx?.booking_id) || own.find(row=>row.status==='Completed') || own[0];assert.ok(booking);
 const patient=rx?.patient_id||booking.patient_id;
 const routes=[
  ['dashboard','/doctor/dashboard'],['appointments','/doctor/appointments'],['patients','/doctor/patients'],['schedule','/doctor/schedule'],['templates','/doctor/templates'],['settings','/doctor/settings'],['profile','/doctor/profile'],
  ['appointment-detail','/doctor/appointments/'+booking.booking_id],['patient-chart','/doctor/patients/'+patient],
  ['consultation','/doctor/consultation2/'+booking.booking_id+'?mode=view'],['legacy-consultation','/doctor/consultation/'+booking.booking_id+'?mode=view'],
  ['vitals','/doctor/consultation/'+booking.booking_id+'/vitals'],['prescription-create',`/doctor/patients/${patient}/prescriptions/create?bookingId=${booking.booking_id}`],
 ];
 if(rx)routes.push(['prescription-edit',`/doctor/patients/${patient}/prescriptions/${rx.group_id}`]);
 for(const [name,path]of routes){
  await page.setViewportSize({width:1440,height:1000});const response=await page.goto(origin+path);assert.ok(response.status()<400,`${name} HTTP ${response.status()}`);
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(()=>{const main=document.querySelector('main');return !!main&&!/^Loading[^\n]*[….]?$/.test(main.innerText.trim())&&!main.querySelector('[aria-busy="true"]')&&!main.querySelector('.animate-pulse')},{},{timeout:30000});
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
   await page.screenshot({path:join(output,`${phase}-${name}-${width}.png`),fullPage:false});
   const nested=await page.locator('main a button').count();
   results.push({name,path,width,http:response.status(),overflow,nestedControls:nested});
   if(phase==='after'){assert.equal(overflow,false,`${name}: horizontal overflow ${width}`);assert.equal(nested,0,`${name}: nested link/button controls`);}
  }
 }
 if(phase==='after'){
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(origin+'/doctor/consultation2/'+booking.booking_id+'?mode=view');
  await page.getByRole('button',{name:'Edit Consultation',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Amend consultation',exact:true})).toBeVisible();
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Documentation workspace must not overflow');
   await page.screenshot({path:join(output,`after-consultation-editor-${width}.png`),fullPage:false});
  }
  await page.goto(origin+'/doctor/appointments');await page.waitForFunction(()=>!document.querySelector('main [aria-busy="true"]'));
  assert.ok((await page.getByLabel('Search patients, patient IDs or queue numbers').boundingBox()).width > 300, 'Search must remain usable, not collapse to a spacing token');
  await page.getByRole('button',{name:'History',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('main [aria-busy="true"]'));
  await expect(page.getByRole('heading',{name:'Appointment history',exact:true})).toBeVisible();
  await page.getByLabel('Search patients, patient IDs or queue numbers').fill('a-no-match-search');
  await expect(page.getByRole('heading',{name:'No matching appointments'})).toBeVisible();
  await page.getByRole('button',{name:'Clear filters',exact:true}).click();
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.screenshot({path:join(output,`after-appointment-history-${width}.png`),fullPage:false});}
  // Exercise a real empty/error/loading transition, without inventing patient data.
  await context.route('**/api/bookings**',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Verification-only unavailable response'})}));
  await page.getByRole('button',{name:'Refresh',exact:true}).click();await expect(page.locator('main [role=alert]')).toContainText('could not be refreshed');
  await page.screenshot({path:join(output,'after-appointments-refresh-error.png'),fullPage:false});
  await context.unroute('**/api/bookings**');await page.getByRole('button',{name:'Try again',exact:true}).click();await expect(page.locator('main [role=alert]')).toHaveCount(0);
  await page.emulateMedia({reducedMotion:'reduce'});
  let release;const gate=new Promise(resolve=>release=resolve);
  const slow=async route=>{await gate;await route.continue()};
  await context.route('**/api/bookings**',slow);
  await page.goto(origin+'/doctor/appointments');
  await expect(page.locator('main section[aria-busy=true]')).toBeVisible();
  await page.screenshot({path:join(output,'after-appointments-loading-reduced-motion.png'),fullPage:false});
  const pulse=page.locator('main .animate-pulse').first();await expect(pulse).toBeVisible();
  assert.equal(await pulse.evaluate(el=>getComputedStyle(el).animationName),'none','Reduced-motion skeletons must remain static');
  release();await context.unroute('**/api/bookings**',slow);
  await expect(page.locator('main section[aria-busy=true]')).toHaveCount(0);
  await page.screenshot({path:join(output,'after-appointments-reduced-motion.png'),fullPage:false});
 }
 assert.deepEqual(blocked,[],'No clinical mutation should be attempted by page navigation');
 assert.deepEqual(errors,[],'No uncaught browser errors');
 writeFileSync(join(output,`${phase}-results.json`),JSON.stringify({results,blocked,errors},null,2));
 console.log(`${phase}: ${results.length} route/viewport captures (${routes.length} doctor routes), no clinical writes; ${output}`);
 await context.close();
}catch(error){if(page&&!page.isClosed())await page.screenshot({path:join(output,`${phase}-failure.png`),fullPage:false});writeFileSync(join(output,`${phase}-failure.json`),JSON.stringify({error:String(error),results,blocked},null,2));throw error;}
finally{await browser.close()}
