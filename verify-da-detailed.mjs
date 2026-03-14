import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'fs';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function waitForModal(page, timeoutMs = 5000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const hasModal = await page.evaluate(() => {
      return document.querySelector('[role="dialog"]') !== null;
    });
    if (hasModal) return true;
    await wait(100);
  }
  return false;
}

const browser = await puppeteer.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--no-sandbox'],
  defaultViewport: { width: 1920, height: 1080 },
});

mkdirSync('screenshots', { recursive: true });

const page = await browser.newPage();

// Login
console.log('Logging in...');
await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
await page.type('input[type="email"]', 'test@example.com');
await page.type('input[type="password"]', 'Test1234');
await page.click('button[type="submit"]');
await wait(3000);

// Navigate to case
console.log('Opening case...');
await page.goto('http://localhost:3000/case', { waitUntil: 'networkidle2' });
await wait(2000);

const caseClicked = await page.evaluate(() => {
  const links = Array.from(document.querySelectorAll('a, button'));
  const viewCase = links.find(l => l.textContent?.includes('View Case'));
  if (viewCase) {
    viewCase.click();
    return true;
  }
  return false;
});
await wait(3000);

console.log('Case opened:', caseClicked);
await page.screenshot({ path: 'screenshots/new-01-workspace.png', fullPage: true });

// Test Document Assistant card
console.log('\n=== Testing Document Assistant ===');
const daClicked = await page.evaluate(() => {
  // Look for Document Assistant card button
  const allButtons = Array.from(document.querySelectorAll('button, [role="button"]'));
  const daCard = allButtons.find(b => {
    const text = b.textContent || '';
    return text.includes('Document Assistant');
  });
  if (daCard) {
    daCard.click();
    return true;
  }
  return false;
});

console.log('Document Assistant clicked:', daClicked);
await wait(3000);

const daModalOpened = await waitForModal(page, 3000);
console.log('Document Assistant modal opened:', daModalOpened);

if (daModalOpened) {
  await page.screenshot({ path: 'screenshots/new-02-da-modal.png', fullPage: true });
  
  const daOptions = await page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"]');
    if (!modal) return null;
    
    const text = modal.textContent || '';
    const buttons = Array.from(modal.querySelectorAll('button'));
    const options = buttons
      .map(b => b.textContent?.trim())
      .filter(t => t && t.length > 0 && t.length < 100 && !['Close', '×', 'Cancel'].includes(t));
    
    return { options, textPreview: text.substring(0, 400) };
  });
  
  console.log('Document Assistant options:', JSON.stringify(daOptions, null, 2));
  
  await page.keyboard.press('Escape');
  await wait(1000);
}

// Open Forms & Fees
console.log('\n=== Testing Forms & Fees ===');
await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('button'));
  const formsBtn = buttons.find(b => b.textContent?.includes('Forms & Fees'));
  if (formsBtn) {
    formsBtn.scrollIntoView({ block: 'center' });
    formsBtn.click();
  }
});
await wait(2000);
await page.screenshot({ path: 'screenshots/new-03-forms-expanded.png', fullPage: true });

// Click Fill on Form I-140
console.log('\n=== Testing Fill Button (Form I-140) ===');
const fillClicked = await page.evaluate(() => {
  const allButtons = Array.from(document.querySelectorAll('button'));
  const fillBtn = allButtons.find(b => b.textContent?.trim() === 'Fill');
  if (fillBtn) {
    fillBtn.click();
    return true;
  }
  return false;
});

console.log('Fill button clicked:', fillClicked);
const fillModalOpened = await waitForModal(page, 5000);
console.log('Fill modal opened:', fillModalOpened);

