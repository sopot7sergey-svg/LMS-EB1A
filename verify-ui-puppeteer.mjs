import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'fs';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function verifyUI() {
  const results = {
    loginSuccess: false,
    caseWorkspaceAccess: false,
    caseIntakeSection: {
      visible: false,
      hasActionBar: false,
      hasAddButton: false,
      hasCreateButton: false,
      hasTemplateButton: false,
      hasStatusBadge: false,
    },
    templateModal: {
      opened: false,
      hasWhatItIs: false,
      hasWhyItMatters: false,
      hasRequiredSections: false,
      hasStrongExample: false,
    },
    builderModal: {
      opened: false,
      hasStepper: false,
      stepCount: 0,
      steps: [],
    },
    consoleErrors: [],
    screenshots: [],
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
    console.log('Navigating to login page...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2', timeout: 30000 });
    await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/01-login-page.png' });
    results.screenshots.push('01-login-page.png');

    // 2. Login
    console.log('Logging in...');
    await page.type('input[type="email"]', 'test@example.com');
    await page.type('input[type="password"]', 'Test1234');
    await page.click('button[type="submit"]');
    
    // Wait for navigation after login
    await page.waitForNavigation({ timeout: 10000 }).catch(() => {});
    await wait(2000);
    await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/02-after-login.png' });
    results.loginSuccess = true;

    // 3. Navigate to case workspace
    console.log('Navigating to case workspace...');
    const currentUrl = page.url();
    
    if (currentUrl.includes('/case/')) {
      // Already on a case page
      results.caseWorkspaceAccess = true;
    } else {
      // Try to find and click on a case, or create one
      await page.goto('http://localhost:3000/case', { waitUntil: 'networkidle2' });
      await wait(3000); // Wait longer for React to render
      
      // Debug: check what's on the page
      const pageInfo = await page.evaluate(() => {
        const viewCaseLinks = Array.from(document.querySelectorAll('a'));
        const filtered = viewCaseLinks.filter(link => link.textContent && link.textContent.includes('View Case'));
        const allLinks = Array.from(document.querySelectorAll('a[href*="/case/"]'));
        const bodyText = document.body.textContent || '';
        return {
          viewCaseCount: filtered.length,
          allCaseLinksCount: allLinks.length,
          firstViewCaseHref: filtered[0]?.href || null,
          hasUntitledCase: bodyText.includes('Untitled Case'),
          hasMyCases: bodyText.includes('My Cases'),
        };
      });
      
      console.log('Page info after wait:', pageInfo);
      
      // Take a screenshot to see what we have
      await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/03a-case-list-debug.png', fullPage: true });
      results.screenshots.push('03a-case-list-debug.png');
      
      // Try different approaches to find and click a case
      let caseClicked = false;
      
      // Approach 1: Look for "View Case" text
      const foundCase = await page.evaluate(() => {
        // Get all elements
        const allElements = Array.from(document.querySelectorAll('*'));
        
        // Find elements with "View Case" text
        const viewCaseElements = allElements.filter(el => {
          const text = el.textContent || '';
          return text.includes('View Case') && text.length < 50; // Short text to avoid parent containers
        });
        
        console.log('Found View Case elements:', viewCaseElements.length);
        
        // Try to click the first one
        if (viewCaseElements.length > 0) {
          // Try to find clickable parent (a or button)
          for (const el of viewCaseElements) {
            let current = el;
            for (let i = 0; i < 5 && current; i++) {
              if (current.tagName === 'A' || current.tagName === 'BUTTON') {
                current.click();
                return { clicked: true, tag: current.tagName, text: current.textContent.trim() };
              }
              current = current.parentElement;
            }
          }
          
          // If no clickable parent, just click the element itself
          viewCaseElements[0].click();
          return { clicked: true, tag: viewCaseElements[0].tagName, text: viewCaseElements[0].textContent.trim() };
        }
        
        return { clicked: false };
      });
      
      console.log('Found case result:', foundCase);
      
      if (foundCase.clicked) {
        await wait(3000);
        caseClicked = true;
        results.caseWorkspaceAccess = true;
      }
      
      // Check if there are any cases
      const caseLinks = await page.$$('a[href*="/case/"]');
      
      if (!caseClicked && (caseLinks.length > 0 || pageInfo.viewCaseCount > 0)) {
        console.log(`Found ${pageInfo.viewCaseCount} view case links, opening the first one...`);
        
        // Click on first "View Case" link
        const clicked = await page.evaluate(() => {
          const viewCaseLinks = Array.from(document.querySelectorAll('a'));
          const viewLink = viewCaseLinks.find(link => link.textContent && link.textContent.includes('View Case'));
          if (viewLink) {
            viewLink.click();
            return true;
          }
          return false;
        });
        
        if (clicked) {
          await wait(3000);
          results.caseWorkspaceAccess = true;
        }
      } else {
        // Try to create a case
        console.log('No cases found, attempting to create one...');
        const createButton = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, a'));
          const createBtn = buttons.find(b => b.textContent && b.textContent.trim().toLowerCase().includes('create'));
          if (createBtn) {
            createBtn.click();
            return true;
          }
          return false;
        });
        
        if (createButton) {
          await wait(1000);
          
          // Fill minimal case info if needed
          const titleInput = await page.$('input[type="text"]');
          if (titleInput) {
            await titleInput.type('Test Case for UI Verification');
          }
          
          const submitBtn = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button[type="submit"]'));
            if (buttons.length > 0) {
              buttons[0].click();
              return true;
            }
            return false;
          });
          
          if (submitBtn) {
            await wait(2000);
          }
          results.caseWorkspaceAccess = true;
        }
      }
    }

    await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/03-case-workspace.png', fullPage: true });
    results.screenshots.push('03-case-workspace.png');

    // 4. Check for "Case Intake & Profile" section
    console.log('Looking for Case Intake & Profile section...');
    
    // Try to find the section heading
    const sectionText = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      const section = elements.find(el => 
        el.textContent && /Case Intake.*Profile/i.test(el.textContent) && el.textContent.length < 100
      );
      return section ? section.textContent : null;
    });
    
    if (sectionText) {
      results.caseIntakeSection.visible = true;
      console.log('Case Intake & Profile section found:', sectionText);
      
      // Expand the section if it's collapsed
      const sectionButton = await page.evaluateHandle(() => {
        const elements = Array.from(document.querySelectorAll('button'));
        return elements.find(el => /Case Intake/i.test(el.textContent));
      });
      
      if (sectionButton) {
        const button = sectionButton.asElement();
        if (button) {
          await button.click();
          await wait(500);
        }
      }
      
      // Take screenshot after expanding
      await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/04-section-expanded.png', fullPage: true });
      results.screenshots.push('04-section-expanded.png');
      
      // 5. Check for Intake Questionnaire row with action buttons
      console.log('Looking for Intake Questionnaire row...');
      
      const rowInfo = await page.evaluate(() => {
        // Find the Intake Questionnaire text
        const elements = Array.from(document.querySelectorAll('*'));
        const intakeElement = elements.find(el => 
          el.textContent && el.textContent.includes('Intake Questionnaire') && el.textContent.length < 200
        );
        
        if (!intakeElement) return null;
        
        // Find the parent container (likely a div with rounded styling)
        let container = intakeElement;
        while (container && container.parentElement) {
          const classes = container.className || '';
          if (classes.includes('rounded') || classes.includes('border')) {
            break;
          }
          container = container.parentElement;
        }
        
        if (!container) return null;
        
        // Look for buttons within this container
        const buttons = Array.from(container.querySelectorAll('button'));
        const buttonTexts = buttons.map(b => b.textContent.trim());
        
        // Look for status badge
        const spans = Array.from(container.querySelectorAll('span'));
        const badges = spans.filter(s => {
          const classes = s.className || '';
          return classes.includes('rounded-full') || classes.includes('badge');
        });
        
        return {
          found: true,
          buttons: buttonTexts,
          hasAdd: buttonTexts.some(t => t === 'Add'),
          hasCreate: buttonTexts.some(t => t === 'Create'),
          hasTemplate: buttonTexts.some(t => t === 'Template'),
          hasBadge: badges.length > 0,
          badgeText: badges.length > 0 ? badges[0].textContent.trim() : null,
        };
      });
      
      if (rowInfo && rowInfo.found) {
        console.log('Intake Questionnaire row found');
        console.log('Buttons:', rowInfo.buttons);
        console.log('Has Add:', rowInfo.hasAdd);
        console.log('Has Create:', rowInfo.hasCreate);
        console.log('Has Template:', rowInfo.hasTemplate);
        console.log('Has Badge:', rowInfo.hasBadge);
        console.log('Badge text:', rowInfo.badgeText);
        
        results.caseIntakeSection.hasAddButton = rowInfo.hasAdd;
        results.caseIntakeSection.hasCreateButton = rowInfo.hasCreate;
        results.caseIntakeSection.hasTemplateButton = rowInfo.hasTemplate;
        results.caseIntakeSection.hasStatusBadge = rowInfo.hasBadge;
        results.caseIntakeSection.hasActionBar = rowInfo.hasAdd && rowInfo.hasCreate && rowInfo.hasTemplate;
        
        // 6. Test Template button
        if (rowInfo.hasTemplate) {
          console.log('Clicking Template button...');
          
          await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('*'));
            const intakeElement = elements.find(el => 
              el.textContent && el.textContent.includes('Intake Questionnaire') && el.textContent.length < 200
            );
            
            if (intakeElement) {
              let container = intakeElement;
              while (container && container.parentElement) {
                const classes = container.className || '';
                if (classes.includes('rounded') || classes.includes('border')) {
                  break;
                }
                container = container.parentElement;
              }
              
              if (container) {
                const buttons = Array.from(container.querySelectorAll('button'));
                const templateBtn = buttons.find(b => b.textContent.trim() === 'Template');
                if (templateBtn) {
                  templateBtn.click();
                }
              }
            }
          });
          
          await wait(1000);
          
          // Check if modal opened
          const modalInfo = await page.evaluate(() => {
            const modal = document.querySelector('[role="dialog"], .modal');
            if (!modal) return null;
            
            const text = modal.textContent || '';
            return {
              opened: true,
              hasTitle: /Intake Questionnaire.*Template/i.test(text),
              hasWhatItIs: text.includes('What this document is'),
              hasWhyItMatters: text.includes('Why it matters'),
              hasRequiredSections: text.includes('Required structure'),
              hasStrongExample: text.includes('Example of a strong') || text.includes('strong version'),
            };
          });
          
          if (modalInfo && modalInfo.opened) {
            console.log('Template modal opened');
            console.log('Modal info:', modalInfo);
            
            results.templateModal.opened = true;
            results.templateModal.hasWhatItIs = modalInfo.hasWhatItIs;
            results.templateModal.hasWhyItMatters = modalInfo.hasWhyItMatters;
            results.templateModal.hasRequiredSections = modalInfo.hasRequiredSections;
            results.templateModal.hasStrongExample = modalInfo.hasStrongExample;
            
            await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/05-template-modal.png', fullPage: true });
            results.screenshots.push('05-template-modal.png');
            
            // Close modal
            await page.keyboard.press('Escape');
            await wait(500);
          }
        }
        
        // 7. Test Create button
        if (rowInfo.hasCreate) {
          console.log('Clicking Create button...');
          
          await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('*'));
            const intakeElement = elements.find(el => 
              el.textContent && el.textContent.includes('Intake Questionnaire') && el.textContent.length < 200
            );
            
            if (intakeElement) {
              let container = intakeElement;
              while (container && container.parentElement) {
                const classes = container.className || '';
                if (classes.includes('rounded') || classes.includes('border')) {
                  break;
                }
                container = container.parentElement;
              }
              
              if (container) {
                const buttons = Array.from(container.querySelectorAll('button'));
                const createBtn = buttons.find(b => b.textContent.trim() === 'Create');
                if (createBtn) {
                  createBtn.click();
                }
              }
            }
          });
          
          await wait(1500);
          
          // Check if builder modal opened
          const builderInfo = await page.evaluate(() => {
            const modal = document.querySelector('[role="dialog"], .modal');
            if (!modal) return null;
            
            const text = modal.textContent || '';
            
            // Look for stepper steps
            const stepButtons = Array.from(modal.querySelectorAll('button'));
            const stepperSteps = stepButtons.filter(b => {
              const text = b.textContent || '';
              return text.includes('Step');
            });
            
            return {
              opened: /Intake Questionnaire.*Builder/i.test(text),
              hasStepper: stepperSteps.length > 0,
              stepCount: stepperSteps.length,
              steps: stepperSteps.map(s => s.textContent.trim()),
            };
          });
          
          if (builderInfo && builderInfo.opened) {
            console.log('Builder modal opened');
            console.log('Builder info:', builderInfo);
            
            results.builderModal.opened = true;
            results.builderModal.hasStepper = builderInfo.hasStepper;
            results.builderModal.stepCount = builderInfo.stepCount;
            results.builderModal.steps = builderInfo.steps;
            
            await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/06-builder-modal.png', fullPage: true });
            results.screenshots.push('06-builder-modal.png');
          }
        }
      }
    }

    // Final screenshot
    await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/07-final.png', fullPage: true });
    results.screenshots.push('07-final.png');

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
console.log('Starting UI verification with Puppeteer...');
const results = await verifyUI();

// Write results to file
writeFileSync(
  '/Users/sergeysopot/LMS-EB1A/ui-verification-results.json',
  JSON.stringify(results, null, 2)
);

console.log('\n=== VERIFICATION RESULTS ===');
console.log(JSON.stringify(results, null, 2));
console.log('\nResults saved to ui-verification-results.json');
console.log('Screenshots saved to screenshots/ directory');

process.exit(0);
