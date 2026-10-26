#!/usr/bin/env node
/**
 * AgentReady Scan — composite action entry point.
 * Validates the target URL with the same SSRF guard rules as
 * FetchDoge/agentready's action-scan.mjs, then runs the pinned scanner
 * (checked out at ./_agentready-scanner by action.yml) and exposes
 * score / grade / earned / report-json as step outputs.
 * Read-only GETs only. Sends no data anywhere except to the scanned site.
 */
import { appendFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const url = (process.env.INPUT_URL || '').trim();
const top = (process.env.INPUT_TOP || '').trim();
const timeoutMs = (process.env.INPUT_TIMEOUT_MS || '12000').trim();
const failBelow = (process.env.INPUT_FAIL_BELOW || '').trim();
const scannerDir = process.env.SCANNER_DIR || join(process.cwd(), '_agentready-scanner');
const outDir = join(process.cwd(), 'agentready-out');

function validate(raw) {
  let u;
  try { u = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw); } catch { return { ok: false, why: 'not a valid URL' }; }
  if (!/^https?:$/.test(u.protocol)) return { ok: false, why: 'only http/https' };
  const h = u.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return { ok: false, why: 'internal hostnames are not scannable' };
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(':')) return { ok: false, why: 'IP literals are not scannable' };
  if (['127.0.0.1', '169.254.169.254', 'metadata.google.internal'].includes(h)) return { ok: false, why: 'not scannable' };
  return { ok: true, url: u.origin };
}

function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
  console.log(`output ${name}=${value}`);
}
function summary(md) {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
  console.log(md);
}

if (!url) { console.error('input "url" is required'); process.exit(1); }
const v = validate(url);
if (!v.ok) { console.error(`url skipped: ${v.why}`); process.exit(1); }

const argv = [join(scannerDir, 'scan.mjs'), v.url, '--json', '--timeout', timeoutMs, '--out', outDir];
if (top) argv.push('--top', top);

let result;
try {
  const raw = execFileSync(process.execPath, argv, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  result = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
} catch (e) {
  // scan.mjs exits 2 when the target is unreachable but still prints JSON.
  if (e.stdout) {
    try { result = JSON.parse(e.stdout.slice(e.stdout.indexOf('{'), e.stdout.lastIndexOf('}') + 1)); }
    catch { /* fall through */ }
  }
  if (!result) { console.error(`scan failed: ${String(e.message).slice(0, 200)}`); process.exit(1); }
}

const host = result.host.replace(/[^a-z0-9.-]/gi, '_');
const reportJson = join(outDir, `${host}.json`);
setOutput('score', result.score);
setOutput('grade', result.grade);
setOutput('earned', result.earned);
setOutput('report-json', reportJson);

const gaps = (result.gaps || []).slice(0, 3).map((g) => `\`${g.name}\` (+${g.weight})`).join(' · ');
summary(`### AgentReady Scan — \`${result.host}\`\n\n## ${result.score}/100 &nbsp; grade **${result.grade}**\n\n${result.earned}/${result.totalWeight} weighted points across ${result.checks.length} checks.${gaps ? `\n\n**Top fixes:** ${gaps}` : ''}\n\n<sub>Scanner pinned to FetchDoge/agentready@345705a2f29ffa8bc32b64d29d26733ada9c08c7 (main, 2026-10-18). Reproduce: \`node scan.mjs ${result.target}\`</sub>`);

if (failBelow !== '' && Number.isFinite(Number(failBelow)) && result.score < Number(failBelow)) {
  console.error(`score ${result.score} is below fail-below threshold ${failBelow}`);
  process.exit(1);
}
process.exit(result.reachable ? 0 : 2);
