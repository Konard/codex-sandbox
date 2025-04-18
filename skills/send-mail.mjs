#!/usr/bin/env node
/*
 * skills/send-mail.mjs
 * --------------------
 * Send an email via the mail.tm SMTP relay.  Exported as `sendMail()` so other
 * modules/tests can call it directly.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

export async function sendMail(accountPath, toArg, subjectArg, textArg) {
  if (!accountPath) throw new TypeError('accountPath is required');

  const { address, password } = JSON.parse(await fs.readFile(accountPath, 'utf8'));

  const toAddress = toArg || address;
  const subject = subjectArg || 'Test Message';
  const text = textArg || 'Hello from mail.tm API!';

  const defaultDir = 'send-mail';
  const username = address.split('@')[0];
  const timestamp = Date.now();
  const outputFile = `${defaultDir}/${username}-${timestamp}.json`;

  // Dynamic deps
  const useJs = await (await fetch('https://unpkg.com/use-m/use.js')).text();
  const { use } = eval(useJs);

  const fsExtra = await use('fs-extra@11');
  await fsExtra.ensureDir(defaultDir);

  const nodemailer = await use('nodemailer@6');
  const transporter = nodemailer.createTransport({
    host: 'in.mail.tm',
    port: 25,
    secure: false,
    auth: { user: address, pass: password }
  });

  const info = await transporter.sendMail({ from: address, to: toAddress, subject, text });

  await fsExtra.outputFile(outputFile, JSON.stringify(info, null, 2), 'utf8');
  return { info, outputFile };
}

// CLI runner
const isCLI = (() => process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url)))();

if (isCLI) {
  (async () => {
    const args = process.argv.slice(2);
    if (args.length < 1) {
      console.error('Usage: send-mail.mjs <accountJson> [toAddress] [subject] [text]');
      process.exit(1);
    }
    const [accountPath, to, sub, txt] = args;
    try {
      const { info, outputFile } = await sendMail(accountPath, to, sub, txt);
      console.log(`✅ Message sent: ${info.messageId}`);
      console.log(`✅ Saved send result to ${outputFile}`);
    } catch (err) {
      console.error(`❌ ${err.message}`);
      process.exit(1);
    }
  })();
}