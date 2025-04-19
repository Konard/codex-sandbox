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

/**
 * Prints detailed information about a failed fetch response.
 * @param {Response} resp - The fetch Response object.
 */
async function printErrorResponse(resp) {
  console.error(`Fetch Error: ${resp.status} ${resp.statusText}`);
  try {
    const bodyText = await resp.clone().text();
    console.error('Response body:', bodyText);
  } catch (e) {
    console.error('Failed to read response body:', e);
  }
}

/**
 * Prints request URL, headers (with auth masked), and JSON payload.
 * @param {string} url - The request URL.
 * @param {object} options - The fetch options object.
 */
function printRequestDetails(url, options) {
  const maskedReqHeaders = {};
  Object.entries(options.headers || {}).forEach(([k, v]) => {
    maskedReqHeaders[k] = k.toLowerCase() === 'authorization'
      ? maskAuthHeader(v, 5)
      : v;
  });
  console.log('Request URL:', url);
  console.log('Request Headers:', maskedReqHeaders);
  try {
    console.log('Request Payload:', JSON.parse(options.body));
  } catch {
    console.log('Request Payload:', options.body);
  }
}

/**
 * Prints status, headers (with auth masked), and body of a fetch Response.
 * @param {Response} resp - The fetch Response object.
 */
async function printResponseDetails(resp) {
  console.log(`Response Status: ${resp.status} ${resp.statusText}`);
  const respHeadersObj = {};
  resp.headers.forEach((v, k) => {
    respHeadersObj[k] = k.toLowerCase() === 'authorization'
      ? maskAuthHeader(v, 5)
      : v;
  });
  console.log('Response Headers:', respHeadersObj);
  try {
    const bodyText = await resp.clone().text();
    console.log('Response Body:', bodyText);
  } catch (e) {
    console.error('Failed to read response body:', e);
  }
}

/**
 * Masks sensitive header values by keeping the first and last few characters.
 * @param {string} value - The header value to mask.
 * @param {number} keepChars - Number of characters to keep at each end.
 */
function maskAuthHeader(value, keepChars = 5) {
  if (typeof value !== 'string') return value;
  const bearerPrefix = 'Bearer ';
  if (value.startsWith(bearerPrefix)) {
    const token = value.slice(bearerPrefix.length);
    if (token.length <= keepChars * 2) return value;
    const maskedToken = token.slice(0, keepChars) + '...' + token.slice(-keepChars);
    return bearerPrefix + maskedToken;
  }
  if (value.length <= keepChars * 2) return value;
  return value.slice(0, keepChars) + '...' + value.slice(-keepChars);
}

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
  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const defaultModel = process.env.DEFAULT_MODEL || 'gpt-4o-search-preview';

  // prepare the Chat Completions request
  const body = {
    model: defaultModel,
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
    const url = `${baseUrl}/chat/completions`;
    const options = {
      method: 'POST',
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    };
    printRequestDetails(url, options);
    resp = await fetch(url, options);
    await printResponseDetails(resp);
    
    if (!resp.ok) {
      await printErrorResponse(resp);
      throw new Error(`API HTTP ${resp.status}`);
    }
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