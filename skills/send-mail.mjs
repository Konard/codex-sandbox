#!/usr/bin/env node
// skills/send-mail.mjs: send an email via mail.tm API

// Usage: send-mail.mjs <accountJson> [toAddress] [subject] [text]
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: send-mail.mjs <accountJson> [toAddress] [subject] [text]');
  process.exit(1);
}
const [accountPath, toArg, subjectArg, textArg] = args;

// Load account credentials
import fs from 'fs/promises';
let account;
try {
  account = JSON.parse(await fs.readFile(accountPath, 'utf8'));
} catch (err) {
  console.error(`❌ Failed to read account file: ${err.message}`);
  process.exit(1);
}
const address = account.address;
const password = account.password;

// Determine recipient and message
const toAddress = toArg || address;
const subject = subjectArg || 'Test Message';
const text = textArg || 'Hello from mail.tm API!';

// Default output
const defaultDir = 'send-mail';
const username = address.split('@')[0];
const timestamp = Date.now();
const outputFile = `${defaultDir}/${username}-${timestamp}.json`;

// Dynamically load use-m to import modules
const useJs = await (await fetch('https://unpkg.com/use-m/use.js')).text();
const { use } = eval(useJs);

// Load fs-extra for file operations
const fsExtra = await use('fs-extra@11');

// Ensure output directory
await fsExtra.ensureDir(defaultDir);

// Send via SMTP using nodemailer
console.log(`✉️ Sending message to ${toAddress} via SMTP...`);
// Load nodemailer
const nodemailer = await use('nodemailer@6');
// Create SMTP transporter (mail.tm SMTP)
const transporter = nodemailer.createTransport({
  host: 'smtp.mail.tm',
  port: 587,
  secure: false,
  auth: { user: address, pass: password }
});
// Send mail
let info;
try {
  info = await transporter.sendMail({
    from: address,
    to: toAddress,
    subject,
    text
  });
} catch (err) {
  console.error(`❌ SMTP send failed: ${err.message}`);
  process.exit(1);
}
console.log(`✅ Message sent: ${info.messageId}`);

// Save send result info
await fsExtra.outputFile(outputFile, JSON.stringify(info, null, 2), 'utf8');
console.log(`✅ Saved send result to ${outputFile}`);