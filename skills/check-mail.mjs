#!/usr/bin/env node
/*
 * skills/check-mail.mjs
 * ---------------------
 * Fetch incoming messages from mail.tm.  Exports `checkMail(accountPath, [out])`.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

export async function checkMail(accountPath, outPath) {
  if (!accountPath) throw new TypeError('accountPath is required');

  // Load account credentials
  const account = JSON.parse(await fs.readFile(accountPath, 'utf8'));
  const { address, password } = account;

  const defaultDir = 'check-mail';
  const username = address.split('@')[0];
  const outputFile = outPath || `${defaultDir}/${username}.json`;

  // Dynamic deps
  const useJs = await (await fetch('https://unpkg.com/use-m/use.js')).text();
  const { use } = eval(useJs);

  const fetchMod = await use('node-fetch@3');
  const fetchFn = fetchMod.default || fetchMod;
  const fsExtra = await use('fs-extra@11');

  if (!outPath) await fsExtra.ensureDir(defaultDir);

  // Authenticate
  const tokenRes = await fetchFn('https://api.mail.tm/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, password })
  });
  if (!tokenRes.ok) {
    throw new Error(`Token request failed: HTTP ${tokenRes.status}`);
  }
  const { token } = await tokenRes.json();

  // Fetch messages
  const msgRes = await fetchFn('https://api.mail.tm/messages?page=1', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!msgRes.ok) {
    throw new Error(`Messages request failed: HTTP ${msgRes.status}`);
  }
  const msgData = await msgRes.json();
  const messages = msgData['hydra:member'] || [];

  await fsExtra.outputFile(outputFile, JSON.stringify({ address, messages }, null, 2), 'utf8');
  return { messages, outputFile };
}

// CLI
const isCLI = (() => process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url)))();

if (isCLI) {
  (async () => {
    const args = process.argv.slice(2);
    if (args.length < 1) {
      console.error('Usage: check-mail.mjs <accountJson> [outputFile]');
      process.exit(1);
    }
    const [acctPath, out] = args;
    try {
      const { messages, outputFile } = await checkMail(acctPath, out);
      console.log(`✅ Saved ${messages.length} messages to ${outputFile}`);
    } catch (err) {
      console.error(`❌ ${err.message}`);
      process.exit(1);
    }
  })();
}