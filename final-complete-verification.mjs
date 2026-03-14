import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'fs';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function waitForModal(page, timeoutMs = 8000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const hasModal = await page.evaluate(() => {
      return document.querySelector('[role="dialog"]') !== null;
    });
    if (hasModal) return true;
    await wait(200);
  }
  return false;
}

mkdirSync('screenshots', { recursive: true });

const results = {
  login: null,
  caseWorkspace: null,
  documentAssistantCard: null,
  documentAssistantModal: null,
  formI140Fill: null,
  helpButton: null,
  voiceInput: null,
  additionalForm: null,
  errors: [],
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
      results.errors.push({ type: 'console', text: msg.text().substring(0, 200) });
    }
  });

  page.on('pageerror', error => {
    results.errors.push({ type: 'pageerror', text: error.message.substring(0, 200) });
  });

  // 1. Login
  console.log('1. Login...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2', timeout: 30000 });
  await page.type('input[type="email"]', 'test@example.com');
  await page.type('input[type="password"]', 'Test1234');
  await page.click('button[type="submit"]');
  await wait(4000);

  const loginSuccess = !page.url().includes('/login');
  results.login = { success: loginSuccess, url: page.url() };
  console.log('   Success:', loginSuccess);

  // 2. Open case workspace
  console.log('2. Open case workspace...');
  await page.goto('http://localhost:3000/case', { waitUntil: 'networkidle2' });
  await wait(2000);

  await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a, button'));
    const viewCase = links.find(l => l.textContent?.includes('View Case'));
    if (viewCase) viewCase.click();
  });
  await wait(4000);

  results.caseWorkspace = { url: page.url(), opened: page.url().includes('/case/') };
  console.log('   Opened:', results.caseWorkspace.opened);

  await page.screenshot({ path: 'screenshots/final-01-workspace.png', fullPage: true });

  // 3. Check Document Assistant card
  console.log('3. Check Document Assistant card...');
  const cardCheck = await page.evaluate(() => {
    const bodyText = document.body.textContent || '';
    
    // Find all card-like elements in the top section
    const cards = Array.from(document.querySelectorAll('[class*="card"], [class*="Card"]'))
      .map(c => c.textContent?.trim().substring(0, 50))
      .filter(t => t && t.length > 5);
    
    return {
      hasDocumentAssistant: bodyText.includes('Document Assistant'),
      hasFormsFiller: bodyText.includes('Forms Filler'),
      hasCreator: bodyText.includes('Creator') && !bodyText.includes('Document Creator'),
      topSectionText: bodyText.substring(0, 500),
    };
  });

  results.documentAssistantCard = cardCheck;
  console.log('   Has Document Assistant:', cardCheck.hasDocumentAssistant);
  console.log('   Has Forms Filler:', cardCheck.hasFormsFiller);

  // 4. Open Document Assistant modal
  console.log('4. Open Document Assistant modal...');
  
  // Try clicking the card itself
  const daOpened = await page.evaluate(() => {
    // Look for the Document Assistant card element
    const allElements = Array.from(document.querySelectorAll('*'));
    const daCard = allElements.find(el => {
      const text = el.textContent || '';
      const classes = el.className || '';
      return text.includes('Document Assistant') && 
             text.length < 200 &&
             (classes.includes('card') || classes.includes('Card'));
    });
    
    if (daCard && daCard.click) {
      daCard.click();
      return true;
    }
    
    // Fallback: click any clickable element with Document Assistant text
    const clickables = Array.from(document.querySelectorAll('button, a, [role="button"], [onclick]'));
    const daButton = clickables.find(el => el.textContent?.includes('Document Assistant'));
    if (daButton) {
      daButton.click();
      return true;
    }
    
    return false;
  });

  console.log('   Clicked Document Assistant:', daOpened);
  await wait(3000);

  const daModalOpened = await waitForModal(page);
  console.log('   Modal opened:', daModalOpened);

  if (daModalOpened) {
    await page.screenshot({ path: 'screenshots/final-02-da-modal.png', fullPage: true });

    const daModalContent = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]');
      if (!modal) return null;

      const text = modal.textContent || '';
      const title = modal.querySelector('h1, h2, h3, [class*="title"]')?.textContent?.trim() || '';
      
      // Get all buttons/options
      const buttons = Array.from(modal.querySelectorAll('button'));
      const options = buttons
        .map(b => b.textContent?.trim())
        .filter(t => t && t.length > 0 && t.length < 100 && 
                !['Close', '×', 'Cancel', 'close'].some(x => t.toLowerCase().includes(x.toLowerCase())));
      
      // Get any list items or options
      const listItems = Array.from(modal.querySelectorAll('li, [role="option"]'))
        .map(li => li.textContent?.trim())
        .filter(t => t && t.length < 100);
      
      return {
        title,
        options: Array.from(new Set([...options, ...listItems])),
        textPreview: text.substring(0, 600),
      };
    });

    results.documentAssistantModal = daModalContent;
    console.log('   Modal content:', JSON.stringify(daModalContent, null, 2));

    await page.keyboard.press('Escape');
    await wait(1500);
  } else {
    results.documentAssistantModal = { opened: false };
  }

  // 5. Open Forms & Fees and click Fill for Form I-140
  console.log('5. Forms & Fees - Fill Form I-140...');
  
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const formsBtn = buttons.find(b => b.textContent?.includes('2. Forms & Fees'));
    if (formsBtn) {
      formsBtn.scrollIntoView({ block: 'center' });
      formsBtn.click();
    }
  });
  await wait(2500);

  await page.screenshot({ path: 'screenshots/final-03-forms-fees.png', fullPage: true });

  await page.evaluate(() => {
    const allButtons = Array.from(document.querySelectorAll('button'));
    const fillBtn = allButtons.find(b => b.textContent?.trim() === 'Fill');
    if (fillBtn) {
      fillBtn.scrollIntoView({ block: 'center' });
      fillBtn.click();
    }
  });

  console.log('   Waiting for Fill modal...');
  await wait(5000); // Give it extra time
  
  const fillModalOpened = await waitForModal(page, 3000);
  console.log('   Fill modal opened:', fillModalOpened);

  if (fillModalOpened) {
    await page.screenshot({ path: 'screenshots/final-04-fill-modal.png', fullPage: true });

    const fillModalInfo = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]');
      if (!modal) return null;

      const text = modal.textContent || '';
      const html = modal.innerHTML;
      
      // Get title
      const titleEl = modal.querySelector('h1, h2, h3, [class*="title" i]');
      const title = titleEl?.textContent?.trim() || '';
      
      // Check if step-based
      const hasStepText = /step\s*\d+/i.test(text) || /\d+\s*\/\s*\d+/.test(text);
      const hasProgressBar = modal.querySelector('progress') !== null;
      const hasStepper = html.includes('stepper') || modal.querySelectorAll('[class*="step" i]').length > 2;
      const hasNavButtons = Array.from(modal.querySelectorAll('button')).some(b => 
        ['Next', 'Continue', 'Previous', 'Back'].includes(b.textContent?.trim() || '')
      );
      
      // Count form elements
      const inputCount = modal.querySelectorAll('input, textarea, select').length;
      
      return {
        title,
        isStepBased: hasStepText || hasProgressBar || hasStepper || hasNavButtons,
        hasStepText,
        hasProgressBar,
        hasStepper,
        hasNavButtons,
        inputCount,
        textPreview: text.substring(0, 400),
      };
    });

    results.formI140Fill = fillModalInfo;
    console.log('   Fill modal:', JSON.stringify(fillModalInfo, null, 2));

    // 6. Look for help button and click it
    console.log('6. Looking for help button...');
    
    // Try to advance to first question if there's a Next/Continue button
    const advanced = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]');
      if (!modal) return false;
      
      const buttons = Array.from(modal.querySelectorAll('button'));
      const nextBtn = buttons.find(b => {
        const text = b.textContent?.trim() || '';
        return ['Next', 'Continue'].includes(text);
      });
      
      if (nextBtn) {
        nextBtn.click();
        return true;
      }
      return false;
    });

    if (advanced) {
      console.log('   Advanced to next step');
      await wait(2000);
      await page.screenshot({ path: 'screenshots/final-05-after-advance.png', fullPage: true });
    }

    // Look for help buttons
    const helpButtonInfo = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]');
      if (!modal) return null;

      // Find all potential help buttons
      const allButtons = Array.from(modal.querySelectorAll('button, [role="button"]'));
      const helpButtons = allButtons.filter(b => {
        const text = b.textContent?.trim() || '';
        const ariaLabel = b.getAttribute('aria-label') || '';
        const title = b.getAttribute('title') || '';
        
        return text === '?' || 
               text.toLowerCase() === 'help' ||
               ariaLabel.toLowerCase().includes('help') ||
               title.toLowerCase().includes('help');
      });

      return {
        found: helpButtons.length > 0,
        count: helpButtons.length,
        details: helpButtons.map(b => ({
          text: b.textContent?.trim(),
          ariaLabel: b.getAttribute('aria-label'),
          title: b.getAttribute('title'),
        })),
      };
    });

    console.log('   Help buttons:', JSON.stringify(helpButtonInfo, null, 2));

    if (helpButtonInfo?.found) {
      const helpClicked = await page.evaluate(() => {
        const modal = document.querySelector('[role="dialog"]');
        if (!modal) return false;

        const allButtons = Array.from(modal.querySelectorAll('button, [role="button"]'));
        const helpBtn = allButtons.find(b => {
          const text = b.textContent?.trim() || '';
          const ariaLabel = b.getAttribute('aria-label') || '';
          return text === '?' || ariaLabel.toLowerCase().includes('help');
        });

        if (helpBtn) {
          helpBtn.click();
          return true;
        }
        return false;
      });

      console.log('   Help button clicked:', helpClicked);
      await wait(2000);

      await page.screenshot({ path: 'screenshots/final-06-help-clicked.png', fullPage: true });

      const helpContent = await page.evaluate(() => {
        // Check for tooltip
        const tooltip = document.querySelector('[role="tooltip"]');
        if (tooltip) {
          return {
            type: 'tooltip',
            content: tooltip.textContent?.trim().substring(0, 400),
            visible: true,
          };
        }

        // Check for popover
        const popover = document.querySelector('[class*="popover" i], [class*="Popover"]');
        if (popover) {
          return {
            type: 'popover',
            content: popover.textContent?.trim().substring(0, 400),
            visible: true,
          };
        }

        // Check if help text appeared in modal
        const modal = document.querySelector('[role="dialog"]');
        if (modal) {
          const helpText = Array.from(modal.querySelectorAll('[class*="help" i]'))
            .map(el => el.textContent?.trim())
            .filter(t => t && t.length > 10);
          
          if (helpText.length > 0) {
            return {
              type: 'inline',
              content: helpText.join(' | ').substring(0, 400),
              visible: true,
            };
          }
        }

        return {
          type: 'unknown',
          content: null,
          visible: false,
        };
      });

      results.helpButton = { ...helpButtonInfo, helpContent };
      console.log('   Help content:', JSON.stringify(helpContent, null, 2));
    } else {
      results.helpButton = { found: false };
    }

    // 7. Check for voice input
    console.log('7. Check for voice input...');
    
    const voiceCheck = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]');
      if (!modal) return null;

      const html = modal.innerHTML.toLowerCase();
      const text = modal.textContent?.toLowerCase() || '';
      
      // Check for microphone icons
      const hasMicIcon = html.includes('microphone') || 
                        html.includes('mic-') || 
                        html.includes('voice');
      
      // Check for voice buttons
      const allButtons = Array.from(modal.querySelectorAll('button'));
      const voiceButtons = allButtons.filter(b => {
        const btnText = b.textContent?.toLowerCase() || '';
        const ariaLabel = b.getAttribute('aria-label')?.toLowerCase() || '';
        return btnText.includes('voice') || btnText.includes('mic') ||
               ariaLabel.includes('voice') || ariaLabel.includes('microphone');
      });

      return {
        found: hasMicIcon || voiceButtons.length > 0,
        hasMicIcon,
        voiceButtonCount: voiceButtons.length,
      };
    });

    results.voiceInput = voiceCheck;
    console.log('   Voice input:', JSON.stringify(voiceCheck, null, 2));

    await page.keyboard.press('Escape');
    await wait(1500);
  } else {
    results.formI140Fill = { opened: false };
    console.log('   WARNING: Fill modal did not open');
  }

  // 8. Test additional form (G-1145)
  console.log('8. Test Form G-1145...');
  
  const g1145Clicked = await page.evaluate(() => {
    // Scroll to Forms & Fees section
    const allElements = Array.from(document.querySelectorAll('*'));
    const g1145El = allElements.find(el => {
      const text = el.textContent || '';
      return text.includes('Form G-1145') && text.length < 300;
    });
    
    if (!g1145El) return false;
    
    g1145El.scrollIntoView({ block: 'center' });
    
    // Find Fill button in parent
    let parent = g1145El.parentElement;
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
  
  if (g1145Clicked) {
    await wait(5000);
    const g1145ModalOpened = await waitForModal(page, 3000);
    console.log('   G-1145 modal opened:', g1145ModalOpened);

    if (g1145ModalOpened) {
      await page.screenshot({ path: 'screenshots/final-07-g1145-modal.png', fullPage: true });

      const g1145Info = await page.evaluate(() => {
        const modal = document.querySelector('[role="dialog"]');
        if (!modal) return null;

        const text = modal.textContent || '';
        const title = modal.querySelector('h1, h2, h3')?.textContent?.trim() || '';
        const isStepBased = /step/i.test(text) || /\d+\s*\/\s*\d+/.test(text) ||
                           Array.from(modal.querySelectorAll('button')).some(b => 
                             ['Next', 'Continue'].includes(b.textContent?.trim() || ''));

        return {
          title,
          isStepBased,
          textPreview: text.substring(0, 300),
        };
      });

      results.additionalForm = { form: 'G-1145', ...g1145Info };
      console.log('   G-1145 info:', JSON.stringify(g1145Info, null, 2));
    } else {
      results.additionalForm = { form: 'G-1145', opened: false };
    }
  }

  console.log('\n=== VERIFICATION COMPLETE ===');

} catch (error) {
  results.errors.push({ type: 'script-error', text: error.message });
  console.error('Error:', error);
} finally {
  await browser.close();
}

writeFileSync('final-verification-results.json', JSON.stringify(results, null, 2));
console.log('\n' + JSON.stringify(results, null, 2));
