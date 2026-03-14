import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const modules = [
  {
    title: '"Case Axis" and Strategy',
    description: 'How USCIS reads the case, choosing your field, proposed endeavor, and case positioning.',
    order: 0,
    lessons: [
      {
        title: 'How USCIS reads an EB-1A case.',
        description: null,
        order: 1,
      },
      {
        title: 'Choosing your field.',
        description: null,
        order: 2,
      },
      {
        title: 'Proposed endeavor.',
        description: null,
        order: 3,
      },
      {
        title: 'Case positioning.',
        description: null,
        order: 4,
      },
    ],
  },
  {
    title: 'Diagnosis Across the 10 Criteria',
    description: 'Diagnosis, evidence reading, criteria selection, evidence mapping, and overall merits.',
    order: 1,
    lessons: [
      {
        title: 'The 10 criteria: what actually "works" in practice',
        description: null,
        order: 1,
      },
      {
        title: 'How evidence is "read"',
        description: null,
        order: 2,
      },
      {
        title: 'Choosing 5-6 criteria instead of 3',
        description: null,
        order: 3,
      },
      {
        title: 'Evidence map: which types of documents satisfy which criteria',
        description: null,
        order: 4,
      },
      {
        title: 'Overall merits: how to prepare "cumulative persuasiveness" in advance',
        description: null,
        order: 5,
      },
    ],
  },
  {
    title: 'Building Evidence for the 10 Criteria',
    description: 'Introductory block, criteria-by-criteria evidence building, and comparable evidence.',
    order: 2,
    lessons: [
      {
        title: 'What "initial evidence" is and why context matters',
        description: '2.0 Introductory Block',
        order: 1,
      },
      {
        title: 'Principles: independence, verifiability, scale, cause-and-effect relationship',
        description: '2.0 Introductory Block',
        order: 2,
      },
      {
        title: 'How to formulate the Proposed Endeavor persuasively',
        description: '2.0 Introductory Block',
        order: 3,
      },
      {
        title: 'How to build "Exhibit logic"',
        description: '2.0 Introductory Block',
        order: 4,
      },
      {
        title: 'What counts as an "award" and what does not',
        description: '2.1 Criterion 1 · Lesser nationally or internationally recognized prizes or awards',
        order: 5,
      },
      {
        title: 'How to prove "recognition": contest rules, judges, reach, competitiveness',
        description: '2.1 Criterion 1 · Lesser nationally or internationally recognized prizes or awards',
        order: 6,
      },
      {
        title: 'How to package it: certificate + award description + supporting sources',
        description: '2.1 Criterion 1 · Lesser nationally or internationally recognized prizes or awards',
        order: 7,
      },
      {
        title: 'How USCIS looks at selectivity',
        description: '2.2 Criterion 2 · Membership in associations that require outstanding achievements',
        order: 8,
      },
      {
        title: 'What evidence to use',
        description: '2.2 Criterion 2 · Membership in associations that require outstanding achievements',
        order: 9,
      },
      {
        title: 'Plan B: what to use instead of membership if there is no selectivity',
        description: '2.2 Criterion 2 · Membership in associations that require outstanding achievements',
        order: 10,
      },
      {
        title: 'The difference between a profile / interview / mention vs. your own authored article',
        description: '2.3 Criterion 3 · Published material about you in professional or major media',
        order: 11,
      },
      {
        title: 'How to prove "major / professional": media profile, audience, editorial policy',
        description: '2.3 Criterion 3 · Published material about you in professional or major media',
        order: 12,
      },
      {
        title: 'How to present it',
        description: '2.3 Criterion 3 · Published material about you in professional or major media',
        order: 13,
      },
      {
        title: 'What qualifies as judging',
        description: '2.4 Criterion 4 · Judging: Evaluation of the work of others',
        order: 14,
      },
      {
        title: 'How to document it',
        description: '2.4 Criterion 4 · Judging: Evaluation of the work of others',
        order: 15,
      },
      {
        title: 'How to build up judging quickly in a lawful and provable way',
        description: '2.4 Criterion 4 · Judging: Evaluation of the work of others',
        order: 16,
      },
      {
        title: '"Major significance" = impact beyond your own team',
        description: '2.5 Criterion 5 · Original contributions of major significance',
        order: 17,
      },
      {
        title: 'How to present a claim-based approach',
        description: '2.5 Criterion 5 · Original contributions of major significance',
        order: 18,
      },
      {
        title: 'What evidence to use',
        description: '2.5 Criterion 5 · Original contributions of major significance',
        order: 19,
      },
      {
        title: 'Scholarly vs. professional',
        description: '2.6 Criterion 6 · Authorship of scholarly articles in professional publications or major media',
        order: 20,
      },
      {
        title: 'How to prove the impact of articles outside the academic environment',
        description: '2.6 Criterion 6 · Authorship of scholarly articles in professional publications or major media',
        order: 21,
      },
      {
        title: 'Packaging: PDF, links, indexing, metrics (where applicable)',
        description: '2.6 Criterion 6 · Authorship of scholarly articles in professional publications or major media',
        order: 22,
      },
      {
        title: 'What counts as an exhibition/showcase',
        description: '2.7 Criterion 7 · Display of work at artistic exhibitions and showcases',
        order: 23,
      },
      {
        title: 'How to prove selection and the status of the venue',
        description: '2.7 Criterion 7 · Display of work at artistic exhibitions and showcases',
        order: 24,
      },
      {
        title: 'Packaging: catalogs, event pages, curator letters',
        description: '2.7 Criterion 7 · Display of work at artistic exhibitions and showcases',
        order: 25,
      },
      {
        title: '"Distinguished" organization: how to prove it',
        description: '2.8 Criterion 8 · Leading or critical role for distinguished organizations',
        order: 26,
      },
      {
        title: 'How to prove the impact of articles outside the academic environment',
        description: '2.8 Criterion 8 · Leading or critical role for distinguished organizations',
        order: 27,
      },
      {
        title: '"Critical" = indispensable function + impact on the result',
        description: '2.8 Criterion 8 · Leading or critical role for distinguished organizations',
        order: 28,
      },
      {
        title: 'Which documents qualify',
        description: '2.9 Criterion 9 · High salary or other significantly high remuneration',
        order: 29,
      },
      {
        title: 'Market comparison: how to do it correctly and what sources to use',
        description: '2.9 Criterion 9 · High salary or other significantly high remuneration',
        order: 30,
      },
      {
        title: 'How not to overload the case with too many numbers',
        description: '2.9 Criterion 9 · High salary or other significantly high remuneration',
        order: 31,
      },
      {
        title: 'Who it applies to and which metrics are accepted',
        description: '2.10 Criterion 10 · Commercial success in the performing arts',
        order: 32,
      },
      {
        title: 'How to prove it',
        description: '2.10 Criterion 10 · Commercial success in the performing arts',
        order: 33,
      },
      {
        title: 'How to package the evidence',
        description: '2.10 Criterion 10 · Commercial success in the performing arts',
        order: 34,
      },
      {
        title: 'When comparable evidence is allowed',
        description: '2.C Comparable Evidence · Comparable Evidence (if the criteria do not fit)',
        order: 35,
      },
      {
        title: 'How to build comparability',
        description: '2.C Comparable Evidence · Comparable Evidence (if the criteria do not fit)',
        order: 36,
      },
      {
        title: 'Risks: why you must explain "why the 10 criteria do not fit"',
        description: '2.C Comparable Evidence · Comparable Evidence (if the criteria do not fit)',
        order: 37,
      },
    ],
  },
  {
    title: 'Recommendation Letters',
    description: 'Letter architecture, independent letters, substance, differentiation, and attachments.',
    order: 3,
    lessons: [
      {
        title: 'Letter architecture',
        description: null,
        order: 1,
      },
      {
        title: '"Independent" letters',
        description: null,
        order: 2,
      },
      {
        title: 'A letter should not be reduced to a general positive evaluation',
        description: null,
        order: 3,
      },
      {
        title: 'How to avoid template language and letters that are "too similar"',
        description: null,
        order: 4,
      },
      {
        title: 'Attachments to recommendation letters',
        description: null,
        order: 5,
      },
    ],
  },
  {
    title: 'Petition Packaging and Final Assembly',
    description: 'Package structure, legal brief logic, exhibit readability, translations, and final QA.',
    order: 4,
    lessons: [
      {
        title: 'Petition package structure',
        description: null,
        order: 1,
      },
      {
        title: 'Cover letter / legal brief: logic by criteria + overall merits',
        description: null,
        order: 2,
      },
      {
        title: 'Exhibit labeling: how to make it "readable for the officer"',
        description: null,
        order: 3,
      },
      {
        title: 'Translations: formatting requirements and certification',
        description: null,
        order: 4,
      },
      {
        title: 'Final QA review: "how the officer thinks during the first pass-through"',
        description: null,
        order: 5,
      },
    ],
  },
  {
    title: 'Filing the I-140 and What Comes After',
    description: '(premium / AOS / consular)',
    order: 5,
    lessons: [
      {
        title: 'What gets filed: the I-140 package + dependencies based on U.S. status',
        description: null,
        order: 1,
      },
      {
        title: 'Premium processing: when it makes sense',
        description: null,
        order: 2,
      },
      {
        title: 'AOS vs. consular processing: decision logic',
        description: null,
        order: 3,
      },
      {
        title: 'What happens after filing',
        description: null,
        order: 4,
      },
      {
        title: 'How to respond to real USCIS notices',
        description: null,
        order: 5,
      },
    ],
  },
  {
    title: 'Officer-Style Review',
    description: 'Read the EER/SER, prioritize flagged points, and iterate toward minimum risk.',
    order: 6,
    lessons: [
      {
        title: 'How to read the EER/SER report and how to close the flagged points',
        description: null,
        order: 1,
      },
      {
        title: 'Prioritization: what is critical, what is desirable, and what is optional',
        description: null,
        order: 2,
      },
      {
        title: 'Iteration: how to get to "minimum risk" in structure and clarity',
        description: null,
        order: 3,
      },
    ],
  },
];

