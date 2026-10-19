// @ts-nocheck — the CLI module is an intentionally standalone Node .mjs artifact.
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { preflightUnsignedPdf295, signPdfLocal295 } from '../scripts/lib/pdf-sign-local-295.mjs';

let work, source, identity;
const password = 'fixture-passphrase-only';

function openssl(...args) {
  const run = spawnSync('openssl', args, { encoding: 'utf8', timeout: 15000 });
  if (run.status !== 0) throw Error(`OpenSSL fixture/verification failed (exit=${run.status})`);
}

function detachedCms295(pdf) {
  const text = pdf.toString('latin1');
  const matches = [...text.matchAll(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/gu)];
  expect(matches).toHaveLength(1);
  const [start, firstLen, secondStart, secondLen] = matches[0].slice(1).map(Number);
  expect(start).toBe(0);
  expect(secondStart + secondLen).toBe(pdf.length);
  expect(secondStart).toBeGreaterThan(firstLen);
  const between = text.slice(firstLen, secondStart);
  expect(between).toMatch(/^<[0-9a-fA-F]+>$/u);
  const cms = Buffer.from(between.slice(1, -1), 'hex');
  return { cms, content: Buffer.concat([pdf.subarray(0, firstLen), pdf.subarray(secondStart)]) };
}

beforeAll(async () => {
  await mkdir('node_modules/.cache', { recursive: true });
  work = await mkdtemp('node_modules/.cache/strume295-');
  const key = join(work, 'private.key');
  const cert = join(work, 'test-cert.pem');
  const p12Path = join(work, 'test-identity.p12');
  openssl('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert,
    '-days', '1', '-subj', '/CN=Fixture STR295');
  openssl('pkcs12', '-export', '-legacy', '-inkey', key, '-in', cert, '-out', p12Path, '-passout', `pass:${password}`);
  identity = await readFile(p12Path);
  const pdf = await PDFDocument.create();
  pdf.addPage([320, 420]).drawText('Independent PDF signature fixture', { x: 32, y: 300,
    font: await pdf.embedFont(StandardFonts.Helvetica) });
  source = Buffer.from(await pdf.save({ useObjectStreams: false }));
});

afterAll(async () => { if (work) await rm(work, { recursive: true, force: true }); });

describe('#295 optional local P12 cryptographic signing', () => {
  it('embeds a detached CMS independently verified by OpenSSL; PDF remains readable', async () => {
    const preserved = Buffer.from(source);
    const signed = await signPdfLocal295({ pdf: source, p12: identity, passphrase: password, consent: true });
    expect(source).toEqual(preserved);
    expect(signed.toString('latin1')).toContain('/ByteRange');
    const { cms, content } = detachedCms295(signed);
    const cmsPath = join(work, 'signature.der');
    const dataPath = join(work, 'signed-bytes.bin');
    const verifiedPath = join(work, 'verified.bin');
    await writeFile(cmsPath, cms);
    await writeFile(dataPath, content);
    openssl('cms', '-verify', '-inform', 'DER', '-binary', '-noverify', '-in', cmsPath,
      '-content', dataPath, '-out', verifiedPath);
    expect(await readFile(verifiedPath)).toEqual(content);
    const reopened = await PDFDocument.load(signed);
    expect(reopened.getPageCount()).toBe(1);
    // A changed signed byte must independently fail CMS verification.
    const tampered = Buffer.from(content);
    tampered[200] ^= 1;
    await writeFile(dataPath, tampered);
    const failure = spawnSync('openssl', ['cms', '-verify', '-inform', 'DER', '-binary', '-noverify',
      '-in', cmsPath, '-content', dataPath, '-out', verifiedPath]);
    expect(failure.status).not.toBe(0);
  });

  it('refuses missing consent, wrong passphrase, insufficient placeholder and invalid P12', async () => {
    await expect(signPdfLocal295({ pdf: source, p12: identity, passphrase: password })).rejects.toThrow('PDF295_CONSENT_REQUIRED');
    await expect(signPdfLocal295({ pdf: source, p12: identity, passphrase: 'wrong', consent: true })).rejects.toThrow('PDF295_SIGNING_FAILED_OR_BAD_PASSWORD');
    await expect(signPdfLocal295({ pdf: source, p12: identity, passphrase: password, consent: true, signatureBytes: 1024 })).rejects.toThrow('PDF295_PLACEHOLDER_TOO_SMALL');
    await expect(signPdfLocal295({ pdf: source, p12: Buffer.from('bad'), passphrase: password, consent: true })).rejects.toThrow('PDF295_INVALID_P12');
  });

  it('refuses already signed, appended revisions, unsafe dictionaries and unsupported files', async () => {
    const signed = await signPdfLocal295({ pdf: source, p12: identity, passphrase: password, consent: true });
    expect(() => preflightUnsignedPdf295(signed)).toThrow('PDF295_ALREADY_SIGNED_OR_FORM');
    expect(() => preflightUnsignedPdf295(Buffer.concat([source, Buffer.from('\nstartxref\n2\n%%EOF\n')]))).toThrow('PDF295_AMBIGUOUS_REVISION');
    expect(() => preflightUnsignedPdf295(Buffer.concat([source, Buffer.from('\n/Encrypt 9 0 R')]))).toThrow('PDF295_AMBIGUOUS_REVISION');
    const altered = Buffer.from(source.toString('latin1').replace('%%EOF', '/ByteRange [0 1 2 3]\n%%EOF'), 'latin1');
    expect(() => preflightUnsignedPdf295(altered)).toThrow('PDF295_ALREADY_SIGNED_OR_FORM');
    expect(() => preflightUnsignedPdf295(Buffer.from('not a PDF'))).toThrow('PDF295_UNSUPPORTED_PDF');
  });

  it('CLI signs only on explicit local opt-in; never overwrites an existing output', async () => {
    const inputPath = join(work, 'input.pdf');
    const p12Path = join(work, 'test-identity.p12');
    const outputPath = join(work, 'output.pdf');
    await writeFile(inputPath, source);
    const base = ['scripts/pdf-sign-local-295.mjs', '--input', inputPath, '--p12', p12Path,
      '--output', outputPath, '--password-stdin'];
    const noConsent = spawnSync(process.execPath, base, { input: password, encoding: 'utf8' });
    expect(noConsent.status).toBe(1);
    expect(noConsent.stderr).toContain('PDF295_CONSENT_OR_ARGUMENTS');
    const signed = spawnSync(process.execPath, [...base, '--consent-local-signing'], { input: password, encoding: 'utf8' });
    expect(signed.status, signed.stderr).toBe(0);
    expect(signed.stdout.trim()).toBe('PDF295_SIGNED_LOCAL');
    expect(detachedCms295(await readFile(outputPath)).cms.length).toBeGreaterThan(500);
    expect((await stat(outputPath)).mode & 0o777).toBe(0o600);
    const again = spawnSync(process.execPath, [...base, '--consent-local-signing'], { input: password, encoding: 'utf8' });
    expect(again.status).toBe(1);
    expect(again.stderr).not.toContain(password);
    expect(await readFile(inputPath)).toEqual(source);
    expect((await readdir(work)).filter((name) => name.endsWith('.pdf'))).toEqual(['input.pdf', 'output.pdf']);
  });
});
