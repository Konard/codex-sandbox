#!/usr/bin/env node
// skills/check-mail.mjs: fetch incoming mail messages via mail.tm API

// Usage: check-mail.mjs <accountJson> [outputFile]
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: check-mail.mjs <accountJson> [outputFile]');
  process.exit(1);
}
const [accountPath, outputPathArg] = args;

// Load account credentials
import fs from 'fs/promises';
let account;
try {
  const txt = await fs.readFile(accountPath, 'utf8');
  account = JSON.parse(txt);
} catch (err) {
  console.error(`❌ Failed to read account file: ${err.message}`);
  process.exit(1);
}
const { address, password } = account;

// Default output directory and file
const defaultDir = 'check-mail';
// Slugify username (part before @)
const username = address.split('@')[0];
const defaultFile = `${defaultDir}/${username}.json`;
const outputFile = outputPathArg || defaultFile;

// Dynamically load use-m to import dependencies
const useJs = await (await fetch('https://unpkg.com/use-m/use.js')).text();
const { use } = eval(useJs);

// Load node-fetch for HTTP and fs-extra for file operations
const fetchMod = await use('node-fetch@3');
const fetchFn = fetchMod.default || fetchMod;
const fsExtra = await use('fs-extra@11');

// Ensure output directory exists if default
if (!outputPathArg) {
  await fsExtra.ensureDir(defaultDir);
}

// Authenticate to mail.tm
console.log('🔐 Requesting auth token...');
const tokenRes = await fetchFn('https://api.mail.tm/token', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ address, password })
});
if (!tokenRes.ok) {
  console.error(`❌ Token request failed: HTTP ${tokenRes.status}`);
  process.exit(1);
}
const { token } = await tokenRes.json();

// Fetch messages
console.log('📬 Fetching messages...');
const msgRes = await fetchFn('https://api.mail.tm/messages?page=1', {
  headers: { Authorization: `Bearer ${token}` }
});
if (!msgRes.ok) {
  console.error(`❌ Messages request failed: HTTP ${msgRes.status}`);
  process.exit(1);
}
const msgData = await msgRes.json();
const messages = msgData['hydra:member'] || [];

// Save messages to file
try {
  await fsExtra.outputFile(outputFile, JSON.stringify({ address, messages }, null, 2), 'utf8');
  console.log(`✅ Saved ${messages.length} messages to ${outputFile}`);
} catch (err) {
  console.error(`❌ Failed to write output: ${err.message}`);
  process.exit(1);
}