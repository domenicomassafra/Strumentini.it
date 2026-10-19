import { readFile } from "node:fs/promises";
import { chromium, firefox, webkit } from "@playwright/test";

const origin = process.env.STR_271_ORIGIN ?? "http://127.0.0.1:4331";
async function run(page, orientationJPEG) {
  return page.evaluate(async ({orientationJPEG}) => {
    const { resizeImageLocal } = await import("/src/tools/image-resize/module.ts");
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 400;
    const cx = canvas.getContext("2d");
    cx.clearRect(0, 0, 600, 400);
    cx.fillStyle = "rgba(255,0,0,1)";
    cx.fillRect(0, 0, 300, 400);
    cx.fillStyle = "rgba(0,20,255,1)";
    cx.fillRect(300, 0, 150, 400);
    const inputBlob = await new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("input encode")), "image/png"));
    const file = new File([inputBlob], "source.png", { type: "image/png" });
    const input = (width,height,fit,noUpscale,outputMime) => ({file,width,height,fit,noUpscale,outputMime,quality:0.95});
    const pixel = async (blob, x, y) => {
      const bitmap = await createImageBitmap(blob);
      const c = document.createElement("canvas");c.width=bitmap.width;c.height=bitmap.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(bitmap,0,0);bitmap.close();
      return {width:c.width,height:c.height,rgba:Array.from(ctx.getImageData(x,y,1,1).data)};
    };
    const webp = await resizeImageLocal(input(150,100,"contain",false,"image/webp"));
    const webpPixel = await pixel(webp.blob,130,50);
    const jpeg = await resizeImageLocal(input(150,100,"contain",false,"image/jpeg"));
    const jpegPixel = await pixel(jpeg.blob,130,50);
    const crop = await resizeImageLocal(input(150,150,"cover",false,"image/jpeg"));
    const noUpscale = await resizeImageLocal(input(1000,1000,"contain",true,"image/jpeg"));
    const raw = atob(orientationJPEG);
    const exifFile = new File([Uint8Array.from(raw, char => char.charCodeAt(0))], "orientation.jpg", {type:"image/jpeg"});
    const oriented = await resizeImageLocal({file:exifFile,width:60,height:60,fit:"contain",noUpscale:false,outputMime:"image/jpeg",quality:0.92});
    const orientedPixel = await pixel(oriented.blob,20,10);
    const abort = new AbortController();
    let aborted = false;
    try {
      await resizeImageLocal(input(150,100,"contain",false,"image/jpeg"), abort.signal, p => {
        if (p.phase === "resize") abort.abort();
      });
    } catch(e) { aborted=e?.name === "AbortError"; }
    return {
      webp:{engine:webp.resampling, pixel:webpPixel, mime:webp.blob.type},
      jpeg:{engine:jpeg.resampling,pixel:jpegPixel,mime:jpeg.blob.type},
      cover:{engine:crop.resampling,width:crop.outputWidth,height:crop.outputHeight},
      noUpscale:{engine:noUpscale.resampling,width:noUpscale.outputWidth,height:noUpscale.outputHeight},
      orientation:{source:[oriented.sourceWidth,oriented.sourceHeight], output:[oriented.outputWidth,oriented.outputHeight], engine:oriented.resampling, pixel:orientedPixel},
      cancel:aborted
    };
  },{orientationJPEG});
}
const orientationJPEG = (await readFile(".scratch/pica-271-orientation.jpg")).toString("base64");
for (const [label, target] of [["chromium",chromium],["firefox",firefox],["webkit",webkit]]) {
  const browser = await target.launch({headless:true});
  try {
    const page = await browser.newPage();
    const response=await page.goto(origin + "/tools/image-resize/");
    if (response?.status() !== 200) throw new Error("route HTTP " + response?.status());
    const normal=await run(page,orientationJPEG);
    const checks = [
      normal.webp.engine.engine === "pica",
      normal.jpeg.engine.engine === "pica",
      normal.webp.pixel.rgba[3] < 10,
      normal.jpeg.pixel.rgba.slice(0,3).every(n => n > 240),
      normal.cover.engine.engine === "canvas" && normal.cover.engine.reason === "COVER_CROP",
      normal.noUpscale.engine.engine === "canvas" && normal.noUpscale.engine.reason === "NOT_DOWNSCALE",
      normal.cancel,
      normal.orientation.source.join("x") === "80x120",
      normal.orientation.output.join("x") === "40x60",
      normal.jpeg.mime === "image/jpeg",
      normal.webp.mime === "image/webp"
    ];
    const noWorker = await browser.newPage();
    await noWorker.addInitScript(() => {
      Object.defineProperty(window,"Worker",{value:undefined,configurable:true});
      Object.defineProperty(window,"WebAssembly",{value:undefined,configurable:true});
    });
    await noWorker.goto(origin + "/tools/image-resize/");
    const fallback=await run(noWorker,orientationJPEG);
    const fallbackOk = fallback.webp.engine.engine === "pica" && fallback.jpeg.engine.engine === "pica" && fallback.cancel;
    const success=checks.every(Boolean) && fallbackOk;
    console.log(JSON.stringify({browser:label,status:success?"PASS":"FAIL",checks,fallbackOk,normal,fallbackEngine:fallback.webp.engine}));
    if (!success) process.exitCode=1;
  } catch(error) {
    console.log(JSON.stringify({browser:label,status:"FAIL",error:String(error)}));
    process.exitCode=1;
  } finally {await browser.close();}
}
