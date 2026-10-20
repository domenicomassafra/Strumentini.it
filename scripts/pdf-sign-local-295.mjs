#!/usr/bin/env node
/** No HTTP endpoint: user invokes the opt-in signing command on their own host. */
import { open, readFile, realpath, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { signPdfLocal295 } from './lib/pdf-sign-local-295.mjs';

const USAGE = `Uso: node scripts/pdf-sign-local-295.mjs --input documento.pdf --p12 certificato.p12 --output firmato.pdf --password-stdin --consent-local-signing [--signature-bytes N]
Esecuzione esclusivamente locale su Node. La password si legge da stdin, non dagli argomenti. Nessun upload o log del documento e delle credenziali.`;

function args295(argv) {
  if (argv.includes('--help')) return null;
  const allowed = new Set(['--input', '--p12', '--output', '--password-stdin', '--consent-local-signing', '--signature-bytes']);
  const fields = new Map();
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (!allowed.has(flag) || fields.has(flag)) throw Error('PDF295_ARGUMENTS');
    if (flag === '--password-stdin' || flag === '--consent-local-signing') fields.set(flag, true);
    else {
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw Error('PDF295_ARGUMENTS');
      fields.set(flag, argv[++i]);
    }
  }
  if (!fields.has('--password-stdin') || !fields.has('--consent-local-signing')
    || !fields.has('--input') || !fields.has('--p12') || !fields.has('--output')) throw Error('PDF295_CONSENT_OR_ARGUMENTS');
  return fields;
}

async function readPassword() {
  const chunks = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > 2048) throw Error('PDF295_INVALID_PASSPHRASE');
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  try { return bytes.toString('utf8').replace(/\r?\n$/u, ''); }
  finally { bytes.fill(0); chunks.forEach((item) => item.fill(0)); }
}

export async function main295(argv = process.argv.slice(2)) {
  const fields = args295(argv);
  if (!fields) { process.stdout.write(`${USAGE}\n`); return; }
  const inputPath = resolve(fields.get('--input'));
  const p12Path = resolve(fields.get('--p12'));
  const outputPath = resolve(fields.get('--output'));
  if (outputPath === inputPath || outputPath === p12Path) throw Error('PDF295_OUTPUT_COLLISION');
  // No output can replace an existing file, including via a symlink.
  const [realPdf, realP12] = await Promise.all([realpath(inputPath), realpath(p12Path)]);
  if (outputPath === realPdf || outputPath === realP12) throw Error('PDF295_OUTPUT_COLLISION');
  const [pdf, p12, passphrase] = await Promise.all([readFile(inputPath), readFile(p12Path), readPassword()]);
  if (!passphrase.length) throw Error('PDF295_INVALID_PASSPHRASE');
  let output;
  try {
    output = await signPdfLocal295({ pdf, p12, passphrase, consent: true,
      ...(fields.has('--signature-bytes') ? { signatureBytes: Number(fields.get('--signature-bytes')) } : {}) });
  } finally { p12.fill(0); }
  // Exclusive creation prevents accidental overwrite, and permission 0600
  // ensures sensitive signed output isn't readable by other local accounts.
  const handle = await open(outputPath, 'wx', 0o600);
  try { await handle.writeFile(output); }
  catch (error) { await handle.close(); await unlink(outputPath); throw error; }
  await handle.close();
  process.stdout.write('PDF295_SIGNED_LOCAL\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main295().catch((error) => {
    const code = /^PDF295_[A-Z_]+$/u.test(error?.message || '') ? error.message : 'PDF295_IO_OR_INPUT_ERROR';
    process.stderr.write(`${code}\n`);
    process.exitCode = 1;
  });
}
