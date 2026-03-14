import puppeteer from 'puppeteer-core';
import { mkdir } from 'fs/promises';
import { writeFileSync } from 'fs';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function verifySectionsBuilderButtons() {
  const log = [];
  const results = {
    section4: {},
    section5: {},
    section6: {},
    section7: {},
    section8: {},
  };

  let browser;

  try {
    await mkdir('/Users/sergeysopot/LMS-EB1A/screenshots', { recursive: true });

    browser = await puppeteer.launch({
      headless: false,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      slowMo: 250,
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    log.push('='.repeat(60));
    log.push('LOGGING IN');
    log.push('='.repeat(60));
    
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
    
    log.push('✓ Logged in successfully\n');

    // Navigate to case
    await page.goto('http://localhost:3000/case/dc75d30d-3a2e-4865-a65c-241b8175e526', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    await wait(5000);
    log.push('✓ Case page loaded\n');

    // Scroll to checklist
    await page.evaluate(() => window.scrollTo(0, 600));
    await wait(2000);

    // Function to verify a section
    async function verifySection(sectionNumber, sectionName, resultKey) {
      log.push('='.repeat(60));
      log.push(`SECTION ${sectionNumber}: ${sectionName}`);
      log.push('='.repeat(60));

      // Expand section
      log.push(`\nStep 1: Expanding section ${sectionNumber}...`);
      await page.evaluate((num, name) => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const section = buttons.find(b => {
          const text = b.textContent || '';
          const regex = new RegExp(`^${num}\\.\\s+${name.substring(0, 15)}`, 'i');
          return regex.test(text);
        });
        if (section) {
          section.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => {
            if (section.getAttribute('aria-expanded') !== 'true') {
              section.click();
            }
          }, 500);
        }
      }, sectionNumber, sectionName);
      await wait(3000);
      log.push('✓ Section expanded');

      // Take screenshot
      log.push(`\nStep 2: Taking screenshot...`);
      const screenshotPath = `/Users/sergeysopot/LMS-EB1A/screenshots/section${sectionNumber}-expanded.png`;
      await page.screenshot({ 
        path: screenshotPath,
        fullPage: true 
      });
      log.push(`✓ Screenshot saved: section${sectionNumber}-expanded.png`);

      // Analyze builder slots
      log.push(`\nStep 3: Analyzing builder slots...`);
      const sectionData = await page.evaluate((num) => {
        // Find the section content
        const buttons = Array.from(document.querySelectorAll('button'));
        const sectionHeader = buttons.find(b => {
          const text = b.textContent || '';
          return new RegExp(`^${num}\\.\\s+`).test(text);
        });
        
        if (!sectionHeader) return { error: 'Section not found' };
        
        // Find the content container (next sibling or parent structure)
        let contentContainer = sectionHeader.parentElement;
        while (contentContainer && !contentContainer.querySelector('[role="region"]')) {
          contentContainer = contentContainer.parentElement;
          if (!contentContainer || contentContainer === document.body) break;
        }
        
        if (!contentContainer) {
          contentContainer = sectionHeader.parentElement?.nextElementSibling;
        }
        
        if (!contentContainer) return { error: 'Content container not found' };

        // Find all builder slots and upload slots
        const slots = [];
        
        // Look for elements that might be slots
        const allElements = Array.from(contentContainer.querySelectorAll('*'));
        
        // Strategy: Find elements that contain "Draft", "Sheet", "Memo", "Summary" etc.
        const potentialSlots = allElements.filter(el => {
          const text = el.textContent || '';
          const isSlot = /\(Draft\)|\(Sheet\)|\(Memo\)|\(Summary\)|Letter Draft|Request Draft/i.test(text);
          return isSlot && text.length < 500;
        });

        for (const slotEl of potentialSlots) {
          // Find the container that has buttons
          let container = slotEl;
          for (let i = 0; i < 15 && container; i++) {
            container = container.parentElement;
            if (!container) break;
            
            const buttonsInContainer = Array.from(container.querySelectorAll('button'));
            const addBtn = buttonsInContainer.find(b => b.textContent?.trim() === 'Add');
            const createBtn = buttonsInContainer.find(b => b.textContent?.trim() === 'Create');
            const templateBtn = buttonsInContainer.find(b => b.textContent?.trim() === 'Template');
            
            if (addBtn || createBtn || templateBtn) {
              // Get slot name
              const slotName = slotEl.textContent?.split('\n')[0]?.trim() || 'Unknown';
              
              // Get button states
              const addStyle = addBtn ? window.getComputedStyle(addBtn) : null;
              const createStyle = createBtn ? window.getComputedStyle(createBtn) : null;
              const templateStyle = templateBtn ? window.getComputedStyle(templateBtn) : null;
              
              slots.push({
                name: slotName.substring(0, 100),
                hasAdd: !!addBtn,
                hasCreate: !!createBtn,
                hasTemplate: !!templateBtn,
                addDimmed: addBtn ? (parseFloat(addStyle.opacity) < 1 || addBtn.className.includes('opacity-50')) : null,
                createActive: createBtn ? (parseFloat(createStyle.opacity) >= 0.9 && !createBtn.disabled) : null,
                templateActive: templateBtn ? (parseFloat(templateStyle.opacity) >= 0.9 && !templateBtn.disabled) : null,
              });
              break;
            }
          }
        }

        return {
          slotsFound: slots.length,
          slots: slots,
        };
      }, sectionNumber);

      if (sectionData.error) {
        log.push(`✗ Error: ${sectionData.error}`);
        results[resultKey] = { error: sectionData.error };
        return;
      }

      log.push(`✓ Found ${sectionData.slotsFound} slots`);
      results[resultKey].slots = sectionData.slots;

      // Log each slot
      sectionData.slots.forEach((slot, i) => {
        log.push(`\n  Slot ${i + 1}: ${slot.name}`);
        log.push(`    • Add button: ${slot.hasAdd ? (slot.addDimmed ? '✓ Present (dimmed)' : '⚠ Present (NOT dimmed)') : '✗ Missing'}`);
        log.push(`    • Create button: ${slot.hasCreate ? (slot.createActive ? '✓ Present (active)' : '⚠ Present (inactive)') : '✗ Missing'}`);
        log.push(`    • Template button: ${slot.hasTemplate ? (slot.templateActive ? '✓ Present (active)' : '⚠ Present (inactive)') : '✗ Missing'}`);
      });

      // Try to click Create on first builder slot
      if (sectionData.slots.length > 0 && sectionData.slots[0].hasCreate) {
        log.push(`\nStep 5: Clicking Create button on first slot...`);
        
        const clickResult = await page.evaluate((num) => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const sectionHeader = buttons.find(b => {
            const text = b.textContent || '';
            return new RegExp(`^${num}\\.\\s+`).test(text);
          });
          
          if (!sectionHeader) return { success: false, error: 'Section not found' };
          
          let contentContainer = sectionHeader.parentElement;
          while (contentContainer && !contentContainer.querySelector('[role="region"]')) {
            contentContainer = contentContainer.parentElement;
            if (!contentContainer || contentContainer === document.body) break;
          }
          
          if (!contentContainer) {
            contentContainer = sectionHeader.parentElement?.nextElementSibling;
          }
          
          // Find first Create button
          const allButtons = Array.from(contentContainer.querySelectorAll('button'));
          const createBtn = allButtons.find(b => b.textContent?.trim() === 'Create');
          
          if (createBtn) {
            createBtn.click();
            return { success: true };
          }
          
          return { success: false, error: 'Create button not found' };
        }, sectionNumber);

        if (clickResult.success) {
          log.push('✓ Clicked Create button');
          await wait(2000);
          
          // Check if modal/overlay opened
          const modalCheck = await page.evaluate(() => {
            const modals = document.querySelectorAll('[role="dialog"]');
            const overlays = document.querySelectorAll('[class*="modal"], [class*="Modal"], [class*="overlay"]');
            return {
              modalCount: modals.length,
              overlayCount: overlays.length,
              hasModal: modals.length > 0 || overlays.length > 0,
            };
          });
          
          if (modalCheck.hasModal) {
            log.push(`✓ Modal/builder opened (${modalCheck.modalCount} dialog(s) detected)`);
            results[resultKey].createOpensModal = true;
            
            // Close modal
            log.push('Step 6: Closing modal...');
            await page.keyboard.press('Escape');
            await wait(1500);
            log.push('✓ Modal closed');
          } else {
            log.push('⚠ No modal detected after clicking Create');
            results[resultKey].createOpensModal = false;
          }
        } else {
          log.push(`✗ Failed to click Create: ${clickResult.error}`);
        }
      } else {
        log.push('\n⚠ No builder slots with Create button found, skipping Create click test');
      }

      log.push(''); // Empty line for spacing
    }

    // Verify each section
    await verifySection(4, 'Cover Letter / Legal Brief', 'section4');
    await verifySection(5, 'Evidence (Criteria)', 'section5');
    await verifySection(6, 'Supporting Documents', 'section6');
    await verifySection(7, 'Expert Letters', 'section7');
    await verifySection(8, 'Recommendation Letters', 'section8');

  } catch (error) {
    log.push(`\nERROR: ${error.message}`);
    console.error(error);
  } finally {
    if (browser) {
      await wait(3000);
      await browser.close();
    }
  }

  return { log, results };
}

