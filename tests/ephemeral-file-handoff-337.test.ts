import { describe, expect, it } from "vitest";
import { createOutputArtifactDescriptor, type OutputArtifactDescriptor } from "../src/runtime/output-artifact";
import { createBinaryHandoffEnvelope, MAX_BINARY_HANDOFF_BYTES } from "../src/runtime/binary-handoff";
import { canOfferPdfPagesHandoff337, EPHEMERAL_FILE_HANDOFF_TTL_MS_337,
  PDF_PAGES_HANDOFF_TARGET_337, receivePdfPagesHandoff337, startPdfPagesHandoff337 } from "../src/runtime/ephemeral-file-handoff-337";

const token = "12345678-1234-4234-8234-123456789abc";
const bytes = new TextEncoder().encode("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n");
function pdf(): OutputArtifactDescriptor {
  return createOutputArtifactDescriptor({ kind: "pdf", name: "pages.pdf", mime: "application/pdf", bytes,
    verification: { state: "verified", verifiedMime: "application/pdf", method: "PDF parser reopened produced document" },
    fidelity: "structural", fidelityNote: "Local PDF fixture." });
}

class FakeWindow {
  readonly location = { origin:"https://strumentini.it", pathname:"/tools/pdf-merge/", search:"", hash:"" };
  readonly history = { replaceState: (_: unknown, __: string, path: string) => { this.location.hash=""; this.paths.push(path); } };
  readonly paths:string[]=[];
  opener: FakeWindow | null = null;
  peer: FakeWindow | null = null;
  blockPopup = false;
  timers = new Map<number,()=>void>();
  private counter = 0;
  private readonly listeners = new Set<(event: MessageEvent)=>void>();
  open(path: string, _target: string): Window | null {
    if (this.blockPopup || this.peer === null) return null;
    this.peer.location.hash = new URL(path,this.location.origin).hash;
    this.peer.location.pathname = new URL(path,this.location.origin).pathname;
    this.peer.opener=this;
    return this.peer as unknown as Window;
  }
  addEventListener(_: "message", listener: (event:MessageEvent)=>void) { this.listeners.add(listener); }
  removeEventListener(_: "message", listener: (event:MessageEvent)=>void) { this.listeners.delete(listener); }
  setTimeout(fn:()=>void, _:number) { const id=++this.counter; this.timers.set(id,fn); return id; }
  clearTimeout(id:number) { this.timers.delete(id); }
  postMessage(data:unknown, origin:string) {
    if (this.peer===null) return;
    this.emit(data,this.peer,origin);
  }
  emit(data:unknown, source:FakeWindow, origin:string) {
    for (const fn of [...this.listeners]) fn({ origin,source: source as unknown as Window,data } as MessageEvent);
  }
  expire() { for (const fn of [...this.timers.values()]) fn(); }
  get listenerCount() { return this.listeners.size; }
}

function pair() {
  const sender=new FakeWindow(), receiver=new FakeWindow();
  sender.peer=receiver; receiver.peer=sender;
  return { sender,receiver };
}

