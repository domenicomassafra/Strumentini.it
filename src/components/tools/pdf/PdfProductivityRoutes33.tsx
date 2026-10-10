/**
 * One public handoff directory for the existing PDF productivity engines.
 * This component does not reimplement any conversion or silently transfer
 * source files to a route that has not declared a compatible handoff.
 */
export const PDF_PRODUCTIVITY_ROUTES_33 = [
  { id: "pdf-multi-text-search", label: "Cerca testo in più PDF", note: "Solo testo selezionabile; scansioni non interpretate come OCR" },
  { id: "pdf-split", label: "Dividi PDF per pagine o dimensione massima", note: "Parti verificate nei byte; impossibile se una pagina supera il limite" },
  { id: "pdf-n-up", label: "Impagina più pagine per foglio", note: "Anteprima e ordine delle pagine controllati" },
  { id: "pdf-booklet-interleave", label: "Booklet e intercala fronte/retro", note: "L'ordine di stampa è mostrato prima dell'esportazione" },
  { id: "printable-pdf-from-text", label: "TXT, Markdown, HTML o CSV in PDF", note: "Stampa semantica locale, non fedeltà Office DOCX/XLSX/PPTX" },
  { id: "pdf-to-markdown", label: "PDF in Markdown o DOCX testuale", note: "Solo testo estratto; non ricostruisce il layout originale" },
  { id: "pdf-tables-to-xlsx", label: "Tabelle PDF in XLSX", note: "Solo griglie selezionate e verificabili, con anteprima" },
  { id: "pdf-to-images", label: "Pagine PDF in immagini o PPTX", note: "Le slide PPTX sono immagini, non elementi modificabili" },
  { id: "images-to-pdf", label: "Immagini in PDF", note: "Ordine e geometria espliciti, conversioni locali supportate" },
] as const;

export function PdfProductivityRoutes33({ current }: { readonly current: string }) {
  return <nav aria-label="Altre operazioni PDF verificate" data-pdf-family-routes-33
    style={{ maxWidth: "940px", margin: "1.5rem auto" }}>
    <h2>Altre operazioni PDF</h2>
    <p class="file-note">Ogni collegamento apre lo strumento canonico, senza conversioni duplicate.
      Per ora devi selezionare di nuovo il file sullo strumento di destinazione:
      il passaggio automatico del file non è verificato.</p>
    <ul style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: "12px", listStyle: "none", padding: "0" }}>
      {PDF_PRODUCTIVITY_ROUTES_33.filter((route) => route.id !== current).map((route) =>
        <li key={route.id} style={{ border: "1px solid var(--border, #ccc)", borderRadius: "10px", padding: "12px" }}>
          <a href={`/tools/${route.id}/`}>{route.label}</a>
          <p class="file-note" style={{ marginBottom: 0 }}>{route.note}</p>
        </li>)}
    </ul>
  </nav>;
}
