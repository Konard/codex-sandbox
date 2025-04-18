<!-- README for Codex Sandbox -->
# Codex Sandbox

> A toolkit of standalone Node.js scripts (“skills”) that dynamically load their own dependencies via **use-m**, requiring no local `package.json` or `node_modules`. Each script lives under `skills/` and writes output to its own default folder (which is git‑ignored).

## Repository Layout

- **.gitignore** — ignores generated output directories and secrets:
  - `download/`
  - `search-bing/`
  - `register-email/`
  - `send-mail/`
  - `check-mail/`
  - `.env`
- **skills/** — directory containing executable scripts:
  - `download.mjs`       — download a URL to a file
  - `search-bing.mjs`    — scrape Bing search results to Markdown
  - `register-email.mjs` — register a disposable Mail.tm email account
  - `send-mail.mjs`      — send an email via Mail.tm SMTP
  - `check-mail.mjs`     — fetch incoming Mail.tm messages via API
- **download/**       — default download outputs (ignored)
- **search-bing/**    — default search outputs (ignored)
- **register-email/** — account JSON files (ignored)
- **send-mail/**      — send info JSON files (ignored)
- **check-mail/**     — mailbox JSON files (ignored)
- **tests/**          — tape-based tests for skills

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

## Skill: register-email.mjs

- **Usage**: `skills/register-email.mjs`
- **Defaults**:
  - Output directory: `register-email/`
  - Filename: `<username>.json` (randomly generated)
- **Dependencies**:
  - `node-fetch@3`
  - `fs-extra@11`
- **Description**:
  1. Fetches available domains from Mail.tm API.
  2. Registers a new account with a random username and password.
  3. Saves `{ address, password, id }` to `<username>.json`.

## Skill: send-mail.mjs

- **Usage**: `skills/send-mail.mjs <accountJson> [toAddress] [subject] [text]`
- **Defaults**:
  - `toAddress`: same as account address if omitted
  - `subject`: "Test Message"
  - `text`: "Hello from mail.tm API!"
  - Output directory: `send-mail/`
  - Filename: `<username>-<timestamp>.json`
- **Dependencies**:
  - `nodemailer@6`
  - `fs-extra@11`
- **Description**:
  - Uses SMTP transporter at `in.mail.tm:25`.
  - Sends email via Mail.tm’s SMTP.
  - Saves the send response `info` to a JSON file.

## Skill: check-mail.mjs

- **Usage**: `skills/check-mail.mjs <accountJson> [outputFile]`
- **Defaults**:
  - Output directory: `check-mail/`
  - Filename: `<username>.json`
- **Dependencies**:
  - `node-fetch@3`
  - `fs-extra@11`
- **Description**:
  1. Reads `{ address, password }` from the account JSON.
  2. Obtains a JWT token from Mail.tm API.
  3. Fetches the list of messages.
  4. Saves `{ address, messages }` to the output JSON.

## Tests

- `tests/search-bing.mjs` — unit test for search-bing skill
- `tests/send-mail.mjs` — end-to-end integration test: register → send → check

Run all tests with:
```bash
node tests/send-mail.mjs
```
Or run a single test:
```bash
node tests/search-bing.mjs
```

## Adding New Skills

1. Create a new `.mjs` script under `skills/`.
2. Use **use-m** to dynamically load dependencies.
3. Follow slugified default output folder convention.
4. Add the folder name to `.gitignore`.
5. Commit and push to `main`.

---

_Read this file to recall project structure, scripting conventions, and usage patterns._