import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

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
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();

    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        results.consoleErrors.push({
          type: 'console.error',
          text: msg.text(),
          location: msg.location(),
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
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 30000 });
    await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/01-login-page.png' });
    results.screenshots.push('01-login-page.png');

    // 2. Login
    console.log('Logging in...');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'Test1234');
    await page.click('button[type="submit"]');
    
    // Wait for navigation after login
    await page.waitForURL(/\/(case|dashboard)/, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/02-after-login.png' });
    results.screenshots.push('02-after-login.png');
    results.loginSuccess = true;

    // 3. Navigate to case workspace
    console.log('Navigating to case workspace...');
    const currentUrl = page.url();
    
    if (currentUrl.includes('/case/')) {
      // Already on a case page
      results.caseWorkspaceAccess = true;
    } else {
      // Try to find and click on a case, or create one
      await page.goto('http://localhost:3000/case', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      
      // Check if there are any cases
      const caseLinks = await page.locator('a[href*="/case/"]').all();
      
      if (caseLinks.length > 0) {
        console.log(`Found ${caseLinks.length} cases, opening the first one...`);
        await caseLinks[0].click();
        await page.waitForTimeout(2000);
        results.caseWorkspaceAccess = true;
      } else {
        // Try to create a case
        console.log('No cases found, attempting to create one...');
        const createButton = page.locator('button:has-text("Create"), a:has-text("Create")').first();
        if (await createButton.count() > 0) {
          await createButton.click();
          await page.waitForTimeout(1000);
          
          // Fill minimal case info if needed
          const titleInput = page.locator('input[type="text"]').first();
          if (await titleInput.count() > 0) {
            await titleInput.fill('Test Case for UI Verification');
          }
          
          const submitBtn = page.locator('button[type="submit"]:has-text("Create"), button:has-text("Create")').first();
          if (await submitBtn.count() > 0) {
            await submitBtn.click();
            await page.waitForTimeout(2000);
          }
          results.caseWorkspaceAccess = true;
        }
      }
    }

    await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/03-case-workspace.png' });
    results.screenshots.push('03-case-workspace.png');

    // 4. Check for "Case Intake & Profile" section
    console.log('Looking for Case Intake & Profile section...');
    const sectionHeading = page.locator('text=/Case Intake.*Profile/i');
    
    if (await sectionHeading.count() > 0) {
      results.caseIntakeSection.visible = true;
      console.log('Case Intake & Profile section found');
      
      // Expand the section if it's not already
      const sectionButton = page.locator('button:has-text("Case Intake")').first();
      if (await sectionButton.count() > 0) {
        await sectionButton.click();
        await page.waitForTimeout(500);
      }
      
      // 5. Check for document row with action bar
      console.log('Looking for Intake Questionnaire row...');
      const intakeRow = page.locator('text="Intake Questionnaire"').first();
      
      if (await intakeRow.count() > 0) {
        console.log('Intake Questionnaire row found');
        
        // Get the parent container
        const rowContainer = intakeRow.locator('xpath=ancestor::div[contains(@class, "rounded")]').first();
        
        // Check for action buttons within the same row
        const addButton = rowContainer.locator('button:has-text("Add")');
        const createButton = rowContainer.locator('button:has-text("Create")');
        const templateButton = rowContainer.locator('button:has-text("Template")');
        
        results.caseIntakeSection.hasAddButton = await addButton.count() > 0;
        results.caseIntakeSection.hasCreateButton = await createButton.count() > 0;
        results.caseIntakeSection.hasTemplateButton = await templateButton.count() > 0;
        results.caseIntakeSection.hasActionBar = 
          results.caseIntakeSection.hasAddButton && 
          results.caseIntakeSection.hasCreateButton && 
          results.caseIntakeSection.hasTemplateButton;
        
        // Check for status badge
        const statusBadge = rowContainer.locator('span[class*="rounded-full"]');
        results.caseIntakeSection.hasStatusBadge = await statusBadge.count() > 0;
        
        console.log(`Add button: ${results.caseIntakeSection.hasAddButton}`);
        console.log(`Create button: ${results.caseIntakeSection.hasCreateButton}`);
        console.log(`Template button: ${results.caseIntakeSection.hasTemplateButton}`);
        console.log(`Status badge: ${results.caseIntakeSection.hasStatusBadge}`);
        
        await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/04-intake-row.png' });
        results.screenshots.push('04-intake-row.png');
        
        // 6. Test Template button
        if (results.caseIntakeSection.hasTemplateButton) {
          console.log('Clicking Template button...');
          await templateButton.first().click();
          await page.waitForTimeout(1000);
          
          // Check if modal opened
          const modalTitle = page.locator('text=/Intake Questionnaire.*Template/i');
          results.templateModal.opened = await modalTitle.count() > 0;
          
          if (results.templateModal.opened) {
            console.log('Template modal opened');
            
            // Check for expected sections
            results.templateModal.hasWhatItIs = await page.locator('text="What this document is"').count() > 0;
            results.templateModal.hasWhyItMatters = await page.locator('text="Why it matters"').count() > 0;
            results.templateModal.hasRequiredSections = await page.locator('text="Required structure"').count() > 0;
            results.templateModal.hasStrongExample = await page.locator('text="Example of a strong"').count() > 0;
            
            console.log(`Has "What this document is": ${results.templateModal.hasWhatItIs}`);
            console.log(`Has "Why it matters": ${results.templateModal.hasWhyItMatters}`);
            console.log(`Has "Required structure": ${results.templateModal.hasRequiredSections}`);
            console.log(`Has "Strong example": ${results.templateModal.hasStrongExample}`);
            
            await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/05-template-modal.png' });
            results.screenshots.push('05-template-modal.png');
            
            // Close modal
            const closeButton = page.locator('button[aria-label="Close"], button:has-text("Close")').first();
            if (await closeButton.count() > 0) {
              await closeButton.click();
              await page.waitForTimeout(500);
            } else {
              // Try ESC key
              await page.keyboard.press('Escape');
              await page.waitForTimeout(500);
            }
          }
        }
        
        // 7. Test Create button
        if (results.caseIntakeSection.hasCreateButton) {
          console.log('Clicking Create button...');
          await createButton.first().click();
          await page.waitForTimeout(1500);
          
          // Check if builder modal opened
          const builderTitle = page.locator('text=/Intake Questionnaire.*Builder/i');
          results.builderModal.opened = await builderTitle.count() > 0;
          
          if (results.builderModal.opened) {
            console.log('Builder modal opened');
            
            // Check for stepper
            const stepperSteps = page.locator('button:has-text("Step")');
            results.builderModal.stepCount = await stepperSteps.count();
            results.builderModal.hasStepper = results.builderModal.stepCount > 0;
            
            // Get step labels
            if (results.builderModal.hasStepper) {
              const stepLabels = await stepperSteps.allTextContents();
              results.builderModal.steps = stepLabels;
              console.log(`Found ${results.builderModal.stepCount} steps:`, stepLabels);
            }
            
            await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/06-builder-modal.png', fullPage: true });
            results.screenshots.push('06-builder-modal.png');
          }
        }
      }
    }

    // Final screenshot
    await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/07-final.png' });
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
console.log('Starting UI verification...');
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
