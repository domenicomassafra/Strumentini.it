const CATEGORY_LABELS: Readonly<Record<string, string>> = {
  "business-math": "Soldi e business",
  "client-work-math": "Tariffe e clienti",
  data: "Tabelle e dati",
  "date-time": "Date e calendario",
  developer: "Codice e sviluppo",
  documents: "PDF e documenti",
  files: "File e cartelle",
  "files-assets": "Immagini e file multimediali",
  "image-visual": "Colori e grafica",
  marketing: "Marketing e campagne",
  research: "Ricerca e fonti",
  text: "Testo e scrittura",
  "web-operations": "URL e web",
};

const INPUT_TYPE_LABELS: Readonly<Record<string, string>> = {
  "application/pdf": "PDF",
  base64: "Base64",
  bytes: "Byte",
  color: "Colore",
  cron: "Espressione cron",
  csv: "CSV",
  currency: "Valuta",
  date: "Data",
  "date-time": "Data e ora",
  days: "Giorni",
  decimal: "Numero decimale",
  file: "File",
  folder: "Cartella",
  hours: "Ore",
  html: "HTML",
  identifier: "Identificatore",
  image: "Immagine",
  "image/jpeg": "Immagine JPEG",
  "image/png": "Immagine PNG",
  "image/webp": "Immagine WebP",
  integer: "Numero intero",
  invoice: "Fattura",
  json: "JSON",
  jwt: "JWT",
  lines: "Righe",
  list: "Elenco",
  markdown: "Markdown",
  money: "Importo",
  number: "Numero",
  pdf: "PDF",
  percent: "Percentuale",
  rate: "Tariffa",
  "rate-unit": "Unità tariffaria",
  regex: "Espressione regolare",
  secret: "Segreto o token",
  structured: "Dati strutturati",
  table: "Tabella",
  text: "Testo",
  time: "Ora",
  timezone: "Fuso orario",
  toml: "TOML",
  tsv: "TSV",
  units: "Unità",
  url: "URL",
  writing: "Scrittura",
  yaml: "YAML",
  year: "Anno",
  zip: "ZIP",
};

const TAG_LABELS: Readonly<Record<string, string>> = {
  "client-services": "Consulenza e servizi ai clienti",
  "marketing-growth": "Marketing e crescita",
  "data-cleanup": "Pulizia dei dati",
  "research-evidence": "Ricerca e fonti",
  "file-asset-handoff": "Consegna di file e risorse",
  creative: "Creatività",
};

export function categoryLabelIt(value: string): string {
  return CATEGORY_LABELS[value] ?? value;
}

export function inputTypeLabelIt(value: string): string {
  return INPUT_TYPE_LABELS[value] ?? value;
}

export function tagLabelIt(value: string): string {
  return TAG_LABELS[value] ?? value;
}
