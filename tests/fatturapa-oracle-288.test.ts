import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FatturaPaReaderError, readFatturaPaXml } from "../src/engines/italy/fatturapa-reader";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const ordinary = readFileSync(resolve(root, "quality/fixtures/italy-2026-consumers/fatturapa-ordinary-anonymized.xml"), "utf8");
const simplified = readFileSync(resolve(root, "quality/fixtures/italy-2026-consumers/fatturapa-simplified-anonymized.xml"), "utf8");
const adapter = resolve(root, "tests/fatturapa-oracle-288.py");

type OracleBody = {
  documentType: string | null; number: string | null; date: string | null; currency: string;
  documentTotal: string | null; stampDutyAmount: string | null;
  lines: Record<string, string | null>[]; vatSummaries: Record<string, string | null>[];
  payments: Record<string, string | null>[];
};
type OracleResult = {
  supplier: { name: string | null; vatId: string | null; taxCode: string | null };
  customer: { name: string | null; vatId: string | null; taxCode: string | null };
  bodies: OracleBody[];
};

function oracle(xml: string): OracleResult {
  const call = spawnSync("python3", [adapter], { input: xml, encoding: "utf8", timeout: 10_000, maxBuffer: 1024 * 1024 });
  expect(call.error).toBeUndefined();
  expect(call.status, call.stderr || "Oracle exited unsuccessfully").toBe(0);
  return JSON.parse(call.stdout) as OracleResult;
}

// Decimal lexical scales differ: the donor renders values as Italian display
// strings, while our browser reader preserves the source XML decimal text.
function canonical(value: string | null): string | null {
  if (value === null) return null;
  return value.replace(/^(-?)0+(?=\d)/u, "$1").replace(/(\.\d*?)0+$/u, "$1").replace(/\.$/u, "");
}

function compare(xml: string): OracleResult {
  const browser = readFatturaPaXml(xml);
  const donor = oracle(xml);
  expect(browser.family).toBe("ordinary");
  expect(browser.fieldErrors).toEqual([]);
  expect(browser.supplier).toEqual(donor.supplier);
  expect(browser.customer).toEqual(donor.customer);
  expect(browser.bodies).toHaveLength(donor.bodies.length);
  for (const [i, actual] of browser.bodies.entries()) {
    const expected = donor.bodies[i]!;
    for (const key of ["documentType", "number", "date", "currency"] as const) {
      expect(actual[key], `body ${i + 1} ${key}`).toBe(expected[key]);
    }
    expect(canonical(actual.documentTotal), `body ${i + 1} documentTotal`).toBe(expected.documentTotal);
    expect(canonical(actual.stampDutyAmount), `body ${i + 1} stampDuty`).toBe(expected.stampDutyAmount);
    expect(actual.lines).toHaveLength(expected.lines.length);
    for (const [j, line] of actual.lines.entries()) {
      const donorLine = expected.lines[j]!;
      for (const key of ["lineNumber", "description", "vatNature"] as const) {
        expect(line[key], `body ${i + 1} line ${j + 1} ${key}`).toBe(donorLine[key]);
      }
      for (const key of ["quantity", "unitPrice", "lineTotal", "vatRatePercent"] as const) {
        expect(canonical(line[key]), `body ${i + 1} line ${j + 1} ${key}`).toBe(donorLine[key]);
      }
    }
    expect(actual.vatSummaries).toHaveLength(expected.vatSummaries.length);
    for (const [j, summary] of actual.vatSummaries.entries()) {
      const donorSummary = expected.vatSummaries[j]!;
      expect(summary.vatNature, `body ${i + 1} summary ${j + 1} nature`).toBe(donorSummary.vatNature);
      for (const key of ["taxableAmount", "taxAmount", "vatRatePercent"] as const) {
        expect(canonical(summary[key]), `body ${i + 1} summary ${j + 1} ${key}`).toBe(donorSummary[key]);
      }
    }
    expect(actual.payments).toHaveLength(expected.payments.length);
    for (const [j, payment] of actual.payments.entries()) {
      const donorPayment = expected.payments[j]!;
      expect(payment.method, `body ${i + 1} payment ${j + 1} method`).toBe(donorPayment.method);
      expect(payment.dueDate, `body ${i + 1} payment ${j + 1} due date`).toBe(donorPayment.dueDate);
      expect(canonical(payment.amount), `body ${i + 1} payment ${j + 1} amount`).toBe(donorPayment.amount);
    }
  }
  return donor;
}

const publicAdministration = ordinary.replaceAll("FPR12", "FPA12");
const paymentBlock = `<DatiPagamento>
  <CondizioniPagamento>TP02</CondizioniPagamento>
  <DettaglioPagamento><ModalitaPagamento>MP05</ModalitaPagamento>
    <DataScadenzaPagamento>2026-11-06</DataScadenzaPagamento><ImportoPagamento>124.00</ImportoPagamento>
  </DettaglioPagamento>
</DatiPagamento>`;
const enriched = publicAdministration
  .replace("<ImportoTotaleDocumento>122.00</ImportoTotaleDocumento>",
    "<ImportoTotaleDocumento>124.00</ImportoTotaleDocumento><DatiBollo><BolloVirtuale>SI</BolloVirtuale><ImportoBollo>2.00</ImportoBollo></DatiBollo>")
  .replace("</DatiBeniServizi>", `</DatiBeniServizi>${paymentBlock}`);
