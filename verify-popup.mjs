import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'fs';
import { mkdir } from 'fs/promises';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function verifyDisabledAddPopup() {
  const results = {
    section3: {
      onlyAddLinks: null,
      popupAppeared: false,
      popupText: null,
      screenshot: null,
    },
    section4: {
      hasThreeButtons: null,
      addButtonDimmed: null,
      createActive: null,
      templateActive: null,
      popupAppeared: false,
      popupText: null,
      screenshot: null,
    },
    screenshots: [],
    stepLog: [],
  };

  let browser;
  try {
    await mkdir('/Users/sergeysopot/LMS-EB1A/screenshots', { recursive: true });

    browser = await puppeteer.launch({
      headless: false,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      slowMo: 100, // Slow down to observe
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Login
    console.log('\n=== STEP 1-3: Login and Navigate ===');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    await wait(1000);
    
    await page.type('input[type="email"]', 'test@example.com', { delay: 50 });
    await page.type('input[type="password"]', 'Test1234', { delay: 50 });
    await page.click('button[type="submit"]');
    await wait(3000);
    
    // Inject auth
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
    
    const caseUrl = 'http://localhost:3000/case/dc75d30d-3a2e-4865-a65c-241b8175e526';
    await page.goto(caseUrl, { waitUntil: 'networkidle2' });
    await wait(5000);
    
    console.log('✓ Logged in and on case page');
    results.stepLog.push('Logged in and navigated to case');

    // STEP 4: Scroll to checklist
    console.log('\n=== STEP 4: Scroll to Checklist ===');
    await page.evaluate(() => window.scrollTo(0, 500));
    await wait(1000);
    
    // STEP 5: Close all open sections
    console.log('\n=== STEP 5: Close Open Sections ===');
    await page.evaluate(() => {
      const allButtons = Array.from(document.querySelectorAll('button'));
      const sectionButtons = allButtons.filter(b => {
        const text = b.textContent || '';
        return /^\d+\.\s+/.test(text) && b.getAttribute('aria-expanded') === 'true';
      });
      
      console.log('Closing', sectionButtons.length, 'open sections');
      sectionButtons.forEach(btn => btn.click());
    });
    await wait(1500);
    results.stepLog.push('Closed all open sections');

    // STEP 6-7: Expand Section 3 and verify + Add links only
    console.log('\n=== STEP 6-7: Section 3 - Expand and Verify ===');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const section3 = buttons.find(b => /3\.\s+Identity.*Status/i.test(b.textContent || ''));
      if (section3) {
        section3.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => section3.click(), 500);
      }
    });
    await wait(2000);
    
    // Analyze Section 3 slots
    const section3Analysis = await page.evaluate(() => {
      // Find first few visible document slots
      const allElements = Array.from(document.querySelectorAll('*'));
      
      // Count different button types
      const allButtons = Array.from(document.querySelectorAll('button'));
      const addLinks = allButtons.filter(b => {
        const text = b.textContent || '';
        return /^\s*\+?\s*Add\s*$/i.test(text.trim());
      });
      
      const createButtons = allButtons.filter(b => b.textContent?.trim() === 'Create');
      const templateButtons = allButtons.filter(b => b.textContent?.trim() === 'Template');
      
      // Try to find the structure more specifically
      // Look for a pattern: document name followed by buttons
      let slotsWithButtons = [];
      
      return {
        addLinkCount: addLinks.length,
        createButtonCount: createButtons.length,
        templateButtonCount: templateButtons.length,
        onlyHasAddLinks: addLinks.length > 0 && createButtons.length === 0 && templateButtons.length === 0,
      };
    });
    
    console.log('Section 3 analysis:', section3Analysis);
    results.section3.onlyAddLinks = section3Analysis.onlyHasAddLinks;
    results.stepLog.push(`Section 3 expanded - Only + Add links: ${section3Analysis.onlyHasAddLinks ? 'YES ✓' : 'NO ✗'}`);
    results.stepLog.push(`  + Add: ${section3Analysis.addLinkCount}, Create: ${section3Analysis.createButtonCount}, Template: ${section3Analysis.templateButtonCount}`);
    
    await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/popup-01-section3-expanded.png', fullPage: true });
    results.screenshots.push('popup-01-section3-expanded.png');

    // STEP 8: Click + Add on first slot
    console.log('\n=== STEP 8: Click + Add on Passport ===');
    await page.evaluate(() => {
      // Find Passport element
      const allElements = Array.from(document.querySelectorAll('*'));
      const passportElement = allElements.find(el => {
        const text = el.textContent || '';
        return /passport.*biographic/i.test(text) && text.length < 200;
      });
      
      if (passportElement) {
        console.log('Found Passport element');
        passportElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    await wait(1000);
    
    // Click the + Add button
    const section3ClickResult = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      const passportElement = allElements.find(el => {
        const text = el.textContent || '';
        return /passport.*biographic/i.test(text) && text.length < 200;
      });
      
      if (!passportElement) {
        return { found: false, reason: 'Passport not found' };
      }
      
      // Find + Add button near this element
      let container = passportElement;
      for (let i = 0; i < 15 && container; i++) {
        container = container.parentElement;
        if (!container) break;
        
        const buttons = Array.from(container.querySelectorAll('button, a'));
        const addButton = buttons.find(b => {
          const text = b.textContent || '';
          return /^\s*\+?\s*Add\s*$/i.test(text.trim());
        });
        
        if (addButton) {
          console.log('Clicking + Add button...');
          addButton.click();
          return { found: true, clicked: true };
        }
      }
      
      return { found: false, reason: 'Add button not found' };
    });
    
    console.log('Click result:', section3ClickResult);
    
    // STEP 9: Wait and check for popup
    console.log('\n=== STEP 9: Check for Popup Message ===');
    await wait(2000); // Give popup time to appear
    
    const section3Popup = await page.evaluate(() => {
      // Check for popover/tooltip near the button
      const popovers = Array.from(document.querySelectorAll('[role="tooltip"], [data-radix-popper-content-wrapper], [class*="Popover"], [class*="popover"]'));
      
      for (const popover of popovers) {
        const text = popover.textContent || '';
        if (text.length > 10) { // Has some content
          const rect = popover.getBoundingClientRect();
          return {
            found: true,
            text: text.trim(),
            hasDisabledMessage: /not available|upload|administrator/i.test(text),
            visible: rect.width > 0 && rect.height > 0,
          };
        }
      }
      
      // Check for modal
      const modal = document.querySelector('[role="dialog"]');
      if (modal) {
        const text = modal.textContent || '';
        return {
          found: true,
          text: text.substring(0, 500),
          hasDisabledMessage: /not available|upload|administrator/i.test(text),
          visible: true,
        };
      }
      
      return { found: false };
    });
    
    console.log('Section 3 popup:', section3Popup);
    results.section3.popupAppeared = section3Popup.found;
    results.section3.popupText = section3Popup.text;
    
    if (section3Popup.found) {
      console.log('✓ POPUP APPEARED!');
      console.log('  Text:', section3Popup.text?.substring(0, 150));
      results.stepLog.push('Section 3 popup appeared ✓');
      results.stepLog.push(`  Message: "${section3Popup.text?.substring(0, 100)}..."`);
    } else {
      console.log('✗ No popup found');
      results.stepLog.push('Section 3 popup NOT found ✗');
    }
    
    // STEP 10: Take screenshot with popup
    await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/popup-02-section3-with-popup.png', fullPage: true });
    results.screenshots.push('popup-02-section3-with-popup.png');
    results.section3.screenshot = 'popup-02-section3-with-popup.png';

    // STEP 11: Dismiss popup
    console.log('\n=== STEP 11: Dismiss Popup ===');
    await page.evaluate(() => {
      // Look for Dismiss button/link
      const allButtons = Array.from(document.querySelectorAll('button, a'));
      const dismissButton = allButtons.find(b => /dismiss/i.test(b.textContent || ''));
      if (dismissButton) {
        console.log('Clicking Dismiss...');
        dismissButton.click();
      } else {
        // Try pressing Escape
        console.log('No Dismiss found, will use Escape');
      }
    });
    await page.keyboard.press('Escape');
    await wait(1000);

    // STEP 12: Expand Section 4
    console.log('\n=== STEP 12: Expand Section 4 ===');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const section4 = buttons.find(b => /4\.\s+Cover.*Letter/i.test(b.textContent || ''));
      if (section4) {
        section4.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => section4.click(), 500);
      }
    });
    await wait(2000);

    // STEP 13-14: Analyze Cover Letter Draft slot
    console.log('\n=== STEP 13-14: Analyze Builder Slot and Click Add ===');
    
    const section4Analysis = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      const coverLetterElement = allElements.find(el => {
        const text = el.textContent || '';
        return /Cover Letter.*Legal Brief.*Draft/i.test(text) && text.length < 150;
      });
      
      if (!coverLetterElement) {
        return { found: false };
      }
      
      // Find the button container
      let container = coverLetterElement;
      for (let i = 0; i < 15 && container; i++) {
        container = container.parentElement;
        if (!container) break;
        
        const buttons = Array.from(container.querySelectorAll('button'));
        const addButton = buttons.find(b => b.textContent?.trim() === 'Add');
        const createButton = buttons.find(b => b.textContent?.trim() === 'Create');
        const templateButton = buttons.find(b => b.textContent?.trim() === 'Template');
        
        if (addButton || createButton || templateButton) {
          const getButtonState = (btn) => {
            if (!btn) return null;
            const style = window.getComputedStyle(btn);
            return {
              disabled: btn.disabled,
              opacity: style.opacity,
              cursor: style.cursor,
            };
          };
          
          return {
            found: true,
            hasAdd: !!addButton,
            hasCreate: !!createButton,
            hasTemplate: !!templateButton,
            hasAllThree: !!addButton && !!createButton && !!templateButton,
            addState: getButtonState(addButton),
            createState: getButtonState(createButton),
            templateState: getButtonState(templateButton),
          };
        }
      }
      
      return { found: false };
    });
    
    console.log('Section 4 builder slot analysis:', section4Analysis);
    results.section4.hasThreeButtons = section4Analysis.hasAllThree;
    results.section4.addButtonDimmed = section4Analysis.addState?.opacity < 1;
    results.section4.createActive = section4Analysis.createState?.opacity >= 0.9;
    results.section4.templateActive = section4Analysis.templateState?.opacity >= 0.9;
    
    results.stepLog.push(`Section 4 builder slot analysis:`);
    results.stepLog.push(`  Has all 3 buttons: ${section4Analysis.hasAllThree ? 'YES ✓' : 'NO ✗'}`);
    results.stepLog.push(`  Add dimmed: ${results.section4.addButtonDimmed ? 'YES ✓' : 'NO ✗'} (opacity: ${section4Analysis.addState?.opacity})`);
    results.stepLog.push(`  Create active: ${results.section4.createActive ? 'YES ✓' : 'NO ✗'} (opacity: ${section4Analysis.createState?.opacity})`);
    results.stepLog.push(`  Template active: ${results.section4.templateActive ? 'YES ✓' : 'NO ✗'} (opacity: ${section4Analysis.templateState?.opacity})`);
    
    await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/popup-03-section4-builder-slot.png', fullPage: true });
    results.screenshots.push('popup-03-section4-builder-slot.png');
    
    // Click Add button
    console.log('\n=== STEP 15: Click Add on Builder Slot ===');
    await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      const coverLetterElement = allElements.find(el => {
        const text = el.textContent || '';
        return /Cover Letter.*Legal Brief.*Draft/i.test(text) && text.length < 150;
      });
      
      if (coverLetterElement) {
        let container = coverLetterElement;
        for (let i = 0; i < 15 && container; i++) {
          container = container.parentElement;
          if (!container) break;
          
          const buttons = Array.from(container.querySelectorAll('button'));
          const addButton = buttons.find(b => b.textContent?.trim() === 'Add');
          
          if (addButton) {
            console.log('Clicking Add button on builder slot...');
            addButton.click();
            return;
          }
        }
      }
    });
    
    await wait(2000);
    
    // STEP 16: Check for popup
    console.log('\n=== STEP 16: Check for Popup on Builder Slot ===');
    
    const section4Popup = await page.evaluate(() => {
      const popovers = Array.from(document.querySelectorAll('[role="tooltip"], [data-radix-popper-content-wrapper], [class*="Popover"], [class*="popover"]'));
      
      for (const popover of popovers) {
        const text = popover.textContent || '';
        if (text.length > 10) {
          const rect = popover.getBoundingClientRect();
          return {
            found: true,
            text: text.trim(),
            hasDisabledMessage: /not available|upload|administrator/i.test(text),
            visible: rect.width > 0 && rect.height > 0,
          };
        }
      }
      
      const modal = document.querySelector('[role="dialog"]');
      if (modal) {
        const text = modal.textContent || '';
        return {
          found: true,
          text: text.substring(0, 500),
          hasDisabledMessage: /not available|upload|administrator/i.test(text),
          visible: true,
        };
      }
      
      return { found: false };
    });
    
    console.log('Section 4 popup:', section4Popup);
    results.section4.popupAppeared = section4Popup.found;
    results.section4.popupText = section4Popup.text;
    
    if (section4Popup.found) {
      console.log('✓ POPUP APPEARED!');
      console.log('  Text:', section4Popup.text?.substring(0, 150));
      results.stepLog.push('Section 4 popup appeared ✓');
      results.stepLog.push(`  Message: "${section4Popup.text?.substring(0, 100)}..."`);
    } else {
      console.log('✗ No popup found');
      results.stepLog.push('Section 4 popup NOT found ✗');
    }
    
    await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/popup-04-section4-with-popup.png', fullPage: true });
    results.screenshots.push('popup-04-section4-with-popup.png');
    results.section4.screenshot = 'popup-04-section4-with-popup.png';

    // STEP 17: Verify Create/Template are active
    console.log('\n=== STEP 17: Final Verification ===');
    results.stepLog.push('Final verification complete');

  } catch (error) {
    console.error('Error:', error);
    results.stepLog.push(`Error: ${error.message}`);
  } finally {
    if (browser) {
      console.log('\nKeeping browser open for 5 seconds for observation...');
      await wait(5000);
      await browser.close();
    }
  }

  return results;
}

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║  Verifying Disabled Add Button Popup                     ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

