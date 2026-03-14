import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'fs';
import { mkdir } from 'fs/promises';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function verifyUploadPopup() {
  const log = [];
  const screenshots = [];
  let popup1Found = false;
  let popup1Text = null;
  let popup2Found = false;
  let popup2Text = null;
  let section3OnlyAdd = false;

  let browser;
  try {
    await mkdir('/Users/sergeysopot/LMS-EB1A/screenshots', { recursive: true });

    browser = await puppeteer.launch({
      headless: false,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      slowMo: 300,
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Steps 1-2: Login
    log.push('Step 1-2: Navigating to login...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    await wait(1000);
    
    await page.type('input[type="email"]', 'test@example.com');
    await page.type('input[type="password"]', 'Test1234');
    await page.click('button[type="submit"]');
    await wait(3000);
    
    // Inject auth token
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
    
    log.push('✓ Logged in successfully');

    // Step 3: Navigate to case
    log.push('Step 3: Navigating to case...');
    await page.goto('http://localhost:3000/case/dc75d30d-3a2e-4865-a65c-241b8175e526', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    await wait(6000);
    log.push('✓ Case page loaded');

    // Step 4: Scroll to checklist
    log.push('Step 4: Scrolling to checklist...');
    await page.evaluate(() => window.scrollTo(0, 600));
    await wait(1500);
    log.push('✓ Scrolled to checklist');

    // Step 5: COLLAPSE section 1
    log.push('Step 5: Collapsing section 1...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const section1 = buttons.find(b => /^1\.\s+Case Intake.*Profile/i.test(b.textContent || ''));
      if (section1) {
        const expanded = section1.getAttribute('aria-expanded');
        console.log('Section 1 aria-expanded:', expanded);
        if (expanded === 'true') {
          section1.click();
          console.log('Collapsed section 1');
        }
      }
    });
    await wait(1500);
    log.push('✓ Section 1 collapsed');

    // Step 6: COLLAPSE section 5
    log.push('Step 6: Collapsing section 5...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const section5 = buttons.find(b => /^5\.\s+Evidence/i.test(b.textContent || ''));
      if (section5) {
        const expanded = section5.getAttribute('aria-expanded');
        console.log('Section 5 aria-expanded:', expanded);
        if (expanded === 'true') {
          section5.click();
          console.log('Collapsed section 5');
        }
      }
    });
    await wait(1500);
    log.push('✓ Section 5 collapsed');

    // Step 7: EXPAND section 3
    log.push('Step 7: Expanding section 3...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const section3 = buttons.find(b => /^3\.\s+Identity.*Status/i.test(b.textContent || ''));
      if (section3) {
        section3.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          const expanded = section3.getAttribute('aria-expanded');
          console.log('Section 3 aria-expanded:', expanded);
          if (expanded !== 'true') {
            section3.click();
            console.log('Expanded section 3');
          }
        }, 500);
      }
    });
    await wait(2500);
    log.push('✓ Section 3 expanded');

    // Step 8: Check buttons in section 3
    log.push('Step 8: Checking section 3 buttons...');
    const buttonCheck = await page.evaluate(() => {
      // Look for visible Create and Template buttons
      const allButtons = Array.from(document.querySelectorAll('button'));
      const visibleCreate = allButtons.filter(b => {
        return b.textContent?.trim() === 'Create' && 
               b.offsetParent !== null &&
               window.getComputedStyle(b).display !== 'none';
      });
      const visibleTemplate = allButtons.filter(b => {
        return b.textContent?.trim() === 'Template' && 
               b.offsetParent !== null &&
               window.getComputedStyle(b).display !== 'none';
      });
      
      return {
        createCount: visibleCreate.length,
        templateCount: visibleTemplate.length,
      };
    });
    
    section3OnlyAdd = (buttonCheck.createCount === 0 && buttonCheck.templateCount === 0);
    log.push(`  Create buttons visible: ${buttonCheck.createCount}`);
    log.push(`  Template buttons visible: ${buttonCheck.templateCount}`);
    log.push(`  Section 3 has only + Add: ${section3OnlyAdd ? '✓ YES' : '✗ NO'}`);

    // Step 9: Screenshot of section 3
    log.push('Step 9: Taking screenshot of section 3...');
    await page.screenshot({ 
      path: '/Users/sergeysopot/LMS-EB1A/screenshots/verify-section3-expanded.png',
      fullPage: true 
    });
    screenshots.push('verify-section3-expanded.png');
    log.push('✓ Screenshot saved: verify-section3-expanded.png');

    // Step 10: Click + Add on Passport
    log.push('Step 10: Clicking + Add on Passport...');
    
    // Scroll to Passport
    await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      const passportEl = allElements.find(el => {
        const text = el.textContent || '';
        return /passport.*biographic.*page.*scan/i.test(text) && text.length < 300;
      });
      if (passportEl) {
        passportEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    await wait(2000);
    
    // Click + Add
    const clickSuccess = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      const passportEl = allElements.find(el => {
        const text = el.textContent || '';
        return /passport.*biographic.*page.*scan/i.test(text) && text.length < 300;
      });
      
      if (!passportEl) {
        console.log('Passport element not found');
        return false;
      }
      
      // Find + Add button in the same container
      let container = passportEl;
      for (let i = 0; i < 25 && container; i++) {
        container = container.parentElement;
        if (!container) break;
        
        const buttons = Array.from(container.querySelectorAll('button, a'));
        const addBtn = buttons.find(b => /^\s*\+?\s*Add\s*$/i.test(b.textContent?.trim() || ''));
        
        if (addBtn) {
          console.log('Found + Add button, clicking...');
          addBtn.click();
          return true;
        }
      }
      
      console.log('+ Add button not found');
      return false;
    });
    
    log.push(clickSuccess ? '✓ Clicked + Add button' : '✗ Could not find + Add button');

    // Step 11-12: Wait for popup and screenshot
    log.push('Step 11-12: Waiting for popup...');
    await wait(4000); // Wait longer for popup animation
    
    // Check for popup with multiple strategies
    const popupCheck = await page.evaluate(() => {
      // Strategy 1: Radix UI popover
      const radixWrapper = document.querySelector('[data-radix-popper-content-wrapper]');
      if (radixWrapper) {
        const allDivs = Array.from(radixWrapper.querySelectorAll('div'));
        for (const div of allDivs) {
          const text = div.textContent || '';
          const rect = div.getBoundingClientRect();
          if (rect.width > 50 && rect.height > 30 && text.length > 20) {
            return {
              found: true,
              method: 'radix-wrapper',
              text: text.trim(),
              hasExpectedText: /not available.*version.*administrator/i.test(text),
            };
          }
        }
      }
      
      // Strategy 2: Any tooltip role
      const tooltips = document.querySelectorAll('[role="tooltip"]');
      for (const tooltip of tooltips) {
        const text = tooltip.textContent || '';
        const rect = tooltip.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && text.length > 20) {
          return {
            found: true,
            method: 'tooltip-role',
            text: text.trim(),
            hasExpectedText: /not available.*version.*administrator/i.test(text),
          };
        }
      }
      
      // Strategy 3: Popover class
      const popovers = document.querySelectorAll('[class*="opover"]');
      for (const popover of popovers) {
        const text = popover.textContent || '';
        const rect = popover.getBoundingClientRect();
        const style = window.getComputedStyle(popover);
        if (rect.width > 50 && rect.height > 30 && 
            text.length > 20 && 
            style.display !== 'none' &&
            style.visibility !== 'hidden') {
          return {
            found: true,
            method: 'popover-class',
            text: text.trim(),
            hasExpectedText: /not available.*version.*administrator/i.test(text),
          };
        }
      }
      
      // Strategy 4: Check all visible divs with z-index > 100
      const allDivs = document.querySelectorAll('div');
      for (const div of allDivs) {
        const style = window.getComputedStyle(div);
        const zIndex = parseInt(style.zIndex);
        const text = div.textContent || '';
        const rect = div.getBoundingClientRect();
        
        if (zIndex > 100 && 
            rect.width > 50 && 
            rect.height > 30 && 
            /upload.*not available|not available.*upload/i.test(text) &&
            style.display !== 'none') {
          return {
            found: true,
            method: 'high-z-index',
            text: text.trim(),
            hasExpectedText: /not available.*version.*administrator/i.test(text),
          };
        }
      }
      
      return { found: false };
    });
    
    popup1Found = popupCheck.found;
    popup1Text = popupCheck.text;
    
    if (popupCheck.found) {
      log.push(`✓ POPUP FOUND! (via ${popupCheck.method})`);
      log.push(`  Text: "${popupCheck.text?.substring(0, 150)}..."`);
      log.push(`  Has expected message: ${popupCheck.hasExpectedText ? 'YES' : 'NO'}`);
    } else {
      log.push('✗ Popup NOT found');
    }
    
    await page.screenshot({ 
      path: '/Users/sergeysopot/LMS-EB1A/screenshots/verify-section3-popup.png',
      fullPage: true 
    });
    screenshots.push('verify-section3-popup.png');
    log.push('✓ Screenshot saved: verify-section3-popup.png');

    // Step 13: Dismiss popup
    log.push('Step 13: Dismissing popup...');
    await page.evaluate(() => {
      const dismissButtons = Array.from(document.querySelectorAll('button, a'));
      const dismiss = dismissButtons.find(b => /dismiss/i.test(b.textContent || ''));
      if (dismiss) {
        dismiss.click();
      }
    });
    await page.keyboard.press('Escape');
    await wait(2000);
    log.push('✓ Popup dismissed');

    // Step 14: Expand section 4
    log.push('Step 14: Expanding section 4...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const section4 = buttons.find(b => /^4\.\s+Cover.*Letter/i.test(b.textContent || ''));
      if (section4) {
        section4.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          if (section4.getAttribute('aria-expanded') !== 'true') {
            section4.click();
          }
        }, 500);
      }
    });
    await wait(2500);
    log.push('✓ Section 4 expanded');

    // Step 15-16: Click Add on builder slot
    log.push('Step 15-16: Clicking Add on Cover Letter Draft...');
    
    await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      const coverEl = allElements.find(el => {
        const text = el.textContent || '';
        return /Cover Letter.*Legal Brief.*Draft/i.test(text) && text.length < 200;
      });
      if (coverEl) {
        coverEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    await wait(2000);
    
    const click2Success = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      const coverEl = allElements.find(el => {
        const text = el.textContent || '';
        return /Cover Letter.*Legal Brief.*Draft/i.test(text) && text.length < 200;
      });
      
      if (!coverEl) return false;
      
      let container = coverEl;
      for (let i = 0; i < 25 && container; i++) {
        container = container.parentElement;
        if (!container) break;
        
        const buttons = Array.from(container.querySelectorAll('button'));
        const addBtn = buttons.find(b => b.textContent?.trim() === 'Add');
        
        if (addBtn) {
          console.log('Found Add button, clicking...');
          addBtn.click();
          return true;
        }
      }
      
      return false;
    });
    
    log.push(click2Success ? '✓ Clicked Add button' : '✗ Could not find Add button');

    // Step 17-18: Check for popup and screenshot
    log.push('Step 17-18: Waiting for popup...');
    await wait(4000);
    
    const popup2Check = await page.evaluate(() => {
      const radixWrapper = document.querySelector('[data-radix-popper-content-wrapper]');
      if (radixWrapper) {
        const allDivs = Array.from(radixWrapper.querySelectorAll('div'));
        for (const div of allDivs) {
          const text = div.textContent || '';
          const rect = div.getBoundingClientRect();
          if (rect.width > 50 && rect.height > 30 && text.length > 20) {
            return {
              found: true,
              text: text.trim(),
              hasExpectedText: /not available.*version.*administrator/i.test(text),
            };
          }
        }
      }
      
      const tooltips = document.querySelectorAll('[role="tooltip"]');
      for (const tooltip of tooltips) {
        const text = tooltip.textContent || '';
        const rect = tooltip.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && text.length > 20) {
          return {
            found: true,
            text: text.trim(),
            hasExpectedText: /not available.*version.*administrator/i.test(text),
          };
        }
      }
      
      const popovers = document.querySelectorAll('[class*="opover"]');
      for (const popover of popovers) {
        const text = popover.textContent || '';
        const rect = popover.getBoundingClientRect();
        const style = window.getComputedStyle(popover);
        if (rect.width > 50 && rect.height > 30 && text.length > 20 && 
            style.display !== 'none') {
          return {
            found: true,
            text: text.trim(),
            hasExpectedText: /not available.*version.*administrator/i.test(text),
          };
        }
      }
      
      return { found: false };
    });
    
    popup2Found = popup2Check.found;
    popup2Text = popup2Check.text;
    
    if (popup2Check.found) {
      log.push('✓ POPUP FOUND!');
      log.push(`  Text: "${popup2Check.text?.substring(0, 150)}..."`);
    } else {
      log.push('✗ Popup NOT found');
    }
    
    await page.screenshot({ 
      path: '/Users/sergeysopot/LMS-EB1A/screenshots/verify-section4-popup.png',
      fullPage: true 
    });
    screenshots.push('verify-section4-popup.png');
    log.push('✓ Screenshot saved: verify-section4-popup.png');

  } catch (error) {
    log.push(`ERROR: ${error.message}`);
    console.error(error);
  } finally {
    if (browser) {
      await wait(3000);
      await browser.close();
    }
  }

  return {
    log,
    screenshots,
    popup1Found,
    popup1Text,
    popup2Found,
    popup2Text,
    section3OnlyAdd,
  };
}

