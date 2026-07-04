#!/usr/bin/env node
/**
 * d1-query.js
 *
 * Run a SQL query against Cloudflare D1 and print results as proper UTF-8 JSON.
 *
 * Usage:
 *   node d1-query.js "<SQL query>"
 *   node d1-query.js "<SQL query>" --db=core-pulse-blog
 *
 * This script solves the PowerShell 5.1 console encoding problem:
 *   PowerShell 5.1 console defaults to system codepage (cp950/cp932), not UTF-8.
 *   When wrangler outputs JSON with Chinese characters, PowerShell displays
 *   them as garbled text (?萎辣隡箸??). The data in D1 is correct, but you
 *   can't verify it through PowerShell.
 *
 * This script uses Node.js execSync with encoding: 'utf8' to capture wrangler
 * output directly, bypassing PowerShell's console encoding entirely.
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
  console.log('Usage: node d1-query.js "<SQL query>" [--db=<database-name>]');
  console.log('Default database: core-pulse-blog');
  console.log('');
  console.log('Examples:');
  console.log('  node d1-query.js "SELECT id, title FROM posts;"');
  console.log("  node d1-query.js \"SELECT * FROM posts WHERE id = 'hello-d1';\"");
  process.exit(0);
}

const query = args[0];
const dbArg = args.find(a => a.startsWith('--db='));
const dbName = dbArg ? dbArg.split('=')[1] : 'core-pulse-blog';

// Read token from .env
const envPath = path.resolve('.env');
if (!fs.existsSync(envPath)) {
  fatal('.env file not found in current directory. Cannot read CLOUDFLARE_API_TOKEN.');
}
const envContent = fs.readFileSync(envPath, 'utf8');
const tokenMatch = envContent.match(/^CLOUDFLARE_API_TOKEN=(.+)$/m);
const token = tokenMatch ? tokenMatch[1].trim() : '';
if (!token) {
  fatal('CLOUDFLARE_API_TOKEN not found or empty in .env file.');
}

// Detect Node version to pick wrangler version
const nodeVersion = parseInt(process.versions.node.split('.')[0], 10);
const wranglerCmd = nodeVersion >= 22 ? 'wrangler' : 'wrangler@3';

// Set token in env
process.env.CLOUDFLARE_API_TOKEN = token;

// On Windows (cmd.exe), use double quotes for --command and escape internal double quotes.
// On Unix (bash), single quotes are safer but we normalize to double quotes with escaping.
// This avoids the shell splitting the SQL into separate arguments.
const escapedQuery = query.replace(/"/g, '\\"');
const cmd = `npx ${wranglerCmd} d1 execute ${dbName} --command="${escapedQuery}" --remote --json`;

try {
  const output = execSync(cmd, {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
    env: { ...process.env, CLOUDFLARE_API_TOKEN: token }
  });

  // Parse JSON from output (skip warning lines)
  const jsonStart = output.indexOf('[');
  if (jsonStart >= 0) {
    const data = JSON.parse(output.substring(jsonStart));
    const result = data[0];

    if (result.results && result.results.length > 0) {
      // Print each row
      result.results.forEach((row, i) => {
        if (result.results.length > 1) console.log(`--- Row ${i + 1} ---`);
        for (const [key, value] of Object.entries(row)) {
          // Truncate long content fields for readability
          const display = (typeof value === 'string' && value.length > 200)
            ? value.substring(0, 200) + '... (' + value.length + ' chars total)'
            : value;
          console.log(`${key}: ${display}`);
        }
        if (result.results.length > 1) console.log('');
      });
    } else {
      console.log('Query executed. No rows returned.');
    }

    if (result.meta) {
      console.log(`\nRows read: ${result.meta.rows_read}, Duration: ${result.meta.duration}ms`);
    }
  } else {
    console.log(output);
  }
} catch (e) {
  console.error('Query failed:', e.message);
  process.exit(1);
}
