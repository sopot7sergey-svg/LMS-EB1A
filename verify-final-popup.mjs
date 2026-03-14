import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'fs';
import { mkdir } from 'fs/promises';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function verifyPopupPrecise() {
  const results = {
    step9: { popupAppeared: false, popupText: null, screenshot: null },
    step16: { popupAppeared: false, popupText: null, screenshot: null },
    section3OnlyAddLinks: null,
  };

  let browser;
  try {
    await mkdir('/Users/sergeysopot/LMS-EB1A/screenshots', { recursive: true });

    browser = await puppeteer.launch({
      headless: false,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      slowMo: 200,
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Steps 1-3: Login
    console.log('\n=== Steps 1-3: Login ===');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    await wait(1000);
    
    await page.type('input[type="email"]', 'test@example.com');
    await page.type('input[type="password"]', 'Test1234');
    await page.click('button[type="submit"]');
    await wait(3000);
    
    const loginResponse = await page.evaluate(async () => {
      try {
        const response = await fetch('http://localhost:3001/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test@example.com', password: 'Test1234' }),
        });
        return await response.json();
      } catch (err) {
        return { error: err.message };
      }
    });
    
    if (loginResponse.token) {
      await page.evaluate((authData) => {
        localStorage.setItem('auth-storage', JSON.stringify({
          state: { user: authData.user, token: authData.token },
          version: 0,
        }));
      }, loginResponse);
    }
    
    await page.goto('http://localhost:3000/case/dc75d30d-3a2e-4865-a65c-241b8175e526', { waitUntil: 'networkidle2' });
    await wait(5000);
    console.log('✓ Logged in and on case page');

    // Step 4: Scroll to checklist
    console.log('\n=== Step 4: Scroll to Checklist ===');
    await page.evaluate(() => window.scrollTo(0, 500));
    await wait(1000);

    // Step 5: COLLAPSE sections 1 and 5
    console.log('\n=== Step 5: COLLAPSE Sections 1 and 5 ===');
    
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      
      // Find and collapse section 1
      const section1 = buttons.find(b => /1\.\s+Case Intake.*Profile/i.test(b.textContent || ''));
      if (section1 && section1.getAttribute('aria-expanded') === 'true') {
        console.log('Collapsing Section 1...');
        section1.click();
      }
    });
    await wait(1000);
    
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      
      // Find and collapse section 5
      const section5 = buttons.find(b => /5\.\s+Evidence/i.test(b.textContent || ''));
      if (section5 && section5.getAttribute('aria-expanded') === 'true') {
        console.log('Collapsing Section 5...');
        section5.click();
      }
    });
    await wait(1000);
    console.log('✓ Collapsed sections 1 and 5');

    // Step 6: EXPAND Section 3
    console.log('\n=== Step 6: EXPAND Section 3 ===');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const section3 = buttons.find(b => /3\.\s+Identity.*Status/i.test(b.textContent || ''));
      if (section3) {
        section3.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          if (section3.getAttribute('aria-expanded') !== 'true') {
            console.log('Expanding Section 3...');
            section3.click();
          }
        }, 500);
      }
    });
    await wait(2000);
    console.log('✓ Expanded Section 3');
    
    // Check button types in Section 3
    const section3Buttons = await page.evaluate(() => {
      // Count all visible Create and Template buttons on the page
      const allButtons = Array.from(document.querySelectorAll('button'));
      const createButtons = allButtons.filter(b => b.textContent?.trim() === 'Create' && b.offsetParent !== null);
      const templateButtons = allButtons.filter(b => b.textContent?.trim() === 'Template' && b.offsetParent !== null);
      const addLinks = allButtons.filter(b => /^\s*\+?\s*Add\s*$/i.test(b.textContent?.trim() || '') && b.offsetParent !== null);
      
      return {
        createCount: createButtons.length,
        templateCount: templateButtons.length,
        addCount: addLinks.length,
      };
    });
    
    console.log('Button counts:', section3Buttons);
    results.section3OnlyAddLinks = (section3Buttons.createCount === 0 && section3Buttons.templateCount === 0);
    console.log('Section 3 has only + Add links:', results.section3OnlyAddLinks ? '✓ YES' : '✗ NO');

    // Step 7-8: Find Passport and click + Add
    console.log('\n=== Steps 7-8: Click + Add on Passport ===');
    
    await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      const passportElement = allElements.find(el => {
        const text = el.textContent || '';
        return /passport.*biographic.*page.*scan/i.test(text) && text.length < 200;
      });
      
      if (passportElement) {
        passportElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    await wait(1500);
    
    // Click + Add
    const clickResult = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      const passportElement = allElements.find(el => {
        const text = el.textContent || '';
        return /passport.*biographic.*page.*scan/i.test(text) && text.length < 200;
      });
      
      if (!passportElement) return { found: false };
      
      let container = passportElement;
      for (let i = 0; i < 20 && container; i++) {
        container = container.parentElement;
        if (!container) break;
        
        const links = Array.from(container.querySelectorAll('button, a'));
        const addLink = links.find(l => /^\s*\+?\s*Add\s*$/i.test(l.textContent?.trim() || ''));
        
        if (addLink) {
          console.log('Found + Add link, clicking...');
          addLink.click();
          return { found: true, clicked: true };
        }
      }
      
      return { found: false };
    });
    
    console.log('Click result:', clickResult);
    
    // Step 9: Wait and check for popup
    console.log('\n=== Step 9: Check for Popup ===');
    await wait(3000); // Give popup time to appear and animate
    
    // Try multiple selectors for popup
    const popup = await page.evaluate(() => {
      // Check for Radix UI Popover
      const radixPopover = document.querySelector('[data-radix-popper-content-wrapper]');
      if (radixPopover) {
        const content = radixPopover.querySelector('[role="dialog"], [data-state="open"]');
        if (content) {
          const text = content.textContent || '';
          const rect = content.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && text.length > 10) {
            return {
              found: true,
              type: 'radix-popover',
              text: text.trim(),
              visible: true,
            };
          }
        }
      }
      
      // Check for tooltip
      const tooltips = Array.from(document.querySelectorAll('[role="tooltip"]'));
      for (const tooltip of tooltips) {
        const rect = tooltip.getBoundingClientRect();
        const text = tooltip.textContent || '';
        if (rect.width > 0 && rect.height > 0 && text.length > 10) {
          return {
            found: true,
            type: 'tooltip',
            text: text.trim(),
            visible: true,
          };
        }
      }
      
      // Check for any visible popover
      const popovers = Array.from(document.querySelectorAll('[class*="popover"], [class*="Popover"]'));
      for (const popover of popovers) {
        const rect = popover.getBoundingClientRect();
        const text = popover.textContent || '';
        if (rect.width > 0 && rect.height > 0 && text.length > 10) {
          return {
            found: true,
            type: 'popover',
            text: text.trim(),
            visible: true,
          };
        }
      }
      
      return { found: false };
    });
    
    console.log('Popup check:', popup);
    results.step9.popupAppeared = popup.found;
    results.step9.popupText = popup.text;
    
    if (popup.found) {
      console.log('✓ POPUP FOUND!');
      console.log('  Type:', popup.type);
      console.log('  Text:', popup.text);
    } else {
      console.log('✗ No popup found');
    }
    
    // Step 10: Take screenshot
    await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/final-popup-section3.png', fullPage: true });
    results.step9.screenshot = 'final-popup-section3.png';
    console.log('✓ Screenshot captured');

    // Step 11: Dismiss popup
    console.log('\n=== Step 11: Dismiss Popup ===');
    await page.evaluate(() => {
      const dismissButtons = Array.from(document.querySelectorAll('button, a'));
      const dismissBtn = dismissButtons.find(b => /dismiss/i.test(b.textContent || ''));
      if (dismissBtn) {
        console.log('Clicking Dismiss...');
        dismissBtn.click();
      }
    });
    await page.keyboard.press('Escape');
    await wait(1500);

    // Step 12: EXPAND Section 4
    console.log('\n=== Step 12: EXPAND Section 4 ===');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const section4 = buttons.find(b => /4\.\s+Cover.*Letter/i.test(b.textContent || ''));
      if (section4) {
        section4.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          if (section4.getAttribute('aria-expanded') !== 'true') {
            console.log('Expanding Section 4...');
            section4.click();
          }
        }, 500);
      }
    });
    await wait(2000);
    console.log('✓ Expanded Section 4');

    // Steps 13-15: Find Cover Letter Draft and click Add
    console.log('\n=== Steps 13-15: Click Add on Cover Letter Draft ===');
    
    await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      const coverLetterElement = allElements.find(el => {
        const text = el.textContent || '';
        return /Cover Letter.*Legal Brief.*Draft/i.test(text) && text.length < 200;
      });
      
      if (coverLetterElement) {
        coverLetterElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    await wait(1500);
    
    // Click Add button
    const clickResult4 = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      const coverLetterElement = allElements.find(el => {
        const text = el.textContent || '';
        return /Cover Letter.*Legal Brief.*Draft/i.test(text) && text.length < 200;
      });
      
      if (!coverLetterElement) return { found: false };
      
      let container = coverLetterElement;
      for (let i = 0; i < 20 && container; i++) {
        container = container.parentElement;
        if (!container) break;
        
        const buttons = Array.from(container.querySelectorAll('button'));
        const addButton = buttons.find(b => b.textContent?.trim() === 'Add');
        
        if (addButton) {
          console.log('Found Add button, clicking...');
          addButton.click();
          return { found: true, clicked: true };
        }
      }
      
      return { found: false };
    });
    
    console.log('Click result:', clickResult4);

    // Step 16: Check for popup
    console.log('\n=== Step 16: Check for Popup ===');
    await wait(3000);
    
    const popup4 = await page.evaluate(() => {
      const radixPopover = document.querySelector('[data-radix-popper-content-wrapper]');
      if (radixPopover) {
        const content = radixPopover.querySelector('[role="dialog"], [data-state="open"]');
        if (content) {
          const text = content.textContent || '';
          const rect = content.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && text.length > 10) {
            return {
              found: true,
              type: 'radix-popover',
              text: text.trim(),
              visible: true,
            };
          }
        }
      }
      
      const tooltips = Array.from(document.querySelectorAll('[role="tooltip"]'));
      for (const tooltip of tooltips) {
        const rect = tooltip.getBoundingClientRect();
        const text = tooltip.textContent || '';
        if (rect.width > 0 && rect.height > 0 && text.length > 10) {
          return {
            found: true,
            type: 'tooltip',
            text: text.trim(),
            visible: true,
          };
        }
      }
      
      const popovers = Array.from(document.querySelectorAll('[class*="popover"], [class*="Popover"]'));
      for (const popover of popovers) {
        const rect = popover.getBoundingClientRect();
        const text = popover.textContent || '';
        if (rect.width > 0 && rect.height > 0 && text.length > 10) {
          return {
            found: true,
            type: 'popover',
            text: text.trim(),
            visible: true,
          };
        }
      }
      
      return { found: false };
    });
    
    console.log('Popup check:', popup4);
    results.step16.popupAppeared = popup4.found;
    results.step16.popupText = popup4.text;
    
    if (popup4.found) {
      console.log('✓ POPUP FOUND!');
      console.log('  Type:', popup4.type);
      console.log('  Text:', popup4.text);
    } else {
      console.log('✗ No popup found');
    }

    // Step 17: Take screenshot
    await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/final-popup-section4.png', fullPage: true });
    results.step16.screenshot = 'final-popup-section4.png';
    console.log('✓ Screenshot captured');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (browser) {
      console.log('\nKeeping browser open for 5 seconds...');
      await wait(5000);
      await browser.close();
    }
  }

  return results;
}

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║  Final Popup Verification                                ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

const results = await verifyPopupPrecise();

writeFileSync(
  '/Users/sergeysopot/LMS-EB1A/final-popup-results.json',
  JSON.stringify(results, null, 2)
);

console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║  FINAL RESULTS                                            ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

console.log('QUESTION 1: Did the popup appear in Step 9 (Section 3 Passport)?');
console.log('  Answer:', results.step9.popupAppeared ? '✓ YES' : '✗ NO');
if (results.step9.popupText) {
  console.log('  Text:', results.step9.popupText);
}

console.log('\nQUESTION 2: Did the popup appear in Step 16 (Section 4 Cover Letter)?');
console.log('  Answer:', results.step16.popupAppeared ? '✓ YES' : '✗ NO');
if (results.step16.popupText) {
  console.log('  Text:', results.step16.popupText);
}

console.log('\nQUESTION 3: Were Section 3 rows showing only "+ Add" (no Create/Template)?');
console.log('  Answer:', results.section3OnlyAddLinks ? '✓ YES' : '✗ NO');

console.log('\nResults saved to: final-popup-results.json\n');

process.exit(0);
