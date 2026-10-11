import type { OutputArtifactDescriptor } from "./output-artifact";
import { planVerifiedDownload339 } from "./download-policy-339";

/**
 * Requests a verified download from the browser, never claims OS acceptance.
 * All result families share exactly the same bounded plan and cleanup policy.
 */
export function requestBrowserDownload339(artifact:OutputArtifactDescriptor | null):boolean {
  const plan=planVerifiedDownload339(artifact);
  if(!plan.allowed) return false;
  let url:string|undefined;
  try {
    url=URL.createObjectURL(new Blob([plan.bytes.slice().buffer],{type:plan.mime}));
    const anchor=document.createElement("a");
    anchor.href=url;
    anchor.download=plan.filename;
    anchor.hidden=true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    const temporaryUrl=url;
    setTimeout(()=>URL.revokeObjectURL(temporaryUrl),15_000);
    return true;
  } catch {
    if(url!==undefined) URL.revokeObjectURL(url);
    return false;
  }
}
