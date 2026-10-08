import type { PdfFormAnnotationAudit, PdfFlattenVerification } from "../../../engines/pdf";

export function PdfFormAuditDetails({ audit, verification }: {
  readonly audit?: PdfFormAnnotationAudit;
  readonly verification?: PdfFlattenVerification;
}) {
  const before = verification?.before ?? audit;
  if (before === undefined) return null;
  return (
    <section aria-label={verification ? "Verifica appiattimento PDF" : "Inventario moduli e annotazioni PDF"}
      data-pdf-form-audit>
      <p class="file-note" data-form-audit-counts role="status">
        {before.fieldCount} campi AcroForm · {before.annotationCount} annotazioni (di cui {before.widgetCount} widget) ·
        {before.visibleAnnotationCount} visibili · {before.hiddenAnnotationCount} nascoste ·
        {before.appearanceStreamCount} con appearance stream
      </p>
      {before.fields.length > 0 && (
        <div>
          <strong>Campi individuati</strong>
          <ol class="status-list">
            {before.fields.slice(0, 40).map((field, index) => (
              <li key={index}>{field.name} ({field.fieldType}) · oggetto {field.objectId ?? "diretto"} ·
                pagine {field.pages.join(", ") || "nessuna"} · widget {field.widgetObjectIds.join(", ") || "nessuno"}
              </li>
            ))}
          </ol>
        </div>
      )}
      {before.annotations.length > 0 && (
        <div>
          <strong>Annotazioni per pagina</strong>
          <ol class="status-list">
            {before.annotations.slice(0, 40).map((annotation, index) => (
              <li key={index}>Pagina {annotation.page} · {annotation.subtype} · oggetto {annotation.objectId ?? "diretto"} ·
                {annotation.hidden ? "nascosta" : "potenzialmente visibile"} ·
                appearance {annotation.appearanceStream ? "presente" : "non dichiarata"}
              </li>
            ))}
          </ol>
        </div>
      )}
      {(before.fields.length > 40 || before.annotations.length > 40) && <small>Mostrate al massimo 40 voci per categoria; il risultato strutturato include l'inventario completo.</small>}
      {before.unsafeAppearance && (
        <p class="file-note" data-form-audit-blockers>
          Il flatten locale non può garantire l'aspetto visivo di queste annotazioni. Motivi: {before.blockers.join("; ")}.
        </p>
      )}
      {verification !== undefined && (
        <div data-pdf-flatten-verification>
          <strong>Verifica prima → dopo</strong>
          <p class="file-note">Campi {verification.before.fieldCount} → {verification.after.fieldCount} ·
            annotazioni {verification.before.annotationCount} → {verification.after.annotationCount} ·
            pagine {verification.pageCount.before} → {verification.pageCount.after}
          </p>
          <p class="file-note">Controlli: hook assenti {verification.allPageHooksRemoved ? "sì" : "no"} ·
            testo stabile {verification.contentTextStable ? "sì" : "no"} ·
            geometria stabile {verification.geometryStable ? "sì" : "no"} ·
            conteggio immagini stabile {verification.imageCountStable ? "sì" : "no"}.
          </p>
          <p class="file-note" data-pdf-capability-before-after>
            Capacità flatten: prima {verification.capabilities.before.find((capability) => capability.capability === "flatten")?.available ? "disponibile" : "non disponibile"} →
            dopo {verification.capabilities.after.find((capability) => capability.capability === "flatten")?.available ? "disponibile" : "non disponibile"}.
            Le altre capacità disponibili e i motivi di indisponibilità sono nel risultato strutturato.
          </p>
          <p class="file-note">Il motore ammette soltanto la rimozione di hook senza annotazioni visibili da incorporare. Il confronto dei pixel delle pagine non viene eseguito automaticamente: questa verifica non certifica equivalenza visiva generale.</p>
        </div>
      )}
    </section>
  );
}
