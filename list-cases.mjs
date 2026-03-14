import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listCases() {
  try {
    const cases = await prisma.case.findMany({
      select: {
        id: true,
        userId: true,
        caseAxisStatement: true,
        status: true,
        createdAt: true,
        _count: {
          select: {
            compileJobs: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });

    console.log('=== Available Cases ===\n');
    cases.forEach((c, idx) => {
      console.log(`${idx + 1}. Case ID: ${c.id}`);
      console.log(`   Status: ${c.status}`);
      console.log(`   Axis: ${c.caseAxisStatement?.substring(0, 60)}...`);
      console.log(`   Compile Jobs: ${c._count.compileJobs}`);
      console.log(`   Created: ${c.createdAt}`);
      console.log(`   URL: http://localhost:3000/case/${c.id}`);
      console.log('');
    });

    return cases;
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listCases();
