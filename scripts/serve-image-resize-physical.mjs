import { spawn } from "node:child_process";
import { networkInterfaces } from "node:os";

const port = Number(process.env.IMAGE_RESIZE_PHYSICAL_PORT ?? "18141");
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("IMAGE_RESIZE_PHYSICAL_PORT must be a valid non-privileged port");

const addresses = Object.values(networkInterfaces())
  .flatMap((entries) => entries ?? [])
  .filter((entry) => entry.family === "IPv4" && !entry.internal)
  .map((entry) => entry.address);

console.log("Physical Image Resize acceptance server");
console.log("Keep this terminal open while testing the phone on the same LAN.");
console.log("Open one of these URLs on the physical device:");
if (addresses.length === 0) console.log(`  http://<this-computer-lan-ip>:${port}/tools/image-resize/`);
for (const address of addresses) console.log(`  http://${address}:${port}/tools/image-resize/`);
console.log("Test with a real image chosen through Files/Photos, resize it, open the downloaded output, and note the source/output dimensions shown by the tool.");
console.log("Stop the server with Ctrl-C. Then record the observed run with npm run acceptance:image-resize:physical:record -- ...");

const child = spawn("python3", ["-m", "http.server", String(port), "--bind", "0.0.0.0", "--directory", "dist"], {
  stdio: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("exit", (code, signal) => process.exit(signal ? 0 : (code ?? 0)));
