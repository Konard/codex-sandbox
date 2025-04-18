#!/usr/bin/env node
// tests/send-mail.mjs: integration test for register, send, and check-mail skills

import { spawnSync } from 'child_process';
import fs from 'fs/promises';

// Load use-m for dynamic imports
const useJs = await (await fetch('https://unpkg.com/use-m/use.js')).text();
const { use } = eval(useJs);

// Load tape for testing
const tapeMod = await use('tape@5');
const tape = tapeMod.default;

tape('send-mail integration test', async t => {
  // Load fs-extra for cleanup and directory checks
  const fsExtra = await use('fs-extra@11');
  // Prepare spawnSync result holder
  let res;
  // Clean previous outputs except existing accounts
  await fsExtra.remove('send-mail');
  await fsExtra.remove('check-mail');

  // 1) Ensure account exists: reuse or register
  const acctDir = 'register-email';
  let accountPath;
  if (await fsExtra.pathExists(acctDir)) {
    const regFiles = await fs.readdir(acctDir);
    t.ok(regFiles.length >= 1, 'existing account available');
    accountPath = `${acctDir}/${regFiles[0]}`;
  } else {
    t.comment('Register new account');
    const resReg = spawnSync('node', ['skills/register-email.mjs'], { stdio: 'inherit' });
    t.equal(resReg.status, 0, 'register-email exited with code 0');
    const regFiles = await fs.readdir(acctDir);
    t.equal(regFiles.length, 1, 'one account file created');
    accountPath = `${acctDir}/${regFiles[0]}`;
  }

  // 2) Send email to self
  t.comment('Send email to self');
  res = spawnSync('node', ['skills/send-mail.mjs', accountPath], { stdio: 'inherit' });
  t.equal(res.status, 0, 'send-mail exited with code 0');

  // 3) Check mailbox
  t.comment('Check mailbox for incoming message');
  res = spawnSync('node', ['skills/check-mail.mjs', accountPath], { stdio: 'inherit' });
  t.equal(res.status, 0, 'check-mail exited with code 0');

  // Read mailbox file
  const checkFiles = await fs.readdir('check-mail');
  t.equal(checkFiles.length, 1, 'one mailbox file created');
  const checkPath = `check-mail/${checkFiles[0]}`;
  const data = JSON.parse(await fs.readFile(checkPath, 'utf8'));
  t.ok(Array.isArray(data.messages), 'data.messages is an array');
  t.ok(data.messages.length >= 1, 'at least one message received');

  t.end();
});

// Run and exit when done
tape.onFinish(() => process.exit());