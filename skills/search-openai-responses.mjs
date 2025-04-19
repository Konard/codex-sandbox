#!/usr/bin/env node
/*
 * skills/get-response-openai.mjs
 * -------------------------------
 * Generate a conversational response via OpenAI’s Responses API,
 * save the assistant’s output (and any citations) to Markdown, and
 * optionally return the parsed output + output file path.
 *
 * Usage as **stand‑alone script**:
 *   node skills/get-response-openai.mjs "your prompt here" [previousResponseId] [outputFile]
 *
 * Usage as **importable module**:
 *   const { getResponseOpenAI } = await import('./skills/get-response-openai.mjs');
 *   await getResponseOpenAI('your prompt here', 'resp_abcdef123', './out.md');
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

export async function getResponseOpenAI(prompt, previousResponseId, outPath) {
  if (!prompt || typeof prompt !== 'string') {
    throw new TypeError('prompt must be a non‑empty string');
  }

  // Default output directory & filename
  const defaultDir = 'responses-openai';
  const slug = prompt.trim().replace(/\s+/g, '-').toLowerCase();
  const outputFile = outPath || `${defaultDir}/${slug}.md`;

  if (!outPath) {
    await fs.mkdir(defaultDir, { recursive: true });
  }

  /* ------------------------------------------------------------------
   * Dynamic imports via use‑m (keeps repo dependency‑free)
   * ------------------------------------------------------------------ */
  const useJs = await (await fetch('https://unpkg.com/use-m/use.js')).text();
  const { use } = eval(useJs);

  // Load dotenv to get OPENAI_API_KEY
  const dotenv = await use('dotenv@16');
  dotenv.config();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Please set your OPENAI_API_KEY in your environment');
  }

  // load fetch for Node <18 compatibility
  const fetchMod = await use('node-fetch@3');
  const fetchFn = fetchMod.default || fetchMod;

  // Build the Responses API request
  const body = {
    model: 'gpt-4o-mini',
    input: prompt
  };
  if (previousResponseId) {
    body.previous_response_id = previousResponseId;
  }

  // Call OpenAI Responses endpoint
  let resp, data;
  try {
    resp = await fetchFn('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!resp.ok) throw new Error(`API HTTP ${resp.status}`);
    data = await resp.json();
  } catch (err) {
    throw new Error(`OpenAI request failed: ${err.message}`);
  }

  // Extract the assistant’s reply
  const firstOutput = data.output?.[0]?.content?.[0];
  if (!firstOutput || typeof firstOutput.text !== 'string') {
    throw new Error('No valid assistant response returned');
  }
  const text = firstOutput.text.trim();

  // Extract any URL citations
  const annotations = firstOutput.annotations || [];
  const citations = annotations
    .filter(a => a.type === 'url_citation')
    .map((a, i) => `  [${i + 1}]: ${a.url_citation.url} (${a.url_citation.title})`);

  // Build Markdown
  let md = `# Response for "${prompt}"\n\n${text}\n\n`;
  if (citations.length) {
    md += '---\n\n' + citations.join('\n') + '\n';
  }

  // Write to file
  await fs.writeFile(outputFile, md, 'utf8');
  return { response: text, citations, outputFile };
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
    const [prompt, prevId, outFile] = process.argv.slice(2);
    if (!prompt) {
      console.error('Usage: get-response-openai.mjs <prompt> [previousResponseId] [outputFile]');
      process.exit(1);
    }
    try {
      const { response, citations, outputFile } = await getResponseOpenAI(prompt, prevId, outFile);
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