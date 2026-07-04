#!/usr/bin/env node
/**
 * d1-insert-post.js
 *
 * Generate a BOM-free UTF-8 SQL file for inserting/upserting a blog post into D1,
 * then optionally execute it.
 *
 * Usage:
 *   node d1-insert-post.js --md="<markdown-file>" [--id="<post-id>"] [--title="<title>"] \
 *     [--date="YYYY-MM-DD"] [--readTime="N min"] [--tags='["tag1","tag2"]'] \
 *     [--excerpt="<excerpt>"] [--postType="Learning|Tools|Work|Daily|Project"] \
 *     [--coverImage="<url>"] [--execute] [--db=core-pulse-blog]
 *
 * If --id is omitted, it's derived from the markdown filename (without extension).
 * If --title is omitted, the first H1 in the markdown is used.
 * If --date is omitted, today's date (YYYY-MM-DD) is used.
 * If --readTime is omitted, defaults to "10 min".
 * If --postType is omitted, defaults to "Learning".
 * If --excerpt is omitted, the first blockquote or paragraph is used (truncated to 150 chars).
 *
 * If --execute is passed, the SQL is executed immediately via d1-execute-file.js logic.
 * Without --execute, the SQL file path is printed for manual execution.
 *
 * This script solves the PowerShell 5.1 BOM problem that caused 亂碼 (mojibake)
 * in Chinese blog posts uploaded to D1.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function fatal(msg) {
  console.error('ERROR:', msg);
  process.exit(1);
}

// Parse args
const args = process.argv.slice(2);
if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`Usage: node d1-insert-post.js --md="<markdown-file>" [options] [--execute]

Options:
  --id="<post-id>"          Post ID (default: derived from filename)
  --title="<title>"         Post title (default: first H1 in markdown)
  --date="YYYY-MM-DD"       Post date (default: today)
  --readTime="N min"        Read time (default: "10 min")
  --tags='["a","b"]'        Tags as JSON array string (default: "[]")
  --excerpt="<excerpt>"     Excerpt (default: first paragraph, truncated to 150 chars)
  --postType="<type>"       One of: Learning, Tools, Work, Daily, Project (default: Learning)
  --coverImage="<url>"      Cover image URL (default: empty)
  --execute                 Execute the SQL immediately after generating
  --db="<database>"         D1 database name (default: core-pulse-blog)
  --out="<path>"            Output SQL file path (default: temp file or ./insert-<id>.sql)

Examples:
  node d1-insert-post.js --md="post.md" --postType="Project" --execute
  node d1-insert-post.js --md="post.md" --id="my-post" --title="My Post" --tags='["tech","dev"]'
`);
  process.exit(0);
}

// Parse key=value args
const opts = {};
for (const arg of args) {
  const match = arg.match(/^--([a-zA-Z]+)=(.*)$/s);
  if (match) {
    opts[match[1]] = match[2];
  } else if (arg === '--execute') {
    opts.execute = true;
  }
}

if (!opts.md) {
  fatal('--md="<markdown-file>" is required. Use --help for usage.');
}

const mdPath = path.resolve(opts.md);
if (!fs.existsSync(mdPath)) {
  fatal(`Markdown file not found: ${mdPath}`);
}

// Read markdown content as UTF-8 (no BOM, Node.js default)
const content = fs.readFileSync(mdPath, 'utf8');

// Derive post ID from filename if not provided
const baseName = path.basename(mdPath, path.extname(mdPath));
const id = opts.id || baseName;

// Derive title from first H1 if not provided
let title = opts.title;
if (!title) {
  const h1Match = content.match(/^#\s+(.+)$/m);
  title = h1Match ? h1Match[1].trim() : baseName;
}

// Derive date (today if not provided)
const date = opts.date || new Date().toISOString().split('T')[0];

// Read time
const readTime = opts.readTime || '10 min';

// Tags
const tags = opts.tags || '[]';

// Derive excerpt from first blockquote or paragraph if not provided
let excerpt = opts.excerpt;
if (!excerpt) {
  // Try blockquote first
  const bqMatch = content.match(/^>\s+(.+)$/m);
  if (bqMatch) {
    excerpt = bqMatch[1].trim();
  } else {
    // Skip H1 and find first paragraph
    const lines = content.split('\n');
    let found = '';
    let pastH1 = false;
    for (const line of lines) {
      if (line.startsWith('# ')) { pastH1 = true; continue; }
      if (pastH1 && line.trim() && !line.startsWith('#') && !line.startsWith('!') && !line.startsWith('|') && !line.startsWith('```')) {
        found = line.trim();
        break;
      }
    }
    excerpt = found || content.substring(0, 150).replace(/\n/g, ' ').trim();
  }
  // Truncate to 200 chars
  if (excerpt.length > 200) excerpt = excerpt.substring(0, 200) + '...';
}

// Post type
const postType = opts.postType || 'Learning';

// Cover image
const coverImage = opts.coverImage || '';

// Escape single quotes for SQL
function esc(s) {
  return String(s).replace(/'/g, "''");
}

// Build SQL (DELETE + INSERT for idempotent upsert)
const sql = `DELETE FROM posts WHERE id = '${esc(id)}';
INSERT INTO posts (id, title, content, date, readTime, tags, excerpt, postType, coverImage)
VALUES (
  '${esc(id)}',
  '${esc(title)}',
  '${esc(content)}',
  '${esc(date)}',
  '${esc(readTime)}',
  '${esc(tags)}',
  '${esc(excerpt)}',
  '${esc(postType)}',
  '${esc(coverImage)}'
);
`;

// Determine output path
const outPath = opts.out
  ? path.resolve(opts.out)
  : path.join(path.dirname(mdPath), `insert-${id}.sql`);

// Write SQL as UTF-8 without BOM (Node.js default)
fs.writeFileSync(outPath, sql, 'utf8');

console.log('SQL file generated (BOM-free UTF-8):');
console.log(`  Path: ${outPath}`);
console.log(`  Size: ${fs.statSync(outPath).size} bytes`);
console.log(`  Post ID: ${id}`);
console.log(`  Title: ${title}`);
console.log(`  Date: ${date}`);
console.log(`  PostType: ${postType}`);
console.log(`  ReadTime: ${readTime}`);
console.log(`  Tags: ${tags}`);
console.log(`  Excerpt: ${excerpt.substring(0, 80)}${excerpt.length > 80 ? '...' : ''}`);

if (opts.execute) {
  console.log('\n--- Executing against D1 ---');

  // Read token from .env
  const envPath = path.resolve('.env');
  if (!fs.existsSync(envPath)) {
    fatal('.env file not found. Cannot execute without CLOUDFLARE_API_TOKEN.');
  }
  const envContent = fs.readFileSync(envPath, 'utf8');
  const tokenMatch = envContent.match(/^CLOUDFLARE_API_TOKEN=(.+)$/m);
  const token = tokenMatch ? tokenMatch[1].trim() : '';
  if (!token) {
    fatal('CLOUDFLARE_API_TOKEN not found in .env.');
  }

  const nodeVersion = parseInt(process.versions.node.split('.')[0], 10);
  const wranglerCmd = nodeVersion >= 22 ? 'wrangler' : 'wrangler@3';
  const dbName = opts.db || 'core-pulse-blog';

  process.env.CLOUDFLARE_API_TOKEN = token;
  const cmd = `npx ${wranglerCmd} d1 execute ${dbName} --file="${outPath}" --remote --json`;

  try {
    const output = execSync(cmd, {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const jsonStart = output.indexOf('[');
    if (jsonStart >= 0) {
      const data = JSON.parse(output.substring(jsonStart));
      const result = data[0];
      console.log('Success:', result.success);
      if (result.meta) {
        console.log(`Rows written: ${result.meta.rows_written}, Duration: ${result.meta.duration}ms`);
      }
    } else {
      console.log(output);
    }

    // Clean up the SQL file after successful execution
    if (!opts.out) {
      try { fs.unlinkSync(outPath); } catch (e) {}
      console.log('(Temporary SQL file cleaned up)');
    }
  } catch (e) {
    console.error('Execution failed:');
    if (e.stdout) console.error(e.stdout);
    if (e.stderr) console.error(e.stderr);
    process.exit(1);
  }
} else {
  console.log('\nTo execute: node d1-execute-file.js "' + outPath + '"');
}
