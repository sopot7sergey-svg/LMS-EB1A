import puppeteer from 'puppeteer-core';
import { mkdir } from 'fs/promises';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function verifySection7Buttons() {
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

    log.push('Step 1: Logging in...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    await wait(1000);
    
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

    log.push('Step 2: Navigating to case...');
    await page.goto('http://localhost:3000/case/dc75d30d-3a2e-4865-a65c-241b8175e526', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    await wait(5000);
    log.push('✓ Case page loaded');

    log.push('Step 3: Scrolling to Submission Checklist...');
    await page.evaluate(() => window.scrollTo(0, 600));
    await wait(2000);

    log.push('Step 4: Expanding Section 7 - Expert Letters...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const section7 = buttons.find(b => /^7\.\s+Expert.*Letters/i.test(b.textContent || ''));
      if (section7) {
        section7.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          const expanded = section7.getAttribute('aria-expanded');
          console.log('Section 7 aria-expanded:', expanded);
          if (expanded !== 'true') {
            section7.click();
            console.log('Clicked to expand Section 7');
          } else {
            console.log('Section 7 already expanded');
          }
        }, 500);
      } else {
        console.log('Section 7 not found');
      }
    });
    await wait(3000);
    log.push('✓ Section 7 expanded');

    // Take initial screenshot
    await page.screenshot({ 
      path: '/Users/sergeysopot/LMS-EB1A/screenshots/section7-full.png',
      fullPage: true 
    });
    log.push('✓ Screenshot: section7-full.png');

    // Analyze ALL rows in Section 7
    log.push('Step 5: Analyzing all rows in Section 7...');
    const rowAnalysis = await page.evaluate(() => {
      // Find Section 7 container
      const buttons = Array.from(document.querySelectorAll('button'));
      const section7Header = buttons.find(b => /^7\.\s+Expert.*Letters/i.test(b.textContent || ''));
      
      if (!section7Header) {
        return { error: 'Section 7 header not found' };
      }

      // Find the expanded content container
      let contentContainer = section7Header.parentElement;
      while (contentContainer && !contentContainer.querySelector('[role="region"]')) {
        contentContainer = contentContainer.nextElementSibling;
        if (!contentContainer) break;
      }

      if (!contentContainer) {
        // Alternative: find by looking at siblings
        contentContainer = section7Header.closest('[data-state]')?.parentElement;
      }

      const rows = [];
      
      // Strategy: Find all document rows in Section 7
      // Look for elements that contain document names and action buttons
      const allElements = Array.from(document.querySelectorAll('*'));
      
      // Find all potential row containers near Section 7
      let section7Container = section7Header;
      for (let i = 0; i < 10; i++) {
        section7Container = section7Container.parentElement;
        if (!section7Container) break;
      }

      if (section7Container) {
        // Look for all rows with buttons
        const potentialRows = section7Container.querySelectorAll('div');
        
        potentialRows.forEach((row, index) => {
          const text = row.textContent || '';
          
          // Check if this is a document row (has a reasonable name length and buttons)
          const rowButtons = Array.from(row.querySelectorAll('button'));
          const hasAdd = rowButtons.some(b => b.textContent?.trim() === 'Add');
          const hasCreate = rowButtons.some(b => b.textContent?.trim() === 'Create');
          const hasTemplate = rowButtons.some(b => b.textContent?.trim() === 'Template');
          
          // Only count rows that have at least an Add button
          if (hasAdd && text.length < 500 && text.length > 10) {
            // Try to extract the document name
            let docName = '';
            
            // Look for the main text node
            const textNodes = Array.from(row.childNodes).filter(node => 
              node.nodeType === Node.TEXT_NODE || 
              (node.nodeType === Node.ELEMENT_NODE && node.textContent && node.textContent.length < 200)
            );
            
            // Try to find a heading or strong text
            const heading = row.querySelector('h4, h3, strong, [class*="font-medium"]');
            if (heading && heading.textContent.length < 100) {
              docName = heading.textContent.trim();
            } else {
              // Extract from the beginning of text
              const cleanText = text
                .replace(/Add/g, '')
                .replace(/Create/g, '')
                .replace(/Template/g, '')
                .replace(/Not started/gi, '')
                .replace(/Pending/gi, '')
                .replace(/Draft/gi, '')
                .trim();
              
              const firstLine = cleanText.split('\n')[0];
              if (firstLine && firstLine.length < 100 && firstLine.length > 5) {
                docName = firstLine.trim();
              }
            }
            
            if (docName && !docName.includes('Expert Letters')) {
              // Get Add button opacity
              const addBtn = rowButtons.find(b => b.textContent?.trim() === 'Add');
              const addOpacity = addBtn ? window.getComputedStyle(addBtn).opacity : 'N/A';
              
              rows.push({
                name: docName,
                hasAdd,
                hasCreate,
                hasTemplate,
                addOpacity,
                buttonCount: rowButtons.filter(b => 
                  ['Add', 'Create', 'Template'].includes(b.textContent?.trim())
                ).length,
              });
            }
          }
        });
      }

      // Remove duplicates based on name
      const uniqueRows = [];
      const seenNames = new Set();
      
      rows.forEach(row => {
        const cleanName = row.name.toLowerCase().trim();
        if (!seenNames.has(cleanName)) {
          seenNames.add(cleanName);
          uniqueRows.push(row);
        }
      });

      return {
        totalRows: uniqueRows.length,
        rows: uniqueRows,
      };
    });

    if (rowAnalysis.error) {
      log.push(`✗ Error: ${rowAnalysis.error}`);
      return { log, success: false };
    }

    log.push(`✓ Found ${rowAnalysis.totalRows} total rows in Section 7`);
    log.push('');
    log.push('Detailed Row Analysis:');
    log.push('═══════════════════════════════════════════════════════════');

    let fullActionBarCount = 0;
    let onlyAddCount = 0;
    const missingButtons = [];

    rowAnalysis.rows.forEach((row, index) => {
      log.push(`\nRow ${index + 1}: ${row.name}`);
      log.push(`  Add button: ${row.hasAdd ? '✓' : '✗'} (opacity: ${row.addOpacity})`);
      log.push(`  Create button: ${row.hasCreate ? '✓' : '✗'}`);
      log.push(`  Template button: ${row.hasTemplate ? '✓' : '✗'}`);
      log.push(`  Total action buttons: ${row.buttonCount}`);

      if (row.hasAdd && row.hasCreate && row.hasTemplate) {
        fullActionBarCount++;
        log.push(`  Status: ✓ FULL ACTION BAR`);
      } else if (row.hasAdd && !row.hasCreate && !row.hasTemplate) {
        onlyAddCount++;
        log.push(`  Status: ⚠️  ONLY ADD BUTTON`);
        missingButtons.push(row.name);
      } else {
        log.push(`  Status: ✗ PARTIAL BUTTONS`);
        missingButtons.push(row.name);
      }
    });

    // Summary
    log.push('');
    log.push('═══════════════════════════════════════════════════════════');
    log.push('SUMMARY');
    log.push('═══════════════════════════════════════════════════════════');
    log.push(`Total rows in Section 7: ${rowAnalysis.totalRows}`);
    log.push(`Rows with full action bar (Add + Create + Template): ${fullActionBarCount}`);
    log.push(`Rows with only Add button: ${onlyAddCount}`);
    log.push('');

    if (missingButtons.length > 0) {
      log.push('⚠️  ROWS MISSING CREATE/TEMPLATE BUTTONS:');
      missingButtons.forEach((name, i) => {
        log.push(`  ${i + 1}. ${name}`);
      });
    } else {
      log.push('✓ ALL ROWS HAVE FULL ACTION BAR (Add + Create + Template)');
    }

    log.push('');
    log.push('Add Button Opacity Check:');
    const allDimmed = rowAnalysis.rows.every(row => 
      parseFloat(row.addOpacity) === 0.5 || row.addOpacity === '0.5'
    );
    log.push(allDimmed ? 
      '✓ All Add buttons are dimmed (opacity-50)' : 
      '⚠️  Some Add buttons may not be dimmed'
    );

    return {
      log,
      success: true,
      summary: {
        totalRows: rowAnalysis.totalRows,
        fullActionBar: fullActionBarCount,
        onlyAdd: onlyAddCount,
        missingButtons,
        allAddButtonsDimmed: allDimmed,
      },
    };

  } catch (error) {
    log.push(`ERROR: ${error.message}`);
    console.error(error);
    return { log, success: false, error: error.message };
  } finally {
    if (browser) {
      await wait(3000);
      await browser.close();
    }
  }
}

console.log('═══════════════════════════════════════════════════════════');
console.log('  SECTION 7 EXPERT LETTERS BUTTON VERIFICATION');
console.log('═══════════════════════════════════════════════════════════\n');

const results = await verifySection7Buttons();

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  VERIFICATION LOG');
console.log('═══════════════════════════════════════════════════════════\n');

results.log.forEach(line => console.log(line));

if (results.summary) {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  CRITICAL FINDINGS');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  if (results.summary.missingButtons.length === 0) {
    console.log('✅ SUCCESS: All rows in Section 7 have Add + Create + Template buttons');
  } else {
    console.log('❌ ISSUE FOUND: Some rows are missing Create/Template buttons');
    console.log(`   ${results.summary.missingButtons.length} row(s) affected`);
  }
  
  console.log('');
  console.log(`Add button dimming: ${results.summary.allAddButtonsDimmed ? '✓ Correct' : '✗ Issue'}`);
}

process.exit(0);
