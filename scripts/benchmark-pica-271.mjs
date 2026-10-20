import { chromium, firefox, webkit } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
const w = process.cwd();
const fixture = (await readFile(resolve(w, ".scratch/pica-271-input.png"))).toString("base64");
const oracle = (await readFile(resolve(w, ".scratch/pica-271-oracle.png"))).toString("base64");
for (const [label, target] of [["chromium",chromium],["firefox",firefox],["webkit",webkit]]) {
  let browser;
  try { browser = await target.launch({headless:true}); }
  catch(e) { console.log(JSON.stringify({browser:label,status:"UNAVAILABLE",message:e.message.slice(0,180)})); continue; }
  try {
    const page=await browser.newPage();
    await page.goto("about:blank");
    await page.addScriptTag({path:resolve(w,"node_modules/pica/dist/pica.js")});
    const data = await page.evaluate(async ({fixture,oracle})=>{
      const dec=async b=>{const bs=atob(b);const a=new Uint8Array(bs.length);for(let i=0;i<bs.length;i++) a[i]=bs.charCodeAt(i);return await createImageBitmap(new Blob([a],{type:"image/png"}))};
      const src=await dec(fixture), ref=await dec(oracle);
      const canvas=(width,height)=>{const c=document.createElement("canvas");c.width=width;c.height=height;return c};
      const dst=canvas(ref.width,ref.height), baseline=canvas(ref.width,ref.height), oracleCanvas=canvas(ref.width,ref.height);
      oracleCanvas.getContext("2d").drawImage(ref,0,0);
      const resizer=window.pica({concurrency:1,features:["js","wasm","ww"]});
      const t=performance.now();baseline.getContext("2d").drawImage(src,0,0,baseline.width,baseline.height);const canvasCold=performance.now()-t;
      const start=performance.now();await resizer.resize(src,dst);const picaCold=performance.now()-start;
      const warm=[];for(let i=0;i<3;i++){let begin=performance.now();await resizer.resize(src,dst);warm.push(performance.now()-begin)};
      const canvasWarm=[];for(let i=0;i<3;i++){let begin=performance.now();baseline.getContext("2d").drawImage(src,0,0,baseline.width,baseline.height);canvasWarm.push(performance.now()-begin)};
      const pixels=(c)=>c.getContext("2d").getImageData(0,0,c.width,c.height).data;
      const orig=pixels(oracleCanvas), a=pixels(baseline), b=pixels(dst);
      const metrics=(x)=>{let total=0,max=0,px=0;for(let i=0;i<orig.length;i+=4){let diff=0;for(let j=0;j<3;j++){const d=Math.abs(orig[i+j]-x[i+j]);total+=d*d;max=Math.max(max,d);diff+=d;}if(diff>24)px++}return {rgbRmse:Math.sqrt(total/(orig.length/4*3)),maxDifference:max,pixelsDiffGt8:px}};
      src.close();ref.close();
      return {canvasColdMs:canvasCold,picaColdMs:picaCold,canvasWarmMs:canvasWarm,picaWarmMs:warm,canvas:metrics(a),pica:metrics(b),source:[1200,800],target:[300,200],workers:typeof Worker==="function",wasm:typeof WebAssembly==="object"};
    },{fixture,oracle});
    console.log(JSON.stringify({browser:label,status:"PASS",...data}));
  } catch(e) {console.log(JSON.stringify({browser:label,status:"FAIL",message:String(e).slice(0,400)}));}
  finally {await browser.close();}
}
