#!/usr/bin/env node
/*
 * skills/search-youtube.mjs
 * -------------------------
 * Search YouTube for videos matching a given query, save the results to a Markdown file and
 * optionally return the parsed results + output path. The file can be used in two different ways:
 *   1. As a **stand‑alone script**:   `node skills/search-youtube.mjs "cooking tutorials"`
 *   2. As an **importable module**:   `const { searchYouTube } = await import('./skills/search-youtube.mjs');`
 *                                    `await searchYouTube('cooking tutorials');`
 *
 * To achieve both usage patterns we:
 *   • wrap the core logic in an exported async function `searchYouTube()`
 *   • detect direct‑CLI execution (`isCLI`) and, if true, forward the
 *     command‑line arguments to that function.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Perform a YouTube search and write the results to a Markdown file.
 *
 * @param {string} query                The search query.
 * @param {string | undefined} outPath  Optional custom output path. When
 *                                      omitted the file will be placed under
 *                                      `search-youtube/<slug>.md`.
 * @returns {Promise<{results: Array, outputFile: string}>}
 */
export async function searchYouTube(query, outPath) {
  if (!query || typeof query !== 'string') {
    throw new TypeError('query must be a non‑empty string');
  }

  const defaultDir = 'search-youtube';
  const slug = query.trim().replace(/\s+/g, '-');
  const outputFile = outPath || `${defaultDir}/${slug}.md`;

  if (!outPath) {
    await fs.mkdir(defaultDir, { recursive: true });
  }

  /* ------------------------------------------------------------------
   * Dynamic imports via use‑m to keep the repository dependency‑free.
   * ------------------------------------------------------------------ */
  const useJs = await (await fetch('https://unpkg.com/use-m/use.js')).text();
  const { use } = eval(useJs);

  const fetchMod = await use('node-fetch@3');
  const fetchFn = fetchMod.default || fetchMod;

  const cheerio = await use('cheerio@1.0.0-rc.12');
  const { load } = cheerio;

  // Fetch YouTube search results page
  const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  let html;
  try {
    const res = await fetchFn(ytUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (err) {
    throw new Error(`Failed to fetch results: ${err.message}`);
  }

  // Parse HTML and extract video entries
  const $ = load(html);
  const results = [];
  $('a#video-title').each((i, el) => {
    const elem = $(el);
    const title = elem.text().trim();
    let href = elem.attr('href') || '';
    // skip non-video links
    if (!href.startsWith('/watch')) return;
    const url = `https://www.youtube.com${href.split('&')[0]}`;
    results.push({ title, url });
  });

  // Build Markdown content
  let md = `# YouTube search results for "${query}"
\n`;
  for (const { title, url } of results) {
    md += `- [${title}](${url})\n\n`;
  }

  // Write to the output file
  await fs.writeFile(outputFile, md, 'utf8');

  return { results, outputFile };
}

/* -------------------------------------------------------------------------- */
// CLI runner – after the export so that importing doesn’t immediately trigger
// any network requests or side‑effects.
/* -------------------------------------------------------------------------- */

const isCLI = (() => {
  if (!process.argv[1]) return false;
  const cliPath = path.resolve(process.argv[1]);
  const thisPath = path.resolve(fileURLToPath(import.meta.url));
  return cliPath === thisPath;
})();

if (isCLI) {
  (async () => {
    const args = process.argv.slice(2);
    if (args.length < 1) {
      console.error('Usage: search-youtube.mjs <query> [outputFile]');
      process.exit(1);
    }
    const [query, outputPathArg] = args;
    try {
      const { results, outputFile } = await searchYouTube(query, outputPathArg);
      console.log(`✅ Saved ${results.length} results to ${outputFile}`);
    } catch (err) {
      console.error(`❌ ${err.message}`);
      process.exit(1);
    }
  })();
}
