import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'fs';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

mkdirSync('screenshots', { recursive: true });

const browser = await puppeteer.launch({
  headless: false,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--no-sandbox'],
  defaultViewport: { width: 1920, height: 1080 },
});

const page = await browser.newPage();

// Login
console.log('Logging in...');
await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
await page.type('input[type="email"]', 'test@example.com');
await page.type('input[type="password"]', 'Test1234');
await page.click('button[type="submit"]');
await wait(3000);

// Direct navigation to known case
console.log('Navigating to case workspace...');
await page.goto('http://localhost:3000/case/dc75d30d-3a2e-4865-a65c-241b8175e526', { waitUntil: 'networkidle2' });
await wait(2000);

console.log('Current URL:', page.url());

// Take initial screenshot
await page.screenshot({ path: 'screenshots/case-workspace-initial.png', fullPage: true });

// Find and click Forms & Fees
console.log('Looking for Forms & Fees section...');
const clicked = await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('button'));
  const formsBtn = buttons.find(b => b.textContent && b.textContent.includes('2. Forms & Fees'));
  if (formsBtn) {
    formsBtn.scrollIntoView({ block: 'center' });
    formsBtn.click();
    return true;
  }
  return false;
});

console.log('Forms & Fees button clicked:', clicked);
await wait(2000);

await page.screenshot({ path: 'screenshots/forms-fees-after-click.png', fullPage: true });

// Check what's visible
const analysis = await page.evaluate(() => {
  const bodyText = document.body.textContent || '';
  const allButtons = Array.from(document.querySelectorAll('button'));
  
  return {
    hasFormsFeesInText: bodyText.includes('2. Forms & Fees'),
    hasFormI140Final: bodyText.includes('Form I-140 (final signed PDF)'),
    hasFormI140Draft: bodyText.includes('Form I-140 (draft'),
    hasFormG1145: bodyText.includes('Form G-1145'),
    hasFormI907: bodyText.includes('Form I-907'),
    totalButtons: allButtons.length,
    fillButtons: allButtons.filter(b => b.textContent?.trim() === 'Fill').length,
    templateButtons: allButtons.filter(b => b.textContent?.trim() === 'Template').length,
    addButtons: allButtons.filter(b => b.textContent?.includes('Add')).length,
    sampleButtons: allButtons.slice(0, 30).map(b => b.textContent?.trim()).filter(t => t && t.length < 30),
  };
});

console.log('\n=== ANALYSIS ===');
console.log(JSON.stringify(analysis, null, 2));

writeFileSync('direct-check-result.json', JSON.stringify(analysis, null, 2));

console.log('\nBrowser staying open for manual inspection...');
console.log('Screenshots saved. Press Ctrl+C when done.');
await wait(300000);

await browser.close();
