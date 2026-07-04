---
name: cloudflare-use
description: Use this skill to safely and correctly interact with (read/write) the project's Cloudflare D1 database and R2 storage bucket across different computers. Trigger this whenever the user asks to check the database, query D1, upload/read images from R2, or verify Cloudflare contents.
---

# Cloudflare Use (D1 & R2)

Standard operating procedures for executing commands against the Cloudflare D1 database (`core-pulse-blog`) and R2 storage bucket (`core-pulse-assets`), ensuring it works across any computer or operating system.

## Context
- **Project Root**: The workspace directory containing `wrangler.toml` and `.env`. Do NOT hardcode drive letters (like `D:\`).
- **Database (D1)**: `core-pulse-blog`
- **Storage (R2)**: `core-pulse-assets`
- **Auth**: `CLOUDFLARE_API_TOKEN` stored in project `.env` file.

## ⚠️ Critical Rules (READ BEFORE ANY COMMAND)

### Rule 1 — Wrangler Version (Node < 22)

Wrangler 4 requires Node.js >= 22. If the project runs on Node 20 or lower, `npx wrangler` will auto-install v4 and fail with:

```
Wrangler requires at least Node.js v22.0.0. You are using v20.16.0.
```

**Fix**: ALWAYS pin `wrangler@3` explicitly:

```powershell
npx wrangler@3 d1 execute ...
```

Before first use in a session, check the Node version:
```powershell
node --version
```
- Node >= 22 → `npx wrangler` (latest v4) is fine.
- Node < 22 → ALWAYS use `npx wrangler@3`.

### Rule 2 — Encoding: NEVER Use PowerShell to Write SQL Files

**This is the #1 cause of garbled Chinese text (亂碼) in D1.**

PowerShell 5.1's `Set-Content -Encoding UTF8` prepends a **BOM** (byte `EF BB BF`) to the file. When wrangler reads this SQL file, the BOM corrupts the first string literal, turning all multi-byte UTF-8 characters (Traditional Chinese, etc.) into mojibake.

| Tool | Writes BOM? | Safe for D1 SQL? |
|------|-------------|-------------------|
| PowerShell `Set-Content -Encoding UTF8` | **YES** | ❌ NO |
| PowerShell `Out-File -Encoding utf8` | **YES** | ❌ NO |
| PowerShell `[System.IO.File]::WriteAllText(path, text, [System.Text.UTF8Encoding]::new($false))` | No | ✅ Yes |
| Node.js `fs.writeFileSync(path, text, 'utf8')` | No | ✅ Yes (PREFERRED) |

**For any D1 operation involving non-ASCII content (Chinese, emoji, etc.), ALWAYS generate SQL files using Node.js** — see the helper scripts in `scripts/` below.

### Rule 3 — Encoding: NEVER Trust PowerShell Console for D1 Output

PowerShell 5.1 console defaults to the system codepage (cp950/cp932/etc.), NOT UTF-8. When wrangler outputs JSON containing Chinese characters, PowerShell will display them as garbled text (`?萎辣隡箸??`). **The data in D1 may be correct even though the console shows garbage.**

To verify D1 content with non-ASCII data, ALWAYS use Node.js to capture and parse the output:
```javascript
const { execSync } = require('child_process');
const output = execSync('npx wrangler@3 d1 execute ... --json', { encoding: 'utf8' });
const jsonStart = output.indexOf('[');
const data = JSON.parse(output.substring(jsonStart));
```

## Execution Workflow

### Step 1 — Locate Project Root
Identify the workspace root by locating `.env` or `wrangler.toml`.

### Step 2 — Pre-flight Check (.env & Token)
Check the `.env` file. Verify `CLOUDFLARE_API_TOKEN` is present and not empty.

**IF THE TOKEN IS MISSING**: DO NOT run any commands. Instead:
- Tell the user: "Your `.env` file is missing the `CLOUDFLARE_API_TOKEN`. To use this project on this computer, you need to set it up."
- Instruct them: Cloudflare Dashboard → My Profile → API Tokens → Create Custom Token with:
  - Account → D1 → Edit
  - Account → Worker R2 Storage → Edit
  - Zone → Workers Routes → Edit (if deploying)
- Ask them to provide the token so you can write it to `.env`.
- WAIT for their response.

### Step 3 — Run the Command

#### Token Injection

Read the token from `.env` and inject it as an environment variable:

**PowerShell (Bash tool on Windows):**
```powershell
$env:CLOUDFLARE_API_TOKEN = Get-Content .env | Where-Object { $_ -match '^CLOUDFLARE_API_TOKEN=' } | ForEach-Object { ($_ -split '=', 2)[1] }; npx wrangler@3 d1 execute core-pulse-blog --command="<SQL>" --remote
```

**Bash (Linux/macOS):**
```bash
CLOUDFLARE_API_TOKEN="$(grep '^CLOUDFLARE_API_TOKEN=' .env | cut -d'=' -f2-)" npx wrangler d1 execute core-pulse-blog --command="<SQL>" --remote
```

#### Simple Queries (ASCII-only: SELECT, schema checks, etc.)

Safe to run directly via PowerShell:
```powershell
npx wrangler@3 d1 execute core-pulse-blog --command="SELECT id, title, postType FROM posts;" --remote
```

#### Inserting/Updating Content with Non-ASCII (Chinese, etc.)

**NEVER use PowerShell `Set-Content` to write the SQL file.** Use the Node.js helper script at `scripts/d1-execute-file.cjs` (see below):

1. Write the content to a temp `.md` or `.txt` file (using the `write` tool — this is BOM-safe).
2. Run the Node.js helper to execute the `.sql` file with BOM-free UTF-8:
   ```powershell
   node .agent/skills/cloudflare-use/scripts/d1-execute-file.cjs "<path-to-sql-file>"
   ```

Or, for a one-step workflow from markdown to D1, use `scripts/d1-insert-post.cjs`:
```powershell
node .agent/skills/cloudflare-use/scripts/d1-insert-post.cjs --md="<markdown-file>" --postType="Project" --execute
```

#### Verifying Non-ASCII Content

Use the Node.js helper at `scripts/d1-query.cjs`:
```powershell
node .agent/skills/cloudflare-use/scripts/d1-query.cjs "SELECT id, title, substr(content, 1, 200) as preview FROM posts;"
```

### Step 4 — R2 Operations

```powershell
# Upload
$env:CLOUDFLARE_API_TOKEN = Get-Content .env | Where-Object { $_ -match '^CLOUDFLARE_API_TOKEN=' } | ForEach-Object { ($_ -split '=', 2)[1] }; npx wrangler@3 r2 object put core-pulse-assets/<key> --file="<local-path>"

# Download
npx wrangler@3 r2 object get core-pulse-assets/<key> --file="<local-path>"
```

## Helper Scripts

Reusable Node.js scripts in `scripts/` ensure BOM-free UTF-8 handling:

| Script | Purpose |
|--------|---------|
| `scripts/d1-execute-file.cjs` | Execute a `.sql` file against D1 (BOM-free UTF-8, auto-detects wrangler version). Use when inserting content with non-ASCII characters. |
| `scripts/d1-insert-post.cjs` | One-step: generate SQL from a markdown file and optionally execute it. Auto-derives id/title/excerpt. Use `--execute` to upload immediately. |
| `scripts/d1-query.cjs` | Run a SQL query and print results as proper UTF-8 JSON. Use to verify Chinese content without PowerShell console garbling. |

Both scripts auto-read the token from `.env` and auto-detect Node version to pick `wrangler@3` vs `wrangler`. All scripts use `.cjs` extension because the project's `package.json` has `"type": "module"`.

## Important Rules
- ALWAYS use `--remote` for D1 queries unless the user explicitly asks for the local dev database.
- ALWAYS use dynamic paths (relative or workspace root) — never hardcode `D:\CORE-PULSE`.
- DO NOT log or output the API token in text responses.
- If auth fails, verify the token was properly injected into the session.
- If Chinese text appears garbled in D1, the SQL file was likely written with a BOM — re-do using the Node.js helper script.
- If Chinese text appears garbled in PowerShell console but the website shows correct text, the data is fine — it's just PowerShell's console encoding. Verify with `scripts/d1-query.cjs`.

## Common Pitfalls (Learned From Real Incidents)

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| `Wrangler requires at least Node.js v22.0.0` | `npx wrangler` auto-installed v4 on Node 20 | Use `npx wrangler@3` |
| Chinese text in D1 is 亂碼 (mojibake) | SQL file written with PowerShell `Set-Content -Encoding UTF8` (adds BOM) | Re-generate SQL via Node.js `fs.writeFileSync('utf8')` |
| D1 data looks correct on website but garbled in terminal | PowerShell 5.1 console codepage ≠ UTF-8 | Verify via `scripts/d1-query.cjs` (Node.js) instead of PowerShell pipe |
| `npx wrangler@3` shows "out-of-date" warning | Wrangler 3 is deprecated but functional on Node 20 | Ignore the warning; it works correctly |
