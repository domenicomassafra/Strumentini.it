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
    // A native slice can use subclass species or Buffer view semantics and
    // expose unrelated backing bytes. Copy only the verified Uint8Array view.
    url=URL.createObjectURL(new Blob([new Uint8Array(plan.bytes).buffer],{type:plan.mime}));
    const anchor=document.createElement("a");
    anchor.href=url;
    anchor.download=plan.filename;
    anchor.hidden=true;
    document.body.append(anchor);
    // HTMLElement.click() returns void even when a policy/consumer cancels the
    // click's default action. Observe the dispatched event synchronously so
    // callers do not report an attempted download as accepted in that case.
    let clicked:MouseEvent|undefined;
    const observe=(event:MouseEvent):void=>{if(event.target===anchor) clicked=event;};
    window.addEventListener("click",observe,true);
    try { anchor.click(); }
    finally {
      window.removeEventListener("click",observe,true);
      anchor.remove();
    }
    if(clicked===undefined || clicked.defaultPrevented) {
      URL.revokeObjectURL(url);
      return false;
    }
    const temporaryUrl=url;
    setTimeout(()=>URL.revokeObjectURL(temporaryUrl),15_000);
    return true;
  } catch {
    if(url!==undefined) URL.revokeObjectURL(url);
    return false;
  }
}