console.log('═══════════════════════════════════════════════════════════');
console.log('  SECTIONS 4-8 BUILDER BUTTONS VERIFICATION');
console.log('═══════════════════════════════════════════════════════════\n');

const { log, results } = await verifySectionsBuilderButtons();

// Print log
log.forEach(line => console.log(line));

// Save detailed results
writeFileSync(
  '/Users/sergeysopot/LMS-EB1A/builder-buttons-results.json',
  JSON.stringify(results, null, 2)
);

// Print summary
console.log('\n' + '='.repeat(60));
console.log('SUMMARY');
console.log('='.repeat(60) + '\n');

function printSectionSummary(sectionNum, sectionData) {
  console.log(`Section ${sectionNum}:`);
  if (sectionData.error) {
    console.log(`  ✗ Error: ${sectionData.error}`);
    return;
  }
  
  if (!sectionData.slots || sectionData.slots.length === 0) {
    console.log('  ⚠ No builder slots found');
    return;
  }
  
  console.log(`  Builder slots found: ${sectionData.slots.length}`);
  
  const allHaveCreate = sectionData.slots.every(s => s.hasCreate);
  const allHaveTemplate = sectionData.slots.every(s => s.hasTemplate);
  const allAddDimmed = sectionData.slots.every(s => s.addDimmed);
  
  console.log(`  Create buttons: ${allHaveCreate ? '✓ ALL present' : '✗ SOME missing'}`);
  console.log(`  Template buttons: ${allHaveTemplate ? '✓ ALL present' : '✗ SOME missing'}`);
  console.log(`  Add buttons dimmed: ${allAddDimmed ? '✓ ALL dimmed' : '⚠ SOME not dimmed'}`);
  console.log(`  Create opens modal: ${sectionData.createOpensModal ? '✓ YES' : '✗ NO'}`);
  
  sectionData.slots.forEach((slot, i) => {
    const status = (slot.hasCreate && slot.hasTemplate && slot.addDimmed) ? '✓' : '⚠';
    console.log(`    ${status} ${slot.name}`);
  });
  console.log();
}

printSectionSummary(4, results.section4);
printSectionSummary(5, results.section5);
printSectionSummary(6, results.section6);
printSectionSummary(7, results.section7);
printSectionSummary(8, results.section8);

console.log('Results saved to: builder-buttons-results.json');
console.log('Screenshots saved to: screenshots/section[4-8]-expanded.png\n');

process.exit(0);