if (fillModalOpened) {
  await page.screenshot({ path: 'screenshots/new-04-fill-modal-initial.png', fullPage: true });
  
  const fillFlowAnalysis = await page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"]');
    if (!modal) return null;
    
    const text = modal.textContent || '';
    const html = modal.innerHTML;
    
    // Check for step indicators
    const hasStepText = /step\s*\d+/i.test(text) || /\d+\s*\/\s*\d+/.test(text) || /\d+\s*of\s*\d+/i.test(text);
    const hasProgressBar = modal.querySelector('progress') !== null || html.includes('progress');
    const hasStepper = modal.querySelectorAll('[class*="step"]').length > 0;
    
    // Count inputs (few = step-based, many = full form)
    const inputCount = modal.querySelectorAll('input, textarea, select').length;
    
    // Check title
    const title = modal.querySelector('h1, h2, h3, [class*="title"]')?.textContent || '';
    
    return {
      isStepBased: hasStepText || hasProgressBar || hasStepper,
      hasStepText,
      hasProgressBar,
      hasStepper,
      inputCount,
      title: title.substring(0, 100),
      textPreview: text.substring(0, 300),
    };
  });
  
  console.log('Fill flow analysis:', JSON.stringify(fillFlowAnalysis, null, 2));
  
  // Look for help icon (? button)
  console.log('\n=== Looking for Help Icon ===');
  const helpIconAnalysis = await page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"]');
    if (!modal) return null;
    
    // Look for help buttons/icons
    const allElements = Array.from(modal.querySelectorAll('button, [role="button"], svg, [aria-label*="help" i]'));
    const helpElements = allElements.filter(el => {
      const text = el.textContent?.trim() || '';
      const ariaLabel = el.getAttribute('aria-label') || '';
      const classes = el.className || '';
      
      return text === '?' || 
             text.toLowerCase() === 'help' ||
             ariaLabel.toLowerCase().includes('help') ||
             classes.includes('help');
    });
    
    return {
      found: helpElements.length > 0,
      count: helpElements.length,
      types: helpElements.map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim().substring(0, 20),
        ariaLabel: el.getAttribute('aria-label'),
      })),
    };
  });
  
  console.log('Help icon analysis:', JSON.stringify(helpIconAnalysis, null, 2));
  
  if (helpIconAnalysis?.found) {
    // Click the first help icon
    const helpClicked = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]');
      if (!modal) return false;
      
      const allElements = Array.from(modal.querySelectorAll('button, [role="button"]'));
      const helpBtn = allElements.find(el => {
        const text = el.textContent?.trim() || '';
        const ariaLabel = el.getAttribute('aria-label') || '';
        return text === '?' || ariaLabel.toLowerCase().includes('help');
      });
      
      if (helpBtn) {
        helpBtn.click();
        return true;
      }
      return false;
    });
    
    console.log('Help icon clicked:', helpClicked);
    await wait(2000);
    
    await page.screenshot({ path: 'screenshots/new-05-help-clicked.png', fullPage: true });
    
    const helpAppearance = await page.evaluate(() => {
      const tooltip = document.querySelector('[role="tooltip"]');
      const popover = document.querySelector('[class*="popover" i]');
      
      if (tooltip) {
        return {
          type: 'tooltip',
          text: tooltip.textContent?.substring(0, 300),
        };
      } else if (popover) {
        return {
          type: 'popover',
          text: popover.textContent?.substring(0, 300),
        };
      } else {
        return {
          type: 'unknown',
          note: 'Help content may have appeared inline or in a different format',
        };
      }
    });
    
    console.log('Help appearance:', JSON.stringify(helpAppearance, null, 2));
  }
  
  // Check for voice input
  console.log('\n=== Checking for Voice Input ===');
  const voiceCheck = await page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"]');
    if (!modal) return null;
    
    const html = modal.innerHTML.toLowerCase();
    const allButtons = Array.from(modal.querySelectorAll('button'));
    
    const hasMicIcon = html.includes('microphone') || html.includes('mic-');
    const hasVoiceButton = allButtons.some(b => {
      const text = b.textContent?.toLowerCase() || '';
      const ariaLabel = b.getAttribute('aria-label')?.toLowerCase() || '';
      return text.includes('voice') || text.includes('mic') ||
             ariaLabel.includes('voice') || ariaLabel.includes('mic');
    });
    
    return {
      found: hasMicIcon || hasVoiceButton,
      hasMicIcon,
      hasVoiceButton,
    };
  });
  
  console.log('Voice input check:', JSON.stringify(voiceCheck, null, 2));
  
  await page.keyboard.press('Escape');
  await wait(1000);
}

// Test G-1145
console.log('\n=== Testing Form G-1145 Fill ===');
await page.evaluate(() => {
  const bodyText = document.body.textContent || '';
  if (!bodyText.includes('Form G-1145')) return;
  
  const allElements = Array.from(document.querySelectorAll('*'));
  const g1145Element = allElements.find(el => {
    const text = el.textContent || '';
    return text.includes('Form G-1145') && text.length < 200;
  });
  
  if (!g1145Element) return;
  
  let parent = g1145Element.parentElement;
  for (let i = 0; i < 5 && parent; i++) {
    const buttons = Array.from(parent.querySelectorAll('button'));
    const fillBtn = buttons.find(b => b.textContent?.trim() === 'Fill');
    if (fillBtn) {
      fillBtn.click();
      return;
    }
    parent = parent.parentElement;
  }
});

await wait(4000);
const g1145ModalOpened = await waitForModal(page, 2000);
console.log('G-1145 modal opened:', g1145ModalOpened);

if (g1145ModalOpened) {
  await page.screenshot({ path: 'screenshots/new-06-g1145-modal.png', fullPage: true });
  
  const g1145Analysis = await page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"]');
    if (!modal) return null;
    
    const text = modal.textContent || '';
    const title = modal.querySelector('h1, h2, h3')?.textContent || '';
    const isStepBased = /step/i.test(text) || /\d+\s*\/\s*\d+/.test(text);
    
    return {
      title: title.substring(0, 100),
      isStepBased,
      textPreview: text.substring(0, 200),
    };
  });
  
  console.log('G-1145 analysis:', JSON.stringify(g1145Analysis, null, 2));
}

await browser.close();
console.log('\n=== VERIFICATION COMPLETE ===');
