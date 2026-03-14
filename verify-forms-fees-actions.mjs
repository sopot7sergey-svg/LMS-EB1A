import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'fs';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function verifyFormsFees() {
  const results = {
    supportedSlots: [],
    unsupportedSlots: [],
    regressions: [],
  };

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // LOGIN
    console.log('=== LOGGING IN ===');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2', timeout: 30000 });
    await page.type('input[type="email"]', 'test@example.com');
    await page.type('input[type="password"]', 'Test1234');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ timeout: 10000 }).catch(() => {});
    await wait(2000);
    console.log('✓ Logged in');

    // NAVIGATE TO FIRST CASE
    console.log('\n=== NAVIGATING TO FIRST CASE ===');
    await page.goto('http://localhost:3000/case', { waitUntil: 'networkidle2' });
    await wait(2000);
    
    const caseClicked = await page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll('a'));
      const viewLink = allLinks.find(link => link.textContent && link.textContent.includes('View Case'));
      if (viewLink) {
        viewLink.click();
        return true;
      }
      return false;
    });
    
    if (!caseClicked) {
      throw new Error('Could not find first case to open');
    }
    
    await wait(3000);
    console.log('✓ Opened first case:', page.url());
    await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/forms-fees-01-case.png', fullPage: true });

    // FIND AND EXPAND FORMS & FEES SECTION
    console.log('\n=== FINDING FORMS & FEES SECTION ===');
    
    const formsSectionFound = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      const formsSection = allElements.find(el => {
        const text = el.textContent || '';
        return text.includes('Forms & Fees') && text.includes('2.') && text.length < 100;
      });
      
      if (!formsSection) return { found: false };
      
      // Try to find and click the button to expand if needed
      let current = formsSection;
      for (let i = 0; i < 5 && current; i++) {
        if (current.tagName === 'BUTTON') {
          current.click();
          return { found: true, clicked: true };
        }
        current = current.parentElement;
      }
      
      return { found: true, clicked: false };
    });
    
    if (!formsSectionFound.found) {
      throw new Error('Forms & Fees section not found');
    }
    
    console.log('✓ Forms & Fees section found');
    if (formsSectionFound.clicked) {
      console.log('✓ Expanded Forms & Fees section');
    }
    
    await wait(1500);
    await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/forms-fees-02-expanded.png', fullPage: true });

    // ANALYZE EACH SLOT IN FORMS & FEES
    console.log('\n=== ANALYZING SLOTS ===');
    
    const slotsInfo = await page.evaluate(() => {
      const slots = [];
      
      // Known supported slots (should have Fill/Template/Add)
      const supportedNames = [
        'Form I-140',
        'I-140',
        'Form G-1145',
        'G-1145',
      ];
      
      // Known unsupported slots (should be upload-only)
      const unsupportedNames = [
        'Filing Fee Worksheet',
        'Payment Method Proof',
        'Fee Worksheet',
      ];
      
      // Find all elements that might be slot containers
      const allElements = Array.from(document.querySelectorAll('*'));
      
      // Look for slots by finding text that contains slot names
      [...supportedNames, ...unsupportedNames].forEach(slotName => {
        const slotElement = allElements.find(el => {
          const text = el.textContent || '';
          // Match the slot name but not too much text (avoid parent containers)
          return text.includes(slotName) && text.length < 500;
        });
        
        if (!slotElement) return;
        
        // Find the container with buttons
        let container = slotElement;
        for (let i = 0; i < 10 && container; i++) {
          const buttons = Array.from(container.querySelectorAll('button'));
          if (buttons.length > 0) {
            // Found a container with buttons
            const buttonTexts = buttons.map(b => b.textContent?.trim()).filter(Boolean);
            
            slots.push({
              name: slotName,
              supported: supportedNames.includes(slotName),
              buttons: buttonTexts,
              hasFill: buttonTexts.some(t => t === 'Fill'),
              hasTemplate: buttonTexts.some(t => t === 'Template'),
              hasAdd: buttonTexts.some(t => t === 'Add' || t === '+ Add'),
              hasCreate: buttonTexts.some(t => t === 'Create'),
              hasUpload: buttonTexts.some(t => t.includes('Upload') || t.includes('upload')),
              containerText: container.textContent?.substring(0, 200),
            });
            break;
          }
          container = container.parentElement;
        }
      });
      
      return slots;
    });
    
    console.log(`Found ${slotsInfo.length} slots to analyze`);
    
    // Categorize and check for regressions
    slotsInfo.forEach(slot => {
      console.log(`\n--- ${slot.name} (${slot.supported ? 'SUPPORTED' : 'UNSUPPORTED'}) ---`);
      console.log('Buttons:', slot.buttons);
      console.log('Has Fill:', slot.hasFill);
      console.log('Has Template:', slot.hasTemplate);
      console.log('Has Add:', slot.hasAdd);
      console.log('Has Create:', slot.hasCreate);
      
      if (slot.supported) {
        // Supported slot should have Fill/Template/Add
        const hasExpectedActions = slot.hasFill || slot.hasTemplate || slot.hasAdd;
        
        if (!hasExpectedActions) {
          console.log('❌ REGRESSION: Supported slot missing builder actions');
          results.regressions.push({
            slot: slot.name,
            type: 'supported',
            issue: 'Missing builder actions (Fill/Template/Add)',
            buttons: slot.buttons,
          });
        } else {
          console.log('✓ PASS: Has builder actions');
        }
        
        results.supportedSlots.push({
          name: slot.name,
          status: hasExpectedActions ? 'PASS' : 'FAIL',
          buttons: slot.buttons,
          hasFill: slot.hasFill,
          hasTemplate: slot.hasTemplate,
          hasAdd: slot.hasAdd,
        });
      } else {
        // Unsupported slot should NOT have Fill/Template/Create
        const hasBuilderActions = slot.hasFill || slot.hasTemplate || slot.hasCreate;
        
        if (hasBuilderActions) {
          console.log('❌ REGRESSION: Unsupported slot exposing builder actions');
          results.regressions.push({
            slot: slot.name,
            type: 'unsupported',
            issue: 'Exposing builder actions (should be upload-only)',
            buttons: slot.buttons,
            exposedActions: {
              fill: slot.hasFill,
              template: slot.hasTemplate,
              create: slot.hasCreate,
            },
          });
        } else {
          console.log('✓ PASS: Upload-only (no builder actions)');
        }
        
        results.unsupportedSlots.push({
          name: slot.name,
          status: hasBuilderActions ? 'FAIL' : 'PASS',
          buttons: slot.buttons,
          isUploadOnly: !hasBuilderActions,
        });
      }
    });
    
    // If we didn't find some expected slots, note it
    const expectedSupported = ['Form I-140', 'Form G-1145'];
    const expectedUnsupported = ['Filing Fee Worksheet', 'Payment Method Proof'];
    
    const foundSupportedNames = results.supportedSlots.map(s => s.name);
    const foundUnsupportedNames = results.unsupportedSlots.map(s => s.name);
    
    expectedSupported.forEach(name => {
      if (!foundSupportedNames.some(found => found.includes(name.replace('Form ', '')))) {
        console.log(`\n⚠ WARNING: Expected supported slot "${name}" not found or not analyzed`);
      }
    });
    
    expectedUnsupported.forEach(name => {
      if (!foundUnsupportedNames.some(found => found.includes(name))) {
        console.log(`\n⚠ WARNING: Expected unsupported slot "${name}" not found or not analyzed`);
      }
    });

    await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/forms-fees-03-final.png', fullPage: true });

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    results.error = {
      message: error.message,
      stack: error.stack,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return results;
}

