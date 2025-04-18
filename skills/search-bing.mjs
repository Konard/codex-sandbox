#!/usr/bin/env node
/*
 * skills/search-bing.mjs
 * ----------------------
 * Search Bing for a given query, save the results to a Markdown file and
 * optionally return the parsed results + output path.  The file can be used in
 * two different ways:
 *   1. As a **stand‑alone script**:   `node skills/search-bing.mjs "cats"`
 *   2. As an **importable module**:   `const { searchBing } = await import('./skills/search-bing.mjs');`
 *                                    `await searchBing('cats');`
 *
 *  To achieve both usage patterns we:                                
 *   • wrap the core logic in an exported async function `searchBing()`
 *   • detect direct‑CLI execution (`isCLI`) and, if true, forward the
 *     command‑line arguments to that function.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Perform a Bing search and write the results to a Markdown file.
 *
 * @param {string} query                The search query.
 * @param {string | undefined} outPath  Optional custom output path. When
 *                                      omitted the file will be placed under
 *                                      `search-bing/<slug>.md`.
 * @returns {Promise<{results: Array, outputFile: string}>}
 */
export async function searchBing(query, outPath) {
  if (!query || typeof query !== 'string') {
    throw new TypeError('query must be a non‑empty string');
  }

  // Default output directory based on script name
  const defaultDir = 'search-bing';
  // Slugify query by replacing spaces with hyphens
  const slug = query.trim().replace(/\s+/g, '-');
  // Determine output file path: use provided path or default under defaultDir
  const outputFile = outPath || `${defaultDir}/${slug}.md`;

  // Ensure directory exists when using the default location
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

  // Fetch Bing results page
  const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
  let html;
  try {
    const res = await fetchFn(bingUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (err) {
    // Re‑throw to let consumer handle/inspect the error
    throw new Error(`Failed to fetch results: ${err.message}`);
  }

  // Parse HTML and extract results
  const $ = load(html);
  const results = [];
  $('li.b_algo').each((i, el) => {
    const elem = $(el);
    const title = elem.find('h2 a').text().trim();
    const url = elem.find('h2 a').attr('href');
    const description = elem.find('.b_caption p').text().trim();
    if (title && url) results.push({ title, url, description });
  });

  // Build Markdown content
  let md = `# Search results for "${query}"
\n`;
  for (const { title, url, description } of results) {
    md += `- [${title}](${url})\n\n  ${description || ''}\n\n`;
  }

  // Write to the output file
  await fs.writeFile(outputFile, md, 'utf8');

  return { results, outputFile };
}

/* -------------------------------------------------------------------------- */
// CLI runner – after the export so that importing doesn’t immediately trigger
// any network requests or side‑effects.
/* -------------------------------------------------------------------------- */

// Detect whether this file is executed directly via `node skills/search-bing.mjs`
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
      console.error('Usage: search-bing.mjs <query> [outputFile]');
      process.exit(1);
    }
    const [query, outputPathArg] = args;
    try {
      const { results, outputFile } = await searchBing(query, outputPathArg);
      console.log(`✅ Saved ${results.length} results to ${outputFile}`);
    } catch (err) {
      console.error(`❌ ${err.message}`);
      process.exit(1);
    }
  })();
}