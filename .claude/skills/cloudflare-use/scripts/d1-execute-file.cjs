#!/usr/bin/env node
/**
 * d1-execute-file.js
 *
 * Execute a .sql file against Cloudflare D1 with BOM-free UTF-8 encoding.
 *
 * Usage:
 *   node d1-execute-file.js <sql-file-path>
 *   node d1-execute-file.js <sql-file-path> --db=core-pulse-blog
 *
 * This script solves the PowerShell 5.1 BOM problem:
 *   PowerShell `Set-Content -Encoding UTF8` adds a BOM (EF BB BF) to files,
 *   which corrupts Chinese characters when wrangler reads the SQL file.
 *   Node.js `fs.readFileSync('utf8')` / `execSync` handle UTF-8 without BOM.
 *
 * The script:
 *   1. Reads the .sql file as UTF-8 (no BOM).
 *   2. Reads CLOUDFLARE_API_TOKEN from .env in the current workspace.
 *   3. Detects Node version to pick wrangler@3 (Node < 22) or wrangler (Node >= 22).
 *   4. Executes the SQL file via `wrangler d1 execute --file --remote`.
 *   5. Parses and prints the JSON result with proper UTF-8.
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
  console.log('Usage: node d1-execute-file.js <sql-file-path> [--db=<database-name>]');
  console.log("Default database: core-pulse-blog");
  process.exit(0);
}

const sqlFile = path.resolve(args[0]);
const dbArg = args.find(a => a.startsWith('--db='));
const dbName = dbArg ? dbArg.split('=')[1] : 'core-pulse-blog';

// Verify SQL file exists
if (!fs.existsSync(sqlFile)) {
  fatal(`SQL file not found: ${sqlFile}`);
}

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

// Read the SQL file as UTF-8 (no BOM, Node.js default)
const sqlContent = fs.readFileSync(sqlFile, 'utf8');

// Write to a temp file (ensuring no BOM) for wrangler to read
const tmpSqlPath = path.join(require('os').tmpdir(), `d1-exec-${Date.now()}.sql`);
fs.writeFileSync(tmpSqlPath, sqlContent, 'utf8'); // Node.js utf8 = no BOM

// Set token in env and execute
process.env.CLOUDFLARE_API_TOKEN = token;

const cmd = `npx ${wranglerCmd} d1 execute ${dbName} --file="${tmpSqlPath}" --remote --json`;

console.log(`Executing SQL file via ${wranglerCmd}...`);
console.log(`Database: ${dbName}`);
console.log(`SQL file: ${sqlFile}`);
console.log('---');

try {
  const output = execSync(cmd, {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // Parse JSON from output (skip warning lines)
  const jsonStart = output.indexOf('[');
  if (jsonStart >= 0) {
    const data = JSON.parse(output.substring(jsonStart));
    const result = data[0];
    console.log('Success:', result.success);
    if (result.results) {
      console.log('Results:', JSON.stringify(result.results, null, 2));
    }
    if (result.meta) {
      console.log(`Rows read: ${result.meta.rows_read}, Rows written: ${result.meta.rows_written}`);
      console.log(`Duration: ${result.meta.duration}ms, DB size: ${result.meta.size_after} bytes`);
    }
  } else {
    console.log(output);
  }
} catch (e) {
  console.error('Execution failed:');
  if (e.stdout) console.error(e.stdout);
  if (e.stderr) console.error(e.stderr);
  process.exit(1);
} finally {
  // Clean up temp file
  try { fs.unlinkSync(tmpSqlPath); } catch (e) {}
}
