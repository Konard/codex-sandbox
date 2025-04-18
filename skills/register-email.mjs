#!/usr/bin/env node
/*
 * skills/register-email.mjs
 * ------------------------
 * Register a new disposable email on mail.tm.  Exported so that the integration
 * test (or any consumer) can call it programmatically.
 */

import path from 'path';
import { fileURLToPath } from 'url';

export async function registerEmail() {
  const defaultDir = 'register-email';
  const timestamp = Date.now();

  // Dynamic deps
  const useJs = await (await fetch('https://unpkg.com/use-m/use.js')).text();
  const { use } = eval(useJs);

  const fetchMod = await use('node-fetch@3');
  const fetchFn = fetchMod.default || fetchMod;
  const fsExtra = await use('fs-extra@11');

  await fsExtra.ensureDir(defaultDir);

  // Generate credentials
  const username = `user${timestamp}`;
  const password = Math.random().toString(36).slice(2) + 'A!1';

  // Fetch domain
  const domRes = await fetchFn('https://api.mail.tm/domains?page=1');
  if (!domRes.ok) {
    throw new Error('Failed to fetch domains');
  }
  const domData = await domRes.json();
  const domain = domData['hydra:member'][0]?.domain;
  if (!domain) {
    throw new Error('No domain available');
  }

  const address = `${username}@${domain}`;

  // Register account
  const accRes = await fetchFn('https://api.mail.tm/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, password })
  });
  if (!accRes.ok) {
    const err = await accRes.text();
    throw new Error(`Registration failed: ${err}`);
  }
  const accData = await accRes.json();

  const outputFile = `${defaultDir}/${username}.json`;
  await fsExtra.outputFile(outputFile, JSON.stringify({ address, password, id: accData.id }, null, 2), 'utf8');

  return { address, password, id: accData.id, outputFile };
}

// CLI
const isCLI = (() => process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url)))();

if (isCLI) {
  (async () => {
    try {
      const { address, outputFile } = await registerEmail();
      console.log(`✅ Registered ${address} → ${outputFile}`);
    } catch (err) {
      console.error(`❌ ${err.message}`);
      process.exit(1);
    }
  })();
}