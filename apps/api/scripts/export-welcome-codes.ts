#!/usr/bin/env npx tsx
/**
 * Export the 205 welcome access codes to a text file.
 * Run: npx tsx apps/api/scripts/export-welcome-codes.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { generateWelcomeCodes } from '../src/lib/welcome-codes';

const codes = generateWelcomeCodes();
const productionCodes = codes.filter((c) => !c.isTest).map((c) => c.code);
const testCodes = codes.filter((c) => c.isTest).map((c) => c.code);

const output = [
  '# AI Pass Welcome Access Codes',
  `Generated: ${new Date().toISOString()}`,
  `Total: ${codes.length} (200 production + 5 TEST)`,
  '',
  '## TEST codes (reserved for internal testing)',
  ...testCodes.map((c) => `- ${c}`),
  '',
  '## Production codes (200)',
  ...productionCodes,
  '',
  '---',
  'One-time use. On redemption: lifetime course access + 30-day Start plan (MyCase).',
].join('\n');

const outPath = path.join(__dirname, '..', '..', '..', 'welcome-codes.txt');
fs.writeFileSync(outPath, output, 'utf8');
console.log(`Exported ${codes.length} codes to ${outPath}`);
console.log('TEST codes:', testCodes.join(', '));
