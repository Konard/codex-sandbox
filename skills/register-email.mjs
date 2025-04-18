#!/usr/bin/env node
// skills/register-email.mjs: register a new disposable email via mail.tm API

// Default output directory
const defaultDir = 'register-email';
// Slug for output filename based on timestamp
const timestamp = Date.now();

// Dynamically load use-m to import required modules
const useJs = await (await fetch('https://unpkg.com/use-m/use.js')).text();
const { use } = eval(useJs);

// Load node-fetch for HTTP and fs-extra for file operations
const fetchMod = await use('node-fetch@3');
const fetchFn = fetchMod.default || fetchMod;
const fsExtra = await use('fs-extra@11');
// Ensure output directory exists
await fsExtra.ensureDir(defaultDir);

// Generate credentials
const username = `user${timestamp}`;
const password = Math.random().toString(36).slice(2) + 'A!1';

console.log('🔎 Fetching available domains...');
// Get first available domain from mail.tm
const domRes = await fetchFn('https://api.mail.tm/domains?page=1');
if (!domRes.ok) {
  console.error('❌ Failed to fetch domains');
  process.exit(1);
}
const domData = await domRes.json();
const domain = domData['hydra:member'][0]?.domain;
if (!domain) {
  console.error('❌ No domain available');
  process.exit(1);
}
const address = `${username}@${domain}`;

console.log(`✉️ Registering account ${address} ...`);
// Register account
const accRes = await fetchFn('https://api.mail.tm/accounts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ address, password })
});
if (!accRes.ok) {
  const err = await accRes.text();
  console.error(`❌ Registration failed: ${err}`);
  process.exit(1);
}
const accData = await accRes.json();

// Save account info (no token retrieval)
const outputFile = `${defaultDir}/${username}.json`;
// Use outputFile to write JSON string and ensure directory exists
await fsExtra.outputFile(
  outputFile,
  JSON.stringify({ address, password, id: accData.id }, null, 2),
  'utf8'
);
console.log(`✅ Registered ${address} → ${outputFile}`);