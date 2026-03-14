#!/usr/bin/env node
/**
 * Verify Ultra request flow end-to-end.
 * Requires: npm run dev:all (API + web)
 */
import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:3000';
const SCREENSHOT_DIR = __dirname + '/screenshots/ultra-flow';
try { mkdirSync(SCREENSHOT_DIR, { recursive: true }); } catch (_) {}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  const results = { steps: [], screenshots: [], errors: [] };
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const capture = async (name) => {
      const path = `${SCREENSHOT_DIR}/${name}.png`;
      await page.screenshot({ path, fullPage: true });
      results.screenshots.push(name + '.png');
    };

    const apiLogin = async (email, password) => {
      return page.evaluate(async ({ email, password }) => {
        const r = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await r.json();
        if (data.token) {
          localStorage.setItem('auth-storage', JSON.stringify({
            state: { user: data.user, token: data.token },
            version: 0,
          }));
          return true;
        }
        return false;
      }, { email, password });
    };

    await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(3000);

    const studentLoggedIn = await apiLogin('test@example.com', 'Test1234');
    if (!studentLoggedIn) {
      results.errors.push('Student login failed');
      throw new Error('Student login failed');
    }
    results.steps.push({ step: 'student_login', ok: true });

    await page.goto(BASE + '/account/plans', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(3000);
    await capture('01-plans-before-request');

    const hasPending = await page.evaluate(() =>
      document.body?.innerText?.includes('Request pending review') || document.body?.innerText?.includes('pending')
    );
    let requestCreated = hasPending;
    if (!hasPending) {
      const btn = await page.$('button');
      const buttons = await page.$$('button');
      let requestBtn = null;
      for (const b of buttons) {
        const text = await page.evaluate((el) => el.textContent, b);
        if (text && text.includes('Request Ultra')) {
          requestBtn = b;
          break;
        }
      }
      if (requestBtn) {
        await requestBtn.click();
        await sleep(3000);
        await capture('02-after-request-click');
        const afterText = await page.evaluate(() => document.body?.innerText || '');
        requestCreated = afterText.includes('pending') || afterText.includes('Request submitted') || !afterText.includes('404');
      }
    }
    results.steps.push({ step: 'request_ultra', ok: requestCreated });

    await apiLogin('admin@aipas.com', 'admin123');
    await page.goto(BASE + '/admin/ultra-requests', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(3000);
    await capture('03-admin-ultra-requests');

    const hasRequests = await page.evaluate(() => {
      const text = document.body?.innerText || '';
      return text.includes('pending') || text.includes('Test Student') || text.includes('test@example.com');
    });
    results.steps.push({ step: 'admin_sees_requests', ok: hasRequests });

    const approveBtn = await page.evaluateHandle(() => {
      const btns = [...document.querySelectorAll('button')];
      return btns.find((b) => b.textContent?.includes('Approve'));
    });
    const approveEl = approveBtn.asElement();
    if (approveEl) {
      await approveEl.click();
      await sleep(3000);
      await capture('04-after-approve');
      results.steps.push({ step: 'admin_approve', ok: true });
    } else {
      results.steps.push({ step: 'admin_approve', ok: false, note: 'No Approve button or already approved' });
    }

    await apiLogin('test@example.com', 'Test1234');
    await page.goto(BASE + '/account/plans', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(3000);
    await capture('05-student-after-approval');

    const hasUltra = await page.evaluate(() => {
      const text = document.body?.innerText || '';
      return text.includes('Ultra') && (text.includes('You have Ultra') || text.includes('upload'));
    });
    results.steps.push({ step: 'student_has_ultra', ok: hasUltra });

    const plansData = await page.evaluate(async () => {
      try {
        const storage = localStorage.getItem('auth-storage');
        const auth = storage ? JSON.parse(storage) : null;
        const token = auth?.state?.token;
        if (!token) return null;
        const r = await fetch('/api/plans', { headers: { Authorization: `Bearer ${token}` } });
        return await r.json();
      } catch (e) {
        return { error: e.message };
      }
    });
    results.plansAfterApproval = plansData;
  } catch (e) {
    results.errors.push(e.message);
    console.error(e);
  } finally {
    if (browser) await browser.close();
  }

  const outPath = 'ultra-flow-verification-results.json';
  writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  console.log('\nScreenshots:', SCREENSHOT_DIR);
  return results;
}

run();
