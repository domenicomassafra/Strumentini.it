import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const image = await sharp(Buffer.from([
  255, 0, 0, 255, 0, 255, 0, 255,
  0, 0, 255, 255, 255, 255, 0, 255,
]), { raw: { width: 2, height: 2, channels: 4 } }).png().toBuffer();
const expectedHash = createHash("sha256").update(image).digest("hex");
const port = await new Promise((done, fail) => {
  const socket = createServer();
  socket.once("error", fail);
  socket.listen(0, "127.0.0.1", () => {
    const address = socket.address();
    if (!address || typeof address === "string") return fail(new Error("port unavailable"));
    socket.close(() => done(address.port));
  });
});
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });
let browser;
try {
  for (let n = 0; n < 90; n++) {
    if (server.exitCode !== null) throw new Error("static server unavailable");
    try { if ((await fetch(`${origin}/tools/image-crop/`)).ok) break; } catch { /* warm-up */ }
    if (n === 89) throw new Error("compiled image editor unavailable");
    await new Promise(done => setTimeout(done, 100));
  }
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    const url = `${origin}/tools/image-crop/`;
    await page.goto(url);
    await page.locator("[data-image-project-412]").waitFor();
    await page.waitForFunction(() => {
      const islands = Array.from(document.querySelectorAll("astro-island"));
      return islands.length > 0 && islands.every(island => !island.hasAttribute("ssr"));
    }, null, { timeout: 30000 });
    await page.locator('input[type="file"][accept*="image/png"]').setInputFiles({
      name: "source.png", mimeType: "image/png", buffer: image,
    });
    await page.getByRole("button", { name: "Ruota 90°" }).waitFor();
    await page.getByRole("button", { name: "Ruota 90°" }).click();
    await page.getByRole("button", { name: "Salva progetto su questo dispositivo" }).click();
    await page.locator("[data-image-project-412] [role=status]").filter({ hasText: "Nuova copia v2" }).waitFor();

    const saved = await page.evaluate(async () => {
      const db = await new Promise((done, fail) => {
        const r = indexedDB.open("strumentini-editor-projects-412", 1);
        r.onsuccess = () => done(r.result);
        r.onerror = () => fail(r.error);
      });
      try {
        const entries = await new Promise((done, fail) => {
          const tx = db.transaction("state", "readonly");
          const r = tx.objectStore("state").getAll();
          r.onsuccess = () => done(r.result);
          r.onerror = () => fail(r.error);
        });
        return Promise.all(entries.filter(e => e.schema === "strumentini-editor-project" && e.kind === "image")
          .map(async project => ({
            id: project.id,
            bytes: Array.from(project.files.find(file => file.role === "source").bytes),
            actualHash: Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", project.files[0].bytes))).map(x => x.toString(16).padStart(2, "0")).join(""),
            recordedHash: project.files[0].sha256,
            state: JSON.parse(new TextDecoder().decode(project.stateBytes)),
          })));
      } finally { db.close(); }
    });
    assert.equal(saved.length, 1, "one new opt-in image snapshot");
    assert.equal(createHash("sha256").update(Buffer.from(saved[0].bytes)).digest("hex"), expectedHash, "independent Node SHA-256 original after save");
    assert.equal(saved[0].actualHash, expectedHash, "browser SHA-256 original");
    assert.equal(saved[0].recordedHash, expectedHash, "recorded project hash");
    assert.equal(saved[0].state.history.current.rotate, 90);
    assert.equal(saved[0].state.history.past[0].rotate, 0);

    await page.reload();
    await page.locator("[data-image-project-412]").waitFor();
    await page.getByLabel("Progetto immagine salvato").selectOption(`v2:${saved[0].id}`);
    await page.getByRole("button", { name: "Riapri progetto", exact: true }).click();
    await page.locator("[data-image-project-412] [role=status]").filter({ hasText: "Progetto riaperto" }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Annulla ultima modifica" }).isEnabled(), true, "undo restored after reload");
    await page.getByRole("button", { name: "Annulla ultima modifica" }).click();
    assert.equal(await page.getByRole("button", { name: "Ripeti modifica" }).isEnabled(), true, "redo restored after undo");
    await page.getByRole("button", { name: "Ripeti modifica" }).click();

    await page.getByRole("button", { name: "Salva progetto su questo dispositivo" }).click();
    await page.locator("[data-image-project-412] [role=status]").filter({ hasText: "Nuova copia v2" }).waitFor();
    const reopenedHash = await page.evaluate(async id => {
      const db = await new Promise((done, fail) => {
        const r = indexedDB.open("strumentini-editor-projects-412", 1);
        r.onsuccess = () => done(r.result);
        r.onerror = () => fail(r.error);
      });
      const records = await new Promise((done, fail) => {
        const r = db.transaction("state", "readonly").objectStore("state").getAll();
        r.onsuccess = () => done(r.result);
        r.onerror = () => fail(r.error);
      });
      db.close();
      const copied = records.find(item => item.kind === "image" && item.id !== id);
      return copied ? Array.from(copied.files[0].bytes) : null;
    }, saved[0].id);
    assert.ok(reopenedHash, "saved a new snapshot from reopened editor");
    assert.equal(createHash("sha256").update(Buffer.from(reopenedHash)).digest("hex"), expectedHash, "reopened editor source matches independent original hash");

    const legacyId = "22222222-2222-4222-8222-222222222222";
    await page.evaluate(async ({ legacyId, sourceBytes, state }) => {
      const db = await new Promise((done, fail) => {
        const r = indexedDB.open("strumentini-image-projects-385", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("projects");
        r.onsuccess = () => done(r.result);
        r.onerror = () => fail(r.error);
      });
      await new Promise((done, fail) => {
        const tx = db.transaction("projects", "readwrite");
        tx.objectStore("projects").add({
          schema: "image-transform-project", version: 1,
          id: legacyId, revision: 1, name: "Vecchio immagine",
          original: new Blob([new Uint8Array(sourceBytes)], { type: "image/png" }),
          originalName: "source.png", mime: "image/png",
          width: 2, height: 2, transform: state.history.current,
        }, legacyId);
        tx.oncomplete = done;
        tx.onerror = () => fail(tx.error);
      });
      db.close();
    }, { legacyId, sourceBytes: saved[0].bytes, state: saved[0].state });
    await page.reload();
    await page.locator("[data-image-project-412]").waitFor();
    await page.getByLabel("Progetto immagine salvato").selectOption(`v1:${legacyId}`);
    await page.getByRole("button", { name: "Riapri progetto", exact: true }).click();
    await page.locator("[data-image-project-412] [role=status]").filter({ hasText: "Progetto riaperto" }).waitFor();
    await page.getByRole("button", { name: "Salva progetto su questo dispositivo" }).click();
    await page.locator("[data-image-project-412] [role=status]").filter({ hasText: "Nuova copia v2" }).waitFor();
    const legacyBytes = await page.evaluate(async id => {
      const db = await new Promise((done, fail) => {
        const r = indexedDB.open("strumentini-image-projects-385", 1);
        r.onsuccess = () => done(r.result);
        r.onerror = () => fail(r.error);
      });
      const item = await new Promise((done, fail) => {
        const r = db.transaction("projects", "readonly").objectStore("projects").get(id);
        r.onsuccess = () => done(r.result);
        r.onerror = () => fail(r.error);
      });
      db.close();
      return { revision: item.revision, bytes: Array.from(new Uint8Array(await item.original.arrayBuffer())) };
    }, legacyId);
    assert.equal(legacyBytes.revision, 1, "old v1 revision unchanged");
    assert.equal(createHash("sha256").update(Buffer.from(legacyBytes.bytes)).digest("hex"), expectedHash, "old v1 source unchanged");

    // A malformed legacy project must not hide healthy v2 snapshots.
    await page.evaluate(async () => {
      const db = await new Promise((done, fail) => {
        const r = indexedDB.open("strumentini-image-projects-385", 1);
        r.onsuccess = () => done(r.result);
        r.onerror = () => fail(r.error);
      });
      await new Promise((done, fail) => {
        const tx = db.transaction("projects", "readwrite");
        tx.objectStore("projects").add({ schema: "future-image-project", version: 99 }, "33333333-3333-4333-8333-333333333333");
        tx.oncomplete = done;
        tx.onerror = () => fail(tx.error);
      });
      db.close();
    });
    await page.reload();
    await page.locator("[data-image-project-412]").waitFor();
    await page.getByLabel("Progetto immagine salvato").selectOption(`v2:${saved[0].id}`);
    await page.getByRole("button", { name: "Riapri progetto", exact: true }).click();
    await page.locator("[data-image-project-412] [role=status]").filter({ hasText: "Progetto riaperto" }).waitFor();

    await page.evaluate(async () => {
      const db = await new Promise((done, fail) => {
        const r = indexedDB.open("strumentini-editor-projects-412", 1);
        r.onsuccess = () => done(r.result);
        r.onerror = () => fail(r.error);
      });
      await new Promise((done, fail) => {
        const tx = db.transaction("state", "readwrite");
        tx.objectStore("state").add({ schema: "strumentini-editor-project", version: 99 }, "editor-project/412/v2/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
        tx.oncomplete = done;
        tx.onerror = () => fail(tx.error);
      });
      db.close();
    });
    await page.reload();
    await page.locator("[data-image-project-412]").waitFor();
    assert.match(await page.locator("[data-image-project-412] [role=status]").innerText(), /schema sconosciuto|file mancanti/u, "future schema refusal surfaced");
    const savedAfter = await page.evaluate(async id => {
      const db = await new Promise((done, fail) => {
        const r = indexedDB.open("strumentini-editor-projects-412", 1);
        r.onsuccess = () => done(r.result);
        r.onerror = () => fail(r.error);
      });
      const item = await new Promise((done, fail) => {
        const r = db.transaction("state", "readonly").objectStore("state").get(`editor-project/412/v2/${id}`);
        r.onsuccess = () => done(r.result);
        r.onerror = () => fail(r.error);
      });
      db.close();
      return Array.from(item.files[0].bytes);
    }, saved[0].id);
    assert.equal(createHash("sha256").update(Buffer.from(savedAfter)).digest("hex"), expectedHash, "refusal did not overwrite prior asset");
    assert.deepEqual(errors, [], "no browser runtime errors");
    console.log("PASS STR-412 image compiled consumer: v1/v2 reopen, reload, undo/redo, independent SHA-256, future-schema refusal");
  } finally {
    await context.close();
  }
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
  await new Promise(done => {
    if (server.exitCode !== null) return done();
    server.once("exit", done);
    setTimeout(done, 1500).unref();
  });
}
