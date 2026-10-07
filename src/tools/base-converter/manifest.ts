import { defineDeveloperWebManifest } from "../../engines/developer-web/manifest";

export const baseConverterManifest = defineDeveloperWebManifest({
  id: "base-converter",
  name: "Base 2–36 Integer Converter",
  summary: "Convert signed integers exactly between bases 2 and 36 with bounded BigInt arithmetic and precise invalid-digit locations.",
  aliases: ["radix converter", "binary decimal hex converter", "number base converter"],
  jobs: ["convert integer base", "convert hexadecimal to decimal", "convert binary to hexadecimal"],
  inputTypes: ["integer", "number", "text"],
  oracleEntryId: "cand-202",
  fixtureFamilies: ["developer-network-numeric"],
});
export default baseConverterManifest;
