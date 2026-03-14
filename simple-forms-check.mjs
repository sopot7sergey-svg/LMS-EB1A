import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'fs';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

mkdirSync('screenshots', { recursive: true });

const browser = await puppeteer.launch({
  headless: false,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--no-sandbox'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });

// Login
await page.goto('http://localhost:3000/login');
await page.type('input[type="email"]', 'test@example.com');
await page.type('input[type="password"]', 'Test1234');
await page.click('button[type="submit"]');
await wait(3000);

// Go to cases
await page.goto('http://localhost:3000/case');
await wait(2000);

// Click View Case
await page.evaluate(() => {
  const links = Array.from(document.querySelectorAll('a'));
  const viewCase = links.find(l => l.textContent.includes('View Case'));
  if (viewCase) viewCase.click();
});
await wait(3000);

// Scroll to and click Forms & Fees section
await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('button'));
  const formsBtn = buttons.find(b => b.textContent.includes('Forms & Fees'));
  if (formsBtn) {
    formsBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
});
await wait(1000);

await page.screenshot({ path: 'screenshots/before-click.png', fullPage: true });

// Check if it's already open
const isOpen = await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('button'));
  const formsBtn = buttons.find(b => b.textContent.includes('Forms & Fees'));
  if (!formsBtn) return null;
  
  // Look for ChevronDown (expanded) vs ChevronRight (collapsed)
  const hasChevronDown = formsBtn.querySelector('[class*="chevron"]')?.innerHTML?.includes('chevron-down') || 
                          formsBtn.innerHTML.includes('ChevronDown');
  return { found: true, seemsOpen: hasChevronDown };
});

console.log('Forms & Fees button state:', isOpen);

// Toggle it
await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('button'));
  const formsBtn = buttons.find(b => b.textContent.includes('Forms & Fees'));
  if (formsBtn) formsBtn.click();
});
await wait(2000);

await page.screenshot({ path: 'screenshots/after-click.png', fullPage: true });

// Check for Fill buttons
const fillCheck = await page.evaluate(() => {
  const allButtons = Array.from(document.querySelectorAll('button'));
  const fillBtns = allButtons.filter(b => b.textContent.trim() === 'Fill');
  
  // Get all visible text near Forms & Fees
  const body = document.body.textContent || '';
  const hasFormI140Final = body.includes('Form I-140 (final signed PDF)');
  const hasFormI140Draft = body.includes('Form I-140 (draft / working copy)');
  const hasFormG1145 = body.includes('Form G-1145');
  const hasFormI907 = body.includes('Form I-907');
  
  return {
    fillCount: fillBtns.length,
    hasFormI140Final,
    hasFormI140Draft,
    hasFormG1145,
    hasFormI907,
    fillButtonsHTML: fillBtns.slice(0, 2).map(b => b.outerHTML)
  };
});

console.log('Fill button check:', JSON.stringify(fillCheck, null, 2));

// Keep browser open
console.log('\nBrowser will stay open. Check the screenshots and press Ctrl+C to close.');
await wait(300000); // 5 minutes

await browser.close();
