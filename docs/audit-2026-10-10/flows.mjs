import {chromium} from '/Users/domenico/Code/Strumentini.it/node_modules/@playwright/test/index.mjs';
import {createRequire} from 'node:module';import {readFile,writeFile} from 'node:fs/promises';
const require=createRequire('/Users/domenico/Code/Strumentini.it/package.json');const sharp=require('sharp');
const root='/Users/domenico/Code/Strumentini.it',out='/tmp/strumentini-independent-audit';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const proof=[];
for(const width of [390,1440]){
const context=await browser.newContext({viewport:{width,height:900},acceptDownloads:true});const page=await context.newPage();
const requests=[];page.on('request',r=>requests.push({host:new URL(r.url()).hostname,method:r.method(),path:new URL(r.url()).pathname,bytes:r.postDataBuffer()?.length??0}));
const record=(name,data)=>{proof.push({name,width,...data});console.log(JSON.stringify({name,width,...data}));};
async function screen(name){await page.screenshot({path:`${out}/${name}-${width}.png`});}
async function download(locator,name){const event=page.waitForEvent('download');await locator.click();const d=await event;const bytes=await readFile(await d.path());await writeFile(`${out}/${width}-${name}`,bytes);return {filename:d.suggestedFilename(),bytes};}
try{
await page.goto('https://strumentini.it/tools/utm-builder/',{waitUntil:'networkidle'});const start=Date.now();
await page.getByLabel('URL di destinazione',{exact:true}).fill('https://example.com/catalogo?ref=cliente#scheda');
await page.getByLabel('Sorgente',{exact:true}).fill('newsletter');await page.getByLabel('Mezzo',{exact:true}).fill('email');await page.getByLabel('Campagna',{exact:true}).fill('ottobre 2026');await page.getByRole('button',{name:'Crea URL',exact:true}).click();
await page.locator('[data-result-class="text-code"]').waitFor();await screen('utm-result');
const d=await download(page.locator('[data-result-class="text-code"]').getByRole('button',{name:/scarica/i}),'utm.txt');const url=new URL(d.bytes.toString());record('utm',{filename:d.filename,output:d.bytes.toString(),verified:url.searchParams.get('ref')==='cliente'&&url.hash==='#scheda'&&url.searchParams.get('utm_campaign')==='ottobre 2026',elapsedMs:Date.now()-start,actions:6});
await page.getByLabel('URL di destinazione',{exact:true}).fill('not a url');await page.getByRole('button',{name:'Crea URL',exact:true}).click();await page.locator('main [role=alert]').first().waitFor();record('utm-error',{message:await page.locator('main [role=alert]').first().innerText(),downloadCount:await page.locator('[data-result-class="text-code"]').count()});await screen('utm-error');
}catch(e){record('utm-failure',{error:String(e)});}
try{
await page.goto('https://strumentini.it/tools/csv-cleaner/',{waitUntil:'networkidle'});await page.getByRole('button',{name:'Pulisci CSV',exact:true}).click();record('csv-empty',{message:await page.locator('main [role=alert]').first().innerText()});
const input=Buffer.from('\uFEFFnome,note\r\nAnna,"prima riga\r\nseconda riga"\r\nLuca,00123\r\n');await page.locator('main input[type=file]').setInputFiles({name:'clienti.csv',mimeType:'text/csv',buffer:input});await page.getByRole('button',{name:'Pulisci CSV',exact:true}).click();await page.locator('[data-result-class="table"]').waitFor();await screen('csv-result');
console.log('CSV_BUTTONS '+JSON.stringify(await page.locator('[data-result-class="table"] button').allTextContents()));
const d=await download(page.locator('[data-result-class="table"]').getByRole('button',{name:/scarica/i}),'csv.csv');const text=d.bytes.toString();record('csv',{filename:d.filename,inputBytes:input.length,outputBytes:d.bytes.length,output:text,verified:!text.startsWith('\uFEFF')&&text.includes('00123')&&text.includes('prima riga\r\nseconda riga'),actions:3});
}catch(e){record('csv-failure',{error:String(e)});}
try{
await page.goto('https://strumentini.it/tools/image-compression/',{waitUntil:'networkidle'});const raw=Buffer.alloc(64*48*4);for(let i=0;i<64*48;i++){raw[i*4]=i%2?255:0;raw[i*4+2]=i%2?0:255;raw[i*4+3]=i%7?255:0;}
const png=await sharp(raw,{raw:{width:64,height:48,channels:4}}).png({compressionLevel:0}).toBuffer();await page.locator('[data-png-palette-47] select').selectOption('exact');await page.locator('main input[type=file]').setInputFiles({name:'palette.png',mimeType:'image/png',buffer:png});const start=Date.now();await page.getByRole('button',{name:'Esegui in locale',exact:true}).click();await page.locator('[data-result-class="image"] a[download]').first().waitFor();await screen('image-result');const d=await download(page.locator('[data-result-class="image"] a[download]').first(),'image.png');record('image',{filename:d.filename,inputBytes:png.length,outputBytes:d.bytes.length,rgbaEqual:(await sharp(d.bytes).ensureAlpha().raw().toBuffer()).equals(raw),elapsedMs:Date.now()-start,actions:4});
await page.locator('main input[type=file]').setInputFiles({name:'broken.png',mimeType:'image/png',buffer:Buffer.from('bad png')});await page.getByRole('button',{name:'Esegui in locale',exact:true}).click();await page.locator('main [role=alert]').first().waitFor();record('image-error',{message:await page.locator('main [role=alert]').first().innerText(),downloadCount:await page.locator('[data-result-class="image"] a[download]').count()});await screen('image-error');
}catch(e){record('image-failure',{error:String(e)});}
try{
await page.goto('https://strumentini.it/tools/pdf-merge/',{waitUntil:'networkidle'});const start=Date.now();await page.locator('main input[type=file]').setInputFiles([root+'/quality/fixtures/pdf-gold/simple-2page.pdf',root+'/quality/fixtures/pdf-gold/simple-3page.pdf']);await page.getByRole('button',{name:'Unisci PDF',exact:true}).click();await page.locator('[data-result-class="pdf"] a[download]').first().waitFor({timeout:30000});await screen('pdf-result');const d=await download(page.locator('[data-result-class="pdf"] a[download]').first(),'merge.pdf');record('pdf',{filename:d.filename,outputBytes:d.bytes.length,header:d.bytes.subarray(0,8).toString(),elapsedMs:Date.now()-start,actions:3});
}catch(e){record('pdf-failure',{error:String(e)});}
try{
await page.goto('https://strumentini.it/onboarding/',{waitUntil:'networkidle'});await page.locator('[data-ready=true]').waitFor();await page.locator('[data-onboarding-action=start]').click();await page.locator('[data-context-id]').first().click();await page.locator('[data-onboarding-action=continue-context]').click();await page.locator('[data-onboarding-action=continue-jobs]').click();const offers=await page.locator('[data-starter-tool-id]').evaluateAll(els=>els.map(e=>({id:e.dataset.starterToolId,reason:e.innerText})));await screen('onboarding-review');await page.locator('[data-onboarding-action=save]').click();await page.waitForURL('https://strumentini.it/');await page.goto('https://strumentini.it/preferiti/',{waitUntil:'networkidle'});record('onboarding',{offers,saved:await page.locator('[data-area-favorites]').innerText(),recent:await page.locator('[data-area-continue]').innerText(),actions:6});await screen('workbench-after');await page.reload({waitUntil:'networkidle'});record('workbench-reload',{saved:await page.locator('[data-area-favorites]').innerText()});
await page.goto('https://strumentini.it/impostazioni/',{waitUntil:'networkidle'});await page.locator('[data-settings-tab=preferenze]').click();await screen('settings-preferences');await page.locator('[data-settings-tab=tema]').click();await page.locator('input[name=theme][value=dark]').check();record('theme-ui',{theme:await page.evaluate(()=>document.documentElement.dataset.theme)});await screen('settings-dark');
}catch(e){record('onboarding-failure',{error:String(e)});}
try{
await page.goto('https://strumentini.it/accedi/',{waitUntil:'networkidle'});await page.waitForTimeout(800);record('auth-bootstrap',{iframes:await page.locator('#turnstile-login iframe').count(),widgetText:await page.locator('#turnstile-login').innerText(),apiReady:await page.evaluate(()=>typeof window.turnstile==='object')});
// No credentials, no API mutation: submit blank form to exercise local validation.
await page.locator('[data-access-panel=login] [data-access-submit]').click();record('auth-local-validation',{message:await page.locator('[data-access-status]').innerText({timeout:1000}).catch(()=>''),networkWrites:requests.filter(r=>r.method!=='GET'&&r.host==='strumentini.it')});await screen('auth-error');
await page.getByRole('tab',{name:'Crea un account',exact:true}).click();record('auth-register-tab',{visible:await page.locator('[data-access-panel=register]').isVisible()});await screen('auth-register');
}catch(e){record('auth-failure',{error:String(e)});}
record('network',{writes:requests.filter(r=>r.method!=='GET'),hosts:[...new Set(requests.map(r=>r.host))]});await context.close();
}
await writeFile(out+'/flows.json',JSON.stringify(proof,null,2));await browser.close();
