// Dependency-free validation for the L1 Portal page.
// Usage: node scripts/validate.mjs [path-to-html]
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const file = process.argv[2] || 'L1portalv1.html';
const html = readFileSync(file, 'utf8');

const errors = [];
const warnings = [];

// 1. Basic document structure
for (const [label, re] of [
  ['<!DOCTYPE html>', /<!DOCTYPE html>/i],
  ['<html lang>', /<html[^>]*\blang=/i],
  ['<title>', /<title>[^<]+<\/title>/i],
  ['viewport meta', /<meta[^>]+name=["']viewport["']/i],
]) {
  if (!re.test(html)) errors.push(`Missing ${label}`);
}

// 2. Inline <script> blocks must parse
const scriptRe = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
const scripts = [...html.matchAll(scriptRe)].map((m) => m[1]);
if (scripts.length === 0) errors.push('No inline <script> blocks found');
scripts.forEach((code, i) => {
  try {
    new vm.Script(code, { filename: `${file}#script${i + 1}` });
  } catch (e) {
    errors.push(`Script block ${i + 1} has a syntax error: ${e.message}`);
  }
});

// 3. Evaluate the link dataset and validate it
const dataScript = scripts.find((s) => /let\s+links\s*=/.test(s));
let links = [];
if (!dataScript) {
  errors.push('Could not find the `let links = [...]` dataset');
} else {
  try {
    const ctx = vm.createContext({
      localStorage: { getItem: () => null, setItem: () => {} },
    });
    links = vm.runInContext(`${dataScript}\n;links`, ctx);
  } catch (e) {
    errors.push(`Could not evaluate the links dataset: ${e.message}`);
  }
}

// Categories offered by the sidebar / Add-URL form
const allowedCategories = new Set([
  'Monitoring', 'Enterprise', 'Gateway', 'Switch', 'Admin', 'Pinned', 'SMS', 'Other',
]);

const isHttpUrl = (u) => {
  try {
    const p = new URL(u);
    return p.protocol === 'http:' || p.protocol === 'https:';
  } catch {
    return false;
  }
};

const seenIds = new Set();
const seenTitles = new Map();
for (const l of links) {
  const name = `#${l.id} "${l.title}"`;
  if (seenIds.has(l.id)) errors.push(`Duplicate id: ${l.id}`);
  seenIds.add(l.id);

  for (const f of ['title', 'category', 'tag', 'dcUrl', 'desc', 'icon']) {
    if (!l[f] || typeof l[f] !== 'string' || !l[f].trim()) {
      errors.push(`${name}: missing or empty "${f}"`);
    }
  }
  if (l.category && !allowedCategories.has(l.category)) {
    errors.push(`${name}: unknown category "${l.category}"`);
  }
  if (l.dcUrl && !isHttpUrl(l.dcUrl)) errors.push(`${name}: invalid dcUrl "${l.dcUrl}"`);
  if (l.drUrl && !isHttpUrl(l.drUrl)) errors.push(`${name}: invalid drUrl "${l.drUrl}"`);
  if (l.dcUrl && l.drUrl && l.dcUrl === l.drUrl) errors.push(`${name}: dcUrl and drUrl are identical`);
  if (l.dcUrl && l.dcUrl.includes('"')) errors.push(`${name}: dcUrl contains a double quote`);

  const key = (l.title || '').trim().toLowerCase();
  if (seenTitles.has(key)) warnings.push(`${name}: same title as #${seenTitles.get(key)}`);
  seenTitles.set(key, l.id);
}

// 4. The hardcoded "37" in the UI text should match the dataset size
const claimed = [...html.matchAll(/\b(\d+)\s+(?:operational links|department URLs)/gi)].map((m) => Number(m[1]));
for (const n of claimed) {
  if (n !== links.length) warnings.push(`UI text says ${n} links but the dataset has ${links.length}`);
}

// Report
console.log(`File: ${file}`);
console.log(`Inline scripts: ${scripts.length} | Links: ${links.length}`);
warnings.forEach((w) => console.log(`::warning::${w}`));
errors.forEach((e) => console.log(`::error::${e}`));
if (errors.length) {
  console.log(`\nFAILED with ${errors.length} error(s).`);
  process.exit(1);
}
console.log('\nOK: all checks passed.');
