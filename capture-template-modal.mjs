import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'fs';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

mkdirSync('screenshots', { recursive: true });

const browser = await puppeteer.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--no-sandbox'],
  defaultViewport: { width: 1920, height: 1080 },
});

const page = await browser.newPage();

// Login
await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
await page.type('input[type="email"]', 'test@example.com');
await page.type('input[type="password"]', 'Test1234');
await page.click('button[type="submit"]');
await wait(3000);

// Navigate to case
await page.goto('http://localhost:3000/case/dc75d30d-3a2e-4865-a65c-241b8175e526', { 
  waitUntil: 'networkidle2' 
});
await wait(2000);

// Expand Forms & Fees
await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('button'));
  const formsBtn = buttons.find(b => b.textContent && b.textContent.includes('2. Forms & Fees'));
  if (formsBtn) {
    formsBtn.scrollIntoView({ block: 'center' });
    formsBtn.click();
  }
});
await wait(2000);

console.log('Testing Template button...');

// Click Template button
const clicked = await page.evaluate(() => {
  const allButtons = Array.from(document.querySelectorAll('button'));
  const fillBtn = allButtons.find(b => b.textContent?.trim() === 'Fill');
  
  if (fillBtn && fillBtn.parentElement) {
    const siblingButtons = Array.from(fillBtn.parentElement.querySelectorAll('button'));
    const templateBtn = siblingButtons.find(b => b.textContent?.trim() === 'Template');
    if (templateBtn) {
      templateBtn.click();
      return true;
    }
  }
  return false;
});

console.log('Template button clicked:', clicked);

// Wait longer for modal
await wait(3000);

// Take screenshot immediately
await page.screenshot({ path: 'screenshots/template-modal-captured.png', fullPage: true });

// Check modal content
const modalInfo = await page.evaluate(() => {
  const modal = document.querySelector('[role="dialog"]');
  if (!modal) return { opened: false };

  const text = modal.textContent || '';
  const html = modal.innerHTML;

  return {
    opened: true,
    fullText: text,
    hasWhatItIs: /what this.*is/i.test(text),
    hasWhyItMatters: /why.*matters/i.test(text),
    hasPurpose: text.toLowerCase().includes('purpose'),
    hasDownload: text.toLowerCase().includes('download') || html.includes('href'),
    hasUSCIS: text.includes('USCIS'),
    textLength: text.length,
    textPreview: text.substring(0, 600),
  };
});

console.log('\n=== TEMPLATE MODAL INFO ===');
console.log(JSON.stringify(modalInfo, null, 2));

await browser.close();
