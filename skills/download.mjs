#!/usr/bin/env node
// skills/download.mjs: download a URL to a file with slugified filename and use-m
// No direct fs import; fs-extra will handle directory creation

// Parse command-line arguments
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: download.mjs <URL> [outputFile]');
  process.exit(1);
}
const [url, outputPathArg] = args;
// Default output directory based on script name
const defaultDir = 'download';
// Slugify URL: replace non-alphanumerics with hyphens
const slug = url.trim().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
// Determine output file path: custom or defaultDir/slug
const outputFile = outputPathArg || `${defaultDir}/${slug}`;

// Dynamically load use-m to import npm modules at runtime
const useJs = await (await fetch('https://unpkg.com/use-m/use.js')).text();
const { use } = eval(useJs);

// Load node-fetch for HTTP and fs-extra for file write conveniences
const fetchMod = await use('node-fetch@3');
const fetchFn = fetchMod.default || fetchMod;
const fsExtra = await use('fs-extra@11');

// Download the URL
let response;
try {
  response = await fetchFn(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
} catch (err) {
  console.error(`❌ Download failed: ${err.message}`);
  process.exit(1);
}
if (!response.ok) {
  console.error(`❌ HTTP Error: ${response.status}`);
  process.exit(1);
}

// Read response as Buffer
const arrayBuffer = await response.arrayBuffer();
const buffer = Buffer.from(arrayBuffer);

// Write the file (fs-extra.outputFile creates directories as needed)
try {
  await fsExtra.outputFile(outputFile, buffer);
  console.log(`✅ Saved ${url} → ${outputFile}`);
} catch (err) {
  console.error(`❌ Failed to write file: ${err.message}`);
  process.exit(1);
}
