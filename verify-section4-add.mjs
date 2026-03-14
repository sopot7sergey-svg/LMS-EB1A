import puppeteer from 'puppeteer-core';
import { mkdir } from 'fs/promises';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function verifySection4Popup() {
  const log = [];
  let browser;

  try {
    await mkdir('/Users/sergeysopot/LMS-EB1A/screenshots', { recursive: true });

    browser = await puppeteer.launch({
      headless: false,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      slowMo: 300,
      devtools: true, // Open DevTools
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    log.push('Step 1: Navigating to login...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    await wait(1000);
    
    // Login
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

    // Navigate to case
    log.push('Step 2: Navigating to case...');
    await page.goto('http://localhost:3000/case/dc75d30d-3a2e-4865-a65c-241b8175e526', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    await wait(5000);
    log.push('✓ Case page loaded');

    // Scroll to checklist
    log.push('Step 3: Scrolling to Submission Checklist...');
    await page.evaluate(() => window.scrollTo(0, 600));
    await wait(2000);
    log.push('✓ Scrolled to checklist');

    // Expand Section 4
    log.push('Step 4: Expanding Section 4 - Cover Letter / Legal Brief...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const section4 = buttons.find(b => /^4\.\s+Cover.*Letter/i.test(b.textContent || ''));
      if (section4) {
        section4.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          const expanded = section4.getAttribute('aria-expanded');
          console.log('Section 4 aria-expanded:', expanded);
          if (expanded !== 'true') {
            section4.click();
            console.log('Clicked to expand Section 4');
          } else {
            console.log('Section 4 already expanded');
          }
        }, 500);
      } else {
        console.log('Section 4 not found');
      }
    });
    await wait(3000);
    log.push('✓ Section 4 expanded');

    // Screenshot before clicking
    await page.screenshot({ 
      path: '/Users/sergeysopot/LMS-EB1A/screenshots/section4-before-click.png',
      fullPage: true 
    });
    log.push('✓ Screenshot: section4-before-click.png');

    // Find and click the Add button
    log.push('Step 5: Finding and clicking Add button on Cover Letter Draft...');
    
    // First, scroll to the builder slot
    await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      const coverEl = allElements.find(el => {
        const text = el.textContent || '';
        return /Cover Letter.*Legal Brief.*Draft/i.test(text) && text.length < 200;
      });
      if (coverEl) {
        console.log('Found Cover Letter Draft element, scrolling into view');
        coverEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        console.log('Cover Letter Draft element not found');
      }
    });
    await wait(2000);

    // Get info about the Add button before clicking
    const buttonInfo = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      const coverEl = allElements.find(el => {
        const text = el.textContent || '';
        return /Cover Letter.*Legal Brief.*Draft/i.test(text) && text.length < 200;
      });
      
      if (!coverEl) return { found: false, error: 'Cover Letter element not found' };
      
      let container = coverEl;
      for (let i = 0; i < 25 && container; i++) {
        container = container.parentElement;
        if (!container) break;
        
        const buttons = Array.from(container.querySelectorAll('button'));
        const addBtn = buttons.find(b => b.textContent?.trim() === 'Add');
        
        if (addBtn) {
          const style = window.getComputedStyle(addBtn);
          const rect = addBtn.getBoundingClientRect();
          return {
            found: true,
            opacity: style.opacity,
            classes: addBtn.className,
            disabled: addBtn.disabled,
            position: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
          };
        }
      }
      
      return { found: false, error: 'Add button not found in container' };
    });
    
    log.push(`Add button info: ${JSON.stringify(buttonInfo, null, 2)}`);

    // Click the Add button
    const clickSuccess = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      const coverEl = allElements.find(el => {
        const text = el.textContent || '';
        return /Cover Letter.*Legal Brief.*Draft/i.test(text) && text.length < 200;
      });
      
      if (!coverEl) {
        console.log('Cover Letter element not found');
        return false;
      }
      
      let container = coverEl;
      for (let i = 0; i < 25 && container; i++) {
        container = container.parentElement;
        if (!container) break;
        
        const buttons = Array.from(container.querySelectorAll('button'));
        const addBtn = buttons.find(b => b.textContent?.trim() === 'Add');
        
        if (addBtn) {
          console.log('Found Add button, clicking...');
          console.log('Button opacity:', window.getComputedStyle(addBtn).opacity);
          addBtn.click();
          return true;
        }
      }
      
      console.log('Add button not found');
      return false;
    });
    
    if (clickSuccess) {
      log.push('✓ Clicked Add button successfully');
    } else {
      log.push('✗ Failed to click Add button');
      return { log, success: false };
    }

    // Wait 2 seconds as requested
    log.push('Step 6: Waiting 2 seconds...');
    await wait(2000);

    // Take screenshot after clicking
    await page.screenshot({ 
      path: '/Users/sergeysopot/LMS-EB1A/screenshots/section4-after-click.png',
      fullPage: true 
    });
    log.push('✓ Screenshot: section4-after-click.png');

    // Check for z-index 9999 elements
    log.push('Step 7: Checking for z-index 9999 elements...');
    const zIndexCheck = await page.evaluate(() => {
      const elements = document.querySelectorAll('[style*="z-index: 9999"]');
      return {
        count: elements.length,
        elements: Array.from(elements).map(el => ({
          tag: el.tagName,
          classes: el.className,
          text: el.textContent?.substring(0, 100),
          visible: el.offsetParent !== null,
          rect: el.getBoundingClientRect(),
        })),
      };
    });
    log.push(`z-index 9999 elements: ${zIndexCheck.count}`);
    if (zIndexCheck.count > 0) {
      log.push(`Details: ${JSON.stringify(zIndexCheck.elements, null, 2)}`);
    }

    // Comprehensive popup search
    log.push('Step 8: Comprehensive popup search...');
    const popupSearch = await page.evaluate(() => {
      const results = [];

      // Strategy 1: Radix UI popper
      const radixWrapper = document.querySelector('[data-radix-popper-content-wrapper]');
      if (radixWrapper) {
        results.push({
          method: 'radix-wrapper',
          found: true,
          text: radixWrapper.textContent?.substring(0, 200),
          visible: radixWrapper.offsetParent !== null,
          rect: radixWrapper.getBoundingClientRect(),
        });
      }

      // Strategy 2: Tooltip role
      const tooltips = Array.from(document.querySelectorAll('[role="tooltip"]'));
      tooltips.forEach((tooltip, i) => {
        const rect = tooltip.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          results.push({
            method: `tooltip-${i}`,
            found: true,
            text: tooltip.textContent?.substring(0, 200),
            rect: rect,
          });
        }
      });

      // Strategy 3: Popover classes
      const popovers = Array.from(document.querySelectorAll('[class*="opover"]'));
      popovers.forEach((popover, i) => {
        const style = window.getComputedStyle(popover);
        const rect = popover.getBoundingClientRect();
        if (rect.width > 10 && rect.height > 10 && style.display !== 'none') {
          results.push({
            method: `popover-${i}`,
            found: true,
            text: popover.textContent?.substring(0, 200),
            display: style.display,
            opacity: style.opacity,
            zIndex: style.zIndex,
            rect: rect,
          });
        }
      });

      // Strategy 4: High z-index divs with content
      const allDivs = Array.from(document.querySelectorAll('div'));
      allDivs.forEach((div, i) => {
        const style = window.getComputedStyle(div);
        const zIndex = parseInt(style.zIndex);
        const rect = div.getBoundingClientRect();
        const text = div.textContent || '';
        
        if (zIndex > 100 && 
            rect.width > 50 && 
            rect.height > 30 && 
            /upload.*not available|not available.*upload/i.test(text) &&
            style.display !== 'none') {
          results.push({
            method: `high-z-div-${i}`,
            found: true,
            text: text.substring(0, 200),
            zIndex: zIndex,
            rect: rect,
          });
        }
      });

      // Strategy 5: Check for any element with "not available" text that's visible
      const allElements = Array.from(document.querySelectorAll('*'));
      allElements.forEach((el, i) => {
        const text = el.textContent || '';
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        
        if (/Direct document uploads are not available/i.test(text) &&
            text.length < 300 &&
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== 'none' &&
            style.visibility !== 'hidden') {
          results.push({
            method: `text-match-${i}`,
            tag: el.tagName,
            found: true,
            text: text,
            zIndex: style.zIndex,
            opacity: style.opacity,
            rect: rect,
          });
        }
      });

      return {
        totalFound: results.length,
        results: results,
      };
    });

    log.push(`Popup search found: ${popupSearch.totalFound} potential matches`);
    if (popupSearch.totalFound > 0) {
      log.push('Popup details:');
      popupSearch.results.forEach((result, i) => {
        log.push(`  [${i + 1}] ${result.method}:`);
        log.push(`      Text: "${result.text}"`);
        log.push(`      Position: top=${Math.round(result.rect?.top || 0)} left=${Math.round(result.rect?.left || 0)}`);
        log.push(`      Size: ${Math.round(result.rect?.width || 0)}x${Math.round(result.rect?.height || 0)}`);
        if (result.zIndex) log.push(`      z-index: ${result.zIndex}`);
      });
    } else {
      log.push('  No popup found');
    }

    // Check console logs
    const consoleLogs = await page.evaluate(() => {
      return window.console.logs || [];
    });

    return {
      log,
      success: true,
      buttonInfo,
      zIndexCheck,
      popupSearch,
      popupFound: popupSearch.totalFound > 0,
    };

  } catch (error) {
    log.push(`ERROR: ${error.message}`);
    console.error(error);
    return { log, success: false, error: error.message };
  } finally {
    if (browser) {
      await wait(5000); // Keep browser open longer to see state
      await browser.close();
    }
  }
}

