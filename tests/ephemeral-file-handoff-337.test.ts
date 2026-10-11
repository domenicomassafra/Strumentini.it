import { describe, expect, it } from "vitest";
import { createOutputArtifactDescriptor, type OutputArtifactDescriptor } from "../src/runtime/output-artifact";
import { createBinaryHandoffEnvelope, MAX_BINARY_HANDOFF_BYTES } from "../src/runtime/binary-handoff";
import { canOfferPdfPagesHandoff337, EPHEMERAL_FILE_HANDOFF_TTL_MS_337,
  PDF_PAGES_HANDOFF_TARGET_337, receivePdfPagesHandoff337, startPdfPagesHandoff337,
  canOfferPngCompressionHandoff337, startPngCompressionHandoff337, receivePngCompressionHandoff337,
  PNG_COMPRESSION_HANDOFF_TARGET_337 } from "../src/runtime/ephemeral-file-handoff-337";

const token = "12345678-1234-4234-8234-123456789abc";
const bytes = new TextEncoder().encode("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n");
function pdf(): OutputArtifactDescriptor {
  return createOutputArtifactDescriptor({ kind: "pdf", name: "pages.pdf", mime: "application/pdf", bytes,
    verification: { state: "verified", verifiedMime: "application/pdf", method: "PDF parser reopened produced document" },
    fidelity: "structural", fidelityNote: "Local PDF fixture." });
}

const pngBytes = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9oSWp0sAAAAASUVORK5CYII=", "base64"));
function png(): OutputArtifactDescriptor {
  return createOutputArtifactDescriptor({ kind:"image",name:"small.png",mime:"image/png",bytes:pngBytes,
    verification:{state:"verified",verifiedMime:"image/png",method:"PNG signature and local decoder"},
    fidelity:"lossless",fidelityNote:"PNG verified image" });
}

