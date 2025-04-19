#!/usr/bin/env node
// tests/search-youtube.mjs: unit test for the search-youtube skill

import { spawnSync } from 'child_process';
import fs from 'fs/promises';

// Load use-m for dynamic imports
const useJs = await (await fetch('https://unpkg.com/use-m/use.js')).text();
const { use } = eval(useJs);
// Load tape for assertions
const tapeMod = await use('tape@5');
const tape = tapeMod.default;

tape('search-youtube basic functionality', async t => {
  const fsExtra = await use('fs-extra@11');
  // Clean previous outputs
  await fsExtra.remove('search-youtube');

  // Run the skill with a known query
  const query = 'test';
  const res = spawnSync('node', ['skills/search-youtube.mjs', query], { encoding: 'utf8' });
  t.equal(res.status, 0, 'search-youtube exited with code 0');

  // Verify output file exists
  const slug = query.trim().replace(/\s+/g, '-');
  const outPath = `search-youtube/${slug}.md`;
  t.ok(await fsExtra.pathExists(outPath), `output file ${outPath} exists`);

  // Read and check content header
  const content = await fs.readFile(outPath, 'utf8');
  t.match(content, new RegExp(`^# YouTube search results for \"${query}\"`), 'file contains correct header');

  // ---------------------------------------------------------------
  // Programmatic usage via dynamic import (await import)
  // ---------------------------------------------------------------
  const { searchYouTube } = await import('../skills/search-youtube.mjs');
  t.equal(typeof searchYouTube, 'function', 'searchYouTube exported as a function');

  // Remove existing file to ensure fresh run
  await fsExtra.remove(outPath);

  const { results, outputFile } = await searchYouTube(query);
  t.equal(outputFile, outPath, 'function returns default output path');
  t.ok(Array.isArray(results), 'results is an array');
  t.ok(results.length > 0, 'received at least one result');
  t.ok(await fsExtra.pathExists(outPath), 'output file exists after function call');

  t.end();
});

// Exit when done
tape.onFinish(() => process.exit());