const results = await verifyDisabledAddPopup();

writeFileSync(
  '/Users/sergeysopot/LMS-EB1A/popup-verification.json',
  JSON.stringify(results, null, 2)
);

console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║  VERIFICATION COMPLETE                                    ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

console.log('=== FINAL RESULTS ===\n');

console.log('SECTION 3 (Identity & Status):');
console.log('  Shows only + Add links:', results.section3.onlyAddLinks ? '✓ YES' : '✗ NO (has Create/Template)');
console.log('  Popup appeared:', results.section3.popupAppeared ? '✓ YES' : '✗ NO');
if (results.section3.popupText) {
  console.log('  Popup says:', results.section3.popupText.substring(0, 100));
}

console.log('\nSECTION 4 (Cover Letter - Builder Slot):');
console.log('  Has Add, Create, Template:', results.section4.hasThreeButtons ? '✓ YES' : '✗ NO');
console.log('  Add button dimmed:', results.section4.addButtonDimmed ? '✓ YES' : '✗ NO');
console.log('  Create button active:', results.section4.createActive ? '✓ YES' : '✗ NO');
console.log('  Template button active:', results.section4.templateActive ? '✓ YES' : '✗ NO');
console.log('  Popup appeared:', results.section4.popupAppeared ? '✓ YES' : '✗ NO');
if (results.section4.popupText) {
  console.log('  Popup says:', results.section4.popupText.substring(0, 100));
}

console.log('\n=== STEP LOG ===');
results.stepLog.forEach((log, i) => console.log(`${i + 1}. ${log}`));

console.log('\nScreenshots:', results.screenshots.length);
console.log('Results saved to: popup-verification.json\n');

process.exit(0);
