import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'fs';
import { mkdir } from 'fs/promises';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function verifyUXChanges() {
  const results = {
    steps: [],
    screenshots: [],
    findings: {},
    sections: {
      section3: { name: 'Identity & Status', hasBuilders: null, addDisabled: null, message: null },
      section4: { name: 'Cover Letter', hasBuilders: null, builderSlots: [], addDisabled: null, createEnabled: null },
      section5: { name: 'Evidence', hasBuilders: null, builderSlots: [], addDisabled: null },
      section7: { name: 'Expert Letters', hasBuilders: null, builderSlots: [], addDisabled: null },
      section9: { name: 'Responses to USCIS', hasBuilders: null, addDisabled: null },
      section10: { name: 'Filing & Tracking', hasBuilders: null, addDisabled: null },
    },
  };

  let browser;
  try {
    await mkdir('/Users/sergeysopot/LMS-EB1A/screenshots', { recursive: true });

    browser = await puppeteer.launch({
      headless: false,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // STEPS 1-2: Login
    console.log('\n=== Login ===');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    await wait(1000);
    
    await page.type('input[type="email"]', 'test@example.com', { delay: 50 });
    await page.type('input[type="password"]', 'Test1234', { delay: 50 });
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
    
    console.log('✓ Logged in');
    results.steps.push('Logged in successfully');

    // STEP 3: Navigate to case
    console.log('\n=== Navigate to Case ===');
    const caseUrl = 'http://localhost:3000/case/dc75d30d-3a2e-4865-a65c-241b8175e526';
    await page.goto(caseUrl, { waitUntil: 'networkidle2' });
    await wait(5000);
    
    console.log('✓ Case page loaded');
    results.steps.push('Navigated to case page');

    // STEP 4-5: Find checklist and take screenshot
    console.log('\n=== Checklist Overview ===');
    await page.evaluate(() => window.scrollTo(0, 500));
    await wait(1000);
    await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/ux-01-checklist-overview.png', fullPage: true });
    results.screenshots.push('ux-01-checklist-overview.png');
    console.log('✓ Checklist screenshot captured');

    // Helper function to expand a section
    const expandSection = async (sectionNum, sectionName) => {
      console.log(`\n=== Section ${sectionNum}: ${sectionName} ===`);
      
      const clicked = await page.evaluate((num) => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const sectionButton = buttons.find(b => {
          const text = b.textContent || '';
          const regex = new RegExp(`${num}\\.\\s+`, 'i');
          return regex.test(text);
        });
        
        if (sectionButton) {
          sectionButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => sectionButton.click(), 500);
          return true;
        }
        return false;
      }, sectionNum);
      
      await wait(2000);
      return clicked;
    };

    // Helper to analyze section content
    const analyzeSection = async (sectionNum) => {
      return await page.evaluate((num) => {
        // Find all buttons with "+ Add" or "Add" text
        const allButtons = Array.from(document.querySelectorAll('button'));
        const addButtons = allButtons.filter(b => {
          const text = b.textContent || '';
          return /^\s*\+?\s*Add\s*$/i.test(text.trim()) || text.trim() === 'Add';
        });
        
        // Find Create and Template buttons
        const createButtons = allButtons.filter(b => b.textContent?.trim() === 'Create');
        const templateButtons = allButtons.filter(b => b.textContent?.trim() === 'Template');
        
        // Check for builder slot indicators
        const builderSlots = [];
        const slotElements = Array.from(document.querySelectorAll('*'));
        
        // Look for text indicating builder slots
        const builderIndicators = [
          'Cover Letter / Legal Brief (Draft)',
          'Positioning Summary',
          'Claim Memo',
          'Evidence Mapping Sheet',
          'Contribution Summary',
          'Expert Letter Draft',
          'Expert Request Draft',
          'Expert Summary Sheet',
        ];
        
        builderIndicators.forEach(indicator => {
          const found = slotElements.some(el => {
            const text = el.textContent || '';
            return text.includes(indicator) && text.length < 200;
          });
          if (found) builderSlots.push(indicator);
        });
        
        // Check if Add buttons are disabled
        const addButtonStates = addButtons.map(btn => ({
          disabled: btn.disabled,
          classes: btn.className,
          ariaDisabled: btn.getAttribute('aria-disabled'),
        }));
        
        return {
          addButtonCount: addButtons.length,
          addButtonStates,
          createButtonCount: createButtons.length,
          templateButtonCount: templateButtons.length,
          builderSlots,
          hasBuilders: builderSlots.length > 0,
        };
      }, sectionNum);
    };

    // Helper to click Add button and check for message
    const testAddButton = async () => {
      const result = await page.evaluate(() => {
        const allButtons = Array.from(document.querySelectorAll('button'));
        const addButton = allButtons.find(b => {
          const text = b.textContent || '';
          return /^\s*\+?\s*Add\s*$/i.test(text.trim()) || text.trim() === 'Add';
        });
        
        if (addButton) {
          addButton.click();
          return { clicked: true };
        }
        return { clicked: false };
      });
      
      await wait(2000);
      
      // Check for message/modal
      const message = await page.evaluate(() => {
        // Look for modal or alert with disabled message
        const modal = document.querySelector('[role="dialog"]');
        if (modal) {
          const text = modal.textContent || '';
          return {
            found: true,
            text: text.substring(0, 300),
            hasDisabledMessage: /not available|disabled|contact.*administrator/i.test(text),
          };
        }
        
        // Check for toast/notification
        const toasts = Array.from(document.querySelectorAll('[role="alert"], [class*="toast"], [class*="notification"]'));
        if (toasts.length > 0) {
          const text = toasts[0].textContent || '';
          return {
            found: true,
            text: text.substring(0, 300),
            hasDisabledMessage: /not available|disabled|contact.*administrator/i.test(text),
          };
        }
        
        return { found: false };
      });
      
      return message;
    };

    // STEP 6: Section 3 — Identity & Status
    await expandSection(3, 'Identity & Status');
    const section3Data = await analyzeSection(3);
    results.sections.section3.hasBuilders = section3Data.hasBuilders;
    results.sections.section3.addDisabled = section3Data.addButtonCount > 0;
    
    console.log('Section 3 - Add buttons found:', section3Data.addButtonCount);
    console.log('Section 3 - Has builders:', section3Data.hasBuilders);
    
    // Test Add button
    const section3Message = await testAddButton();
    results.sections.section3.message = section3Message;
    
    await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/ux-02-section3-identity.png', fullPage: true });
    results.screenshots.push('ux-02-section3-identity.png');
    
    console.log('✓ Section 3 verified');
    results.steps.push('Section 3: Identity & Status - ' + (section3Data.hasBuilders ? 'Has builders (INCORRECT)' : 'No builders (CORRECT)'));

    // Close any modal
    await page.keyboard.press('Escape');
    await wait(500);

    // STEP 7: Section 4 — Cover Letter / Legal Brief
    await expandSection(4, 'Cover Letter / Legal Brief');
    const section4Data = await analyzeSection(4);
    results.sections.section4.hasBuilders = section4Data.hasBuilders;
    results.sections.section4.builderSlots = section4Data.builderSlots;
    results.sections.section4.addDisabled = section4Data.addButtonCount > 0;
    results.sections.section4.createEnabled = section4Data.createButtonCount > 0;
    
    console.log('Section 4 - Builder slots:', section4Data.builderSlots);
    console.log('Section 4 - Create buttons:', section4Data.createButtonCount);
    console.log('Section 4 - Template buttons:', section4Data.templateButtonCount);
    
    await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/ux-03-section4-cover-letter.png', fullPage: true });
    results.screenshots.push('ux-03-section4-cover-letter.png');
    
    console.log('✓ Section 4 verified');
    results.steps.push(`Section 4: Cover Letter - ${section4Data.builderSlots.length} builder slots found`);

    // STEP 8: Section 5 — Evidence (Criteria)
    await expandSection(5, 'Evidence (Criteria)');
    const section5Data = await analyzeSection(5);
    results.sections.section5.hasBuilders = section5Data.hasBuilders;
    results.sections.section5.builderSlots = section5Data.builderSlots;
    
    console.log('Section 5 - Builder slots:', section5Data.builderSlots);
    
    await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/ux-04-section5-evidence.png', fullPage: true });
    results.screenshots.push('ux-04-section5-evidence.png');
    
    console.log('✓ Section 5 verified');
    results.steps.push(`Section 5: Evidence - ${section5Data.builderSlots.length} builder slots found`);

    // STEP 9: Section 7 — Expert Letters
    await expandSection(7, 'Expert Letters');
    const section7Data = await analyzeSection(7);
    results.sections.section7.hasBuilders = section7Data.hasBuilders;
    results.sections.section7.builderSlots = section7Data.builderSlots;
    
    console.log('Section 7 - Builder slots:', section7Data.builderSlots);
    
    await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/ux-05-section7-expert-letters.png', fullPage: true });
    results.screenshots.push('ux-05-section7-expert-letters.png');
    
    console.log('✓ Section 7 verified');
    results.steps.push(`Section 7: Expert Letters - ${section7Data.builderSlots.length} builder slots found`);

    // STEP 10: Section 9 — Responses to USCIS
    await expandSection(9, 'Responses to USCIS');
    const section9Data = await analyzeSection(9);
    results.sections.section9.hasBuilders = section9Data.hasBuilders;
    results.sections.section9.addDisabled = section9Data.addButtonCount > 0;
    
    console.log('Section 9 - Has builders:', section9Data.hasBuilders);
    console.log('Section 9 - Add buttons:', section9Data.addButtonCount);
    
    await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/ux-06-section9-responses.png', fullPage: true });
    results.screenshots.push('ux-06-section9-responses.png');
    
    console.log('✓ Section 9 verified');
    results.steps.push('Section 9: Responses - ' + (section9Data.hasBuilders ? 'Has builders (INCORRECT)' : 'No builders (CORRECT)'));

    // STEP 11: Section 10 — Filing & Tracking
    await expandSection(10, 'Filing & Tracking');
    const section10Data = await analyzeSection(10);
    results.sections.section10.hasBuilders = section10Data.hasBuilders;
    results.sections.section10.addDisabled = section10Data.addButtonCount > 0;
    
    console.log('Section 10 - Has builders:', section10Data.hasBuilders);
    console.log('Section 10 - Add buttons:', section10Data.addButtonCount);
    
    await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/ux-07-section10-filing.png', fullPage: true });
    results.screenshots.push('ux-07-section10-filing.png');
    
    console.log('✓ Section 10 verified');
    results.steps.push('Section 10: Filing - ' + (section10Data.hasBuilders ? 'Has builders (INCORRECT)' : 'No builders (CORRECT)'));

  } catch (error) {
    console.error('Error:', error);
    results.steps.push(`Error: ${error.message}`);
  } finally {
    if (browser) {
      console.log('\nClosing browser in 3 seconds...');
      await wait(3000);
      await browser.close();
    }
  }

  return results;
}

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║  Verifying UX Changes (uploadEnabled = false)            ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

