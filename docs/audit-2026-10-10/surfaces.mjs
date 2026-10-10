import { chromium } from '/Users/domenico/Code/Strumentini.it/node_modules/@playwright/test/index.mjs';
import { writeFile } from 'node:fs/promises';
const out='/tmp/strumentini-independent-audit';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const routes=[['home','/'],['directory','/strumenti/'],['category','/categorie/pdf/'],['search','/cerca/?q=unisci+pdf'],['onboarding','/onboarding/'],['lighttool','/tools/utm-builder/'],['image','/tools/image-compression/'],['pdf','/tools/pdf-merge/'],['csv','/tools/csv-cleaner/'],['workbench','/preferiti/'],['account','/accedi/'],['settings','/impostazioni/'],['resources','/risorse/']];
const records=[];
for(const theme of ['light','dark']){
 for(const width of [320,390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:900},acceptDownloads:true});
  await context.addInitScript(t=>localStorage.setItem('strumentini:theme:v1',t),theme);
  const page=await context.newPage();
  for(const [name,route] of routes){
   const errors=[]; const onerr=e=>errors.push(e.message); page.on('pageerror',onerr);
   try{
    const start=Date.now(); const resp=await page.goto('https://strumentini.it'+route,{waitUntil:'networkidle',timeout:25000});
    await page.screenshot({path:`${out}/${name}-${width}-${theme}.png`,fullPage:false});
    if(width===390&&theme==='light')await page.screenshot({path:`${out}/${name}-${width}-${theme}-full.png`,fullPage:true});
    const data=await page.evaluate(()=>({title:document.title,theme:document.documentElement.dataset.theme,scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth,height:document.documentElement.scrollHeight,h1:document.querySelector('h1')?.textContent.trim(),text:document.body.innerText.slice(0,22000),inputs:[...document.querySelectorAll('input,textarea,select')].map(e=>({tag:e.tagName,type:e.type,label:e.getAttribute('aria-label'),id:e.id,name:e.name,placeholder:e.placeholder})),buttons:[...document.querySelectorAll('button')].filter(e=>e.getBoundingClientRect().width>0).map(e=>({text:e.textContent.trim(),aria:e.getAttribute('aria-label'),width:Math.round(e.getBoundingClientRect().width),height:Math.round(e.getBoundingClientRect().height)})),nav:performance.getEntriesByType('navigation').map(e=>({ttfb:Math.round(e.responseStart),dcl:Math.round(e.domContentLoadedEventEnd),load:Math.round(e.loadEventEnd)})),resources:performance.getEntriesByType('resource').map(e=>({name:e.name.split('/').pop(),duration:Math.round(e.duration),transfer:e.transferSize,decoded:e.decodedBodySize}))}));
    const record={name,route,width,theme,status:resp.status(),elapsedMs:Date.now()-start,errors,...data};records.push(record);
    console.log(JSON.stringify({name,width,theme,status:record.status,overflow:data.scrollWidth>width+2,height:data.height,elapsedMs:record.elapsedMs,errors}));
   }catch(e){records.push({name,route,width,theme,error:String(e)});console.log(JSON.stringify({name,width,theme,error:String(e)}));}
   page.off('pageerror',onerr);
  }
  await context.close();
 }
}
await writeFile(out+'/surfaces.json',JSON.stringify(records,null,2));await browser.close();
