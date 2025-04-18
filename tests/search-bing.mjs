#!/usr/bin/env node
// tests/search-bing.mjs: unit test for the search-bing skill

import { spawnSync } from 'child_process';
import fs from 'fs/promises';

// Load use-m for dynamic imports
const useJs = await (await fetch('https://unpkg.com/use-m/use.js')).text();
const { use } = eval(useJs);
// Load tape for assertions
const tapeMod = await use('tape@5');
const tape = tapeMod.default;

tape('search-bing basic functionality', async t => {
  const fsExtra = await use('fs-extra@11');
  // Clean previous outputs
  await fsExtra.remove('search-bing');

  // Run the skill with a known query
  const query = 'openai codex';
  const res = spawnSync('node', ['skills/search-bing.mjs', query], { encoding: 'utf8' });
  t.equal(res.status, 0, 'search-bing exited with code 0');

  // Verify output file exists
  const slug = query.trim().replace(/\s+/g, '-');
  const outPath = `search-bing/${slug}.md`;
  t.ok(await fsExtra.pathExists(outPath), `output file ${outPath} exists`);

  // Read and check content header
  const content = await fs.readFile(outPath, 'utf8');
  t.match(content, new RegExp(`^# Search results for "${query}"`), 'file contains correct header');

  t.end();
});

// Exit when done
tape.onFinish(() => process.exit());