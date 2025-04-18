#!/usr/bin/env node
// skills/register-email.mjs: find email providers via search-bing script

// Parse command-line arguments
const args = process.argv.slice(2);
// Default query if none provided
const query = args.length > 0
  ? args.join(' ')
  : 'email providers direct mail server access code register no phone number no credit card';

// Slugify query for filename
const slug = query.trim()
  .replace(/[^a-zA-Z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');
// Default output folder and file
const defaultDir = 'register-email';
const outputFile = `${defaultDir}/${slug}.md`;

// Ensure output directory exists
import fs from 'fs/promises';
await fs.mkdir(defaultDir, { recursive: true });

// Dynamically load use-m (for consistency, even if not directly used here)
const useJs = await (await fetch('https://unpkg.com/use-m/use.js')).text();
const { use } = eval(useJs);

console.log(`🔎 Searching for email providers: ${query}`);
// Invoke search-bing.mjs to perform the search
import { spawnSync } from 'child_process';
const result = spawnSync(
  'node',
  ['skills/search-bing.mjs', query, outputFile],
  { stdio: 'inherit' }
);
if (result.error) {
  console.error(`❌ Search command failed: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) {
  process.exit(result.status);
}
console.log(`✅ Search results saved to ${outputFile}`);