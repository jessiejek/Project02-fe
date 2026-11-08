import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require=createRequire(import.meta.url);
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
function compile(path,imports){
 const output=ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const container={exports:{}};vm.runInNewContext(output,{module:container,exports:container.exports,require:imports});return container.exports;
}
const {ROLE_CONFIG}=compile('lib/nav-config.ts',require);
export function renderSidebar(role,pathname=ROLE_CONFIG[role].navGroups[0].items[0].href,collapsed=false){
 const {Sidebar}=compile('components/shell/Sidebar.tsx',name=>{
  if(name==='next/navigation')return {usePathname:()=>pathname};
  if(name==='next/link')return {__esModule:true,default:({children,...props})=>React.createElement('a',props,children)};
  if(name==='@/lib/cn')return {cn:(...values)=>values.filter(Boolean).join(' ')};
  if(name==='@/lib/nav-config')return {ROLE_CONFIG};
  if(name==='@/components/ui/Icon')return {Icon:()=>React.createElement('span',{'data-icon':true})};
  return require(name);
 });
 return renderToStaticMarkup(React.createElement(Sidebar,{role,collapsed}));
}
for(const role of ['doctor','patient','staff','admin']){
 test(`${role} sidebar uses subtle corners and independent straight active/hover indicators`,()=>{
  const html=renderSidebar(role);
  const links=html.match(/<a[^>]*href="\/(?:doctor|patient|staff|admin)\/[^>]*>[\s\S]*?<\/a>/g);
  assert.ok(links.length>0);
  assert.equal(links.filter(link=>link.includes('aria-current="page"')).length,1);
  for(const link of links){
   assert.match(link,/rounded-nav/);assert.doesNotMatch(link,/border-l-|rounded-lg|rounded-full/);
   assert.match(link,/<span aria-hidden="true"[^>]*absolute inset-y-sm left-0 w-\[3px\] rounded-none/);
   if(!link.includes('aria-current="page"'))assert.match(link,/opacity-0 group-hover\/sidebar-nav:opacity-100/);
  }
  assert.match(renderSidebar(role,undefined,true),/rounded-nav/);
 });
}
test('navigation corner token is 8px, distinct from larger panel radii',()=>{
 assert.match(read('app/globals.css'),/--radius-nav:\s*0\.5rem;/);
});