describe("#337 PDF result to PDF pages ephemeral handoff",()=>{
  it("transfers actual verified PDF bytes into a native File without input re-selection; one-shot and ack",async()=>{
    const {sender,receiver}=pair();
    const statuses:string[]=[];
    const source=pdf();
    const opened=startPdfPagesHandoff337(source,(v)=>statuses.push(v),{window:sender as unknown as Window,createToken:()=>token});
    expect(opened.opened).toBe(true);
    expect(receiver.location.hash).toBe(`#handoff337=${token}`);
    const delivered:File[]=[];
    const cleanup=receivePdfPagesHandoff337((file)=>delivered.push(file),{window:receiver as unknown as Window});
    expect(delivered).toHaveLength(1);
    expect(delivered[0]).toBeInstanceOf(File);
    expect(delivered[0]).toMatchObject({name:"pages.pdf",type:"application/pdf",size:bytes.byteLength});
    expect(new Uint8Array(await delivered[0]!.arrayBuffer())).toEqual(bytes);
    expect(statuses).toEqual(["received"]);
    expect(receiver.location.hash).toBe("");
    expect(sender.listenerCount).toBe(0);
    expect(receiver.listenerCount).toBe(0);
    expect(sender.timers.size).toBe(0);
    expect(receiver.timers.size).toBe(0);
    expect(receiver.paths).toEqual(["/tools/pdf-to-images/"]);
    receiver.emit({kind:"strumentini-ephemeral-file-handoff-337",token,phase:"payload",targetId:PDF_PAGES_HANDOFF_TARGET_337.id},sender,sender.location.origin);
    expect(delivered).toHaveLength(1);
    cleanup();
  });

  it("enforces the source verified+PDF and <=64 MiB preflight without opening a popup",()=>{
    const {sender}=pair();
    const artifact=pdf();
    expect(canOfferPdfPagesHandoff337(artifact)).toBe(true);
    const unsafe = [
      {...artifact, bytes: new Uint8Array([1,2,3])},
      {...artifact, byteLength: MAX_BINARY_HANDOFF_BYTES+1},
      {...artifact, mime:"application/zip"},
      {...artifact, name:"report.png"},
      {...artifact, verification:{state:"unverified"}},
      {...artifact, kind:"image"},
    ] as OutputArtifactDescriptor[];
    for (const bad of unsafe) {
      expect(canOfferPdfPagesHandoff337(bad)).toBe(false);
      expect(startPdfPagesHandoff337(bad,undefined,{window:sender as unknown as Window,createToken:()=>token}).opened).toBe(false);
    }
    sender.blockPopup=true;
    expect(startPdfPagesHandoff337(artifact,undefined,{window:sender as unknown as Window,createToken:()=>token})).toMatchObject({opened:false,reason:expect.stringContaining("bloccato")});
  });

  it("does not accept forged acknowledgements or duplicate ready events",()=>{
    const {sender,receiver}=pair();
    const statuses:string[]=[];
    const started=startPdfPagesHandoff337(pdf(),s=>statuses.push(s),{window:sender as unknown as Window,createToken:()=>token});
    expect(started.opened).toBe(true);
    const ack={ kind:"strumentini-ephemeral-file-handoff-337",phase:"received",targetId:PDF_PAGES_HANDOFF_TARGET_337.id,token };
    sender.emit(ack,receiver,"https://attacker.example");
    sender.emit(ack,new FakeWindow(),sender.location.origin);
    sender.emit(ack,receiver,sender.location.origin); // Not yet sent, so invalid.
    expect(statuses).toEqual([]);
    let deliveries=0;
    receiver.addEventListener("message",(event)=>{if (event.data?.phase==="payload") deliveries++; });
    const ready={kind:"strumentini-ephemeral-file-handoff-337",phase:"ready",targetId:PDF_PAGES_HANDOFF_TARGET_337.id,token};
    sender.emit(ready,receiver,sender.location.origin);
    sender.emit(ready,receiver,sender.location.origin);
    expect(deliveries).toBe(1);
    sender.emit(ack,receiver,sender.location.origin);
    expect(statuses).toEqual(["received"]);
    expect(sender.listenerCount).toBe(0);
  });

  it("rejects foreign origin/window, forged tokens, invalid payload and unexpected recipient; no acknowledgement",()=>{
    const {sender,receiver}=pair();
    const result:File[]=[];
    receiver.location.hash=`#handoff337=${token}`;
    receiver.opener=sender;
    const cleanup=receivePdfPagesHandoff337((file)=>result.push(file),{window:receiver as unknown as Window});
    const normal=createBinaryHandoffEnvelope("file",pdf(),"pdf");
    const payload={ kind:"strumentini-ephemeral-file-handoff-337",phase:"payload",token,
      targetId:PDF_PAGES_HANDOFF_TARGET_337.id,expiresAt:Date.now()+EPHEMERAL_FILE_HANDOFF_TTL_MS_337/2,envelope:normal };
    receiver.emit(payload,sender,"https://other.example");
    receiver.emit(payload,new FakeWindow(),sender.location.origin);
    receiver.emit({...payload,token:"wrong"},sender,sender.location.origin);
    receiver.emit({...payload,targetId:"pdf-to-json"},sender,sender.location.origin);
    receiver.emit({...payload,envelope:{...normal,descriptor:{...normal.descriptor,mime:"text/plain"}}},sender,sender.location.origin);
    receiver.emit({...payload,envelope:{...normal,descriptor:{...normal.descriptor,bytes:normal.descriptor.bytes+1}}},sender,sender.location.origin);
    receiver.emit({...payload,envelope:{...normal,payload:new Uint8Array(bytes.length)}},sender,sender.location.origin);
    receiver.emit({...payload,expiresAt:Date.now()-1},sender,sender.location.origin);
    receiver.emit({...payload,expiresAt:Date.now()+100_000},sender,sender.location.origin);
    expect(result).toEqual([]);
    expect(receiver.listenerCount).toBe(1);
    cleanup();
  });

  it("expires both sender and receiver, releases listeners and refuses late replays",()=>{
    const {sender,receiver}=pair();
    let now=1000;
    const statuses:string[]=[];
    const opened=startPdfPagesHandoff337(pdf(),s=>statuses.push(s),{window:sender as unknown as Window,createToken:()=>token,now:()=>now});
    expect(opened.opened).toBe(true);
    now+=EPHEMERAL_FILE_HANDOFF_TTL_MS_337;
    sender.expire();
    expect(statuses).toEqual(["expired"]);
    expect(sender.listenerCount).toBe(0);
    const files:File[]=[];
    const dispose=receivePdfPagesHandoff337(file=>files.push(file),{window:receiver as unknown as Window,now:()=>now});
    receiver.expire();
    expect(receiver.listenerCount).toBe(0);
    expect(receiver.location.hash).toBe("");
    expect(files).toEqual([]);
    dispose();
  });

  it("refuses payload delivery after its absolute expiry without consuming it",()=>{
    const {sender,receiver}=pair();
    let now=1000;
    receiver.location.hash=`#handoff337=${token}`;
    receiver.opener=sender;
    const files:File[]=[];
    const dispose=receivePdfPagesHandoff337(f=>files.push(f),{window:receiver as unknown as Window,now:()=>now});
    const msg={ kind:"strumentini-ephemeral-file-handoff-337",phase:"payload",token,targetId:PDF_PAGES_HANDOFF_TARGET_337.id,
      expiresAt:now-1,envelope:createBinaryHandoffEnvelope("file",pdf(),"pdf") };
    receiver.emit(msg,sender,sender.location.origin);
    expect(files).toEqual([]);
    dispose();
  });
});