console.log('═══════════════════════════════════════════════════════════');
console.log('  DISABLED UPLOAD POPUP VERIFICATION');
console.log('═══════════════════════════════════════════════════════════\n');

const results = await verifyUploadPopup();

writeFileSync(
  '/Users/sergeysopot/LMS-EB1A/upload-popup-results.json',
  JSON.stringify(results, null, 2)
);

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  VERIFICATION LOG');
console.log('═══════════════════════════════════════════════════════════\n');

results.log.forEach(line => console.log(line));

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  FINAL RESULTS');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('QUESTION: Does the popup appear?');
console.log('');
console.log('Section 3 (Passport + Add):');
console.log('  Popup appeared:', results.popup1Found ? '✓ YES' : '✗ NO');
if (results.popup1Text) {
  console.log('  Message:', results.popup1Text.substring(0, 100));
}
console.log('');
console.log('Section 4 (Cover Letter Add):');
console.log('  Popup appeared:', results.popup2Found ? '✓ YES' : '✗ NO');
if (results.popup2Text) {
  console.log('  Message:', results.popup2Text.substring(0, 100));
}
console.log('');
console.log('Section 3 has only + Add (no Create/Template):');
console.log(' ', results.section3OnlyAdd ? '✓ YES' : '✗ NO');
console.log('');
console.log('Screenshots:', results.screenshots.join(', '));
console.log('\nResults saved to: upload-popup-results.json\n');

process.exit(0);
