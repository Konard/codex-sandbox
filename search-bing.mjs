#!/usr/bin/env node
// search-bing.mjs: dynamically search using Bing and save results to a Markdown file
import fs from 'fs/promises';

// Parse command-line arguments
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: search-bing.mjs <query> [outputFile]');
  process.exit(1);
}
const [query, outputPathArg] = args;
// Default output directory based on script name
const defaultDir = 'search-bing';
// Slugify query by replacing spaces with hyphens
const slug = query.trim().replace(/\s+/g, '-');
// Determine output file path: use provided path or default under defaultDir
const outputFile = outputPathArg || `${defaultDir}/${slug}.md`;
// Create default directory if no custom output path 
// provided
if (!outputPathArg) {
  await fs.mkdir(defaultDir, { recursive: true });
}

// Dynamically load use-m to import npm packages at runtime
const useJs = await (await fetch('https://unpkg.com/use-m/use.js')).text();
const { use } = eval(useJs);

// Dynamically load Cheerio to parse HTML
const cheerio = await use('cheerio@1.0.0-rc.12');
const { load } = cheerio;
// Fetch Bing Search results page
const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
let html;
try {
  const res = await fetch(bingUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  html = await res.text();
} catch (err) {
  console.error(`❌ Fetch failed: ${err.message}`);
  process.exit(1);
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
  md += `- [${title}](${url})
\n  ${description || ''}
\n`;
}

// Write to the output file
try {
  await fs.writeFile(outputFile, md, 'utf8');
  console.log(`✅ Saved ${results.length} results to ${outputFile}`);
} catch (err) {
  console.error(`❌ Failed to write file: ${err.message}`);
  process.exit(1);
}