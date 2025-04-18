#!/usr/bin/env node
/*
 * skills/download.mjs
 * -------------------
 * Download a remote file.  Exported as `download(url, [outPath])` so other code
 * can import and reuse the functionality while still supporting CLI usage.
 */

import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Download `url` and write it to `outPath` (or `download/<slug>` when omitted).
 *
 * @param {string} url
 * @param {string | undefined} outPath
 * @returns {Promise<string>}  The final output path.
 */
export async function download(url, outPath) {
  if (!url || typeof url !== 'string') {
    throw new TypeError('url must be a non‑empty string');
  }

  const defaultDir = 'download';
  const slug = url.trim().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const outputFile = outPath || `${defaultDir}/${slug}`;

  // Dynamically load required deps
  const useJs = await (await fetch('https://unpkg.com/use-m/use.js')).text();
  const { use } = eval(useJs);

  const fetchMod = await use('node-fetch@3');
  const fetchFn = fetchMod.default || fetchMod;
  const fsExtra = await use('fs-extra@11');

  // Download
  const response = await fetchFn(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());

  await fsExtra.outputFile(outputFile, buffer);
  return outputFile;
}

// CLI runner
const isCLI = (() => {
  if (!process.argv[1]) return false;
  return path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
})();

if (isCLI) {
  (async () => {
    const args = process.argv.slice(2);
    if (args.length < 1) {
      console.error('Usage: download.mjs <URL> [outputFile]');
      process.exit(1);
    }
    const [url, outPath] = args;
    try {
      const out = await download(url, outPath);
      console.log(`✅ Saved ${url} → ${out}`);
    } catch (err) {
      console.error(`❌ ${err.message}`);
      process.exit(1);
    }
  })();
}
