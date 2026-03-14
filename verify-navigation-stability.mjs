#!/usr/bin/env node
/**
 * Navigation stability verification (Puppeteer + system Chrome).
 * Run with: node verify-navigation-stability.mjs
 * Requires: npm run dev:all running (API + web on localhost:3000)
 */
import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = __dirname + '/screenshots/nav-verification';
try { mkdirSync(SCREENSHOT_DIR, { recursive: true }); } catch (_) {}

const BASE = 'http://localhost:3000';
const TIMEOUT = 15000;
const NAV_WAIT = 3000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = {
  timestamp: new Date().toISOString(),
  routes: {},
  transitions: [],
  failures: [],
  screenshots: [],
};

function isBlank(bodyText, hasError = false) {
  const t = (bodyText || '').trim().toLowerCase();
  if (hasError) return true;
  if (!t || t === 'loading...' || t === 'redirecting...') return true;
  if (t.length < 50) return true;
  return false;
}

async function run() {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--headless=new'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const errors = [];
    const failedUrls = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('response', (r) => {
      if (r.status() >= 500) failedUrls.push({ url: r.url(), status: r.status() });
    });

    const captureScreenshot = async (slug) => {
      const f = `${SCREENSHOT_DIR}/${slug}.png`;
      try {
        await page.screenshot({ path: f, fullPage: true });
        results.screenshots.push(slug + '.png');
      } catch (_) {}
    };

    const testRoute = async (path, name, options = {}) => {
      const url = BASE + path;
      const slug = (name || path).replace(/[^a-z0-9-]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'route';
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
        await sleep(NAV_WAIT);
        const bodyText = await page.evaluate(() => document.body?.innerText || '');
        const hasContent = bodyText.length > 100;
        const blank = isBlank(bodyText);
        const title = await page.title();
        const ok = hasContent && !blank;
        results.routes[name || path] = { ok, blank, hasContent, bodyLen: bodyText.length, title };
        if (!ok) results.failures.push({ route: path, reason: blank ? 'blank' : 'no content' });
        await captureScreenshot(slug);
        return ok;
      } catch (e) {
        results.routes[name || path] = { ok: false, error: e.message };
        results.failures.push({ route: path, error: e.message });
        await captureScreenshot(slug + '-error');
        return false;
      }
    };

    const testTransition = async (from, to, name) => {
      try {
        await page.goto(BASE + from, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
        await sleep(1500);
        await page.goto(BASE + to, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
        await sleep(NAV_WAIT);
        const bodyText = await page.evaluate(() => document.body?.innerText || '');
        const ok = bodyText.length > 100 && !isBlank(bodyText);
        results.transitions.push({ from, to, name, ok });
        return ok;
      } catch (e) {
        results.transitions.push({ from, to, name, ok: false, error: e.message });
        return false;
      }
    };

    console.log('=== 1. Public routes (no auth) ===');
    await testRoute('/', 'home');
    await testRoute('/login', 'login');
    await testRoute('/register', 'register');

    console.log('=== 2. Login ===');
    await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await sleep(5000);
    let emailInput = await page.$('input[type="email"]');
    if (emailInput) {
      await page.type('input[type="email"]', 'test@example.com');
      await page.type('input[type="password"]', 'Test1234');
      await page.click('button[type="submit"]');
      await sleep(4000);
      const url = page.url();
      results.loginSuccess = url.includes('/dashboard') || url.includes('/case');
      console.log('Login (UI):', results.loginSuccess ? 'OK' : 'FAIL', url);
    } else {
      const loginRes = await page.evaluate(async () => {
        try {
          const r = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'test@example.com', password: 'Test1234' }),
          });
          return await r.json();
        } catch (e) {
          return { error: e.message };
        }
      });
      if (loginRes && loginRes.token) {
        await page.evaluate((data) => {
          localStorage.setItem('auth-storage', JSON.stringify({ state: { user: data.user, token: data.token }, version: 0 }));
        }, loginRes);
        await page.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
        await sleep(3000);
        results.loginSuccess = page.url().includes('/dashboard') || page.url().includes('/case');
        console.log('Login (API fallback):', results.loginSuccess ? 'OK' : 'FAIL');
      } else {
        results.loginSuccess = false;
        results.failures.push({ step: 'login', error: 'Login form not found, API: ' + (loginRes?.error || 'no token') });
      }
    }

    if (results.loginSuccess) {
      console.log('=== 3. Protected routes ===');
      await testRoute('/dashboard', 'dashboard');
      await testRoute('/case', 'case');
      await testRoute('/account', 'account');
      await testRoute('/account/billing', 'account/billing');
      await testRoute('/account/plans', 'account/plans');
      await testRoute('/modules', 'modules');

      const cases = await page.evaluate(() => {
        const links = [...document.querySelectorAll('a[href*="/case/"]')];
        return links.map((a) => a.getAttribute('href')).filter(Boolean).slice(0, 1);
      });
      const caseId = cases[0]?.match(/\/case\/([a-z0-9-]+)/)?.[1];
      if (caseId) {
        await testRoute(`/case/${caseId}`, 'case-[id]');
      } else {
        results.routes['case/[id]'] = { ok: false, skip: 'no case link (dashboard has View Case)' };
      }

      console.log('=== 4. Admin routes (admin login) ===');
      await page.evaluate(() => localStorage.clear());
      const adminLogin = await page.evaluate(async () => {
        try {
          const r = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@aipas.com', password: 'admin123' }),
          });
          return await r.json();
        } catch (e) {
          return { error: e.message };
        }
      });
      if (adminLogin && adminLogin.token) {
        await page.evaluate((data) => {
          localStorage.setItem('auth-storage', JSON.stringify({ state: { user: data.user, token: data.token }, version: 0 }));
        }, adminLogin);
      }
      await sleep(500);

      await testRoute('/admin/dashboard', 'admin-dashboard');
      await testRoute('/admin/users', 'admin-users');

      const userIds = await page.evaluate(() => {
        const links = [...document.querySelectorAll('a[href*="/admin/users/"]')];
        return links.map((a) => a.getAttribute('href')).filter(Boolean).slice(0, 1);
      });
      const userId = userIds[0]?.match(/\/admin\/users\/([a-z0-9-]+)/)?.[1];
      if (userId) {
        await testRoute(`/admin/users/${userId}`, 'admin-users-id');
      } else {
        results.routes['admin/users/[id]'] = { ok: false, skip: 'no user link' };
      }
    }

    console.log('=== 5. Transitions ===');
    const transLogin = await page.evaluate(async () => {
      try {
        const r = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test@example.com', password: 'Test1234' }),
        });
        return await r.json();
      } catch (e) {
        return { error: e.message };
      }
    });
    if (transLogin && transLogin.token) {
      await page.evaluate((data) => {
        localStorage.setItem('auth-storage', JSON.stringify({ state: { user: data.user, token: data.token }, version: 0 }));
      }, transLogin);
    }
    await sleep(500);

    await testTransition('/dashboard', '/case', 'dashboard→case');
    await testTransition('/case', '/account', 'case→account');
    await testTransition('/account', '/account/billing', 'account→billing');
    await testTransition('/account/billing', '/account/plans', 'billing→plans');
    await testTransition('/account/plans', '/dashboard', 'plans→dashboard');

    results.consoleErrors = errors;
    results.failedUrls = failedUrls.slice(0, 50);
  } catch (e) {
    results.runError = e.message;
    console.error('Run error:', e);
  } finally {
    if (browser) await browser.close();
  }

  const outPath = 'navigation-verification-results.json';
  writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log('\n=== RESULTS ===');
  console.log(JSON.stringify(results, null, 2));
  console.log('\nWritten to', outPath);
  return results;
}

run();
