#!/usr/bin/env node
/*
 * skills/search-github.mjs
 * ------------------------
 * Search GitHub for repositories matching a given query, save the results to a Markdown file and
 * optionally return the parsed results + output path. The file can be used in two different ways:
 *   1. As a **stand‑alone script**:   `node skills/search-github.mjs "utility libs"`
 *   2. As an **importable module**:   `const { searchGitHub } = await import('./skills/search-github.mjs');`
 *                                    `await searchGitHub('utility libs');`
 *
 * To achieve both usage patterns we:
 *   • wrap the core logic in an exported async function `searchGitHub()`
 *   • detect direct‑CLI execution (`isCLI`) and, if true, forward the
 *     command‑line arguments to that function.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Perform a GitHub repository search and write the results to a Markdown file.
 *
 * @param {string} query                The search query.
 * @param {string | undefined} outPath  Optional custom output path. When
 *                                      omitted the file will be placed under
 *                                      `search-github/<slug>.md`.
 * @returns {Promise<{results: Array, outputFile: string}>}
 */
export async function searchGitHub(query, outPath) {
  if (!query || typeof query !== 'string') {
    throw new TypeError('query must be a non‑empty string');
  }

  // Default output directory based on script name
  const defaultDir = 'search-github';
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

  // Fetch GitHub search results via API
  const apiUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}`;
  let json;
  try {
    const res = await fetchFn(apiUrl, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'node.js'
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    json = await res.json();
  } catch (err) {
    throw new Error(`Failed to fetch results: ${err.message}`);
  }

  // Extract relevant fields from results
  const results = (json.items || []).map(repo => ({
    name: repo.full_name,
    url: repo.html_url,
    description: repo.description || '',
    stars: repo.stargazers_count
  }));

  // Build Markdown content
  let md = `# GitHub search results for "${query}"
\n`;
  for (const { name, url, description, stars } of results) {
    md += `- [${name}](${url}) ⭐ ${stars}\n\n  ${description}\n\n`;
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
      console.error('Usage: search-github.mjs <query> [outputFile]');
      process.exit(1);
    }
    const [query, outputPathArg] = args;
    try {
      const { results, outputFile } = await searchGitHub(query, outputPathArg);
      console.log(`✅ Saved ${results.length} results to ${outputFile}`);
    } catch (err) {
      console.error(`❌ ${err.message}`);
      process.exit(1);
    }
  })();
}
