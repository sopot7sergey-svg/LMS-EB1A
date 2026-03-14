import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'fs';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function verifyFormsAndFees() {
  mkdirSync('screenshots', { recursive: true });

  const results = {
    loginSuccess: false,
    pageReached: null,
    formsFeesFound: false,
    fillButtonBehavior: null,
    templateButtonBehavior: null,
    addButtonBehavior: null,
    consoleErrors: [],
  };

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox'],
    defaultViewport: { width: 1920, height: 1080 },
  });

  try {
    const page = await browser.newPage();

    page.on('console', msg => {
      if (msg.type() === 'error') {
        results.consoleErrors.push({ type: 'console.error', text: msg.text() });
      }
    });

    page.on('pageerror', error => {
      results.consoleErrors.push({ type: 'pageerror', text: error.message });
    });

    // 1. Login
    console.log('1. Logging in...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    await page.type('input[type="email"]', 'test@example.com');
    await page.type('input[type="password"]', 'Test1234');
    await page.click('button[type="submit"]');
    await wait(3000);

    results.loginSuccess = !page.url().includes('/login');
    results.pageReached = page.url();
    console.log('   Login success:', results.loginSuccess);

    // 2. Navigate to case workspace
    console.log('2. Navigating to case workspace...');
    await page.goto('http://localhost:3000/case/dc75d30d-3a2e-4865-a65c-241b8175e526', { 
      waitUntil: 'networkidle2' 
    });
    await wait(2000);
    results.pageReached = page.url();
    console.log('   Reached:', results.pageReached);

    // 3. Expand Forms & Fees section
    console.log('3. Expanding Forms & Fees section...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const formsBtn = buttons.find(b => b.textContent && b.textContent.includes('2. Forms & Fees'));
      if (formsBtn) {
        formsBtn.scrollIntoView({ block: 'center' });
        formsBtn.click();
      }
    });
    await wait(2000);

    const formsCheck = await page.evaluate(() => {
      const bodyText = document.body.textContent || '';
      return {
        hasFormsFeesTitle: bodyText.includes('2. Forms & Fees'),
        hasFormI140Final: bodyText.includes('Form I-140 (final signed PDF)'),
        fillButtonCount: Array.from(document.querySelectorAll('button'))
          .filter(b => b.textContent?.trim() === 'Fill').length,
      };
    });

    results.formsFeesFound = formsCheck.hasFormI140Final;
    console.log('   Forms & Fees visible:', results.formsFeesFound);
    console.log('   Fill buttons found:', formsCheck.fillButtonCount);

    await page.screenshot({ path: 'screenshots/final-forms-expanded.png', fullPage: true });

    if (!results.formsFeesFound) {
      console.log('   ERROR: Forms & Fees section not properly expanded');
      return results;
    }

    // 4. Test Fill button
    console.log('4. Testing Fill button on Form I-140 (final)...');
    
    const fillClicked = await page.evaluate(() => {
      // Find the first "Fill" button (should be Form I-140 final)
      const allButtons = Array.from(document.querySelectorAll('button'));
      const fillBtn = allButtons.find(b => b.textContent?.trim() === 'Fill');
      if (fillBtn) {
        fillBtn.scrollIntoView({ block: 'center' });
        fillBtn.click();
        return true;
      }
      return false;
    });

    console.log('   Fill button clicked:', fillClicked);
    await wait(2000);

    const fillModalInfo = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]');
      if (!modal) return { opened: false, error: 'No modal found' };

      const text = modal.textContent || '';
      const hasInputFields = modal.querySelectorAll('input, textarea').length > 0;
      const hasNextButton = text.includes('Next') || text.includes('Continue');
      const hasSteps = text.includes('Step') || modal.querySelectorAll('button[disabled]').length > 0;

      return {
        opened: true,
        modalTitle: text.substring(0, 200),
        hasInputFields,
        hasNextButton,
        hasSteps,
        usable: hasInputFields || hasSteps,
      };
    });

    results.fillButtonBehavior = fillModalInfo;
    console.log('   Fill modal:', JSON.stringify(fillModalInfo, null, 2));

    await page.screenshot({ path: 'screenshots/final-fill-modal.png', fullPage: true });

    // Close modal
    await page.keyboard.press('Escape');
    await wait(1000);

    // 5. Test Template button
    console.log('5. Testing Template button on Form I-140 (final)...');

    const templateClicked = await page.evaluate(() => {
      // Find Template button near Form I-140 final
      // Strategy: find "Fill" button, then find "Template" button nearby
      const allButtons = Array.from(document.querySelectorAll('button'));
      const fillBtn = allButtons.find(b => b.textContent?.trim() === 'Fill');
      
      if (fillBtn && fillBtn.parentElement) {
        const siblingButtons = Array.from(fillBtn.parentElement.querySelectorAll('button'));
        const templateBtn = siblingButtons.find(b => b.textContent?.trim() === 'Template');
        if (templateBtn) {
          templateBtn.scrollIntoView({ block: 'center' });
          templateBtn.click();
          return true;
        }
      }
      return false;
    });

    console.log('   Template button clicked:', templateClicked);
    await wait(2000);

    const templateModalInfo = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]');
      if (!modal) return { opened: false, error: 'No modal found' };

      const text = modal.textContent || '';

      return {
        opened: true,
        modalTitle: text.substring(0, 300),
        hasWhatItIs: text.includes('What this') || text.includes('what this'),
        hasWhyItMatters: text.includes('Why it matters') || text.includes('why it matters'),
        hasDownloadLink: text.includes('Download') || text.includes('PDF') || text.includes('Template'),
        hasExample: text.includes('Example') || text.includes('example'),
      };
    });

    results.templateButtonBehavior = templateModalInfo;
    console.log('   Template modal:', JSON.stringify(templateModalInfo, null, 2));

    await page.screenshot({ path: 'screenshots/final-template-modal.png', fullPage: true });

    // Close modal
    await page.keyboard.press('Escape');
    await wait(1000);

    // 6. Test + Add button
    console.log('6. Testing + Add button on Form I-140 (final)...');

    const addClicked = await page.evaluate(() => {
      // Find "+ Add" button near Form I-140 final
      const allButtons = Array.from(document.querySelectorAll('button'));
      const fillBtn = allButtons.find(b => b.textContent?.trim() === 'Fill');
      
      if (fillBtn && fillBtn.parentElement) {
        const siblingButtons = Array.from(fillBtn.parentElement.querySelectorAll('button'));
        const addBtn = siblingButtons.find(b => {
          const text = b.textContent?.trim() || '';
          return text === '+ Add' || text === 'Add';
        });
        if (addBtn) {
          addBtn.scrollIntoView({ block: 'center' });
          addBtn.click();
          return true;
        }
      }
      return false;
    });

    console.log('   + Add button clicked:', addClicked);
    await wait(1500);

    // Check if upload area appeared (might not be a modal)
    const addUIInfo = await page.evaluate(() => {
      // Look for upload UI - could be inline or in a modal
      const modal = document.querySelector('[role="dialog"]');
      const bodyText = document.body.textContent || '';
      
      const hasUploadText = bodyText.includes('Upload') || bodyText.includes('Drop') || 
                           bodyText.includes('Choose file') || bodyText.includes('Select file');
      const hasFileInput = document.querySelectorAll('input[type="file"]').length > 0;
      
      if (modal) {
        const modalText = modal.textContent || '';
        return {
          type: 'modal',
          opened: true,
          hasUploadText: modalText.includes('Upload') || modalText.includes('Drop'),
          hasFileInput: modal.querySelectorAll('input[type="file"]').length > 0,
        };
      } else if (hasUploadText || hasFileInput) {
        return {
          type: 'inline',
          opened: true,
          hasUploadText,
          hasFileInput,
        };
      } else {
        return {
          opened: false,
          error: 'No upload UI found after clicking + Add',
        };
      }
    });

    results.addButtonBehavior = addUIInfo;
    console.log('   + Add UI:', JSON.stringify(addUIInfo, null, 2));

    await page.screenshot({ path: 'screenshots/final-add-ui.png', fullPage: true });

    console.log('\n=== VERIFICATION COMPLETE ===');

  } catch (error) {
    results.consoleErrors.push({
      type: 'script-error',
      text: error.message,
      stack: error.stack,
    });
    console.error('Error:', error);
  } finally {
    await browser.close();
  }

  return results;
}

const results = await verifyFormsAndFees();
writeFileSync('final-verification-results.json', JSON.stringify(results, null, 2));

console.log('\n=== RESULTS ===');
console.log(JSON.stringify(results, null, 2));