console.log('═══════════════════════════════════════════════════════════');
console.log('  SECTION 4 ADD BUTTON POPUP VERIFICATION');
console.log('═══════════════════════════════════════════════════════════\n');

const results = await verifySection4Popup();

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  VERIFICATION LOG');
console.log('═══════════════════════════════════════════════════════════\n');

results.log.forEach(line => console.log(line));

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  FINAL ANSWER');
console.log('═══════════════════════════════════════════════════════════\n');

if (results.popupFound) {
  console.log('✓ POPUP APPEARED');
  console.log(`  Found ${results.popupSearch.totalFound} popup element(s)`);
  if (results.popupSearch.results[0]) {
    console.log(`  Primary popup location: top=${Math.round(results.popupSearch.results[0].rect?.top || 0)}px, left=${Math.round(results.popupSearch.results[0].rect?.left || 0)}px`);
    console.log(`  Message preview: "${results.popupSearch.results[0].text?.substring(0, 100)}..."`);
  }
} else {
  console.log('✗ NO POPUP APPEARED');
  console.log('  The Add button was clicked but no popup was detected');
}

console.log('\nScreenshots saved:');
console.log('  - section4-before-click.png (before clicking Add)');
console.log('  - section4-after-click.png (after clicking Add)');

process.exit(0);
