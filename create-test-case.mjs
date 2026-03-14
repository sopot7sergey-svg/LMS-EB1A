import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createTestCase() {
  try {
    // Get the test user
    const user = await prisma.user.findUnique({
      where: { email: 'test@example.com' },
    });

    if (!user) {
      console.error('Test user not found. Run seed first.');
      process.exit(1);
    }

    // Create a test case
    const testCase = await prisma.case.create({
      data: {
        userId: user.id,
        caseAxisStatement: 'Test Case for Audit Verification - demonstrating extraordinary ability in software engineering',
        proposedEndeavor: 'Continue contributing to open-source projects and building innovative software solutions',
        keywords: ['software', 'engineering', 'open-source'],
        criteriaSelected: ['awards', 'membership', 'published_material'],
        status: 'in_progress',
      },
    });

    console.log('Created test case:', testCase.id);

    // Create a compile job for this case
    const compileJob = await prisma.compileJob.create({
      data: {
        caseId: testCase.id,
        status: 'completed',
        progress: 100,
        options: {},
      },
    });

    console.log('Created compile job:', compileJob.id);

    console.log('\n=== Test Data Created ===');
    console.log('Case ID:', testCase.id);
    console.log('Case URL: http://localhost:3000/case/' + testCase.id);
    console.log('Compile Job ID:', compileJob.id);

    return { testCase, compileJob };
  } catch (error) {
    console.error('Error creating test case:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createTestCase();
