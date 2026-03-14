import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'fs';
import { mkdir } from 'fs/promises';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function verifyAuditReportUI() {
  const results = {
    steps: [],
    screenshots: [],
    consoleErrors: [],
    loginSuccess: false,
    casePageAccess: false,
    section11Found: false,
    reportModalOpened: false,
    reportSections: [],
  };

  let browser;
  try {
    // Ensure screenshots directory exists
    await mkdir('/Users/sergeysopot/LMS-EB1A/screenshots', { recursive: true });

    browser = await puppeteer.launch({
      headless: false, // Keep visible so we can see what's happening
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Capture console messages
    page.on('console', msg => {
      console.log('BROWSER CONSOLE:', msg.type(), msg.text());
      if (msg.type() === 'error') {
        results.consoleErrors.push({
          type: 'console.error',
          text: msg.text(),
        });
      }
    });

    page.on('pageerror', error => {
      console.error('PAGE ERROR:', error.message);
      results.consoleErrors.push({
        type: 'pageerror',
        text: error.message,
        stack: error.stack,
      });
    });

    // STEP 1: Go to login page
    console.log('\n=== STEP 1: Navigate to login page ===');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(2000);
    await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/step1-login-page.png' });
    results.screenshots.push('step1-login-page.png');
    results.steps.push('Step 1: Navigated to login page');
    console.log('✓ Login page loaded');

    // STEP 2: Enter credentials
    console.log('\n=== STEP 2: Enter credentials ===');
    
    // Wait for email input to be ready
    await page.waitForSelector('input[type="email"]', { visible: true, timeout: 5000 });
    
    // Clear and enter email
    const emailInput = await page.$('input[type="email"]');
    await emailInput.click({ clickCount: 3 });
    await page.keyboard.press('Backspace');
    await emailInput.type('test@example.com', { delay: 50 });
    console.log('✓ Entered email: test@example.com');
    
    // Clear and enter password
    const passwordInput = await page.$('input[type="password"]');
    await passwordInput.click({ clickCount: 3 });
    await page.keyboard.press('Backspace');
    await passwordInput.type('Test1234', { delay: 50 });
    console.log('✓ Entered password: Test1234');
    
    await wait(500);
    await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/step2-credentials-entered.png' });
    results.screenshots.push('step2-credentials-entered.png');
    results.steps.push('Step 2: Entered credentials');

    // STEP 3: Click Sign In button
    console.log('\n=== STEP 3: Click Sign In button ===');
    
    // Find and click the submit button
    const submitButton = await page.$('button[type="submit"]');
    if (submitButton) {
      await submitButton.click();
      console.log('✓ Clicked Sign In button');
    } else {
      console.log('✗ Submit button not found, trying alternative...');
      // Try finding by text
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const signInBtn = buttons.find(b => b.textContent.includes('Sign In'));
        if (signInBtn) signInBtn.click();
      });
    }
    
    // Wait for navigation or URL change
    console.log('Waiting for navigation...');
    try {
      await Promise.race([
        page.waitForNavigation({ timeout: 10000 }),
        page.waitForFunction(() => !window.location.href.includes('/login'), { timeout: 10000 }),
      ]);
      console.log('✓ Navigation detected');
    } catch (err) {
      console.log('⚠ Navigation timeout, checking URL...');
    }
    
    await wait(3000);
    
    const afterLoginUrl = page.url();
    console.log('Current URL:', afterLoginUrl);
    
    if (afterLoginUrl.includes('/login')) {
      console.log('⚠ Still on login page, login may have failed');
      console.log('Trying to check for errors...');
      
      const errorMsg = await page.evaluate(() => {
        const errorDiv = document.querySelector('[class*="error"]');
        return errorDiv ? errorDiv.textContent : null;
      });
      
      if (errorMsg) {
        console.log('Error message:', errorMsg);
      } else {
        console.log('No error message visible');
      }
      
      // Try clicking button again
      console.log('Attempting to click Sign In button again...');
      await page.click('button[type="submit"]');
      await wait(3000);
    }
    
    await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/step3-after-signin.png' });
    results.screenshots.push('step3-after-signin.png');
    
    const finalUrl = page.url();
    results.loginSuccess = !finalUrl.includes('/login');
    results.steps.push(`Step 3: Clicked Sign In - ${results.loginSuccess ? 'Success' : 'Still on login page'}`);
    console.log(results.loginSuccess ? '✓ Login successful' : '✗ Login failed or incomplete');

    // STEP 3.5: Get auth token via API and inject it
    console.log('\n=== STEP 3.5: Get auth token via API ===');
    
    // Make API call to get token
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
    
    console.log('Login API response:', loginResponse.token ? 'Token received' : 'No token');
    
    if (loginResponse.token && loginResponse.user) {
      // Inject auth into localStorage
      await page.evaluate((authData) => {
        localStorage.setItem('auth-storage', JSON.stringify({
          state: {
            user: authData.user,
            token: authData.token,
          },
          version: 0,
        }));
      }, loginResponse);
      
      console.log('✓ Injected auth token into localStorage');
      results.loginSuccess = true;
      results.steps.push('Step 3.5: Successfully authenticated via API');
    }

    // STEP 4: Navigate to specific case
    console.log('\n=== STEP 4: Navigate to case page ===');
    const caseUrl = 'http://localhost:3000/case/dc75d30d-3a2e-4865-a65c-241b8175e526';
    console.log('Navigating to:', caseUrl);
    
    // Navigate with auth
    await page.goto(caseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(8000); // Wait longer for page to fully load
    
    const casePageUrl = page.url();
    console.log('Current URL:', casePageUrl);
    
    // Check if we're on the case page
    results.casePageAccess = casePageUrl.includes('/case/');
    
    // Debug: Get page HTML to see what's there
    const pageContent = await page.evaluate(() => {
      return {
        bodyText: document.body?.textContent?.trim().substring(0, 500) || '',
        bodyHTML: document.body?.innerHTML?.substring(0, 1000) || '',
        title: document.title,
      };
    });
    
    console.log('Page title:', pageContent.title);
    console.log('Body text:', pageContent.bodyText);
    if (pageContent.bodyHTML) {
      console.log('Body HTML preview:', pageContent.bodyHTML.substring(0, 300));
    }
    
    await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/step4-case-page.png', fullPage: true });
    results.screenshots.push('step4-case-page.png');
    results.steps.push(`Step 4: Navigated to case page - ${results.casePageAccess ? 'Success' : 'Failed'}`);
    console.log(results.casePageAccess ? '✓ On case page' : '✗ Not on case page');

    if (!results.casePageAccess) {
      console.log('⚠ Cannot proceed without case page access');
      return results;
    }

    // STEP 5: Find and expand section 11
    console.log('\n=== STEP 5: Find section 11 "Packet Compilation & Audit" ===');
    
    // Scroll down to find section 11
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await wait(1000);
    
    // Look for section 11
    const section11Info = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      
      // Look for section 11 text
      const section11Element = elements.find(el => {
        const text = el.textContent || '';
        return /11\.\s*Packet Compilation.*Audit/i.test(text) && text.length < 200;
      });
      
      if (!section11Element) {
        return { found: false, allSections: [] };
      }
      
      // Find all section headings for context
      const allSections = elements
        .filter(el => /\d+\.\s*[A-Z]/.test(el.textContent || '') && el.textContent.length < 100)
        .map(el => el.textContent.trim())
        .slice(0, 15);
      
      return {
        found: true,
        text: section11Element.textContent.trim(),
        allSections,
      };
    });
    
    console.log('Section 11 search result:', section11Info.found ? '✓ Found' : '✗ Not found');
    if (section11Info.allSections && section11Info.allSections.length > 0) {
      console.log('Available sections:', section11Info.allSections);
    }
    
    results.section11Found = section11Info.found;
    
    if (section11Info.found) {
      console.log('Section 11 text:', section11Info.text);
      
      // Try to expand section 11 by clicking it
      console.log('Attempting to expand section 11...');
      
      // Scroll to section 11
      await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('*'));
        const section11Element = elements.find(el => {
          const text = el.textContent || '';
          return /11\.\s*Packet Compilation.*Audit/i.test(text) && text.length < 200;
        });
        
        if (section11Element) {
          section11Element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
      
      await wait(1000);
      
      // Take screenshot of section 11
      await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/step5-section11-visible.png', fullPage: true });
      results.screenshots.push('step5-section11-visible.png');
      
      // Click to expand
      const clicked = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('button'));
        // Look for button that contains section 11 text
        const section11Button = elements.find(b => {
          const text = b.textContent || '';
          return /11\.\s*Packet Compilation.*Audit/i.test(text);
        });
        
        if (section11Button) {
          console.log('Found section 11 button, clicking...');
          section11Button.click();
          return true;
        }
        
        console.log('Section 11 button not found');
        return false;
      });
      
      if (clicked) {
        console.log('✓ Clicked to expand section 11');
        await wait(1500);
        
        // Take screenshot after expanding
        await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/step6-section11-expanded.png', fullPage: true });
        results.screenshots.push('step6-section11-expanded.png');
        results.steps.push('Step 5-6: Found and expanded section 11');
      } else {
        console.log('⚠ Could not click to expand section 11');
        results.steps.push('Step 5: Found section 11 but could not expand');
      }
      
      // STEP 7: Look for Audited packet and Open Report button
      console.log('\n=== STEP 7: Look for Audited packet and Open Report button ===');
      
      await wait(1000); // Wait for section to expand
      
      // Take screenshot after expansion
      await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/step7a-after-expand.png', fullPage: true });
      results.screenshots.push('step7a-after-expand.png');
      
      const packetInfo = await page.evaluate(() => {
        // Look for all "Open Report" buttons on the page
        const buttons = Array.from(document.querySelectorAll('button'));
        const reportButtons = buttons.filter(b => {
          const text = b.textContent || '';
          return text.trim() === 'Open Report' || text.trim() === 'View Report';
        });
        
        return {
          found: reportButtons.length > 0,
          reportButtonCount: reportButtons.length,
          reportButtonTexts: reportButtons.map(b => b.textContent.trim()),
        };
      });
      
      console.log('Packet info:', packetInfo);
      
      if (packetInfo.found && packetInfo.reportButtonCount > 0) {
        console.log('✓ Found', packetInfo.reportButtonCount, 'report button(s) in section 11');
        console.log('Report button(s):', packetInfo.reportButtonTexts);
        
        // Try to click the first "Open Report" button
        console.log('Attempting to click first Open Report button...');
        
        const reportClicked = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const reportBtn = buttons.find(b => {
            const text = b.textContent || '';
            return text.trim() === 'Open Report' || text.trim() === 'View Report';
          });
          
          if (reportBtn) {
            reportBtn.click();
            return { clicked: true, text: reportBtn.textContent.trim() };
          }
          
          return { clicked: false, reason: 'Button not found' };
        });
        
        if (reportClicked.clicked) {
          console.log('✓ Clicked report button:', reportClicked.text);
          await wait(3000); // Wait longer for modal to open
          
          results.steps.push(`Step 7: Clicked "${reportClicked.text}" button`);
          
          // Take screenshot after clicking
          await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/step7b-after-click.png', fullPage: true });
          results.screenshots.push('step7b-after-click.png');
          
          // STEP 8: Check for PacketReviewModal
          console.log('\n=== STEP 8: Verify PacketReviewModal opened ===');
          
          // Check for modal with different selectors
          const modalInfo = await page.evaluate(() => {
            // Try different modal selectors
            const modal = document.querySelector('[role="dialog"]') ||
                         document.querySelector('.modal') ||
                         document.querySelector('[class*="Modal"]') ||
                         document.querySelector('[class*="modal"]');
            
            if (!modal) {
              // Check if there's any overlay or backdrop
              const overlay = document.querySelector('[class*="overlay"]') ||
                             document.querySelector('[class*="backdrop"]');
              return {
                opened: false,
                hasOverlay: !!overlay,
                bodyClasses: document.body.className,
              };
            }
            
            const text = modal.textContent || '';
            const title = modal.querySelector('h1, h2, h3, [class*="title"]')?.textContent || '';
            
            // Look for specific sections
            const headings = Array.from(modal.querySelectorAll('h1, h2, h3, h4, h5, h6'));
            const sections = headings.map(h => h.textContent.trim());
            
            // Look for risk level badge
            const badges = Array.from(modal.querySelectorAll('[class*="badge"], span'));
            const riskBadge = badges.find(b => {
              const text = b.textContent || '';
              return /low|medium|high.*risk/i.test(text);
            });
            
            // Check for specific sections mentioned in requirements
            const hasExecutiveConclusion = /executive.*conclusion/i.test(text);
            const hasThresholdDeficiencies = /threshold.*deficiencies/i.test(text);
            const hasFilingCompleteness = /filing.*completeness/i.test(text);
            const hasCriticalIssues = /critical.*issues/i.test(text);
            const hasDocumentReview = /document.*review/i.test(text);
            const hasFinalAudit = /final.*audit/i.test(text);
            const hasPacketReview = /packet.*review/i.test(text);
            
            return {
              opened: true,
              title: title.substring(0, 100),
              sections: sections.slice(0, 20),
              riskBadge: riskBadge ? riskBadge.textContent.trim() : null,
              hasExecutiveConclusion,
              hasThresholdDeficiencies,
              hasFilingCompleteness,
              hasCriticalIssues,
              hasDocumentReview,
              hasFinalAudit,
              hasPacketReview,
              modalHTML: modal.outerHTML.substring(0, 500),
            };
          });
          
          console.log('Modal opened:', modalInfo.opened);
          if (modalInfo.opened) {
            console.log('Modal title:', modalInfo.title);
            console.log('Risk badge:', modalInfo.riskBadge);
            console.log('Sections found:', modalInfo.sections);
            console.log('Has Executive Conclusion:', modalInfo.hasExecutiveConclusion);
            console.log('Has Threshold Deficiencies:', modalInfo.hasThresholdDeficiencies);
            console.log('Has Filing Completeness:', modalInfo.hasFilingCompleteness);
            
            results.reportModalOpened = true;
            results.reportSections = modalInfo.sections;
            results.steps.push('Step 8: PacketReviewModal opened successfully');
            
            // Take screenshot of modal header
            await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/step8a-modal-header.png', fullPage: false });
            results.screenshots.push('step8a-modal-header.png');
            console.log('✓ Screenshot: Modal header');
            
            await wait(500);
            
            // Take full modal screenshot
            await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/step8b-modal-full.png', fullPage: true });
            results.screenshots.push('step8b-modal-full.png');
            console.log('✓ Screenshot: Full modal');
            
            // STEP 9: Scroll through modal sections
            console.log('\n=== STEP 9: Scroll through modal sections ===');
            
            // Scroll to Executive Conclusion
            if (modalInfo.hasExecutiveConclusion) {
              await page.evaluate(() => {
                const modal = document.querySelector('[role="dialog"]');
                if (modal) {
                  const headings = Array.from(modal.querySelectorAll('*'));
                  const execConclusion = headings.find(h => /executive.*conclusion/i.test(h.textContent || ''));
                  if (execConclusion) {
                    execConclusion.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }
              });
              await wait(1000);
              await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/step9a-executive-conclusion.png', fullPage: true });
              results.screenshots.push('step9a-executive-conclusion.png');
              console.log('✓ Screenshot: Executive Conclusion');
            }
            
            // Scroll to Threshold Deficiencies
            if (modalInfo.hasThresholdDeficiencies) {
              await page.evaluate(() => {
                const modal = document.querySelector('[role="dialog"]');
                if (modal) {
                  const headings = Array.from(modal.querySelectorAll('*'));
                  const threshold = headings.find(h => /threshold.*deficiencies/i.test(h.textContent || ''));
                  if (threshold) {
                    threshold.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }
              });
              await wait(1000);
              await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/step9b-threshold-deficiencies.png', fullPage: true });
              results.screenshots.push('step9b-threshold-deficiencies.png');
              console.log('✓ Screenshot: Threshold Deficiencies');
            }
            
            // Scroll to Filing Completeness
            if (modalInfo.hasFilingCompleteness) {
              await page.evaluate(() => {
                const modal = document.querySelector('[role="dialog"]');
                if (modal) {
                  const headings = Array.from(modal.querySelectorAll('*'));
                  const filing = headings.find(h => /filing.*completeness/i.test(h.textContent || ''));
                  if (filing) {
                    filing.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }
              });
              await wait(1000);
              await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/step9c-filing-completeness.png', fullPage: true });
              results.screenshots.push('step9c-filing-completeness.png');
              console.log('✓ Screenshot: Filing Completeness');
            }
            
            // Scroll to bottom of modal
            await page.evaluate(() => {
              const modal = document.querySelector('[role="dialog"]');
              if (modal) {
                const scrollContainer = modal.querySelector('[class*="overflow"]') || modal;
                scrollContainer.scrollTo(0, scrollContainer.scrollHeight);
              }
            });
            await wait(1000);
            await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/step9d-modal-bottom.png', fullPage: true });
            results.screenshots.push('step9d-modal-bottom.png');
            console.log('✓ Screenshot: Modal bottom');
            
            results.steps.push('Step 9: Scrolled through all modal sections');
          } else {
            console.log('✗ Modal did not open');
            results.steps.push('Step 8: Modal did not open after clicking button');
          }
        } else {
          console.log('✗ Could not click report button');
          results.steps.push(`Step 7: Report button not found in section 11: ${reportClicked.reason || 'unknown'}`);
        }
      } else {
        console.log('⚠ No report buttons found in section 11');
        results.steps.push('Step 7: No report buttons found in section 11');
      }
    } else {
      results.steps.push('Step 5: Section 11 not found on page');
    }

    // Final screenshot
    await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/step-final.png', fullPage: true });
    results.screenshots.push('step-final.png');

  } catch (error) {
    results.consoleErrors.push({
      type: 'script-error',
      text: error.message,
      stack: error.stack,
    });
    console.error('\n✗ Error during verification:', error);
    results.steps.push(`Error: ${error.message}`);
  } finally {
    if (browser) {
      console.log('\nClosing browser in 5 seconds...');
      await wait(5000);
      await browser.close();
    }
  }

  return results;
}

// Run verification
console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║  Starting Final Audit Report UI Verification             ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

const results = await verifyAuditReportUI();

// Write results to file
writeFileSync(
  '/Users/sergeysopot/LMS-EB1A/audit-ui-verification-results.json',
  JSON.stringify(results, null, 2)
);

console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║  VERIFICATION COMPLETE                                    ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

console.log('=== SUMMARY ===');
console.log('Login Success:', results.loginSuccess ? '✓' : '✗');
console.log('Case Page Access:', results.casePageAccess ? '✓' : '✗');
console.log('Section 11 Found:', results.section11Found ? '✓' : '✗');
console.log('Report Modal Opened:', results.reportModalOpened ? '✓' : '✗');
console.log('\nScreenshots:', results.screenshots.length);
console.log('Console Errors:', results.consoleErrors.length);
console.log('\nResults saved to: audit-ui-verification-results.json');
console.log('Screenshots saved to: screenshots/\n');

process.exit(0);
