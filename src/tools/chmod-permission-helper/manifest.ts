import { defineDeveloperWebManifest } from "../../engines/developer-web/manifest";

export const chmodPermissionHelperManifest = defineDeveloperWebManifest({
  id: "chmod-permission-helper",
  name: "chmod Permission Helper",
  summary: "Convert Unix rwx permissions and octal modes in both directions, including setuid, setgid and sticky-bit semantics without touching the filesystem.",
  aliases: ["chmod calculator", "unix permission converter", "octal rwx converter"],
  jobs: ["convert chmod permissions", "convert octal to rwx", "convert rwx to octal"],
  inputTypes: ["unix-mode", "text"],
  oracleEntryId: "cand-203",
  fixtureFamilies: ["developer-network-numeric"],
});
export default chmodPermissionHelperManifest;