const ragChunks = [
  {
    source: 'USCIS Policy Manual Vol 6 Part F Ch 2',
    section: 'Two-Step Analysis',
    content: 'USCIS officers should evaluate the evidence submitted with the petition in a two-step analysis. First, the officer should determine if the evidence submitted meets the parameters of the regulatory criterion. Second, the officer should evaluate the evidence together when considering the petition in its entirety to make a final merits determination.',
    topicTags: ['two-step', 'analysis', 'final merits'],
  },
  {
    source: 'USCIS Policy Manual Vol 6 Part F Ch 2',
    section: 'Final Merits Determination',
    content: 'After determining that the petitioner has submitted evidence that meets at least three criteria, USCIS officers then evaluate the evidence together when considering the petition in its entirety to make a final merits determination of whether or not the petitioner, by a preponderance of the evidence, has demonstrated the required high level of expertise for the immigrant classification.',
    topicTags: ['final merits', 'totality', 'holistic review'],
  },
  {
    source: '8 CFR 204.5(h)',
    section: 'Extraordinary Ability Definition',
    content: 'Extraordinary ability means a level of expertise indicating that the individual is one of that small percentage who have risen to the very top of the field of endeavor.',
    topicTags: ['definition', 'extraordinary ability', 'top of field'],
  },
  {
    source: '8 CFR 204.5(h)(3)',
    section: 'Criteria Overview',
    content: 'A petition for an alien of extraordinary ability must be accompanied by evidence that the alien has sustained national or international acclaim and that his or her achievements have been recognized in the field of expertise. Such evidence shall include evidence of a one-time achievement (that is, a major, internationally recognized award), or at least three of the following criteria.',
    topicTags: ['criteria', 'evidence', 'requirements'],
  },
  {
    source: 'Kazarian v. USCIS (9th Cir. 2010)',
    section: 'Two-Step Analysis',
    content: 'The Ninth Circuit established that USCIS should use a two-part approach: first, count the types of evidence provided; second, determine whether the evidence demonstrates that the alien has sustained national or international acclaim and is among the small percentage at the very top of the field.',
    topicTags: ['Kazarian', 'two-step', 'analysis', 'precedent'],
  },
  {
    source: 'Matter of Chawathe (AAO 2010)',
    section: 'Preponderance of Evidence',
    content: 'The standard of proof in immigration proceedings is preponderance of the evidence. The petitioner must establish that the claim is "probably true," where the determination of "truth" is made based on the factual circumstances of each individual case.',
    topicTags: ['Chawathe', 'preponderance', 'evidence standard'],
  },
  {
    source: 'USCIS PM Vol 1 Part E Ch 6',
    section: 'RFE Procedures',
    content: 'If all required initial evidence has been submitted but the evidence submitted does not establish eligibility, USCIS may request additional evidence. The RFE should identify the eligibility requirement that has not been established and request evidence that directly addresses the deficiency.',
    topicTags: ['RFE', 'procedures', 'evidence'],
  },
  {
    source: '8 CFR 103.2',
    section: 'Adjudication Procedures',
    content: 'The petitioner must establish eligibility at the time of filing. USCIS may request additional evidence if the initial evidence does not establish eligibility. The request shall specify the type of evidence required.',
    topicTags: ['adjudication', 'procedures', 'evidence'],
  },
];

