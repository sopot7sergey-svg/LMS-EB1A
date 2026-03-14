import puppeteer from 'puppeteer-core';
import { mkdir } from 'fs/promises';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function verifySection6Buttons() {
  const log = [];
  let browser;

  try {
    await mkdir('/Users/sergeysopot/LMS-EB1A/screenshots', { recursive: true });

    browser = await puppeteer.launch({
      headless: false,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      slowMo: 300,
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    log.push('Step 1: Navigating to login...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    await wait(1000);
    
    // Login
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
    
    log.push('✓ Logged in successfully');

    // Navigate to case
    log.push('Step 2: Navigating to case...');
    await page.goto('http://localhost:3000/case/dc75d30d-3a2e-4865-a65c-241b8175e526', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    await wait(5000);
    log.push('✓ Case page loaded');

    // Scroll to checklist
    log.push('Step 3: Scrolling to Submission Checklist...');
    await page.evaluate(() => window.scrollTo(0, 600));
    await wait(2000);
    log.push('✓ Scrolled to checklist');

    // Expand Section 6
    log.push('Step 4: Expanding Section 6 - Comparable Evidence...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const section6 = buttons.find(b => /^6\.\s+Comparable Evidence/i.test(b.textContent || ''));
      if (section6) {
        section6.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          const expanded = section6.getAttribute('aria-expanded');
          console.log('Section 6 aria-expanded:', expanded);
          if (expanded !== 'true') {
            section6.click();
            console.log('Clicked to expand Section 6');
          } else {
            console.log('Section 6 already expanded');
          }
        }, 500);
      } else {
        console.log('Section 6 not found');
      }
    });
    await wait(3000);
    log.push('✓ Section 6 expanded');

    // Scroll down to see all of section 6
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const section6 = buttons.find(b => /^6\.\s+Comparable Evidence/i.test(b.textContent || ''));
      if (section6) {
        const rect = section6.getBoundingClientRect();
        window.scrollTo(0, window.scrollY + rect.top - 100);
      }
    });
    await wait(2000);

    // Take initial screenshot
    await page.screenshot({ 
      path: '/Users/sergeysopot/LMS-EB1A/screenshots/section6-top.png',
      fullPage: false 
    });
    log.push('✓ Screenshot: section6-top.png');

    // Scroll to see middle of section 6
    await page.evaluate(() => window.scrollBy(0, 400));
    await wait(1500);
    await page.screenshot({ 
      path: '/Users/sergeysopot/LMS-EB1A/screenshots/section6-middle.png',
      fullPage: false 
    });
    log.push('✓ Screenshot: section6-middle.png');

    // Scroll to see bottom of section 6
    await page.evaluate(() => window.scrollBy(0, 400));
    await wait(1500);
    await page.screenshot({ 
      path: '/Users/sergeysopot/LMS-EB1A/screenshots/section6-bottom.png',
      fullPage: false 
    });
    log.push('✓ Screenshot: section6-bottom.png');

    // Full page screenshot
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const section6 = buttons.find(b => /^6\.\s+Comparable Evidence/i.test(b.textContent || ''));
      if (section6) {
        section6.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    await wait(2000);
    await page.screenshot({ 
      path: '/Users/sergeysopot/LMS-EB1A/screenshots/section6-full.png',
      fullPage: true 
    });
    log.push('✓ Screenshot: section6-full.png');

    // Analyze all rows in Section 6
    log.push('Step 5: Analyzing all rows in Section 6...');
    const rowAnalysis = await page.evaluate(() => {
      // Find Section 6 header
      const buttons = Array.from(document.querySelectorAll('button'));
      const section6Header = buttons.find(b => /^6\.\s+Comparable Evidence/i.test(b.textContent || ''));
      
      if (!section6Header) {
        return { error: 'Section 6 header not found' };
      }

      // Find the content container (next sibling after header)
      let contentContainer = section6Header.parentElement?.nextElementSibling;
      
      // Try multiple strategies to find the content
      if (!contentContainer) {
        // Strategy 2: Look for expanded accordion content
        let parent = section6Header.parentElement;
        for (let i = 0; i < 10 && parent; i++) {
          const expanded = parent.querySelector('[data-state="open"]');
          if (expanded) {
            contentContainer = expanded;
            break;
          }
          parent = parent.parentElement;
        }
      }

      if (!contentContainer) {
        return { error: 'Section 6 content container not found' };
      }

      // Find all visible rows within this section
      // Each row should contain document names and action buttons
      const allElements = Array.from(contentContainer.querySelectorAll('*'));
      
      const rows = [];
      const processedTexts = new Set();

      // Look for elements that contain document-like text patterns
      allElements.forEach(element => {
        const text = element.textContent || '';
        
        // Skip if this is a button or if we've seen this text
        if (element.tagName === 'BUTTON' || processedTexts.has(text)) {
          return;
        }

        // Look for document patterns (letters, certificates, evidence)
        const documentPatterns = [
          /letter/i, /certificate/i, /evidence/i, /statement/i, 
          /publication/i, /award/i, /membership/i, /judging/i,
          /media/i, /citation/i, /grant/i, /patent/i, /exhibit/i
        ];

        const isDocumentRow = documentPatterns.some(pattern => pattern.test(text));
        
        if (isDocumentRow && text.length < 500) {
          // Check if this element or its parent contains action buttons
          let container = element;
          let foundButtons = null;
          
          for (let i = 0; i < 15 && container; i++) {
            container = container.parentElement;
            if (!container) break;
            
            // Look for Add, Create, Template buttons within this container
            const buttonsInContainer = Array.from(container.querySelectorAll('button'));
            const addBtn = buttonsInContainer.find(b => b.textContent?.trim() === 'Add');
            const createBtn = buttonsInContainer.find(b => b.textContent?.trim() === 'Create');
            const templateBtn = buttonsInContainer.find(b => b.textContent?.trim() === 'Template');
            
            if (addBtn || createBtn || templateBtn) {
              foundButtons = {
                hasAdd: !!addBtn,
                hasCreate: !!createBtn,
                hasTemplate: !!templateBtn,
              };
              
              // Try to extract the document name more cleanly
              let docName = text;
              // Remove button text
              docName = docName.replace(/\s*(Add|Create|Template|Not started|Pending|Complete)\s*/gi, '');
              // Truncate long descriptions
              if (docName.length > 200) {
                // Try to find just the title part
                const lines = docName.split('\n');
                docName = lines[0] || docName.substring(0, 200);
              }
              
              docName = docName.trim();
              
              if (docName && !processedTexts.has(docName)) {
                processedTexts.add(docName);
                rows.push({
                  name: docName,
                  ...foundButtons,
                });
              }
              
              break;
            }
          }
        }
      });

      // Alternative strategy: find all rows with action buttons
      const buttonGroups = contentContainer.querySelectorAll('[class*="flex"], [class*="grid"]');
      buttonGroups.forEach(group => {
        const buttonsInGroup = Array.from(group.querySelectorAll('button'));
        const hasActionButtons = buttonsInGroup.some(b => 
          ['Add', 'Create', 'Template'].includes(b.textContent?.trim() || '')
        );
        
        if (hasActionButtons) {
          const text = group.textContent || '';
          // Extract a reasonable document name
          let docName = text.replace(/\s*(Add|Create|Template|Not started|Pending|Complete)\s*/gi, '').trim();
          
          if (docName.length > 200) {
            const firstLine = docName.split('\n')[0];
            if (firstLine && firstLine.length < 200) {
              docName = firstLine;
            } else {
              docName = docName.substring(0, 200);
            }
          }
          
          if (docName && !processedTexts.has(docName)) {
            processedTexts.add(docName);
            
            const addBtn = buttonsInGroup.find(b => b.textContent?.trim() === 'Add');
            const createBtn = buttonsInGroup.find(b => b.textContent?.trim() === 'Create');
            const templateBtn = buttonsInGroup.find(b => b.textContent?.trim() === 'Template');
            
            rows.push({
              name: docName,
              hasAdd: !!addBtn,
              hasCreate: !!createBtn,
              hasTemplate: !!templateBtn,
            });
          }
        }
      });

      return {
        success: true,
        totalRows: rows.length,
        rows: rows,
      };
    });

    if (rowAnalysis.error) {
      log.push(`✗ Error: ${rowAnalysis.error}`);
      return { log, success: false, error: rowAnalysis.error };
    }

    log.push(`✓ Found ${rowAnalysis.totalRows} rows in Section 6`);
    
    // Calculate statistics
    const rowsWithFullActionBar = rowAnalysis.rows.filter(r => 
      r.hasAdd && r.hasCreate && r.hasTemplate
    );
    
    const rowsWithOnlyAdd = rowAnalysis.rows.filter(r => 
      r.hasAdd && !r.hasCreate && !r.hasTemplate
    );
    
    const rowsMissingCreateOrTemplate = rowAnalysis.rows.filter(r => 
      !r.hasCreate || !r.hasTemplate
    );

    log.push('');
    log.push('Button Analysis:');
    log.push(`  Total rows: ${rowAnalysis.totalRows}`);
    log.push(`  Rows with Add+Create+Template: ${rowsWithFullActionBar.length}`);
    log.push(`  Rows with only Add: ${rowsWithOnlyAdd.length}`);
    log.push(`  Rows missing Create or Template: ${rowsMissingCreateOrTemplate.length}`);
    
    if (rowsMissingCreateOrTemplate.length > 0) {
      log.push('');
      log.push('⚠ Rows missing Create or Template:');
      rowsMissingCreateOrTemplate.forEach((row, i) => {
        log.push(`  [${i + 1}] ${row.name.substring(0, 80)}`);
        log.push(`      Has: Add=${row.hasAdd}, Create=${row.hasCreate}, Template=${row.hasTemplate}`);
      });
    }

    log.push('');
    log.push('All rows:');
    rowAnalysis.rows.forEach((row, i) => {
      const status = (row.hasAdd && row.hasCreate && row.hasTemplate) ? '✓' : '✗';
      log.push(`  ${status} [${i + 1}] ${row.name.substring(0, 60)}`);
      log.push(`      Add=${row.hasAdd}, Create=${row.hasCreate}, Template=${row.hasTemplate}`);
    });

    return {
      log,
      success: true,
      totalRows: rowAnalysis.totalRows,
      rowsWithFullActionBar: rowsWithFullActionBar.length,
      rowsWithOnlyAdd: rowsWithOnlyAdd.length,
      rowsMissingCreateOrTemplate: rowsMissingCreateOrTemplate.map(r => r.name),
      allRows: rowAnalysis.rows,
    };

  } catch (error) {
    log.push(`ERROR: ${error.message}`);
    console.error(error);
    return { log, success: false, error: error.message };
  } finally {
    if (browser) {
      await wait(5000);
      await browser.close();
    }
  }
}

