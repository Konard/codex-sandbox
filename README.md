<!-- README for Codex Sandbox -->
# Codex Sandbox

> A toolkit of standalone Node.js scripts (“skills”) that dynamically load their own dependencies via **use-m**, requiring no local `package.json` or `node_modules`. Each script lives under `skills/` and writes output to its own default folder (which is git‑ignored).

## Repository Layout

- **.gitignore** — ignores script output directories:
  - `search-bing/`
  - `download/`
- **skills/** — directory containing executable scripts:
  - `download.mjs` — download a URL to file
  - `search-bing.mjs` — fetch Bing search results
- **download/** — default download outputs (ignored)
- **search-bing/** — default search outputs (ignored)

## Scripts & Conventions

### ES Module + Top‑Level Await
All scripts use `.mjs` modules and top‑level `await`, so no wrapper functions are needed.

### Dynamic Dependency Loading
Each script begins by fetching and evaluating **use-m**:
```js
const useJs = await (await fetch('https://unpkg.com/use-m/use.js')).text();
const { use } = eval(useJs);
```
Then they import only the npm packages they need:
```js
const pkg = await use('package@version');
```

### Default Output Folders
Scripts write their outputs into a folder named after the script:
- `download.mjs` → `download/`
- `search-bing.mjs` → `search-bing/`

These folders are ignored by git via `.gitignore`.

## Skill: download.mjs

- **Usage**: `skills/download.mjs <URL> [outputFile]`
- **Defaults**:
  - Output directory: `download/`
  - Filename: slugified URL (non‑alphanumerics → `-`)
- **Dependencies**:
  - `node-fetch` for HTTP requests
  - `fs-extra` for file I/O (auto‑creates directories)

**Example**:
```bash
skills/download.mjs https://example.com
# → download/https-example-com
```

## Skill: search-bing.mjs

- **Usage**: `skills/search-bing.mjs <query> [outputFile]`
- **Defaults**:
  - Output directory: `search-bing/`
  - Filename: slugified query (spaces → `-`)
  - Format: Markdown list of results
- **Dependencies**:
  - `cheerio` for HTML parsing

**Example**:
```bash
skills/search-bing.mjs "openai codex"
# → search-bing/openai-codex.md
```

## Adding New Skills

1. Create a new `.mjs` script under `skills/`.
2. Use **use-m** to dynamically load dependencies.
3. Follow slugified default output folder convention.
4. Add the folder name to `.gitignore`.
5. Commit and push to `main`.

---

_Read this file to recall project structure, scripting conventions, and usage patterns._