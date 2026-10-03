import { describe, expect, it } from "vitest";
import { localizeJsonResult } from "../src/components/tools/shared/JsonResult";

describe("risultati JSON pubblici in italiano", () => {
  it("localizza metadati di calcolo senza alterare valori utente arbitrari", () => {
    expect(localizeJsonResult({
      roasExact: "5",
      roasPercent: "500.00",
      formula: "revenue ÷ spend",
      rounding: { mode: "half-up", decimalPlaces: 2, stage: "final-only" },
      engineVersion: "marketing-math-v1",
      output: "half-up",
    })).toEqual({
      roas_esatto: "5",
      roas_percentuale: "500.00",
      formula: "ricavi ÷ spesa",
      arrotondamento: { modalità: "metà verso l'alto", cifre_decimali: 2, fase: "solo sul risultato finale" },
      versione_motore: "marketing-math-v1",
      risultato: "half-up",
    });
  });

  it("localizza i payload CPA/CPC/CPM e scenario conversioni", () => {
    expect(localizeJsonResult({
      metric: "cpa",
      spend: "200.00",
      denominator: "8.00",
      formula: "spend ÷ conversions",
      rounding: { mode: "half-up", decimalPlaces: 2, stage: "final-only" },
    })).toEqual({
      metrica: "cpa",
      spesa: "200.00",
      denominatore: "8.00",
      formula: "spesa ÷ conversioni",
      arrotondamento: { modalità: "metà verso l'alto", cifre_decimali: 2, fase: "solo sul risultato finale" },
    });

    expect(localizeJsonResult({
      visits: "1000.00",
      projectedConversions: "30.00",
      liftPercent: "undefined",
      absoluteLift: "5.00",
      formula: "projected conversions = visits × target rate ÷ 100",
    })).toEqual({
      visite: "1000.00",
      conversioni_previste: "30.00",
      incremento_percentuale: "non definito",
      incremento_assoluto: "5.00",
      formula: "conversioni previste = visite × tasso obiettivo ÷ 100",
    });
  });
});