console.log('═══════════════════════════════════════════════════════════');
console.log('  SECTION 6 BUTTON VERIFICATION');
console.log('  Comparable Evidence - Add/Create/Template Check');
console.log('═══════════════════════════════════════════════════════════\n');

const results = await verifySection6Buttons();

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  VERIFICATION LOG');
console.log('═══════════════════════════════════════════════════════════\n');

results.log.forEach(line => console.log(line));

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  FINAL REPORT');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('QUESTION: Does Section 6 show Add/Create/Template on ALL rows?');
console.log('');
console.log('Total rows counted:', results.totalRows || 0);
console.log('Rows with full action bar (Add+Create+Template):', results.rowsWithFullActionBar || 0);
console.log('Rows with only Add:', results.rowsWithOnlyAdd || 0);
console.log('');

if (results.rowsMissingCreateOrTemplate && results.rowsMissingCreateOrTemplate.length > 0) {
  console.log('❌ ISSUE FOUND: Some rows are missing Create or Template buttons');
  console.log('');
  console.log('Rows missing Create/Template:');
  results.rowsMissingCreateOrTemplate.forEach((name, i) => {
    console.log(`  ${i + 1}. ${name.substring(0, 100)}`);
  });
} else {
  console.log('✅ ALL ROWS have Add, Create, and Template buttons');
}

console.log('');
console.log('Screenshots saved:');
console.log('  - section6-top.png');
console.log('  - section6-middle.png');
console.log('  - section6-bottom.png');
console.log('  - section6-full.png');

process.exit(0);