function isProductionSeedAllowed(): boolean {
  const env = process.env.NODE_ENV;
  const explicit = process.env.ALLOW_SEED_IN_PRODUCTION;
  if (env === 'production' && explicit !== '1') {
    console.error(
      '[SEED] BLOCKED: NODE_ENV=production and ALLOW_SEED_IN_PRODUCTION is not set. ' +
        'Seed must not run in production by default to avoid overwriting user data. ' +
        'If you intentionally need to seed production (e.g. first deploy), set ALLOW_SEED_IN_PRODUCTION=1.'
    );
    return false;
  }
  return true;
}

async function main() {
  console.log('Starting seed...');

  if (!isProductionSeedAllowed()) {
    process.exit(1);
  }

  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@aipas.com' },
    update: {},
    create: {
      email: 'admin@aipas.com',
      password: adminPassword,
      name: 'Admin User',
      role: 'admin',
    },
  });
  console.log('Created admin user:', admin.email);

  const testPassword = await bcrypt.hash('Test1234', 12);
  const testUser = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: { password: testPassword },
    create: {
      email: 'test@example.com',
      password: testPassword,
      name: 'Test Student',
      role: 'student',
    },
  });
  console.log('Created test user:', testUser.email);

  for (const moduleData of modules) {
    const { lessons, ...moduleInfo } = moduleData;

    const existingModule = await prisma.module.findFirst({
      where: { order: moduleInfo.order },
    });

    let module;
    if (existingModule) {
      module = await prisma.module.update({
        where: { id: existingModule.id },
        data: {
          ...moduleInfo,
          isActive: true,
        },
      });
    } else {
      module = await prisma.module.create({
        data: {
          ...moduleInfo,
          isActive: true,
        },
      });
    }

    console.log(`Created/updated module: ${module.title}`);

    for (const lessonData of lessons) {
      const existingLesson = await prisma.lesson.findFirst({
        where: {
          moduleId: module.id,
          order: lessonData.order,
        },
      });

      if (existingLesson) {
        await prisma.lesson.update({
          where: { id: existingLesson.id },
          data: {
            ...lessonData,
            isActive: true,
          },
        });
      } else {
        await prisma.lesson.create({
          data: {
            ...lessonData,
            moduleId: module.id,
            isActive: true,
          },
        });
      }
    }

    await prisma.lesson.updateMany({
      where: {
        moduleId: module.id,
        order: { notIn: lessons.map((lesson) => lesson.order) },
      },
      data: {
        isActive: false,
      },
    });

    console.log(`  Created/updated ${lessons.length} lessons`);
  }

  await prisma.module.updateMany({
    where: {
      order: { notIn: modules.map((module) => module.order) },
    },
    data: {
      isActive: false,
    },
  });

  for (const chunk of ragChunks) {
    const existing = await prisma.rAGChunk.findFirst({
      where: {
        source: chunk.source,
        section: chunk.section,
      },
    });

    if (!existing) {
      await prisma.rAGChunk.create({
        data: {
          ...chunk,
          embedding: [],
        },
      });
    }
  }
  console.log(`Created ${ragChunks.length} RAG chunks`);

  console.log('Seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
