import { useEffect, useState } from "preact/hooks";
import { ITALIAN_GEOGRAPHY_115_METADATA, searchItalianGeography115, type ItalianGeographyCandidate115, type ItalianGeographyKind115 } from "../../reference-data/italy/geography-115";

export function GeographySources115() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const [kind, setKind] = useState<ItalianGeographyKind115>("current");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<readonly ItalianGeographyCandidate115[]>([]);
  const [searched, setSearched] = useState(false);
  return <section class="geo115" aria-label="Ricerca dati territoriali ISTAT">
    <form onSubmit={(event) => { event.preventDefault(); setRows(searchItalianGeography115(kind, query)); setSearched(true); }}>
      <label>Archivio
        <select disabled={!hydrated} value={kind} onChange={(event) => { setKind(event.currentTarget.value as ItalianGeographyKind115); setRows([]); setSearched(false); }}>
          <option value="current">Comuni attuali (ISTAT 21/02/2026)</option>
          <option value="suppressed">Comuni soppressi (storico parziale SITUAS)</option>
          <option value="foreign">Stati esteri (storico SITUAS dal 1990)</option>
        </select>
      </label>
      <label>Nome o codice ISTAT (minimo 2 caratteri)
        <input type="search" disabled={!hydrated} minLength={2} maxLength={80} required value={query} onInput={(event) => { setQuery(event.currentTarget.value); setRows([]); setSearched(false); }} placeholder={kind === "foreign" ? "Es. Francia" : "Es. Bari"}/>
      </label>
      <button class="btn btn-primary" disabled={!hydrated} type="submit">Cerca nella copia ufficiale</button>
    </form>
    <p>Snapshot {ITALIAN_GEOGRAPHY_115_METADATA.version}, controllato il {ITALIAN_GEOGRAPHY_115_METADATA.checkedAt}. Ricerca solo locale nel browser. Massimo 20 righe per interrogazione.</p>
    {searched && <section aria-live="polite">
      <h2>{rows.length === 0 ? "Nessuna corrispondenza nella copia disponibile" : `${rows.length} corrispondenze visualizzate`}</h2>
      {rows.length > 0 && <div class="geo115-table"><table><thead><tr><th>Nome ufficiale</th><th>ISTAT</th><th>{kind === "foreign" ? "Codice estero" : "Belfiore / catastale"}</th><th>{kind === "current" ? "Codice provincia ISTAT" : "Dati storici"}</th></tr></thead><tbody>
        {rows.map((row, i) => <tr key={`${row.istatCode}-${i}`}><th scope="row">{row.name}</th><td>{row.istatCode}</td><td>{row.belfiore ?? "Non disponibile nella fonte"}</td><td>{kind === "current" ? row.istatCode.slice(0, 3) : row.changeDate ? `Evento ${row.changeDate}, ${row.changeType ?? "variazione"}` : "Validità storica non verificata"}</td></tr>)}
      </tbody></table></div>}
    </section>}
    <style>{`.geo115 form{display:flex;align-items:end;flex-wrap:wrap;gap:12px;margin:24px 0}.geo115 form label{display:grid;gap:6px;min-width:180px;flex:1}.geo115 input,.geo115 select{min-height:40px;max-width:100%;background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:8px}.geo115-table{overflow-x:auto}.geo115 table{width:100%;border-collapse:collapse}.geo115 th,.geo115 td{padding:10px;text-align:left;border-bottom:1px solid var(--border)}`}</style>
  </section>;
}
