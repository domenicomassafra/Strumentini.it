export const ITALIAN_PASSPHRASE_WORDLIST = {
  id: "it-passphrase-2026-10-v1",
  version: "1.0.0",
  publishedAt: "2026-10-06",
  provenance: "Lista locale curata per Strumentini.it da parole italiane comuni, brevi e non ambigue. Non deriva da password violate o da dati utente.",
  words: [
    "abete", "acqua", "ago", "alba", "albero", "alga", "amaca", "ambra",
    "ape", "arco", "arena", "aria", "arpa", "asilo", "atomo", "avena",
    "barca", "basilico", "bosco", "brina", "brocca", "cacao", "calma", "campo",
    "cane", "carta", "cedro", "cielo", "cigno", "cima", "circo", "cocco",
    "colle", "cono", "corallo", "corda", "corte", "dado", "dalia", "dente",
    "duna", "eco", "edera", "elmo", "faggio", "falco", "faro", "felce",
    "ferro", "fico", "fiore", "fiume", "foglia", "forno", "frana", "fronda",
    "gatto", "gelso", "girasole", "goccia", "golfo", "grano", "gru", "isola",
    "lago", "lana", "latte", "legno", "leone", "lilla", "lince", "luna",
    "marea", "marmo", "mela", "menta", "miele", "molo", "monte", "mora",
    "muschio", "nastro", "neve", "nido", "noce", "onda", "ombra", "olivo",
    "orto", "pane", "panna", "parco", "pera", "pietra", "pino", "ponte",
    "prato", "quarzo", "ramo", "rana", "riva", "roccia", "rosa", "sale",
    "salice", "seme", "seta", "sole", "sorgo", "stella", "succo", "tasso",
    "tela", "terra", "tiglio", "torre", "ulivo", "valle", "vela", "vento",
    "verde", "vetro", "viola", "vite", "zaino", "zampa", "zenzero", "zucca",
  ] as const,
} as const;

export type ItalianPassphraseWord = (typeof ITALIAN_PASSPHRASE_WORDLIST.words)[number];
