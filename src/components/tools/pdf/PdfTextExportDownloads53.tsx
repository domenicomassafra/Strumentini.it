import { useEffect, useState } from "preact/hooks";
import type { ScopedPdfTextExport53 } from "../../../engines/pdf/text-export-53";

export function PdfTextExportDownloads53({ exported }: { readonly exported: ScopedPdfTextExport53 }) {
  const [links, setLinks] = useState<{ txt: string; md: string } | null>(null);
  useEffect(() => {
    setLinks(null);
    const txt = URL.createObjectURL(new Blob([exported.text.bytes.slice()], { type: exported.text.mime }));
    const md = URL.createObjectURL(new Blob([exported.markdown.bytes.slice()], { type: exported.markdown.mime }));
    setLinks({ txt, md });
    return () => { URL.revokeObjectURL(txt); URL.revokeObjectURL(md); };
  }, [exported]);
  return <section data-pdf-text-exports-53 class="field" aria-label="Esportazione testuale PDF">
    <p role="status">{exported.pages.length} pagine esportate in UTF-8, modalità {exported.mode}. Nessun OCR inventato.</p>
    <div class="actions">
      {links && <>
        <a data-53-txt href={links.txt} download={exported.text.filename}>Scarica TXT</a>
        <a data-53-md href={links.md} download={exported.markdown.filename}>Scarica Markdown</a>
      </>}
    </div>
    <details><summary>Limiti di fedeltà</summary><ul>{exported.limitations.map((limit) => <li key={limit}>{limit}</li>)}</ul></details>
  </section>;
}