console.log('='.repeat(60));
console.log('FORMS & FEES ACTIONS VERIFICATION');
console.log('='.repeat(60));

const results = await verifyFormsFees();

writeFileSync(
  '/Users/sergeysopot/LMS-EB1A/forms-fees-actions-results.json',
  JSON.stringify(results, null, 2)
);

console.log('\n' + '='.repeat(60));
console.log('SUMMARY');
console.log('='.repeat(60));

console.log('\n✅ SUPPORTED SLOTS (should have Fill/Template/Add):');
results.supportedSlots.forEach(slot => {
  const icon = slot.status === 'PASS' ? '✓' : '❌';
  console.log(`  ${icon} ${slot.name}: ${slot.status}`);
  console.log(`     Actions: ${slot.buttons.join(', ')}`);
});

console.log('\n✅ UNSUPPORTED SLOTS (should be upload-only):');
results.unsupportedSlots.forEach(slot => {
  const icon = slot.status === 'PASS' ? '✓' : '❌';
  console.log(`  ${icon} ${slot.name}: ${slot.status}`);
  console.log(`     Actions: ${slot.buttons.join(', ')}`);
});

if (results.regressions.length > 0) {
  console.log('\n' + '='.repeat(60));
  console.log('⚠️  REGRESSIONS FOUND:', results.regressions.length);
  console.log('='.repeat(60));
  results.regressions.forEach((reg, i) => {
    console.log(`\n${i + 1}. ${reg.slot} (${reg.type})`);
    console.log(`   Issue: ${reg.issue}`);
    console.log(`   Buttons: ${reg.buttons.join(', ')}`);
  });
} else {
  console.log('\n✅ NO REGRESSIONS FOUND');
}

console.log('\n✓ Results saved to forms-fees-actions-results.json');

process.exit(results.regressions.length > 0 ? 1 : 0);