const exemptBody = `<FatturaElettronicaBody><DatiGenerali><DatiGeneraliDocumento>
  <TipoDocumento>TD04</TipoDocumento><Divisa>EUR</Divisa><Data>2026-10-07</Data>
  <Numero>DEMO-2</Numero><ImportoTotaleDocumento>30.00</ImportoTotaleDocumento>
</DatiGeneraliDocumento></DatiGenerali><DatiBeniServizi>
  <DettaglioLinee><NumeroLinea>1</NumeroLinea><Descrizione>Esente demo</Descrizione>
    <Quantita>2.00</Quantita><PrezzoUnitario>15.00</PrezzoUnitario>
    <PrezzoTotale>30.00</PrezzoTotale><AliquotaIVA>0.00</AliquotaIVA><Natura>N2.2</Natura>
  </DettaglioLinee>
  <DatiRiepilogo><AliquotaIVA>0.00</AliquotaIVA><Natura>N2.2</Natura>
    <ImponibileImporto>30.00</ImponibileImporto><Imposta>0.00</Imposta>
  </DatiRiepilogo>
</DatiBeniServizi></FatturaElettronicaBody>`;
const multiBody = enriched.replace("</p:FatturaElettronica>", `${exemptBody}</p:FatturaElettronica>`);

describe("issue #288: pinned fatturapa 0.2.0 as a real offline XML oracle", () => {
  it("matches the AdE-derived anonymized FPR12 XML fixture, including header, line and VAT", () => {
    const result = compare(ordinary);
    expect(result.bodies[0]!.documentTotal).toBe("122");
  });

  it("matches FPA12 including bollo and payment fields via independent donor", () => {
    const result = compare(enriched);
    expect(result.bodies[0]!.stampDutyAmount).toBe("2");
    expect(result.bodies[0]!.payments).toEqual([{ method: "MP05", dueDate: "2026-11-06", amount: "124" }]);
  });

  it("matches an FPA12 invoice with multiple bodies, different rates and N2.2 nature", () => {
    const result = compare(multiBody);
    expect(result.bodies.map(({ number }) => number)).toEqual(["DEMO-1", "DEMO-2"]);
    expect(result.bodies[1]!.lines[0]!.vatNature).toBe("N2.2");
  });

  it("documents donor synthetic total when absent: TS keeps an explicit missing value", () => {
    const missing = ordinary.replace("<ImportoTotaleDocumento>122.00</ImportoTotaleDocumento>", "");
    expect(readFatturaPaXml(missing).bodies[0]!.documentTotal).toBeNull();
    expect(oracle(missing).bodies[0]!.documentTotal).toBe("122");
  });

  it("retains negative/refusal behavior for malformed fields and external entities", () => {
    const bad = enriched.replace("<Data>2026-10-06</Data>", "<Data>2026-02-30</Data>")
      .replace("<PrezzoTotale>100.00</PrezzoTotale>", "<PrezzoTotale>invalid</PrezzoTotale>")
      .replace("<ImportoBollo>2.00</ImportoBollo>", "<ImportoBollo>oops</ImportoBollo>")
      .replace("<ImportoPagamento>124.00</ImportoPagamento>", "<ImportoPagamento>oops</ImportoPagamento>");
    const parsed = readFatturaPaXml(bad);
    expect(parsed.fieldErrors.filter(({ code }) => code === "INVALID_DATE")).toHaveLength(1);
    expect(parsed.fieldErrors.filter(({ code }) => code === "INVALID_DECIMAL")).toHaveLength(3);
    expect(parsed.bodies[0]!.number).toBe("DEMO-1");
    expect(() => readFatturaPaXml(ordinary.replace("/fatture/v1.2", "/fatture/unknown"))).toThrowError(
      expect.objectContaining<Partial<FatturaPaReaderError>>({ code: "FATTURAPA_NAMESPACE_UNSUPPORTED" }),
    );
    expect(() => readFatturaPaXml(ordinary.replace("<p:FatturaElettronica",
      '<!DOCTYPE invoice [<!ENTITY data SYSTEM "file:///tmp/secret">]><p:FatturaElettronica'))).toThrow(/DTD|ENTITY/u);
  });

  it("retains FSM10 browser support, which is outside the donor FPR12/FPA12 scope", () => {
    expect(readFatturaPaXml(simplified).family).toBe("simplified");
    expect(readFatturaPaXml(simplified).bodies[0]!.lines[0]!.lineTotal).toBe("50.00");
  });

  it("preserves every payment group even though donor 0.2.0 only exposes the first", () => {
    const xml = enriched.replace("</FatturaElettronicaBody>",
      `<DatiPagamento><CondizioniPagamento>TP02</CondizioniPagamento><DettaglioPagamento>
      <ModalitaPagamento>MP01</ModalitaPagamento><ImportoPagamento>1.00</ImportoPagamento>
      </DettaglioPagamento></DatiPagamento></FatturaElettronicaBody>`);
    expect(readFatturaPaXml(xml).bodies[0]!.payments).toHaveLength(2);
    expect(oracle(xml).bodies[0]!.payments).toHaveLength(1);
  });
});