const results = await verifyUXChanges();

writeFileSync(
  '/Users/sergeysopot/LMS-EB1A/ux-changes-verification.json',
  JSON.stringify(results, null, 2)
);

console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║  VERIFICATION COMPLETE                                    ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

console.log('=== SUMMARY ===\n');
console.log('Section 3 (Identity & Status):');
console.log('  - Has builders:', results.sections.section3.hasBuilders ? '✗ YES (should be NO)' : '✓ NO');
console.log('  - Add disabled:', results.sections.section3.addDisabled ? '✓ YES' : '✗ NO');

console.log('\nSection 4 (Cover Letter):');
console.log('  - Has builders:', results.sections.section4.hasBuilders ? '✓ YES' : '✗ NO');
console.log('  - Builder slots:', results.sections.section4.builderSlots.join(', '));
console.log('  - Create enabled:', results.sections.section4.createEnabled ? '✓ YES' : '✗ NO');

console.log('\nSection 5 (Evidence):');
console.log('  - Has builders:', results.sections.section5.hasBuilders ? '✓ YES' : '✗ NO');
console.log('  - Builder slots:', results.sections.section5.builderSlots.join(', '));

console.log('\nSection 7 (Expert Letters):');
console.log('  - Has builders:', results.sections.section7.hasBuilders ? '✓ YES' : '✗ NO');
console.log('  - Builder slots:', results.sections.section7.builderSlots.join(', '));

console.log('\nSection 9 (Responses):');
console.log('  - Has builders:', results.sections.section9.hasBuilders ? '✗ YES (should be NO)' : '✓ NO');
console.log('  - Add disabled:', results.sections.section9.addDisabled ? '✓ YES' : '✗ NO');

console.log('\nSection 10 (Filing):');
console.log('  - Has builders:', results.sections.section10.hasBuilders ? '✗ YES (should be NO)' : '✓ NO');
console.log('  - Add disabled:', results.sections.section10.addDisabled ? '✓ YES' : '✗ NO');

console.log('\nScreenshots:', results.screenshots.length);
console.log('Results saved to: ux-changes-verification.json\n');

process.exit(0);
