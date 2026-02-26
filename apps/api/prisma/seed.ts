import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const modules = [
  {
    title: 'Case Axis and Strategy',
    description: 'Choose your field, narrative, and proposed endeavor for a cohesive package.',
    order: 0,
    lessons: [
      {
        title: 'How USCIS reads an EB-1A case',
        description: 'One story, one logic, one trajectory',
        order: 1,
      },
      {
        title: 'Choosing your Field',
        description: 'How not to spread yourself too thin (AI/automation/security/platforms/entrepreneurship)',
        order: 2,
      },
      {
        title: 'Proposed Endeavor',
        description: 'How to frame your future work in the U.S. convincingly without "NIW logic"',
        order: 3,
      },
      {
        title: 'Case positioning',
        description: 'Which criteria make the most sense for your axis',
        order: 4,
      },
    ],
  },
  {
    title: 'Diagnostic Across the 10 Criteria',
    description: 'Build a Criteria Matrix and choose 3-6 criteria aligned with your axis and evidence.',
    order: 1,
    lessons: [
      {
        title: 'The 10 criteria',
        description: 'What actually "works" in practice (no promises)',
        order: 1,
      },
      {
        title: 'How evidence is "read"',
        description: 'Quality, independence, scale, verifiability',
        order: 2,
      },
      {
        title: 'Choosing 5-6 criteria instead of 3',
        description: 'The "thick case" strategy',
        order: 3,
      },
      {
        title: 'Evidence map',
        description: 'Which document types support which criteria',
        order: 4,
      },
      {
        title: 'Overall merits',
        description: 'How to prepare "total persuasiveness" in advance',
        order: 5,
      },
    ],
  },
  {
    title: 'Building Evidence for 3-6 Criteria',
    description: 'Build Exhibits that truly "carry" the criteria.',
    order: 2,
    lessons: [
      {
        title: 'What "critical role" means in evidence',
        description: 'Not the title, but the impact',
        order: 1,
      },
      {
        title: 'How to present projects',
        description: 'Scope → ownership → impact → metrics',
        order: 2,
      },
      {
        title: 'Role confirmation letters',
        description: 'Which wording and which attachments',
        order: 3,
      },
      {
        title: 'How to present compensation correctly',
        description: 'Pay stubs, offer letters, W-2, equity docs',
        order: 4,
      },
      {
        title: 'Market benchmarks',
        description: 'What to use if perfect benchmarks are not available',
        order: 5,
      },
      {
        title: '"Major significance" = impact beyond your own team',
        description: 'Original Contributions criterion',
        order: 6,
      },
      {
        title: 'Patents are not required',
        description: 'Alternatives: architectures, implementations, savings, scale',
        order: 7,
      },
      {
        title: 'How to write a "Contribution Narrative"',
        description: 'Support it with independent sources',
        order: 8,
      },
      {
        title: 'What counts as judging',
        description: 'And what does not',
        order: 9,
      },
      {
        title: 'How to quickly and legally build up judging',
        description: 'Hackathons, grants, peer review',
        order: 10,
      },
      {
        title: 'How to document judging',
        description: 'Invitations, criteria, confirmations, logs',
        order: 11,
      },
      {
        title: '"About you" vs "by you"',
        description: 'Published Material criterion',
        order: 12,
      },
      {
        title: 'Interviews/profiles/mentions',
        description: 'Structure and requirements',
        order: 13,
      },
      {
        title: 'How to package publications as exhibits',
        description: 'Formatting and presentation',
        order: 14,
      },
      {
        title: 'Why "paid and joined" does not work',
        description: 'Membership criterion',
        order: 15,
      },
      {
        title: 'How to prove selectivity',
        description: 'Selection criteria, acceptance rate, requirements',
        order: 16,
      },
      {
        title: 'What to use instead if membership is not selective',
        description: 'Alternative evidence strategies',
        order: 17,
      },
    ],
  },
  {
    title: 'Recommendation Letters',
    description: '6-10 strong letters, distributed by author type.',
    order: 3,
    lessons: [
      {
        title: 'Letter architecture',
        description: 'Who confirms which facts',
        order: 1,
      },
      {
        title: '"Independent" letters',
        description: 'How to find authors and how to ask',
        order: 2,
      },
      {
        title: 'A letter must not be "he is a good person"',
        description: 'Structure: claim → evidence → impact',
        order: 3,
      },
      {
        title: 'How to avoid templating and "too-similar" letters',
        description: 'Differentiation strategies',
        order: 4,
      },
      {
        title: 'Letter attachments',
        description: 'Author CV, bio, proof of authority',
        order: 5,
      },
    ],
  },
  {
    title: 'Petition Packaging and Final Assembly',
    description: 'Assemble a complete submission-grade package.',
    order: 4,
    lessons: [
      {
        title: 'Petition package structure',
        description: 'Table of contents, tabs, exhibit numbering',
        order: 1,
      },
      {
        title: 'Cover letter / legal brief',
        description: 'Criteria logic + overall merits',
        order: 2,
      },
      {
        title: 'Exhibit labeling',
        description: 'Making it "officer-readable"',
        order: 3,
      },
      {
        title: 'Translations',
        description: 'Formatting requirements and certification',
        order: 4,
      },
      {
        title: 'Final QA check',
        description: 'How an officer thinks during the first pass',
        order: 5,
      },
    ],
  },
  {
    title: 'Filing I-140 and Post-Filing Process',
    description: 'Understand filing scenarios and what to do after filing.',
    order: 5,
    lessons: [
      {
        title: 'What gets filed',
        description: 'The I-140 package + dependencies based on U.S. status',
        order: 1,
      },
      {
        title: 'Premium processing',
        description: 'When it makes sense (no promises)',
        order: 2,
      },
      {
        title: 'AOS vs Consular processing',
        description: 'Decision logic',
        order: 3,
      },
      {
        title: 'What happens after filing',
        description: 'Receipt, requests, timelines, actions',
        order: 4,
      },
      {
        title: 'How to respond to real USCIS letters',
        description: 'Process-focused guidance',
        order: 5,
      },
    ],
  },
  {
    title: 'Officer-Style Review',
    description: 'Get Evidence Enhancement Requests (EER) with citations to authoritative sources.',
    order: 6,
    lessons: [
      {
        title: 'How to read the EER/SER report and close items',
        description: 'Understanding the feedback',
        order: 1,
      },
      {
        title: 'Prioritization',
        description: 'What is critical, recommended, optional',
        order: 2,
      },
      {
        title: 'Iteration',
        description: 'How to reach "minimal risk" in structure and clarity',
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

async function main() {
  console.log('Starting seed...');

  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@lms-eb1a.com' },
    update: {},
    create: {
      email: 'admin@lms-eb1a.com',
      password: adminPassword,
      name: 'Admin User',
      role: 'admin',
    },
  });
  console.log('Created admin user:', admin.email);

  const testPassword = await bcrypt.hash('test1234', 12);
  const testUser = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
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
        data: moduleInfo,
      });
    } else {
      module = await prisma.module.create({
        data: moduleInfo,
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
          data: lessonData,
        });
      } else {
        await prisma.lesson.create({
          data: {
            ...lessonData,
            moduleId: module.id,
          },
        });
      }
    }

    console.log(`  Created/updated ${lessons.length} lessons`);
  }

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
