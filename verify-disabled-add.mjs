import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'fs';
import { mkdir } from 'fs/promises';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function verifyDisabledAddBehavior() {
  const results = {
    test1: {
      section3AddMessage: { appeared: false, text: null, screenshot: null },
      section4AddMessage: { appeared: false, text: null, screenshot: null },
      section4CreateClickable: { clickable: false, screenshot: null },
    },
    test2: {
      section3OnlyAddLinks: { verified: false, hasCreateTemplate: false, screenshot: null },
      section9OnlyAddLinks: { verified: false, hasCreateTemplate: false, screenshot: null },
      section4HasCreateTemplate: { verified: false, screenshot: null },
    },
    screenshots: [],
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

    // Login
    console.log('\n=== Login ===');
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
    
    console.log('✓ Logged in');

    // Navigate to case
    const caseUrl = 'http://localhost:3000/case/dc75d30d-3a2e-4865-a65c-241b8175e526';
    await page.goto(caseUrl, { waitUntil: 'networkidle2' });
    await wait(5000);
    console.log('✓ Case page loaded');

    // TEST 1: Section 3 - Click + Add on Passport slot
    console.log('\n=== TEST 1: Section 3 - Disabled Add Message ===');
    
    // Expand Section 3
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const section3 = buttons.find(b => /3\.\s+Identity.*Status/i.test(b.textContent || ''));
      if (section3) {
        section3.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => section3.click(), 500);
      }
    });
    await wait(2000);
    
    // Find and click + Add button for Passport
    console.log('Looking for Passport + Add button...');
    const section3ClickResult = await page.evaluate(() => {
      // Look for text containing "Passport" and "biographic"
      const allElements = Array.from(document.querySelectorAll('*'));
      const passportElement = allElements.find(el => {
        const text = el.textContent || '';
        return /passport.*biographic/i.test(text) && text.length < 200;
      });
      
      if (!passportElement) {
        return { found: false, reason: 'Passport element not found' };
      }
      
      // Find the + Add button near this element
      let container = passportElement;
      for (let i = 0; i < 10 && container; i++) {
        container = container.parentElement;
        if (!container) break;
        
        // Look for + Add button in this container
        const buttons = Array.from(container.querySelectorAll('button, a'));
        const addButton = buttons.find(b => {
          const text = b.textContent || '';
          return /^\s*\+?\s*Add\s*$/i.test(text.trim());
        });
        
        if (addButton) {
          console.log('Found + Add button, clicking...');
          addButton.click();
          return { found: true, clicked: true };
        }
      }
      
      return { found: false, reason: 'Add button not found near Passport' };
    });
    
    console.log('Section 3 click result:', section3ClickResult);
    await wait(2000);
    
    // Check for message/popup
    const section3Message = await page.evaluate(() => {
      // Check for modal
      const modal = document.querySelector('[role="dialog"]');
      if (modal) {
        const text = modal.textContent || '';
        return {
          found: true,
          text: text.substring(0, 500),
          hasDisabledText: /not available|disabled|contact.*administrator/i.test(text),
        };
      }
      
      // Check for tooltip/popover
      const tooltips = Array.from(document.querySelectorAll('[role="tooltip"], [class*="tooltip"], [class*="popover"]'));
      if (tooltips.length > 0) {
        const text = tooltips[0].textContent || '';
        return {
          found: true,
          text: text.substring(0, 500),
          hasDisabledText: /not available|disabled|contact.*administrator/i.test(text),
        };
      }
      
      // Check for any alert
      const alerts = Array.from(document.querySelectorAll('[role="alert"], [class*="alert"]'));
      if (alerts.length > 0) {
        const text = alerts[0].textContent || '';
        return {
          found: true,
          text: text.substring(0, 500),
          hasDisabledText: /not available|disabled|contact.*administrator/i.test(text),
        };
      }
      
      return { found: false };
    });
    
    console.log('Section 3 message:', section3Message);
    results.test1.section3AddMessage.appeared = section3Message.found;
    results.test1.section3AddMessage.text = section3Message.text;
    
    await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/disabled-01-section3-add-message.png', fullPage: true });
    results.screenshots.push('disabled-01-section3-add-message.png');
    results.test1.section3AddMessage.screenshot = 'disabled-01-section3-add-message.png';
    
    if (section3Message.found) {
      console.log('✓ Section 3 disabled message appeared');
      console.log('  Message preview:', section3Message.text?.substring(0, 100));
    } else {
      console.log('✗ Section 3 disabled message NOT found');
    }
    
    // Close any modal
    await page.keyboard.press('Escape');
    await wait(1000);

    // TEST 1: Section 4 - Click Add on builder slot
    console.log('\n=== TEST 1: Section 4 - Builder Slot Add Button ===');
    
    // Expand Section 4
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const section4 = buttons.find(b => /4\.\s+Cover.*Letter/i.test(b.textContent || ''));
      if (section4) {
        section4.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => section4.click(), 500);
      }
    });
    await wait(2000);
    
    // Find Cover Letter Draft builder slot and click Add
    console.log('Looking for Cover Letter Draft Add button...');
    const section4ClickResult = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      const coverLetterElement = allElements.find(el => {
        const text = el.textContent || '';
        return /Cover Letter.*Legal Brief.*Draft/i.test(text) && text.length < 150;
      });
      
      if (!coverLetterElement) {
        return { found: false, reason: 'Cover Letter Draft not found' };
      }
      
      // Find the Add button in the same row
      let container = coverLetterElement;
      for (let i = 0; i < 10 && container; i++) {
        container = container.parentElement;
        if (!container) break;
        
        const buttons = Array.from(container.querySelectorAll('button'));
        const addButton = buttons.find(b => {
          const text = b.textContent || '';
          return text.trim() === 'Add';
        });
        
        if (addButton) {
          console.log('Found Add button on Cover Letter Draft, clicking...');
          addButton.click();
          return { found: true, clicked: true };
        }
      }
      
      return { found: false, reason: 'Add button not found' };
    });
    
    console.log('Section 4 click result:', section4ClickResult);
    await wait(2000);
    
    // Check for message
    const section4Message = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]');
      if (modal) {
        const text = modal.textContent || '';
        return {
          found: true,
          text: text.substring(0, 500),
          hasDisabledText: /not available|disabled|contact.*administrator/i.test(text),
        };
      }
      
      const tooltips = Array.from(document.querySelectorAll('[role="tooltip"], [class*="tooltip"], [class*="popover"]'));
      if (tooltips.length > 0) {
        const text = tooltips[0].textContent || '';
        return {
          found: true,
          text: text.substring(0, 500),
          hasDisabledText: /not available|disabled|contact.*administrator/i.test(text),
        };
      }
      
      return { found: false };
    });
    
    console.log('Section 4 message:', section4Message);
    results.test1.section4AddMessage.appeared = section4Message.found;
    results.test1.section4AddMessage.text = section4Message.text;
    
    await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/disabled-02-section4-add-message.png', fullPage: true });
    results.screenshots.push('disabled-02-section4-add-message.png');
    results.test1.section4AddMessage.screenshot = 'disabled-02-section4-add-message.png';
    
    if (section4Message.found) {
      console.log('✓ Section 4 disabled message appeared');
      console.log('  Message preview:', section4Message.text?.substring(0, 100));
    } else {
      console.log('✗ Section 4 disabled message NOT found');
    }
    
    await page.keyboard.press('Escape');
    await wait(1000);

    // TEST 1: Verify Create button is clickable
    console.log('\n=== TEST 1: Verify Create Button Clickable ===');
    
    const createButtonState = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      const coverLetterElement = allElements.find(el => {
        const text = el.textContent || '';
        return /Cover Letter.*Legal Brief.*Draft/i.test(text) && text.length < 150;
      });
      
      if (!coverLetterElement) {
        return { found: false };
      }
      
      let container = coverLetterElement;
      for (let i = 0; i < 10 && container; i++) {
        container = container.parentElement;
        if (!container) break;
        
        const buttons = Array.from(container.querySelectorAll('button'));
        const createButton = buttons.find(b => b.textContent?.trim() === 'Create');
        
        if (createButton) {
          const disabled = createButton.disabled;
          const ariaDisabled = createButton.getAttribute('aria-disabled');
          const classes = createButton.className;
          const style = window.getComputedStyle(createButton);
          
          return {
            found: true,
            disabled: disabled,
            ariaDisabled: ariaDisabled,
            opacity: style.opacity,
            cursor: style.cursor,
            isClickable: !disabled && ariaDisabled !== 'true',
          };
        }
      }
      
      return { found: false };
    });
    
    console.log('Create button state:', createButtonState);
    results.test1.section4CreateClickable.clickable = createButtonState.isClickable;
    
    await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/disabled-03-section4-create-button.png', fullPage: true });
    results.screenshots.push('disabled-03-section4-create-button.png');
    results.test1.section4CreateClickable.screenshot = 'disabled-03-section4-create-button.png';
    
    console.log(createButtonState.isClickable ? '✓ Create button is clickable' : '✗ Create button is NOT clickable');

    // TEST 2: Section 3 - Verify only + Add links
    console.log('\n=== TEST 2: Section 3 - Only + Add Links ===');
    
    // Make sure section 3 is expanded
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const section3 = buttons.find(b => /3\.\s+Identity.*Status/i.test(b.textContent || ''));
      if (section3 && section3.getAttribute('aria-expanded') !== 'true') {
        section3.click();
      }
    });
    await wait(1500);
    
    const section3ButtonAnalysis = await page.evaluate(() => {
      // Find section 3 content area
      const allButtons = Array.from(document.querySelectorAll('button'));
      const section3Button = allButtons.find(b => /3\.\s+Identity.*Status/i.test(b.textContent || ''));
      
      if (!section3Button) {
        return { found: false };
      }
      
      // Get the expanded content
      let container = section3Button.parentElement;
      for (let i = 0; i < 5 && container; i++) {
        container = container?.nextElementSibling;
        if (container && container.querySelector('*')) {
          break;
        }
      }
      
      if (!container) {
        return { found: false, reason: 'Container not found' };
      }
      
      // Count buttons in this section
      const sectionButtons = Array.from(container.querySelectorAll('button, a'));
      const addButtons = sectionButtons.filter(b => /^\s*\+?\s*Add\s*$/i.test(b.textContent?.trim() || ''));
      const createButtons = sectionButtons.filter(b => b.textContent?.trim() === 'Create');
      const templateButtons = sectionButtons.filter(b => b.textContent?.trim() === 'Template');
      
      return {
        found: true,
        addButtonCount: addButtons.length,
        createButtonCount: createButtons.length,
        templateButtonCount: templateButtons.length,
        hasCreateOrTemplate: createButtons.length > 0 || templateButtons.length > 0,
      };
    });
    
    console.log('Section 3 button analysis:', section3ButtonAnalysis);
    results.test2.section3OnlyAddLinks.verified = section3ButtonAnalysis.found;
    results.test2.section3OnlyAddLinks.hasCreateTemplate = section3ButtonAnalysis.hasCreateOrTemplate;
    
    await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/disabled-04-section3-only-add.png', fullPage: true });
    results.screenshots.push('disabled-04-section3-only-add.png');
    results.test2.section3OnlyAddLinks.screenshot = 'disabled-04-section3-only-add.png';
    
    if (!section3ButtonAnalysis.hasCreateOrTemplate) {
      console.log('✓ Section 3 has ONLY + Add links (NO Create/Template)');
    } else {
      console.log('✗ Section 3 has Create/Template buttons (INCORRECT)');
      console.log('  Create:', section3ButtonAnalysis.createButtonCount);
      console.log('  Template:', section3ButtonAnalysis.templateButtonCount);
    }

    // TEST 2: Section 9 - Verify only + Add links
    console.log('\n=== TEST 2: Section 9 - Only + Add Links ===');
    
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const section9 = buttons.find(b => /9\.\s+Responses.*USCIS/i.test(b.textContent || ''));
      if (section9) {
        section9.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          if (section9.getAttribute('aria-expanded') !== 'true') {
            section9.click();
          }
        }, 500);
      }
    });
    await wait(2000);
    
    const section9ButtonAnalysis = await page.evaluate(() => {
      const allButtons = Array.from(document.querySelectorAll('button'));
      const section9Button = allButtons.find(b => /9\.\s+Responses.*USCIS/i.test(b.textContent || ''));
      
      if (!section9Button) {
        return { found: false };
      }
      
      let container = section9Button.parentElement;
      for (let i = 0; i < 5 && container; i++) {
        container = container?.nextElementSibling;
        if (container && container.querySelector('*')) {
          break;
        }
      }
      
      if (!container) {
        return { found: false, reason: 'Container not found' };
      }
      
      const sectionButtons = Array.from(container.querySelectorAll('button, a'));
      const addButtons = sectionButtons.filter(b => /^\s*\+?\s*Add\s*$/i.test(b.textContent?.trim() || ''));
      const createButtons = sectionButtons.filter(b => b.textContent?.trim() === 'Create');
      const templateButtons = sectionButtons.filter(b => b.textContent?.trim() === 'Template');
      
      return {
        found: true,
        addButtonCount: addButtons.length,
        createButtonCount: createButtons.length,
        templateButtonCount: templateButtons.length,
        hasCreateOrTemplate: createButtons.length > 0 || templateButtons.length > 0,
      };
    });
    
    console.log('Section 9 button analysis:', section9ButtonAnalysis);
    results.test2.section9OnlyAddLinks.verified = section9ButtonAnalysis.found;
    results.test2.section9OnlyAddLinks.hasCreateTemplate = section9ButtonAnalysis.hasCreateOrTemplate;
    
    await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/disabled-05-section9-only-add.png', fullPage: true });
    results.screenshots.push('disabled-05-section9-only-add.png');
    results.test2.section9OnlyAddLinks.screenshot = 'disabled-05-section9-only-add.png';
    
    if (!section9ButtonAnalysis.hasCreateOrTemplate) {
      console.log('✓ Section 9 has ONLY + Add links (NO Create/Template)');
    } else {
      console.log('✗ Section 9 has Create/Template buttons (INCORRECT)');
    }

    // TEST 2: Section 4 - Verify Create/Template present
    console.log('\n=== TEST 2: Section 4 - Has Create/Template ===');
    
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const section4 = buttons.find(b => /4\.\s+Cover.*Letter/i.test(b.textContent || ''));
      if (section4) {
        section4.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    await wait(1000);
    
    const section4ButtonAnalysis = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      const coverLetterElement = allElements.find(el => {
        const text = el.textContent || '';
        return /Cover Letter.*Legal Brief.*Draft/i.test(text) && text.length < 150;
      });
      
      if (!coverLetterElement) {
        return { found: false };
      }
      
      let container = coverLetterElement;
      for (let i = 0; i < 10 && container; i++) {
        container = container.parentElement;
        if (!container) break;
        
        const buttons = Array.from(container.querySelectorAll('button'));
        const createButton = buttons.find(b => b.textContent?.trim() === 'Create');
        const templateButton = buttons.find(b => b.textContent?.trim() === 'Template');
        
        if (createButton || templateButton) {
          return {
            found: true,
            hasCreate: !!createButton,
            hasTemplate: !!templateButton,
          };
        }
      }
      
      return { found: false };
    });
    
    console.log('Section 4 button analysis:', section4ButtonAnalysis);
    results.test2.section4HasCreateTemplate.verified = section4ButtonAnalysis.found && 
                                                        section4ButtonAnalysis.hasCreate && 
                                                        section4ButtonAnalysis.hasTemplate;
    
    await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/disabled-06-section4-create-template.png', fullPage: true });
    results.screenshots.push('disabled-06-section4-create-template.png');
    results.test2.section4HasCreateTemplate.screenshot = 'disabled-06-section4-create-template.png';
    
    if (results.test2.section4HasCreateTemplate.verified) {
      console.log('✓ Section 4 has Create AND Template buttons');
    } else {
      console.log('✗ Section 4 missing Create/Template buttons');
    }

  } catch (error) {
    console.error('Error:', error);
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
console.log('║  Verifying Disabled Add Button Behavior                 ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

const results = await verifyDisabledAddBehavior();

writeFileSync(
  '/Users/sergeysopot/LMS-EB1A/disabled-add-verification.json',
  JSON.stringify(results, null, 2)
);

console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║  VERIFICATION COMPLETE                                    ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

console.log('=== TEST 1 RESULTS ===');
console.log('Section 3 + Add clicked → Message appeared:', results.test1.section3AddMessage.appeared ? '✓ YES' : '✗ NO');
console.log('Section 4 Add clicked → Message appeared:', results.test1.section4AddMessage.appeared ? '✓ YES' : '✗ NO');
console.log('Section 4 Create button clickable:', results.test1.section4CreateClickable.clickable ? '✓ YES' : '✗ NO');

console.log('\n=== TEST 2 RESULTS ===');
console.log('Section 3 has ONLY + Add (no Create/Template):', !results.test2.section3OnlyAddLinks.hasCreateTemplate ? '✓ CORRECT' : '✗ INCORRECT');
console.log('Section 9 has ONLY + Add (no Create/Template):', !results.test2.section9OnlyAddLinks.hasCreateTemplate ? '✓ CORRECT' : '✗ INCORRECT');
console.log('Section 4 has Create & Template buttons:', results.test2.section4HasCreateTemplate.verified ? '✓ YES' : '✗ NO');

console.log('\nScreenshots saved:', results.screenshots.length);
console.log('Results saved to: disabled-add-verification.json\n');

process.exit(0);
