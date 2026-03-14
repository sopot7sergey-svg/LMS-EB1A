import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'fs';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function verifyDocumentAssistant() {
  mkdirSync('screenshots', { recursive: true });

  const results = {
    loginSuccess: false,
    pageReached: null,
    toolCardRename: {
      hasDocumentAssistant: false,
      hasCreator: false,
      hasFormsFiller: false,
      toolCardNames: [],
    },
    documentAssistantModal: {
      opened: false,
      options: [],
      fullText: '',
    },
    formsAndFeesCheck: {
      found: false,
      formI140HasButtons: false,
      fillButtonExists: false,
      templateButtonExists: false,
      addButtonExists: false,
    },
    fillFlowCheck: {
      modalType: null,
      isStepBased: false,
      hasStepIndicator: false,
      hasInputFields: false,
      notFullFormModal: false,
    },
    helpIconCheck: {
      found: false,
      clicked: false,
      whatAppears: null,
    },
    voiceInputCheck: {
      foundInFillFlow: false,
      locations: [],
    },
    additionalFormCheck: {
      tested: null,
      usesBuilderFlow: false,
    },
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
    console.log('2. Opening case workspace...');
    await page.goto('http://localhost:3000/case', { waitUntil: 'networkidle2' });
    await wait(2000);

    const caseClicked = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('a, button'));
      const viewCaseBtn = allElements.find(el => el.textContent?.includes('View Case'));
      if (viewCaseBtn) {
        viewCaseBtn.click();
        return true;
      }
      return false;
    });
    await wait(3000);
    results.pageReached = page.url();
    console.log('   Opened case workspace:', caseClicked);

    await page.screenshot({ path: 'screenshots/01-case-workspace.png', fullPage: true });

    // 3. Check for tool cards (Document Assistant vs Creator vs Forms Filler)
    console.log('3. Checking tool card names...');
    
    const toolCardInfo = await page.evaluate(() => {
      const bodyText = document.body.textContent || '';
      const allButtons = Array.from(document.querySelectorAll('button'));
      const allText = Array.from(document.querySelectorAll('*'))
        .map(el => el.textContent?.trim())
        .filter(t => t && t.length < 100);
      
      // Look for tool card-like elements
      const hasDocumentAssistant = bodyText.includes('Document Assistant');
      const hasCreator = bodyText.includes('Creator') && !bodyText.includes('Document Creator');
      const hasFormsFiller = bodyText.includes('Forms Filler') || bodyText.includes('Form Filler');
      
      // Find all card-like headers
      const cards = Array.from(document.querySelectorAll('h2, h3, [class*="card"] h2, [class*="card"] h3, [class*="Card"] > *'));
      const cardTexts = cards
        .map(c => c.textContent?.trim())
        .filter(t => t && t.length > 0 && t.length < 50);
      
      return {
        hasDocumentAssistant,
        hasCreator,
        hasFormsFiller,
        toolCardNames: Array.from(new Set(cardTexts)).slice(0, 20),
      };
    });

    results.toolCardRename = toolCardInfo;
    console.log('   Tool cards:', JSON.stringify(toolCardInfo, null, 2));

    // 4. Open Document Assistant
    console.log('4. Opening Document Assistant...');
    
    const daClicked = await page.evaluate(() => {
      const allButtons = Array.from(document.querySelectorAll('button'));
      const daButton = allButtons.find(b => {
        const text = b.textContent || '';
        return text.includes('Document Assistant');
      });
      if (daButton) {
        daButton.scrollIntoView({ block: 'center' });
        daButton.click();
        return true;
      }
      return false;
    });

    console.log('   Document Assistant button clicked:', daClicked);
    await wait(2000);

    const daModalInfo = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]');
      if (!modal) return { opened: false };

      const text = modal.textContent || '';
      
      // Find all clickable options/buttons in the modal
      const buttons = Array.from(modal.querySelectorAll('button'));
      const options = buttons
        .map(b => b.textContent?.trim())
        .filter(t => t && t.length > 0 && t.length < 100 && !['Close', '×', 'Cancel'].includes(t));
      
      return {
        opened: true,
        options,
        fullText: text.substring(0, 500),
      };
    });

    results.documentAssistantModal = daModalInfo;
    console.log('   Document Assistant modal:', JSON.stringify(daModalInfo, null, 2));

    await page.screenshot({ path: 'screenshots/02-document-assistant-modal.png', fullPage: true });

    // Close modal
    await page.keyboard.press('Escape');
    await wait(1000);

    // 5. Check Forms & Fees
    console.log('5. Checking Forms & Fees section...');
    
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const formsBtn = buttons.find(b => b.textContent?.includes('Forms & Fees'));
      if (formsBtn) {
        formsBtn.scrollIntoView({ block: 'center' });
        formsBtn.click();
      }
    });
    await wait(2000);

    const formsFeesInfo = await page.evaluate(() => {
      const bodyText = document.body.textContent || '';
      const allButtons = Array.from(document.querySelectorAll('button'));
      
      const hasFormI140 = bodyText.includes('Form I-140 (final signed PDF)');
      const fillButtons = allButtons.filter(b => b.textContent?.trim() === 'Fill');
      const templateButtons = allButtons.filter(b => b.textContent?.trim() === 'Template');
      const addButtons = allButtons.filter(b => b.textContent?.trim() === '+ Add');
      
      return {
        found: bodyText.includes('Forms & Fees'),
        formI140HasButtons: hasFormI140,
        fillButtonExists: fillButtons.length > 0,
        templateButtonExists: templateButtons.length > 0,
        addButtonExists: addButtons.length > 0,
        fillCount: fillButtons.length,
      };
    });

    results.formsAndFeesCheck = formsFeesInfo;
    console.log('   Forms & Fees:', JSON.stringify(formsFeesInfo, null, 2));

    await page.screenshot({ path: 'screenshots/03-forms-fees-expanded.png', fullPage: true });

    // 6. Click Fill for Form I-140 (final)
    console.log('6. Testing Fill button for Form I-140 (final)...');
    
    const fillClicked = await page.evaluate(() => {
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
    await wait(3000);

    const fillFlowInfo = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]');
      if (!modal) return { modalType: 'none' };

      const text = modal.textContent || '';
      const html = modal.innerHTML;
      
      // Check for step-based indicators
      const hasStepIndicator = text.includes('Step') || 
                              text.match(/\d+\s*\/\s*\d+/) !== null ||
                              modal.querySelectorAll('[class*="step"]').length > 0;
      
      const hasProgressBar = modal.querySelector('progress') !== null ||
                            html.includes('progress') ||
                            html.includes('stepper');
      
      const inputCount = modal.querySelectorAll('input, textarea').length;
      const hasInputFields = inputCount > 0;
      
      // Check if it's NOT a full form with many fields (old style)
      const notFullFormModal = inputCount < 15; // Old form had many fields at once
      
      const isStepBased = hasStepIndicator || hasProgressBar;
      
      return {
        modalType: 'step-based-builder',
        isStepBased,
        hasStepIndicator,
        hasInputFields,
        inputCount,
        notFullFormModal,
        textPreview: text.substring(0, 400),
      };
    });

    results.fillFlowCheck = fillFlowInfo;
    console.log('   Fill flow:', JSON.stringify(fillFlowInfo, null, 2));

    await page.screenshot({ path: 'screenshots/04-fill-flow-modal.png', fullPage: true });

    // 7. Click ? help icon
    console.log('7. Looking for ? help icon...');
    
    const helpIconInfo = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]');
      if (!modal) return { found: false };

      // Look for help button/icon (?, help, info icon)
      const allButtons = Array.from(modal.querySelectorAll('button, [role="button"]'));
      const helpBtn = allButtons.find(b => {
        const text = b.textContent?.trim() || '';
        const html = b.innerHTML;
        return text === '?' || text.toLowerCase() === 'help' || 
               html.includes('help') || html.includes('question') ||
               b.getAttribute('aria-label')?.toLowerCase().includes('help');
      });
      
      if (helpBtn) {
        helpBtn.click();
        return { found: true, clicked: true };
      }
      
      return { found: false, clicked: false };
    });

    console.log('   Help icon:', JSON.stringify(helpIconInfo, null, 2));
    await wait(1500);

    if (helpIconInfo.clicked) {
      const helpAppearance = await page.evaluate(() => {
        const modal = document.querySelector('[role="dialog"]');
        if (!modal) return null;

        const text = modal.textContent || '';
        
        // Check what appeared after clicking help
        const hasTooltip = document.querySelector('[role="tooltip"]') !== null;
        const hasPopover = modal.querySelector('[class*="popover"]') !== null;
        const hasHelpText = text.includes('help') || text.includes('Help');
        
        let whatAppears = null;
        if (hasTooltip) {
          const tooltip = document.querySelector('[role="tooltip"]');
          whatAppears = { type: 'tooltip', text: tooltip?.textContent?.substring(0, 200) };
        } else if (hasPopover) {
          whatAppears = { type: 'popover', detected: true };
        } else {
          // Check if help text appeared inline
          whatAppears = { type: 'inline', hasHelpText };
        }
        
        return whatAppears;
      });

      results.helpIconCheck = { ...helpIconInfo, whatAppears: helpAppearance };
      console.log('   Help appearance:', JSON.stringify(helpAppearance, null, 2));

      await page.screenshot({ path: 'screenshots/05-help-clicked.png', fullPage: true });
    } else {
      results.helpIconCheck = helpIconInfo;
    }

    // 8. Check for voice input
    console.log('8. Checking for voice input controls...');
    
    const voiceInputInfo = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]');
      if (!modal) return { foundInFillFlow: false };

      const html = modal.innerHTML.toLowerCase();
      const text = modal.textContent?.toLowerCase() || '';
      
      const hasMicIcon = html.includes('microphone') || html.includes('mic') || html.includes('voice');
      const hasVoiceButton = Array.from(modal.querySelectorAll('button')).some(b => {
        const btnText = b.textContent?.toLowerCase() || '';
        const ariaLabel = b.getAttribute('aria-label')?.toLowerCase() || '';
        return btnText.includes('voice') || btnText.includes('mic') ||
               ariaLabel.includes('voice') || ariaLabel.includes('microphone');
      });
      
      return {
        foundInFillFlow: hasMicIcon || hasVoiceButton,
        hasMicIcon,
        hasVoiceButton,
      };
    });

    results.voiceInputCheck = voiceInputInfo;
    console.log('   Voice input:', JSON.stringify(voiceInputInfo, null, 2));

    // Close current modal
    await page.keyboard.press('Escape');
    await wait(1000);

    // 9. Test additional form (G-1145)
    console.log('9. Testing Form G-1145 Fill button...');
    
    const g1145Clicked = await page.evaluate(() => {
      const bodyText = document.body.textContent || '';
      if (!bodyText.includes('Form G-1145')) return false;
      
      // Find all Fill buttons, look for the one near G-1145
      const allElements = Array.from(document.querySelectorAll('*'));
      const g1145Element = allElements.find(el => {
        const text = el.textContent || '';
        return text.includes('Form G-1145') && text.length < 200;
      });
      
      if (!g1145Element) return false;
      
      // Find parent container and look for Fill button
      let parent = g1145Element.parentElement;
      for (let i = 0; i < 5 && parent; i++) {
        const buttons = Array.from(parent.querySelectorAll('button'));
        const fillBtn = buttons.find(b => b.textContent?.trim() === 'Fill');
        if (fillBtn) {
          fillBtn.click();
          return true;
        }
        parent = parent.parentElement;
      }
      return false;
    });

    console.log('   G-1145 Fill clicked:', g1145Clicked);
    await wait(3000);

    if (g1145Clicked) {
      const g1145FlowInfo = await page.evaluate(() => {
        const modal = document.querySelector('[role="dialog"]');
        if (!modal) return { usesBuilderFlow: false };

        const text = modal.textContent || '';
        const isStepBased = text.includes('Step') || text.match(/\d+\s*\/\s*\d+/) !== null;
        const hasProgressIndicator = modal.querySelector('progress') !== null;
        
        return {
          usesBuilderFlow: isStepBased || hasProgressIndicator,
          hasStepIndicator: isStepBased,
          textPreview: text.substring(0, 200),
        };
      });

      results.additionalFormCheck = {
        tested: 'Form G-1145',
        ...g1145FlowInfo,
      };
      console.log('   G-1145 flow:', JSON.stringify(g1145FlowInfo, null, 2));

      await page.screenshot({ path: 'screenshots/06-g1145-fill-flow.png', fullPage: true });
    }

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

const results = await verifyDocumentAssistant();
writeFileSync('document-assistant-verification.json', JSON.stringify(results, null, 2));

console.log('\n=== RESULTS ===');
console.log(JSON.stringify(results, null, 2));
