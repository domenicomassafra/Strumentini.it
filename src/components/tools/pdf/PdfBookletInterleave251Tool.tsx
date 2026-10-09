import { useEffect, useMemo, useState } from "preact/hooks";
import {
  createBooklet251, createInterleave251, planBooklet251, planInterleave251,
  type BookletPaper, type DuplexFlip, type InterleaveBackOrder, type MismatchPolicy,
} from "../../../engines/pdf/booklet-interleave-251";
import { inspectPdfBytes } from "../../../engines/pdf";
import { openPdfThumbnailSession } from "../../../engines/pdf/thumbnails";

export function PdfBookletInterleave251Tool() {
  const [mode, setMode] = useState<"booklet" | "interleave">("booklet");
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [frontCount, setFrontCount] = useState(0);
  const [backCount, setBackCount] = useState(0);
  const [paper, setPaper] = useState<BookletPaper>("a4");
  const [flip, setFlip] = useState<DuplexFlip>("short-edge");
  const [backOrder, setBackOrder] = useState<InterleaveBackOrder>("reverse");
  const [mismatchPolicy, setMismatchPolicy] = useState<MismatchPolicy>("reject");
  const [margin, setMargin] = useState("18");
  const [gap, setGap] = useState("10");
  const [shown, setShown] = useState(1);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Blob | null>(null);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  function changed() {
    setError(""); setResult(null); setShown(1);
  }
  useEffect(() => {
    if (frontFile === null) { setFrontCount(0); return; }
    let live = true;
    void frontFile.arrayBuffer().then((bytes) => {
      const info = inspectPdfBytes(new Uint8Array(bytes));
      if (info.encrypted) throw new Error("PDF cifrato non supportato");
      if (live) setFrontCount(info.pageCount);
    }).catch((cause) => { if (live) { setFrontCount(0); setError(cause instanceof Error ? cause.message : "PDF non valido"); } });
    return () => { live = false; };
  }, [frontFile]);
  useEffect(() => {
    if (backFile === null) { setBackCount(0); return; }
    let live = true;
    void backFile.arrayBuffer().then((bytes) => {
      const info = inspectPdfBytes(new Uint8Array(bytes));
      if (info.encrypted) throw new Error("PDF retro cifrato non supportato");
      if (live) setBackCount(info.pageCount);
    }).catch((cause) => { if (live) { setBackCount(0); setError(cause instanceof Error ? cause.message : "PDF retro non valido"); } });
    return () => { live = false; };
  }, [backFile]);
  const prepared = useMemo(() => {
    if (frontCount === 0 || (mode === "interleave" && backCount === 0)) return { plan: null, error: "" };
    try {
      return { plan: mode === "booklet"
        ? planBooklet251(frontCount, { flip, paper, margin: Number(margin), gap: Number(gap) })
        : planInterleave251(frontCount, backCount, { backOrder, mismatchPolicy }), error: "" };
    } catch (cause) { return { plan: null, error: cause instanceof Error ? cause.message : "Piano di stampa invalido" }; }
  }, [mode, frontCount, backCount, flip, paper, margin, gap, backOrder, mismatchPolicy]);
  const plan = prepared.plan;

  useEffect(() => {
    if (result === null) { setDownloadUrl(""); setPreviewUrl(""); return; }
    const url = URL.createObjectURL(result);
    setDownloadUrl(url);
    let live = true;
    let previewBlobUrl = "";
    let session: Awaited<ReturnType<typeof openPdfThumbnailSession>> | null = null;
    void (async () => {
      session = await openPdfThumbnailSession(new File([result], "pdf-251-verified.pdf", { type: "application/pdf" }));
      const png = await session.renderPage(1);
      if (live) { previewBlobUrl = URL.createObjectURL(png); setPreviewUrl(previewBlobUrl); }
    })().catch((cause) => { if (live) setError(cause instanceof Error ? cause.message : "Anteprima PDF.js fallita"); })
      .finally(() => { void session?.close(); });
    return () => { live = false; URL.revokeObjectURL(url); if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl); void session?.close(); };
  }, [result]);

  async function submit(event: Event) {
    event.preventDefault();
    changed();
    setWorking(true);
    try {
      if (!frontFile || !plan) throw new Error("Piano e file PDF richiesti");
      const output = mode === "booklet"
        ? await createBooklet251(frontFile, { flip, paper, margin: Number(margin), gap: Number(gap) })
        : await createInterleave251(frontFile, backFile!, { backOrder, mismatchPolicy });
      setResult(output.artifact.blob);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Esportazione fallita"); }
    finally { setWorking(false); }
  }
  const face = plan?.mode === "booklet" ? plan.faces[Math.min(shown, plan.faces.length) - 1] : null;
  const sourcePages = plan?.mode === "interleave" ? plan.pages : [];
  const name = mode === "booklet" ? "pdf-booklet-251.pdf" : "pdf-interleave-251.pdf";
  return <form class="tool-operation" data-pdf-251 onSubmit={(event) => void submit(event)} style={{ maxWidth: "940px", margin: "1rem auto" }}>
    <label class="field"><span>Operazione</span><select value={mode} disabled={working}
      onChange={(event) => { setMode(event.currentTarget.value as "booklet" | "interleave"); changed(); }}>
      <option value="booklet">Booklet pieghevole — 2 pagine per facciata</option>
      <option value="interleave">Intercala PDF fronte e PDF retro</option>
    </select></label>
    <label class="field"><span>{mode === "booklet" ? "Documento PDF da piegare" : "Scansione delle pagine fronte"}</span>
      <input type="file" accept=".pdf,application/pdf" disabled={working} onChange={(event) => { setFrontFile(event.currentTarget.files?.[0] ?? null); setFrontCount(0); changed(); }} />
    </label>
    {mode === "interleave" ? <>
      <label class="field"><span>Scansione delle pagine retro</span><input type="file" accept=".pdf,application/pdf" disabled={working}
        onChange={(event) => { setBackFile(event.currentTarget.files?.[0] ?? null); setBackCount(0); changed(); }} /></label>
      <div class="field-grid">
        <label class="field"><span>Ordine delle pagine retro</span><select value={backOrder} disabled={working} onChange={(event) => { setBackOrder(event.currentTarget.value as InterleaveBackOrder); changed(); }}>
          <option value="reverse">Retro in ordine inverso (scanner con pila rovesciata)</option>
          <option value="forward">Retro nello stesso ordine dei fronti</option>
        </select></label>
        <label class="field"><span>Se le due scansioni hanno lunghezze diverse</span><select value={mismatchPolicy} disabled={working}
          onChange={(event) => { setMismatchPolicy(event.currentTarget.value as MismatchPolicy); changed(); }}>
          <option value="reject">Blocca, non indovinare pagine mancanti</option>
          <option value="pad-shorter">Inserisci pagine bianche nelle posizioni mancanti</option>
        </select></label>
      </div>
      <p class="file-note">Conservazione vettoriale dove possibile; l'interleave non riconosce automaticamente l'orientamento dello scanner. Scegli esplicitamente l'ordine dei retro.</p>
    </> : <>
      <div class="field-grid">
        <label class="field"><span>Carta</span><select value={paper} disabled={working} onChange={(event) => { setPaper(event.currentTarget.value as BookletPaper); changed(); }}>
          <option value="a4">A4 orizzontale</option><option value="letter">Letter orizzontale</option>
        </select></label>
        <label class="field"><span>Duplex: lato di ribaltamento</span><select value={flip} disabled={working} onChange={(event) => { setFlip(event.currentTarget.value as DuplexFlip); changed(); }}>
          <option value="short-edge">Lato corto — fronti/retro diretti</option><option value="long-edge">Lato lungo — retro ruotato 180°</option>
        </select></label>
        <label class="field"><span>Margine esterno (pt)</span><input aria-label="Margine esterno (pt)" type="number" min="0" max="72" value={margin} disabled={working} onInput={(event) => { setMargin(event.currentTarget.value); changed(); }} /></label>
        <label class="field"><span>Spazio tra pagine (pt)</span><input aria-label="Spazio tra pagine (pt)" type="number" min="0" max="36" value={gap} disabled={working} onInput={(event) => { setGap(event.currentTarget.value); changed(); }} /></label>
      </div>
      <p class="file-note" data-251-fidelity><strong>Booklet rasterizzato:</strong> il contenuto viene trasformato in JPEG. Testo selezionabile, vettori, collegamenti e annotazioni non vengono conservati; pagine annotate rifiutate. Disabilita orientamento e riordino automatico del driver di stampa.</p>
    </>}
    {(error || prepared.error) && <p role="alert">{error || prepared.error}</p>}
    {plan && <section data-251-plan aria-label="Ordine di stampa verificabile">
      <h2>Anteprima dell'ordine prima di creare il PDF</h2>
      {plan.mode === "booklet" ? <>
        <p role="status" data-251-blank-count>{plan.inputPages} pagine → {plan.paddedPages} posizioni, {plan.blankPages} bianche, {plan.sheetCount} fogli fisici e {plan.faces.length} facciate.</p>
        <p data-251-flip>{plan.duplexNote}</p>
        <div class="actions">
          <button type="button" disabled={shown <= 1} onClick={() => setShown(shown - 1)}>Facciata precedente</button>
          <span>Facciata {face?.face} di {plan.faces.length} ({face?.side === "front" ? "fronte" : "retro"}, foglio {face?.sheet})</span>
          <button type="button" disabled={shown >= plan.faces.length} onClick={() => setShown(shown + 1)}>Facciata successiva</button>
        </div>
        <div data-251-face data-face={face?.face} data-side={face?.side} data-rotation={face?.rotation}
          style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "8px", maxWidth: "500px", margin: "1rem auto" }}>
          {(["left", "right"] as const).map((slot) => <div data-position={slot} data-source-page={face?.[slot] ?? "blank"}
            style={{ aspectRatio: "0.7", background: face?.[slot] === null ? "#fff" : "#dce9fb", color: "#111",
              border: "2px solid #567", display: "grid", placeItems: "center", fontWeight: "bold" }}>
            {face?.[slot] === null ? "BIANCA" : `PAGINA ${face?.[slot]}`}
          </div>)}
        </div>
        <ol data-251-all-faces>{plan.faces.map((item) =>
          <li>{`Foglio ${item.sheet}, ${item.side === "front" ? "fronte" : "retro"}: ${item.left ?? "bianca"} | ${item.right ?? "bianca"}${item.rotation ? " (retro 180°)" : ""}`}</li>)}</ol>
      </> : <>
        <p role="status" data-251-blank-count>{plan.frontPages} pagine fronte + {plan.backPages} retro → {plan.pages.length} pagine, {plan.blankPages} bianche.</p>
        <ol data-251-all-pages>{sourcePages.map((item) =>
          <li data-output-page={item.outputPage} data-source={item.source} data-source-page={item.sourcePage ?? "blank"}>
            {item.outputPage}: {item.source === "front" ? "fronte" : "retro"} {item.sourcePage ?? "BIANCA"}
          </li>)}</ol>
      </>}
    </section>}
    <div class="actions"><button type="submit" class="primary" disabled={!plan || working}>{working ? "Composizione locale…" : "Crea PDF e verifica"}</button></div>
    {downloadUrl && <section data-251-result class="result-panel" data-state="success">
      <p role="status">PDF generato e struttura ricontrollata: {name}.</p>
      {previewUrl && <img data-251-preview src={previewUrl} alt="Prima facciata riaperta e renderizzata localmente con PDF.js" style={{ maxWidth: "min(100%, 300px)" }} />}
      <a href={downloadUrl} download={name}>Scarica PDF {mode === "booklet" ? "booklet" : "intercalato"}</a>
    </section>}
  </form>;
}
