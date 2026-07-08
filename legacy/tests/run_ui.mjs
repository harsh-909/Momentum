/*
 * UI end-to-end runner - no external dependencies, uses the browser already
 * installed on this machine (Edge or Chrome) in headless mode.
 *
 * It: (1) starts the real server.py against an isolated temp data dir, (2) points
 * headless Edge/Chrome at tests/e2e.html which drives the real app as "testuser",
 * (3) reads the JSON result out of the dumped DOM, (4) tears everything down.
 *
 * Usage:  node tests/run_ui.mjs [feature|full]
 * Override the browser with:  MOMENTUM_TEST_BROWSER=/path/to/chrome node tests/run_ui.mjs
 */
import net from 'node:net';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const SUITE = (process.argv[2] || 'feature').toLowerCase();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Chrome first: Edge's --dump-dom emits nothing to stdout on Windows, so it can't
// be used as the results channel. Chrome (and Chromium) work.
const BROWSERS = [
  process.env.MOMENTUM_TEST_BROWSER,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
].filter(Boolean);

function freePort() {
  return new Promise((res, rej) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
    s.on('error', rej);
  });
}

function httpGet(url) {
  return new Promise((res) => {
    http.get(url, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res({ status: r.statusCode, body: d })); })
      .on('error', () => res(null));
  });
}

function httpPost(url, obj) {
  return new Promise((res) => {
    const data = Buffer.from(JSON.stringify(obj));
    const u = new URL(url);
    const req = http.request(
      { hostname: u.hostname, port: u.port, path: u.pathname, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': data.length } },
      (r) => { r.on('data', () => {}); r.on('end', () => res(true)); }
    );
    req.on('error', () => res(false));
    req.write(data); req.end();
  });
}

async function rmDirSafe(dir) {
  for (let i = 0; i < 6; i++) {
    try { fs.rmSync(dir, { recursive: true, force: true }); return; }
    catch { await sleep(200); }
  }
}

async function waitForServer(port) {
  for (let i = 0; i < 100; i++) {
    const r = await httpGet(`http://127.0.0.1:${port}/api/users`);
    if (r && r.status === 200) return true;
    await sleep(100);
  }
  return false;
}

function capture(cmd, args, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { windowsHide: true });
    let out = '', err = '';
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('close', () => { clearTimeout(timer); resolve({ out, err }); });
    child.on('error', (e) => { clearTimeout(timer); resolve({ out, err: String(e) }); });
  });
}

function unescapeHtml(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

async function main() {
  const pyCwd = ROOT;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'momentum-data-'));
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'momentum-prof-'));
  const browser = BROWSERS.find((p) => { try { return fs.existsSync(p); } catch { return false; } });

  if (!browser) {
    console.log('UI tests SKIPPED: no Edge/Chrome found. Set MOMENTUM_TEST_BROWSER to a browser path.');
    process.exit(0); // skip, don't fail the whole run
  }

  const port = await freePort();
  const server = spawn('python', ['server.py', String(port)], {
    cwd: pyCwd, windowsHide: true, stdio: 'ignore',
    env: { ...process.env, MOMENTUM_DATA_DIR: dataDir },
  });

  let exitCode = 1;
  try {
    if (!(await waitForServer(port))) { console.log('UI tests FAILED: test server did not start.'); return; }

    const url = `http://127.0.0.1:${port}/tests/e2e.html?suite=${SUITE}`;
    const args = [
      '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--disable-extensions', '--disable-background-networking',
      `--user-data-dir=${profileDir}`, '--virtual-time-budget=30000', '--dump-dom', url,
    ];
    const { out, err } = await capture(browser, args, 90000);

    const m = out.match(/<pre id="__results__"[^>]*>([\s\S]*?)<\/pre>/);
    if (!m) {
      console.log('UI tests FAILED: could not read results from the rendered page.');
      if (err) console.log('browser stderr (tail):\n' + err.split('\n').slice(-5).join('\n'));
      return;
    }

    let results;
    try { results = JSON.parse(unescapeHtml(m[1]).trim()); }
    catch (e) { console.log('UI tests FAILED: results were not valid JSON:', String(e)); return; }

    console.log(`UI e2e tests  (suite: ${SUITE}, browser: ${path.basename(browser)}, user: testuser)\n`);
    let passed = 0, failed = 0;
    for (const r of results) {
      if (r.ok) { passed++; console.log(`  ✓ ${r.name}`); }
      else { failed++; console.log(`  ✗ ${r.name}${r.detail ? `  ->  ${r.detail}` : ''}`); }
    }
    console.log(`\nUI: ${passed} passed, ${failed} failed`);
    exitCode = failed === 0 && results.length > 0 ? 0 : 1;
  } finally {
    await httpPost(`http://127.0.0.1:${port}/api/quit`, {}).catch(() => {});
    try { server.kill(); } catch {}
    await rmDirSafe(dataDir);
    await rmDirSafe(profileDir);  // Chrome may briefly hold a lock on its profile
  }
  process.exit(exitCode);
}

main();
