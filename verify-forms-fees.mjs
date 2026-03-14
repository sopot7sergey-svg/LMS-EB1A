import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function verifyFormsAndFees() {
  const results = {
    loginSuccess: false,
    pageReached: null,
    formsFeesFound: false,
    fillButtonBehavior: null,
    templateButtonBehavior: null,
    addButtonBehavior: null,
    consoleErrors: [],
    screenshots: [],
  };

  let browser;
  try {
    // Ensure screenshots directory exists
    mkdirSync('screenshots', { recursive: true });

    browser = await puppeteer.launch({
      headless: false, // Run in visible mode to see what's happening
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        results.consoleErrors.push({
          type: 'console.error',
          text: msg.text(),
        });
      }
    });

    page.on('pageerror', error => {
      results.consoleErrors.push({
        type: 'pageerror',
        text: error.message,
        stack: error.stack,
      });
    });

    // 1. Navigate to login page
    console.log('1. Navigating to login page...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2', timeout: 30000 });
    await page.screenshot({ path: 'screenshots/01-login-page.png' });
    results.screenshots.push('01-login-page.png');

    // 2. Login
    console.log('2. Attempting login...');
    await page.type('input[type="email"]', 'test@example.com');
    await page.type('input[type="password"]', 'Test1234');
    await page.click('button[type="submit"]');
    
    await wait(3000);
    await page.screenshot({ path: 'screenshots/02-after-login.png' });
    results.loginSuccess = !page.url().includes('/login');
    results.pageReached = page.url();
    console.log('   Login success:', results.loginSuccess);
    console.log('   Current URL:', results.pageReached);

    // 3. Navigate to case workspace
    console.log('3. Looking for case workspace...');
    
    if (!page.url().includes('/case/')) {
      // Navigate to cases page
      await page.goto('http://localhost:3000/case', { waitUntil: 'networkidle2' });
      await wait(2000);
      
      // Try to click on first case
      console.log('   Looking for View Case button...');
      
      // Wait for the button to be visible
      await wait(1000);
      
      const caseClicked = await page.evaluate(() => {
        // More robust approach: find any link or button with "View Case" text
        const allElements = Array.from(document.querySelectorAll('a, button'));
        const viewCaseBtn = allElements.find(el => {
          const text = el.textContent || '';
          return text.trim().includes('View Case');
        });
        
        console.log('Found View Case button:', !!viewCaseBtn);
        if (viewCaseBtn) {
          console.log('Button tag:', viewCaseBtn.tagName);
          console.log('Button text:', viewCaseBtn.textContent);
          viewCaseBtn.click();
          return true;
        }
        return false;
      });
      
      if (caseClicked) {
        await wait(3000);
        results.pageReached = page.url();
        console.log('   Navigated to case:', results.pageReached);
      }
    }
    
    await page.screenshot({ path: 'screenshots/03-case-workspace.png', fullPage: true });
    results.screenshots.push('03-case-workspace.png');

    // 4. Look for Forms & Fees section
    console.log('4. Looking for Forms & Fees section...');
    
    const formsFeesInfo = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      const section = elements.find(el => 
        el.textContent && /Forms.*Fees/i.test(el.textContent) && el.textContent.length < 100
      );
      return section ? {
        found: true,
        text: section.textContent,
        isButton: section.tagName === 'BUTTON'
      } : null;
    });
    
    if (formsFeesInfo) {
      results.formsFeesFound = true;
      console.log('   Forms & Fees section found:', formsFeesInfo.text);
      
      // Expand the section if it's collapsed
      if (formsFeesInfo.isButton) {
        console.log('   Clicking Forms & Fees section button...');
        const wasExpanded = await page.evaluate(() => {
          const elements = Array.from(document.querySelectorAll('button'));
          const button = elements.find(el => /Forms.*Fees/i.test(el.textContent));
          if (button) {
            button.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Check if section is currently expanded by looking for ChevronDown icon
            const svg = button.querySelector('svg');
            const wasOpen = svg?.classList?.toString().includes('chevron-down') || false;
            button.click();
            return wasOpen;
          }
          return false;
        });
        console.log('   Section was expanded before click:', wasExpanded);
        await wait(2000); // Wait longer for content to render and animations
        
        // Click again if it was expanded (to re-expand it)
        if (wasExpanded) {
          console.log('   Re-clicking to expand...');
          await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('button'));
            const button = elements.find(el => /Forms.*Fees/i.test(el.textContent));
            if (button) button.click();
          });
          await wait(1500);
        }
      }
      
      await page.screenshot({ path: 'screenshots/04-forms-fees-expanded.png', fullPage: true });
      results.screenshots.push('04-forms-fees-expanded.png');
      
      // 5. Find a row with Fill, Template, and + Add buttons
      console.log('5. Looking for row with Fill/Template/Add buttons...');
      
      // First, check if Forms & Fees section is actually expanded
      const sectionStatus = await page.evaluate(() => {
        const allText = document.body.textContent || '';
        return {
          hasFormsFeesTitle: allText.includes('Forms & Fees'),
          hasFormI140: allText.includes('Form I-140'),
          hasFormG1145: allText.includes('Form G-1145'),
          hasFormI907: allText.includes('Form I-907'),
          hasFilingFee: allText.includes('Filing Fee'),
        };
      });
      
      console.log('   Section content check:', JSON.stringify(sectionStatus, null, 2));
      
      // First, check if any Fill/Template/Add buttons exist at all
      const buttonCounts = await page.evaluate(() => {
        const allButtons = Array.from(document.querySelectorAll('button'));
        return {
          totalButtons: allButtons.length,
          fillCount: allButtons.filter(b => b.textContent?.trim() === 'Fill').length,
          templateCount: allButtons.filter(b => b.textContent?.trim() === 'Template').length,
          addCount: allButtons.filter(b => b.textContent?.includes('Add')).length,
          allButtonTexts: allButtons.map(b => b.textContent?.trim()).filter(t => t && t.length < 50).slice(0, 50)
        };
      });
      
      console.log('   Button counts:', JSON.stringify(buttonCounts, null, 2));
      
      const allRowsInfo = await page.evaluate(() => {
        // Find all buttons with text "Fill", "Template", or "+ Add"
        const allButtons = Array.from(document.querySelectorAll('button'));
        const fillButtons = allButtons.filter(b => b.textContent && b.textContent.trim() === 'Fill');
        const templateButtons = allButtons.filter(b => b.textContent && b.textContent.trim() === 'Template');
        const addButtons = allButtons.filter(b => b.textContent && b.textContent.trim() === '+ Add');
        
        console.log('Found Fill buttons:', fillButtons.length);
        console.log('Found Template buttons:', templateButtons.length);
        console.log('Found + Add buttons:', addButtons.length);
        
        // Try to find rows that have all three buttons
        const rows = [];
        
        for (const fillBtn of fillButtons) {
          // Walk up the DOM to find the container that has all three buttons
          let container = fillBtn.parentElement;
          let found = false;
          
          for (let i = 0; i < 5 && container; i++) {
            const containerButtons = Array.from(container.querySelectorAll('button'));
            const containerButtonTexts = containerButtons.map(b => b.textContent.trim());
            
            const hasFill = containerButtonTexts.includes('Fill');
            const hasTemplate = containerButtonTexts.includes('Template');
            const hasAdd = containerButtonTexts.includes('+ Add');
            
            if (hasFill && hasTemplate && hasAdd) {
              // Find the label for this row
              const allText = container.textContent || '';
              const match = allText.match(/(Form [^\n]+)/);
              const label = match ? match[1].substring(0, 100) : allText.substring(0, 100);
              
              rows.push({
                label,
                buttons: containerButtonTexts.filter(t => t && t.length < 30 && (t === 'Fill' || t === 'Template' || t === '+ Add'))
              });
              found = true;
              break;
            }
            
            container = container.parentElement;
          }
        }
        
        return { rows };
      });
      
      console.log('   Found rows:', JSON.stringify(allRowsInfo, null, 2));
      
      // Look for a row with Fill, Template, and Add
      const rowWithButtons = allRowsInfo.rows.find(row => 
        row.buttons.includes('Fill') || 
        row.buttons.includes('Template') || 
        row.buttons.some(b => b.includes('Add'))
      );
      
      if (rowWithButtons) {
        console.log('   Row found with buttons:', rowWithButtons.buttons);
        console.log('   Row label:', rowWithButtons.label);
        
        // 6. Test Fill button
        console.log('6. Testing Fill button...');
        
        await page.evaluate(() => {
          const allButtons = Array.from(document.querySelectorAll('button'));
          const fillBtn = allButtons.find(b => b.textContent.trim() === 'Fill');
          if (fillBtn) fillBtn.click();
        });
        
        await wait(2000);
        
        const fillModalInfo = await page.evaluate(() => {
          const modal = document.querySelector('[role="dialog"]');
          if (!modal) return { opened: false };
          
          const text = modal.textContent || '';
          const hasQuestions = text.includes('Question') || text.includes('Step');
          const hasStepper = modal.querySelector('button[disabled]') !== null;
          
          return {
            opened: true,
            modalText: text.substring(0, 500),
            hasQuestions,
            hasStepper,
            usable: true
          };
        });
        
        results.fillButtonBehavior = fillModalInfo;
        console.log('   Fill button result:', fillModalInfo);
        
        await page.screenshot({ path: 'screenshots/05-fill-modal.png', fullPage: true });
        results.screenshots.push('05-fill-modal.png');
        
        // Close modal
        await page.keyboard.press('Escape');
        await wait(500);
        
        // 7. Test Template button
        console.log('7. Testing Template button...');
        
        await page.evaluate(() => {
          const allButtons = Array.from(document.querySelectorAll('button'));
          const templateBtn = allButtons.find(b => b.textContent.trim() === 'Template');
          if (templateBtn) templateBtn.click();
        });
        
        await wait(1500);
        
        const templateModalInfo = await page.evaluate(() => {
          const modal = document.querySelector('[role="dialog"]');
          if (!modal) return { opened: false };
          
          const text = modal.textContent || '';
          
          return {
            opened: true,
            modalText: text.substring(0, 500),
            hasWhatItIs: text.includes('What this'),
            hasWhyItMatters: text.includes('Why it matters'),
            hasExample: text.includes('Example') || text.includes('example')
          };
        });
        
        results.templateButtonBehavior = templateModalInfo;
        console.log('   Template button result:', templateModalInfo);
        
        await page.screenshot({ path: 'screenshots/06-template-modal.png', fullPage: true });
        results.screenshots.push('06-template-modal.png');
        
        // Close modal
        await page.keyboard.press('Escape');
        await wait(500);
        
        // 8. Test + Add button
        console.log('8. Testing + Add button...');
        
        await page.evaluate(() => {
          const allButtons = Array.from(document.querySelectorAll('button'));
          const addBtn = allButtons.find(b => b.textContent.includes('Add'));
          if (addBtn) addBtn.click();
        });
        
        await wait(1500);
        
        const addModalInfo = await page.evaluate(() => {
          const modal = document.querySelector('[role="dialog"]');
          if (!modal) return { opened: false };
          
          const text = modal.textContent || '';
          const hasFileUpload = text.includes('Upload') || text.includes('Drop');
          
          return {
            opened: true,
            modalText: text.substring(0, 500),
            hasFileUpload,
            hasAttachments: text.includes('attachment')
          };
        });
        
        results.addButtonBehavior = addModalInfo;
        console.log('   + Add button result:', addModalInfo);
        
        await page.screenshot({ path: 'screenshots/07-add-modal.png', fullPage: true });
        results.screenshots.push('07-add-modal.png');
      } else {
        console.log('   No row found with Fill/Template/Add buttons');
        results.fillButtonBehavior = { error: 'No row with all three buttons found' };
        results.templateButtonBehavior = { error: 'No row with all three buttons found' };
        results.addButtonBehavior = { error: 'No row with all three buttons found' };
      }
    } else {
      console.log('   Forms & Fees section NOT found');
    }

    // Final screenshot
    await page.screenshot({ path: 'screenshots/08-final.png', fullPage: true });
    results.screenshots.push('08-final.png');

  } catch (error) {
    results.consoleErrors.push({
      type: 'script-error',
      text: error.message,
      stack: error.stack,
    });
    console.error('Error during verification:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return results;
}

// Run verification
console.log('Starting Forms & Fees verification...\n');
const results = await verifyFormsAndFees();

// Write results to file
writeFileSync(
  'forms-fees-verification-results.json',
  JSON.stringify(results, null, 2)
);

console.log('\n=== VERIFICATION RESULTS ===');
console.log(JSON.stringify(results, null, 2));
console.log('\nResults saved to forms-fees-verification-results.json');
console.log('Screenshots saved to screenshots/ directory');

process.exit(0);
