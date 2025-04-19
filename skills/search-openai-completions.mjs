#!/usr/bin/env node
/*
 * skills/search-openai.mjs
 * ------------------------
 * Search the web via OpenAI’s Chat Completions API with browsing enabled,
 * save the assistant’s answer + citations to a Markdown file, and
 * optionally return the parsed results + output path.
 *
 * Usage as **stand‑alone script**:
 *   node skills/search-openai.mjs "your question here"
 *
 * Usage as **importable module**:
 *   const { searchOpenAI } = await import('./skills/search-openai.mjs');
 *   await searchOpenAI('your question here');
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

export async function searchOpenAI(query, outPath) {
  if (!query || typeof query !== 'string') {
    throw new TypeError('query must be a non‑empty string');
  }

  // Default output directory
  const defaultDir = 'search-openai';
  const slug = query.trim().replace(/\s+/g, '-').toLowerCase();
  const outputFile = outPath || `${defaultDir}/${slug}.md`;

  if (!outPath) {
    await fs.mkdir(defaultDir, { recursive: true });
  }

  /* ------------------------------------------------------------------
   * Dynamic imports via use‑m to keep the repo free of deps
   * ------------------------------------------------------------------ */
  const useJs = await (await fetch('https://unpkg.com/use-m/use.js')).text();
  const { use } = eval(useJs);

  // load dotenv to get OPENAI_API_KEY
  const dotenvMod = await use('dotenv@16');
  dotenvMod.config();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Please set your OPENAI_API_KEY in your environment');
  }

  // load fetch for Node <18 compatibility
  const fetchMod = await use('node-fetch@3');
  const fetchFn = fetchMod.default || fetchMod;

  // prepare the Chat Completions request
  const body = {
    model: "gpt-4o-search-preview",
    messages: [
      { role: "system", content: "You are a helpful assistant with web browsing capability." },
      { role: "user",   content: query }
    ],
    web_search_options: {
      user_location: {
        type: "approximate",
        approximate: {
          country: "US",
          region: "California",
          city: "San Francisco"
        }
      }
    }
  };

  // call OpenAI API
  let resp, data;
  try {
    resp = await fetchFn("https://api.openai.com/v1/chat/completions", {
      method: 'POST',
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!resp.ok) throw new Error(`API HTTP ${resp.status}`);
    data = await resp.json();
  } catch (err) {
    throw new Error(`OpenAI request failed: ${err.message}`);
  }

  // extract assistant content + citations
  const msg = data.choices?.[0]?.message;
  if (!msg || !msg.content) {
    throw new Error('No assistant response returned');
  }
  const content = msg.content.trim();
  const citations = (msg.annotations || [])
    .filter(a => a.type === 'url_citation')
    .map((a, i) => `  [${i+1}]: ${a.url_citation.url} (${a.url_citation.title})`)
    .join('\n');

  // build Markdown
  let md = `# Search results for "${query}"\n\n`;
  md += content + '\n\n';
  if (citations) {
    md += '---\n\n';
    md += citations + '\n';
  }

  // write to file
  await fs.writeFile(outputFile, md, 'utf8');
  return { response: content, citations: citations.split('\n'), outputFile };
}

/* -------------------------------------------------------------------------- */
// CLI runner
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
      console.error('Usage: search-openai.mjs <query> [outputFile]');
      process.exit(1);
    }
    const [query, outputPath] = args;
    try {
      const { response, citations, outputFile } = await searchOpenAI(query, outputPath);
      console.log(`✅ Saved response to ${outputFile}`);
      console.log(response);
      if (citations.length) {
        console.log('\nCitations:\n' + citations.join('\n'));
      }
    } catch (err) {
      console.error(`❌ ${err.message}`);
      process.exit(1);
    }
  })();
}