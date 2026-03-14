import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'fs';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function waitForModal(page, timeoutMs = 10000) {
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
  cardStatus: null,
  chooserContents: null,
  i140Result: null,
  helpResult: null,
  voiceResult: null,
  secondFormResult: null,
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
      const text = msg.text();
      if (!text.includes('404') && !text.includes('Unsupported document builder')) {
        results.errors.push(text.substring(0, 150));
      }
    }
  });

  // Try direct case access
  console.log('Accessing case directly...');
  await page.goto('http://localhost:3000/case/dc75d30d-3a2e-4865-a65c-241b8175e526', { 
    waitUntil: 'networkidle2',
    timeout: 30000 
  });
  await wait(3000);

  // Check if redirected to login
  if (page.url().includes('/login')) {
    console.log('Logging in...');
    await page.type('input[type="email"]', 'test@example.com');
    await page.type('input[type="password"]', 'Test1234');
    await page.click('button[type="submit"]');
    await wait(3000);
    
    // Navigate to case
    await page.goto('http://localhost:3000/case/dc75d30d-3a2e-4865-a65c-241b8175e526', { 
      waitUntil: 'networkidle2' 
    });
    await wait(3000);
  }

  console.log('Current URL:', page.url());
  await page.screenshot({ path: 'screenshots/verify-01-case.png', fullPage: true });

  // 1. Check tool cards
  console.log('\n1. Checking tool cards...');
  const cardStatus = await page.evaluate(() => {
    const text = document.body.textContent || '';
    return {
      hasDocumentAssistant: text.includes('Document Assistant'),
      hasCreator: text.includes('Creator') && !text.includes('Document'),
      hasFormsFiller: text.includes('Forms Filler') || text.includes('Form Filler'),
    };
  });
  results.cardStatus = cardStatus;
  console.log('   Cards:', JSON.stringify(cardStatus));

  // 2. Open Document Assistant chooser
  console.log('\n2. Opening Document Assistant chooser...');
  
  const clicked = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('[class*="card"], [class*="Card"]'));
    for (const card of cards) {
      if (card.textContent?.includes('Document Assistant')) {
        card.click();
        return true;
      }
    }
    
    const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
    const daBtn = buttons.find(b => b.textContent?.includes('Document Assistant'));
    if (daBtn) {
      daBtn.click();
      return true;
    }
    return false;
  });

  console.log('   Clicked:', clicked);
  await wait(3000);
  
  const modalOpened = await waitForModal(page, 5000);
  console.log('   Modal opened:', modalOpened);

  if (modalOpened) {
    await page.screenshot({ path: 'screenshots/verify-02-chooser.png', fullPage: true });

    const chooserContents = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]');
      if (!modal) return null;

      const text = modal.textContent || '';
      
      // Get all clickable items/buttons
      const allButtons = Array.from(modal.querySelectorAll('button, [role="button"], a'));
      const options = allButtons
        .map(b => b.textContent?.trim())
        .filter(t => t && t.length > 3 && t.length < 100)
        .filter(t => !['Close', '×', 'Cancel', 'close'].includes(t));

      // Try to categorize as create-mode vs fill-mode
      const createMode = options.filter(o => 
        /create|generate|draft|write|build/i.test(o)
      );
      const fillMode = options.filter(o => 
        /form|fill|i-140|i-907|g-1145/i.test(o)
      );
      const other = options.filter(o => 
        !createMode.includes(o) && !fillMode.includes(o)
      );

      return {
        allOptions: Array.from(new Set(options)).slice(0, 20),
        createMode: Array.from(new Set(createMode)),
        fillMode: Array.from(new Set(fillMode)),
        other: Array.from(new Set(other)),
      };
    });

    results.chooserContents = chooserContents;
    console.log('   Chooser:', JSON.stringify(chooserContents, null, 2));

    await page.keyboard.press('Escape');
    await wait(1500);
  } else {
    results.chooserContents = { error: 'Modal did not open' };
  }

  // 3. Click Fill for Form I-140
  console.log('\n3. Testing Form I-140 Fill...');
  
  // Open Forms & Fees
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const formsBtn = buttons.find(b => b.textContent?.includes('2. Forms & Fees'));
    if (formsBtn) {
      formsBtn.scrollIntoView({ block: 'center' });
      formsBtn.click();
    }
  });
  await wait(2500);

  await page.screenshot({ path: 'screenshots/verify-03-forms-fees.png', fullPage: true });

  // Click Fill button
  await page.evaluate(() => {
    const allButtons = Array.from(document.querySelectorAll('button'));
    const fillBtn = allButtons.find(b => b.textContent?.trim() === 'Fill');
    if (fillBtn) {
      fillBtn.scrollIntoView({ block: 'center' });
      fillBtn.click();
    }
  });

  console.log('   Waiting for Fill modal...');
  await wait(6000);
  
  const fillModalOpened = await waitForModal(page, 4000);
  console.log('   Fill modal opened:', fillModalOpened);

  if (fillModalOpened) {
    await page.screenshot({ path: 'screenshots/verify-04-i140-fill.png', fullPage: true });

    const i140Result = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]');
      if (!modal) return null;

      const text = modal.textContent || '';
      const title = modal.querySelector('h1, h2, h3')?.textContent?.trim() || '';
      
      // Check for builder-style indicators
      const hasStepIndicator = /step\s*\d+/i.test(text) || /\d+\s*\/\s*\d+/.test(text);
      const hasNavButtons = Array.from(modal.querySelectorAll('button')).some(b => 
        ['Next', 'Continue', 'Previous', 'Back'].some(txt => b.textContent?.trim() === txt)
      );
      const isBuilderStyle = hasStepIndicator || hasNavButtons;
      
      return {
        title,
        isBuilderStyle,
        hasStepIndicator,
        hasNavButtons,
      };
    });

    results.i140Result = i140Result;
    console.log('   I-140 result:', JSON.stringify(i140Result));

    // 4. Advance to first question and look for help
    console.log('\n4. Looking for help button...');
    
    // Try to advance
    const advanced = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]');
      if (!modal) return false;
      
      const buttons = Array.from(modal.querySelectorAll('button'));
      const nextBtn = buttons.find(b => 
        ['Next', 'Continue'].includes(b.textContent?.trim() || '')
      );
      
      if (nextBtn) {
        nextBtn.click();
        return true;
      }
      return false;
    });

    if (advanced) {
      console.log('   Advanced to next step');
      await wait(3000);
      await page.screenshot({ path: 'screenshots/verify-05-first-question.png', fullPage: true });
    }

    // Look for help buttons
    const helpButtons = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]');
      if (!modal) return null;

      const allElements = Array.from(modal.querySelectorAll('button, [role="button"], svg, circle, path'));
      const helpElements = allElements.filter(el => {
        const text = el.textContent?.trim() || '';
        const ariaLabel = el.getAttribute('aria-label') || '';
        const title = el.getAttribute('title') || '';
        const classes = el.className || '';
        
        return text === '?' || 
               text.toLowerCase() === 'help' ||
               ariaLabel.toLowerCase().includes('help') ||
               title.toLowerCase().includes('help') ||
               classes.toLowerCase().includes('help');
      });

      // Also look for SVG circles (common for ? icons)
      const circles = Array.from(modal.querySelectorAll('svg circle'));
      
      return {
        found: helpElements.length > 0 || circles.length > 0,
        count: helpElements.length,
        circleCount: circles.length,
      };
    });

    console.log('   Help buttons:', JSON.stringify(helpButtons));

    if (helpButtons?.found || helpButtons?.circleCount > 0) {
      // Try clicking
      const helpClicked = await page.evaluate(() => {
        const modal = document.querySelector('[role="dialog"]');
        if (!modal) return false;

        // Try button first
        const buttons = Array.from(modal.querySelectorAll('button, [role="button"]'));
        let helpBtn = buttons.find(b => {
          const text = b.textContent?.trim() || '';
          const ariaLabel = b.getAttribute('aria-label') || '';
          return text === '?' || ariaLabel.toLowerCase().includes('help');
        });

        if (helpBtn) {
          helpBtn.click();
          return { clicked: true, type: 'button' };
        }

        // Try SVG/circle
        const svgs = Array.from(modal.querySelectorAll('svg'));
        for (const svg of svgs) {
          if (svg.querySelector('circle')) {
            // Find clickable parent
            let parent = svg.parentElement;
            for (let i = 0; i < 3 && parent; i++) {
              if (parent.tagName === 'BUTTON' || parent.getAttribute('role') === 'button') {
                parent.click();
                return { clicked: true, type: 'svg-parent' };
              }
              parent = parent.parentElement;
            }
          }
        }

        return { clicked: false };
      });

      console.log('   Help clicked:', JSON.stringify(helpClicked));
      
      if (helpClicked?.clicked) {
        await wait(2000);
        await page.screenshot({ path: 'screenshots/verify-06-help.png', fullPage: true });

        const helpStructure = await page.evaluate(() => {
          // Look for tooltip
          const tooltip = document.querySelector('[role="tooltip"]');
          if (tooltip) {
            return {
              type: 'tooltip',
              content: tooltip.textContent?.trim().substring(0, 400),
              visible: true,
            };
          }

          // Look for popover
          const popovers = Array.from(document.querySelectorAll('[class*="popover" i], [data-radix-popper-content-wrapper]'));
          if (popovers.length > 0) {
            return {
              type: 'popover',
              content: popovers[0].textContent?.trim().substring(0, 400),
              visible: true,
            };
          }

          // Check modal for new content
          const modal = document.querySelector('[role="dialog"]');
          if (modal) {
            const helpSections = Array.from(modal.querySelectorAll('[class*="help" i]'));
            if (helpSections.length > 0) {
              return {
                type: 'inline',
                content: helpSections.map(s => s.textContent?.trim()).join(' | ').substring(0, 400),
                visible: true,
              };
            }
          }

          return { type: 'none', visible: false };
        });

        results.helpResult = { ...helpButtons, ...helpClicked, structure: helpStructure };
        console.log('   Help structure:', JSON.stringify(helpStructure));
      } else {
        results.helpResult = { ...helpButtons, clicked: false };
      }
    } else {
      results.helpResult = { found: false };
    }

    // 5. Check for voice input
    console.log('\n5. Checking for voice input...');
    
    const voiceCheck = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]');
      if (!modal) return null;

      const html = modal.innerHTML.toLowerCase();
      const allButtons = Array.from(modal.querySelectorAll('button'));
      
      const hasMicIcon = html.includes('microphone') || html.includes('mic-');
      const hasVoiceButton = allButtons.some(b => {
        const text = b.textContent?.toLowerCase() || '';
        const aria = b.getAttribute('aria-label')?.toLowerCase() || '';
        return text.includes('voice') || text.includes('mic') ||
               aria.includes('voice') || aria.includes('microphone');
      });

      return {
        found: hasMicIcon || hasVoiceButton,
        details: hasMicIcon ? 'mic icon found' : hasVoiceButton ? 'voice button found' : 'none',
      };
    });

    results.voiceResult = voiceCheck;
    console.log('   Voice:', JSON.stringify(voiceCheck));

    await page.keyboard.press('Escape');
    await wait(1500);
  } else {
    results.i140Result = { error: 'Modal did not open' };
  }

  // 6. Test Form G-1145
  console.log('\n6. Testing Form G-1145...');
  
  const g1145Clicked = await page.evaluate(() => {
    const allElements = Array.from(document.querySelectorAll('*'));
    const g1145El = allElements.find(el => {
      const text = el.textContent || '';
      return text.includes('Form G-1145') && text.length < 300;
    });
    
    if (!g1145El) return false;
    g1145El.scrollIntoView({ block: 'center' });
    
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

  console.log('   G-1145 clicked:', g1145Clicked);
  
  if (g1145Clicked) {
    await wait(6000);
    const g1145ModalOpened = await waitForModal(page, 4000);
    console.log('   G-1145 modal opened:', g1145ModalOpened);

    if (g1145ModalOpened) {
      await page.screenshot({ path: 'screenshots/verify-07-g1145.png', fullPage: true });

      const g1145Result = await page.evaluate(() => {
        const modal = document.querySelector('[role="dialog"]');
        if (!modal) return null;

        const text = modal.textContent || '';
        const title = modal.querySelector('h1, h2, h3')?.textContent?.trim() || '';
        
        const isBuilderStyle = /step/i.test(text) || 
                              Array.from(modal.querySelectorAll('button')).some(b => 
                                ['Next', 'Continue'].includes(b.textContent?.trim() || ''));

        return { title, isBuilderStyle };
      });

      results.secondFormResult = { form: 'G-1145', ...g1145Result };
      console.log('   G-1145 result:', JSON.stringify(g1145Result));
    } else {
      results.secondFormResult = { form: 'G-1145', error: 'Modal did not open' };
    }
  } else {
    results.secondFormResult = { form: 'G-1145', error: 'Click failed' };
  }

  console.log('\n=== COMPLETE ===');

} catch (error) {
  results.errors.push(`Script error: ${error.message}`);
  console.error('Error:', error);
} finally {
  await browser.close();
}

writeFileSync('final-end-to-end-results.json', JSON.stringify(results, null, 2));
console.log('\n' + JSON.stringify(results, null, 2));
