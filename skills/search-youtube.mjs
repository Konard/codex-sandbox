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
import fetch from 'node-fetch';

/**
 * Searches YouTube using the YouTube Data API.
 * @param {string} query - The search query term.
 * @param {string} apiKey - Your YouTube Data API key.
 * @param {number} [maxResults=5] - The maximum number of results to return.
 * @returns {Promise<Object>} - The search results from YouTube.
 */
export async function searchYouTubeViaAPI(query, apiKey, maxResults = 5) {
  const endpoint = 'https://www.googleapis.com/youtube/v3/search';
  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'video',
    maxResults: maxResults.toString(),
    key: apiKey,
  });

  const response = await fetch(`${endpoint}?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`YouTube API request failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Converts YouTube API search results to Markdown format.
 * @param {Object} apiResults - The results from the YouTube API.
 * @param {string} query - The search query term.
 * @returns {string} - The Markdown content.
 */
function convertResultsToMarkdown(apiResults, query) {
  let markdown = `# YouTube search results for "${query}"
\n`;

  if (apiResults.items && apiResults.items.length > 0) {
    for (const item of apiResults.items) {
      const title = item.snippet.title;
      const url = `https://www.youtube.com/watch?v=${item.id.videoId}`;
      markdown += `- [${title}](${url})\n\n`;
    }
  } else {
    markdown += "No results found.\n";
  }

  return markdown;
}

/**
 * Perform a YouTube search and write the results to a Markdown file.
 *
 * @param {string} query                The search query.
 * @param {string | undefined} outPath  Optional custom output path. When
 *                                      omitted the file will be placed under
 *                                      `search-youtube/<slug>.md`.
 * @returns {Promise<{results: Array, outputFile: string}>}
 */
export async function searchYouTubeViaHTML(query, outPath) {
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
  console.log('Fetching YouTube search results from:', ytUrl);

  let html;
  try {
    const res = await fetchFn(ytUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
    console.log('Fetched HTML length:', html.length);

    // Save fetched HTML to a file for debugging
    const debugHtmlPath = `${defaultDir}/debug.html`;
    await fs.writeFile(debugHtmlPath, html, 'utf8');
    console.log(`Saved fetched HTML to ${debugHtmlPath}`);
  } catch (err) {
    console.error('Error fetching YouTube results:', err.message);
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

  console.log('Parsed results:', results);

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

/**
 * Perform a YouTube search using the API and convert results to Markdown.
 *
 * @param {string} query - The search query term.
 * @param {string} apiKey - Your YouTube Data API key.
 * @param {number} [maxResults=5] - The maximum number of results to return.
 * @returns {Promise<{apiResults: Object, markdown: string}>} - The API results and Markdown content.
 */
export async function searchYouTube(query, apiKey, maxResults = 5) {
  // Fetch API results using the existing function
  const apiResults = await searchYouTubeViaAPI(query, apiKey, maxResults);

  // Convert results to Markdown
  const markdown = convertResultsToMarkdown(apiResults, query);

  return { apiResults, markdown };
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
      console.error('Usage: search-youtube.mjs <query> <apiKey> [outputFile]');
      process.exit(1);
    }
    const [query, apiKey, outputPathArg] = args;

    if (!apiKey) {
      console.error('❌ Missing API key. Please provide a valid YouTube Data API key.');
      process.exit(1);
    }

    try {
      const { apiResults, markdown } = await searchYouTube(query, apiKey);
      const outputFile = outputPathArg || `search-youtube/${query.trim().replace(/\s+/g, '-')}.md`;

      // Ensure output directory exists
      await fs.mkdir(path.dirname(outputFile), { recursive: true });

      // Write Markdown to file
      await fs.writeFile(outputFile, markdown, 'utf8');
      console.log(`✅ Saved ${apiResults.items.length} results to ${outputFile}`);
    } catch (err) {
      console.error(`❌ ${err.message}`);
      process.exit(1);
    }
  })();
}
