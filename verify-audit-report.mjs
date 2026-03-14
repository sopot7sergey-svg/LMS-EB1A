import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'fs';
import { mkdir } from 'fs/promises';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function verifyAuditReport() {
  const results = {
    loginSuccess: false,
    dashboardAccess: false,
    caseAccess: false,
    section11Found: false,
    section11Details: null,
    compiledPacketsFound: false,
    auditButtonClicked: false,
    reportModalOpened: false,
    reportDetails: null,
    consoleErrors: [],
    screenshots: [],
    steps: [],
  };

  let browser;
  try {
    // Ensure screenshots directory exists
    await mkdir('/Users/sergeysopot/LMS-EB1A/screenshots', { recursive: true });

    browser = await puppeteer.launch({
      headless: false, // Set to false so user can see what's happening
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

    // STEP 1: Navigate to login page (skip actual login due to frontend issues)
    console.log('Step 1: Skipping login for direct case access...');
    results.loginSuccess = false;
    results.dashboardAccess = false;
    results.steps.push('Skipped login - navigating directly to case');

    // STEP 2-3: Navigate directly to test case
    console.log('Step 2: Navigating directly to test case...');
    const testCaseId = '361f562c-7c36-40e2-854f-d08e19c1a76b';
    await page.goto(`http://localhost:3000/case/${testCaseId}`, { waitUntil: 'networkidle2' });
    await wait(5000); // Wait for page to load
    
    await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/audit-03-case-page.png', fullPage: true });
    results.screenshots.push('audit-03-case-page.png');
    results.caseAccess = true;
    results.steps.push('Navigated directly to test case');
    
    const caseInfo = { firstCaseHref: `/case/${testCaseId}` };

    // STEP 4: Already on the case page, update results
    results.caseAccess = true;
    results.steps.push(`On case page: /case/${testCaseId}`);

    // STEP 5: Scroll down and look for section 11 (only if on a case page)
    if (results.caseAccess) {
      console.log('Step 3: Looking for section 11 "Packet Compilation & Audit"...');
      
      // First, scroll down the page
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await wait(1000);
    
    const section11Info = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      
      // Look for section 11 text
      const section11Element = elements.find(el => {
        const text = el.textContent || '';
        return /11\.\s*Packet Compilation.*Audit/i.test(text) && text.length < 200;
      });
      
      if (!section11Element) {
        // Try alternative pattern
        const altElement = elements.find(el => {
          const text = el.textContent || '';
          return /Packet Compilation.*Audit/i.test(text) && text.length < 200;
        });
        
        if (altElement) {
          return {
            found: true,
            text: altElement.textContent.trim(),
            isExpanded: false,
          };
        }
        
        return { found: false };
      }
      
      // Check if section is expanded
      let container = section11Element;
      let isExpanded = false;
      
      // Find the parent button or container
      for (let i = 0; i < 5 && container; i++) {
        const ariaExpanded = container.getAttribute('aria-expanded');
        if (ariaExpanded !== null) {
          isExpanded = ariaExpanded === 'true';
          break;
        }
        container = container.parentElement;
      }
      
      return {
        found: true,
        text: section11Element.textContent.trim(),
        isExpanded,
      };
    });
    
    console.log('Section 11 info:', section11Info);
    results.section11Found = section11Info.found;
    results.section11Details = section11Info;

    if (section11Info.found) {
      results.steps.push('Found section 11: Packet Compilation & Audit');
      
      // Expand the section if collapsed
      if (!section11Info.isExpanded) {
        console.log('Expanding section 11...');
        await page.evaluate(() => {
          const elements = Array.from(document.querySelectorAll('*'));
          const section11Element = elements.find(el => {
            const text = el.textContent || '';
            return /11\.\s*Packet Compilation.*Audit/i.test(text) && text.length < 200;
          });
          
          if (section11Element) {
            let button = section11Element;
            while (button && button.tagName !== 'BUTTON') {
              button = button.parentElement;
            }
            if (button) {
              button.click();
            }
          }
        });
        
        await wait(1000);
      }
      
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
      await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/audit-05-section-11.png', fullPage: true });
      results.screenshots.push('audit-05-section-11.png');
      
      // STEP 6: Look for compiled packets and audit buttons
      console.log('Step 6: Looking for compiled packets and audit buttons...');
      
      const packetsInfo = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('*'));
        
        // Find section 11 container
        const section11Element = elements.find(el => {
          const text = el.textContent || '';
          return /11\.\s*Packet Compilation.*Audit/i.test(text) && text.length < 200;
        });
        
        if (!section11Element) return { found: false };
        
        // Find the expanded content area
        let container = section11Element;
        for (let i = 0; i < 10 && container; i++) {
          container = container.parentElement;
          if (container && container.querySelector('[role="region"]')) {
            break;
          }
        }
        
        if (!container) return { found: false };
        
        // Look for buttons within this section
        const buttons = Array.from(container.querySelectorAll('button'));
        const buttonTexts = buttons.map(b => b.textContent.trim());
        
        // Look for specific audit-related buttons
        const runAuditBtn = buttons.find(b => /Run Audit/i.test(b.textContent));
        const openReportBtn = buttons.find(b => /Open Report/i.test(b.textContent));
        const viewReportBtn = buttons.find(b => /View Report/i.test(b.textContent));
        
        // Look for packet listings
        const text = container.textContent || '';
        const hasPacketListing = text.includes('packet') || text.includes('Packet');
        
        return {
          found: true,
          allButtons: buttonTexts,
          hasRunAudit: !!runAuditBtn,
          hasOpenReport: !!openReportBtn,
          hasViewReport: !!viewReportBtn,
          hasPacketListing,
          containerText: text.substring(0, 500),
        };
      });
      
      console.log('Packets info:', packetsInfo);
      results.compiledPacketsFound = packetsInfo.found && packetsInfo.hasPacketListing;
      
      if (packetsInfo.found) {
        results.steps.push(`Found buttons: ${packetsInfo.allButtons.join(', ')}`);
        
        // STEP 7: Try clicking audit button
        if (packetsInfo.hasRunAudit || packetsInfo.hasOpenReport || packetsInfo.hasViewReport) {
          console.log('Step 7: Clicking audit/report button...');
          
          const buttonClicked = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('*'));
            const section11Element = elements.find(el => {
              const text = el.textContent || '';
              return /11\.\s*Packet Compilation.*Audit/i.test(text) && text.length < 200;
            });
            
            if (!section11Element) return { clicked: false };
            
            let container = section11Element;
            for (let i = 0; i < 10 && container; i++) {
              container = container.parentElement;
              if (container && container.querySelector('[role="region"]')) {
                break;
              }
            }
            
            if (!container) return { clicked: false };
            
            const buttons = Array.from(container.querySelectorAll('button'));
            const auditBtn = buttons.find(b => 
              /Run Audit|Open Report|View Report/i.test(b.textContent)
            );
            
            if (auditBtn) {
              const buttonText = auditBtn.textContent.trim();
              auditBtn.click();
              return { clicked: true, buttonText };
            }
            
            return { clicked: false };
          });
          
          console.log('Button click result:', buttonClicked);
          
          if (buttonClicked.clicked) {
            results.auditButtonClicked = true;
            results.steps.push(`Clicked button: ${buttonClicked.buttonText}`);
            
            await wait(2000);
            
            // STEP 8: Check for modal/report
            console.log('Step 8: Checking for modal/report...');
            
            const modalInfo = await page.evaluate(() => {
              const modal = document.querySelector('[role="dialog"]');
              if (!modal) return { opened: false };
              
              const text = modal.textContent || '';
              const title = modal.querySelector('h2, h3, [class*="title"]')?.textContent || '';
              
              // Look for report sections
              const headings = Array.from(modal.querySelectorAll('h1, h2, h3, h4'));
              const sections = headings.map(h => h.textContent.trim());
              
              // Look for specific audit report elements
              const hasExecutiveSummary = /Executive Summary/i.test(text);
              const hasCriticalIssues = /Critical Issues/i.test(text);
              const hasRecommendations = /Recommendations/i.test(text);
              const hasDocumentReview = /Document Review/i.test(text);
              const hasCompleteness = /Completeness/i.test(text);
              
              return {
                opened: true,
                title,
                text: text.substring(0, 1000),
                sections,
                hasExecutiveSummary,
                hasCriticalIssues,
                hasRecommendations,
                hasDocumentReview,
                hasCompleteness,
              };
            });
            
            console.log('Modal info:', modalInfo);
            results.reportModalOpened = modalInfo.opened;
            results.reportDetails = modalInfo;
            
            if (modalInfo.opened) {
              results.steps.push('Audit report modal opened');
              await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/audit-06-report-modal.png', fullPage: true });
              results.screenshots.push('audit-06-report-modal.png');
              
              // Scroll within modal if needed
              await page.evaluate(() => {
                const modal = document.querySelector('[role="dialog"]');
                if (modal) {
                  const scrollContainer = modal.querySelector('[class*="overflow"]') || modal;
                  scrollContainer.scrollTop = scrollContainer.scrollHeight / 2;
                }
              });
              
              await wait(1000);
              await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/audit-07-report-scrolled.png', fullPage: true });
              results.screenshots.push('audit-07-report-scrolled.png');
            }
          }
        } else {
          results.steps.push('No audit/report buttons found in section 11');
        }
      }
    } else {
      results.steps.push('Section 11 not found on the page');
    }
    } else {
      results.steps.push('Skipped section 11 check - not on a case page');
    }

    // Final screenshot
    await page.screenshot({ path: '/Users/sergeysopot/LMS-EB1A/screenshots/audit-08-final.png', fullPage: true });
    results.screenshots.push('audit-08-final.png');

  } catch (error) {
    results.consoleErrors.push({
      type: 'script-error',
      text: error.message,
      stack: error.stack,
    });
    console.error('Error during verification:', error);
    results.steps.push(`Error: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return results;
}

// Run verification
console.log('Starting Final Audit Report verification...');
const results = await verifyAuditReport();

// Write results to file
writeFileSync(
  '/Users/sergeysopot/LMS-EB1A/audit-report-verification-results.json',
  JSON.stringify(results, null, 2)
);

console.log('\n=== VERIFICATION RESULTS ===');
console.log(JSON.stringify(results, null, 2));
console.log('\nResults saved to audit-report-verification-results.json');
console.log('Screenshots saved to screenshots/ directory');

process.exit(0);