class FakeWindow {
  readonly location = { origin:"https://strumentini.it", pathname:"/tools/pdf-merge/", search:"", hash:"" };
  readonly history = { replaceState: (_: unknown, __: string, path: string) => { this.location.hash=""; this.paths.push(path); } };
  readonly paths:string[]=[];
  opener: FakeWindow | null = null;
  peer: FakeWindow | null = null;
  blockPopup = false;
  mutateOutbound: ((data: unknown) => unknown) | null = null;
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
    this.emit(this.mutateOutbound?.(data) ?? data,this.peer,origin);
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
    // First trusted invalid payload is now consumed and rejected, never retried.
    expect(receiver.listenerCount).toBe(0);
    expect(receiver.location.hash).toBe("");
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

describe("#337 verified PNG result to local image compressor",()=>{
  it("hands real bytes to a File exactly once, acknowledges and removes fragment without running compression",async()=>{
    const {sender,receiver}=pair();
    const statuses:string[]=[];
    const opened=startPngCompressionHandoff337(png(),status=>statuses.push(status),{window:sender as unknown as Window,createToken:()=>token});
    expect(opened.opened).toBe(true);
    expect(receiver.location.pathname).toBe("/tools/image-compression/");
    const delivered:File[]=[];
    const dispose=receivePngCompressionHandoff337(file=>delivered.push(file),{window:receiver as unknown as Window});
    expect(delivered).toHaveLength(1);
    expect(delivered[0]).toMatchObject({name:"small.png",type:"image/png",size:pngBytes.byteLength});
    expect(new Uint8Array(await delivered[0]!.arrayBuffer())).toEqual(pngBytes);
    expect(statuses).toEqual(["received"]);
    expect(receiver.location.hash).toBe("");
    expect(receiver.paths).toEqual(["/tools/image-compression/"]);
    expect(sender.listenerCount).toBe(0);
    expect(receiver.listenerCount).toBe(0);
    expect(sender.timers.size).toBe(0);
    expect(receiver.timers.size).toBe(0);
    receiver.emit({kind:"strumentini-ephemeral-file-handoff-337",token,phase:"payload",targetId:PNG_COMPRESSION_HANDOFF_TARGET_337.id},sender,sender.location.origin);
    expect(delivered).toHaveLength(1);
    dispose();
  });

  it("refuses oversize, non-PNG, unverified, malformed or popup-blocked sources",()=>{
    const {sender}=pair();
    const valid=png();
    expect(canOfferPngCompressionHandoff337(valid)).toBe(true);
    for (const bad of [
      {...valid,byteLength:MAX_BINARY_HANDOFF_BYTES+1},
      {...valid,bytes:new Uint8Array([1,2,3])},
      {...valid,kind:"pdf"},
      {...valid,name:"small.jpg"},
      {...valid,mime:"image/jpeg"},
      {...valid,verification:{state:"warning"}},
    ] as OutputArtifactDescriptor[]) {
      expect(canOfferPngCompressionHandoff337(bad)).toBe(false);
      expect(startPngCompressionHandoff337(bad,undefined,{window:sender as unknown as Window,createToken:()=>token}).opened).toBe(false);
    }
    sender.blockPopup=true;
    expect(startPngCompressionHandoff337(valid,undefined,{window:sender as unknown as Window,createToken:()=>token})).toMatchObject({opened:false,reason:expect.stringContaining("bloccato")});
    const tooLarge=new Uint8Array(MAX_BINARY_HANDOFF_BYTES+1);
    tooLarge.set(pngBytes.slice(0,33));
    tooLarge.set(pngBytes.slice(-12),tooLarge.length-12);
    const actualOversize=createOutputArtifactDescriptor({kind:"image",name:"oversize.png",mime:"image/png",bytes:tooLarge,
      verification:{state:"verified",verifiedMime:"image/png",method:"test oversize preflight"},
      fidelity:"unknown",fidelityNote:"Size guard fixture"});
    expect(canOfferPngCompressionHandoff337(actualOversize)).toBe(false);
  });

  it("reports invalid trusted bytes, missing opener, and receiver timeout without acknowledging or uploading",()=>{
    const {sender,receiver}=pair();
    receiver.location.hash=`#handoff337=${token}`;
    receiver.opener=sender;
    const failures:string[]=[];
    const receive=receivePngCompressionHandoff337(()=>{throw new Error("Unexpected delivery");},
      {window:receiver as unknown as Window},failure=>failures.push(failure));
    const malformed={kind:"strumentini-ephemeral-file-handoff-337",phase:"payload",token,
      targetId:PNG_COMPRESSION_HANDOFF_TARGET_337.id,expiresAt:Date.now()+1000,envelope:{descriptor:null,payload:pngBytes}};
    receiver.emit(malformed,sender,sender.location.origin);
    expect(failures).toEqual(["invalid"]);
    expect(receiver.listenerCount).toBe(0);
    expect(receiver.location.hash).toBe("");
    receive();

    const pair2=pair();
    pair2.receiver.location.hash=`#handoff337=${token}`;
    pair2.receiver.opener=null;
    receivePngCompressionHandoff337(()=>undefined,{window:pair2.receiver as unknown as Window},failure=>failures.push(failure));
    expect(failures).toEqual(["invalid","unavailable"]);
    expect(pair2.receiver.location.hash).toBe("");
    expect(pair2.receiver.paths).toEqual(["/tools/pdf-merge/"]);
    expect(pair2.receiver.listenerCount).toBe(0);
    const pair3=pair();
    pair3.receiver.location.hash=`#handoff337=${token}`;
    pair3.receiver.opener=pair3.sender;
    receivePngCompressionHandoff337(()=>undefined,{window:pair3.receiver as unknown as Window},failure=>failures.push(failure));
    pair3.receiver.expire();
    expect(failures).toEqual(["invalid","unavailable","expired"]);
    expect(pair3.receiver.listenerCount).toBe(0);
    expect(pair3.receiver.location.hash).toBe("");
  });

  it("does not issue a false received ACK if the destination is busy or its file handler fails",()=>{
    for (const onReceive of [() => false, () => { throw new Error("Consumer failed"); }]) {
      const {sender,receiver}=pair();
      const senderStatuses:string[]=[];
      const receiverFailures:string[]=[];
      const started=startPngCompressionHandoff337(png(),status=>senderStatuses.push(status),
        {window:sender as unknown as Window,createToken:()=>token});
      expect(started.opened).toBe(true);
      receivePngCompressionHandoff337(onReceive,{window:receiver as unknown as Window},failure=>receiverFailures.push(failure));
      expect(senderStatuses).toEqual(["unavailable"]);
      expect(receiverFailures).toEqual(["unavailable"]);
      expect(receiver.location.hash).toBe("");
      expect(sender.listenerCount).toBe(0);
      expect(receiver.listenerCount).toBe(0);
      expect(sender.timers.size).toBe(0);
      expect(receiver.timers.size).toBe(0);
    }
  });

  it("rejects wrong sender, origin, format, replay, expiry and forged ACK",()=>{
    const {sender,receiver}=pair();
    let now=1000;
    const statuses:string[]=[];
    startPngCompressionHandoff337(png(),status=>statuses.push(status),{window:sender as unknown as Window,createToken:()=>token,now:()=>now});
    const delivered:File[]=[];
    const dispose=receivePngCompressionHandoff337(file=>delivered.push(file),{window:receiver as unknown as Window,now:()=>now});
    expect(delivered).toHaveLength(1);
    expect(statuses).toEqual(["received"]);
    dispose();

    const pair2=pair();
    pair2.receiver.location.hash=`#handoff337=${token}`;
    pair2.receiver.opener=pair2.sender;
    const rejected:File[]=[];
    const dispose2=receivePngCompressionHandoff337(file=>rejected.push(file),{window:pair2.receiver as unknown as Window,now:()=>now});
    const envelope=createBinaryHandoffEnvelope("image",png(),"png");
    const message={kind:"strumentini-ephemeral-file-handoff-337",phase:"payload",token,targetId:PNG_COMPRESSION_HANDOFF_TARGET_337.id,expiresAt:now+2000,envelope};
    pair2.receiver.emit(message,pair2.sender,"https://attacker.invalid");
    pair2.receiver.emit(message,new FakeWindow(),pair2.sender.location.origin);
    pair2.receiver.emit({...message,targetId:PDF_PAGES_HANDOFF_TARGET_337.id},pair2.sender,pair2.sender.location.origin);
    pair2.receiver.emit({...message,envelope:{...envelope,descriptor:{...envelope.descriptor,mime:"image/jpeg"}}},pair2.sender,pair2.sender.location.origin);
    pair2.receiver.emit({...message,envelope:{...envelope,payload:new Uint8Array(pngBytes.length)}},pair2.sender,pair2.sender.location.origin);
    pair2.receiver.emit({...message,expiresAt:now-1},pair2.sender,pair2.sender.location.origin);
    pair2.receiver.emit({...message,expiresAt:now+31_000},pair2.sender,pair2.sender.location.origin);
    expect(rejected).toHaveLength(0);
    now+=EPHEMERAL_FILE_HANDOFF_TTL_MS_337;
    pair2.receiver.expire();
    expect(pair2.receiver.location.hash).toBe("");
    expect(pair2.receiver.listenerCount).toBe(0);
    pair2.receiver.emit(message,pair2.sender,pair2.sender.location.origin);
    expect(rejected).toHaveLength(0);
    dispose2();
  });
});

describe("#337 authenticated payload rejection releases the sender immediately",()=>{
  for (const target of ["pdf", "png"] as const) {
    for (const rejection of ["invalid", "expired"] as const) {
      it(`${target} ${rejection}: sends only rejected ACK, clears both timeouts and ignores replay`,()=>{
        const {sender,receiver}=pair();
        const senderStatuses:string[]=[];
        const receiverFailures:string[]=[];
        const senderPhases:string[]=[];
        const now=1000;
        sender.addEventListener("message",(event)=>senderPhases.push(event.data?.phase));
        const targetId=target === "pdf" ? PDF_PAGES_HANDOFF_TARGET_337.id : PNG_COMPRESSION_HANDOFF_TARGET_337.id;
        // Mutate only the payload in transit, after the sender has passed preflight and sent once.
        receiver.mutateOutbound=(data)=>{
          if (typeof data !== "object" || data === null || (data as {phase?:string}).phase !== "payload") return data;
          const message=data as {expiresAt:number,envelope:{descriptor:{mime:string}}};
          return rejection === "expired"
            ? {...message,expiresAt:now-1}
            : {...message,envelope:{...message.envelope,descriptor:{...message.envelope.descriptor,mime:"image/jpeg"}}};
        };
        const started=target === "pdf"
          ? startPdfPagesHandoff337(pdf(),status=>senderStatuses.push(status),{window:sender as unknown as Window,createToken:()=>token,now:()=>now})
          : startPngCompressionHandoff337(png(),status=>senderStatuses.push(status),{window:sender as unknown as Window,createToken:()=>token,now:()=>now});
        expect(started.opened).toBe(true);
        // A rejection forged by a different origin, source, token or target cannot release the sender.
        const forged={kind:"strumentini-ephemeral-file-handoff-337",phase:"rejected",token,targetId};
        sender.emit(forged,receiver,"https://untrusted.example");
        sender.emit(forged,new FakeWindow(),sender.location.origin);
        sender.emit({...forged,token:"wrong"},receiver,sender.location.origin);
        sender.emit({...forged,targetId:"not-the-target"},receiver,sender.location.origin);
        sender.emit(forged,receiver,sender.location.origin); // Before sending bytes, even trusted rejection is premature.
        expect(senderStatuses).toEqual([]);
        const deliveries:File[]=[];
        const dispose=target === "pdf"
          ? receivePdfPagesHandoff337(file=>deliveries.push(file),{window:receiver as unknown as Window,now:()=>now})
          : receivePngCompressionHandoff337(file=>deliveries.push(file),{window:receiver as unknown as Window,now:()=>now},failure=>receiverFailures.push(failure));
        expect(deliveries).toEqual([]);
        expect(receiverFailures).toEqual(target === "png" ? [rejection] : []);
        expect(senderStatuses).toEqual(["unavailable"]);
        expect(senderPhases).toContain("rejected");
        expect(senderPhases).not.toContain("received");
        expect(receiver.location.hash).toBe("");
        expect(sender.timers.size).toBe(0);
        expect(receiver.timers.size).toBe(0);
        expect(receiver.listenerCount).toBe(0);
        // The fixture's observer is intentionally still attached to the sender.
        sender.expire(); receiver.expire();
        sender.emit(forged,receiver,sender.location.origin);
        expect(senderStatuses).toEqual(["unavailable"]);
        dispose();
      });
    }
  }
});
