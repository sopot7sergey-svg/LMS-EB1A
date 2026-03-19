import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { grantStartAfterCoursePurchase } from '../src/services/access';
import { generateWelcomeCodes } from '../src/lib/welcome-codes';

const prisma = new PrismaClient();

const modules = [
  {
    title: '"Ось дела" и стратегия',
    description: 'Выбрать field + narrative + proposed endeavor, чтобы весь пакет был единым.',
    order: 0,
    lessons: [
      {
        title: 'Как USCIS читает EB-1A: "одна история, одна логика, одна траектория"',
        description: null,
        order: 1,
      },
      {
        title: 'Выбор Field: как не распылиться (AI/automation/security/platforms/entrepreneurship)',
        description: null,
        order: 2,
      },
      {
        title: 'Proposed Endeavor: как формулировать будущее в США без "NIW-логики", но убедительно',
        description: null,
        order: 3,
      },
      {
        title: '"Case positioning": какие критерии логичнее под твою ось (не из списка, а из жизни)',
        description: null,
        order: 4,
      },
    ],
  },
  {
    title: 'Диагностика по 10 критериям',
    description: 'Построить Criteria Matrix, выбрать 3–6 критериев под твою ось и доказательства.',
    order: 1,
    lessons: [
      {
        title: '10 критериев: что реально "работает" на практике',
        description: null,
        order: 1,
      },
      {
        title: 'Как "читаются" доказательства: качества, независимость, масштаб, проверяемость',
        description: null,
        order: 2,
      },
      {
        title: 'Выбор 5–6 критериев вместо 3: стратегия "толстого дела"',
        description: null,
        order: 3,
      },
      {
        title: 'Карта доказательств: какие типы документов закрывают какие критерии',
        description: null,
        order: 4,
      },
      {
        title: 'Overall merits: как заранее готовить "суммарную убедительность"',
        description: null,
        order: 5,
      },
    ],
  },
  {
    title: 'Построение доказательств под 10 критериев',
    description: 'Вводный блок, критерии по одному, сопоставимые доказательства.',
    order: 2,
    lessons: [
      {
        title: 'Что такое "initial evidence" и почему важен контекст',
        description: '2.0 Вводный блок',
        order: 1,
      },
      {
        title: 'Принципы: независимость, проверяемость, масштаб, причинно-следственная связь "ты → вклад → эффект"',
        description: '2.0 Вводный блок',
        order: 2,
      },
      {
        title: 'Proposed Endeavor: как формулировать будущее в США без "NIW-логики", но убедительно',
        description: '2.0 Вводный блок',
        order: 3,
      },
      {
        title: 'Как строить "Exhibit logic": один критерий → 2–6 exhibits → короткий narrative',
        description: '2.0 Вводный блок',
        order: 4,
      },
      {
        title: 'Что считается "award", а что нет',
        description: '2.1 Критерий 1 · Lesser nationally or internationally recognized prizes or awards',
        order: 5,
      },
      {
        title: 'Как доказывать "recognition": правила конкурса, жюри, охват, конкурентность',
        description: '2.1 Критерий 1 · Lesser nationally or internationally recognized prizes or awards',
        order: 6,
      },
      {
        title: 'Как упаковать: сертификат + описание премии + источники подтверждения',
        description: '2.1 Критерий 1 · Lesser nationally or internationally recognized prizes or awards',
        order: 7,
      },
      {
        title: 'Как USCIS смотрит на селективность',
        description: '2.2 Критерий 2 · Membership in associations requiring outstanding achievements (selective)',
        order: 8,
      },
      {
        title: 'Чем подтверждать: bylaws/criteria, acceptance rate, требования к кандидатам',
        description: '2.2 Критерий 2 · Membership in associations requiring outstanding achievements (selective)',
        order: 9,
      },
      {
        title: 'План B: чем заменить membership, если селективности нет',
        description: '2.2 Критерий 2 · Membership in associations requiring outstanding achievements (selective)',
        order: 10,
      },
      {
        title: 'Разница: профиль/интервью/упоминание vs твоя авторская статья',
        description: '2.3 Критерий 3 · Published material about you in professional/major media',
        order: 11,
      },
      {
        title: 'Как доказывать "major / professional": медиа-профиль, аудитория, редакционная политика',
        description: '2.3 Критерий 3 · Published material about you in professional/major media',
        order: 12,
      },
      {
        title: 'Как оформлять: скрин/копия + метаданные + перевод + пояснение',
        description: '2.3 Критерий 3 · Published material about you in professional/major media',
        order: 13,
      },
      {
        title: 'Что является judging: хакатоны, гранты, peer review, конкурсы, комитеты',
        description: '2.4 Критерий 4 · Judging the work of others',
        order: 14,
      },
      {
        title: 'Как документировать: приглашения, guidelines, logs, подтверждения организаторов',
        description: '2.4 Критерий 4 · Judging the work of others',
        order: 15,
      },
      {
        title: 'Как быстро "нарастить" judging легально и доказуемо',
        description: '2.4 Критерий 4 · Judging the work of others',
        order: 16,
      },
      {
        title: '"Major significance" = влияние за пределами твоей команды',
        description: '2.5 Критерий 5 · Original contributions of major significance',
        order: 17,
      },
      {
        title: 'Как оформлять claim-based подход: 2–4 ключевых "claims" + доказательства',
        description: '2.5 Критерий 5 · Original contributions of major significance',
        order: 18,
      },
      {
        title: 'Чем подтверждать: метрики, внедрения, adoption, экономия, цитирования, независимые письма/публикации',
        description: '2.5 Критерий 5 · Original contributions of major significance',
        order: 19,
      },
      {
        title: 'Scholarly vs professional: что подходит',
        description: '2.6 Критерий 6 · Authorship of scholarly articles (professional/major media)',
        order: 20,
      },
      {
        title: 'Как доказывать влияние статей вне научной среды (если это индустрия)',
        description: '2.6 Критерий 6 · Authorship of scholarly articles (professional/major media)',
        order: 21,
      },
      {
        title: 'Упаковка: PDF, ссылки, индексации, показатели (где применимо)',
        description: '2.6 Критерий 6 · Authorship of scholarly articles (professional/major media)',
        order: 22,
      },
      {
        title: 'Что считается exhibition/showcase (онлайн/оффлайн)',
        description: '2.7 Критерий 7 · Display of work in artistic exhibitions/showcases',
        order: 23,
      },
      {
        title: 'Как доказывать отбор и статус площадки',
        description: '2.7 Критерий 7 · Display of work in artistic exhibitions/showcases',
        order: 24,
      },
      {
        title: 'Упаковка: каталоги, страницы мероприятий, кураторские письма',
        description: '2.7 Критерий 7 · Display of work in artistic exhibitions/showcases',
        order: 25,
      },
      {
        title: '"Distinguished" организация: как подтверждать (не словами, а источниками)',
        description: '2.8 Критерий 8 · Leading or critical role for distinguished organizations',
        order: 26,
      },
      {
        title: '"Critical" = незаменимая функция + влияние на результат',
        description: '2.8 Критерий 8 · Leading or critical role for distinguished organizations',
        order: 27,
      },
      {
        title: 'Доказательства: письма, org charts, performance reviews (где можно), релизы, метрики проектов',
        description: '2.8 Критерий 8 · Leading or critical role for distinguished organizations',
        order: 28,
      },
      {
        title: 'Какие документы подходят (salary, bonus, equity — что и как показывать)',
        description: '2.9 Критерий 9 · High salary or other significantly high remuneration',
        order: 29,
      },
      {
        title: 'Сравнение с рынком: как делать корректно и чем подтверждать источники',
        description: '2.9 Критерий 9 · High salary or other significantly high remuneration',
        order: 30,
      },
      {
        title: 'Как не "перегрузить" кейс лишними цифрами',
        description: '2.9 Критерий 9 · High salary or other significantly high remuneration',
        order: 31,
      },
      {
        title: 'Кому применимо и какие метрики принимаются',
        description: '2.10 Критерий 10 · Commercial successes in the performing arts',
        order: 32,
      },
      {
        title: 'Доказательства: sales, box office, charts, contracts, third-party reports',
        description: '2.10 Критерий 10 · Commercial successes in the performing arts',
        order: 33,
      },
      {
        title: 'Упаковка: источники + пояснение причинной связи',
        description: '2.10 Критерий 10 · Commercial successes in the performing arts',
        order: 34,
      },
      {
        title: 'Когда допустимо comparable evidence',
        description: '2.C Comparable evidence (если критерии не подходят)',
        order: 35,
      },
      {
        title: 'Как строить сопоставимость: "аналог по смыслу" + независимые подтверждения',
        description: '2.C Comparable evidence (если критерии не подходят)',
        order: 36,
      },
      {
        title: 'Риски: почему надо объяснять "почему 10 критериев не подходят"',
        description: '2.C Comparable evidence (если критерии не подходят)',
        order: 37,
      },
    ],
  },
  {
    title: 'Рекомендательные письма',
    description: '6–10 strong letters, распределенные по типам авторов.',
    order: 3,
    lessons: [
      {
        title: 'Архитектура писем: кто какие факты подтверждает',
        description: null,
        order: 1,
      },
      {
        title: '"Независимые" письма: как находить и как просить',
        description: null,
        order: 2,
      },
      {
        title: 'Письмо не должно быть "он хороший": структура (claim → evidence → impact)',
        description: null,
        order: 3,
      },
      {
        title: 'Как избегать шаблонности и "слишком одинаковых" писем',
        description: null,
        order: 4,
      },
      {
        title: 'Приложения к письмам: CV автора, bio, доказательства авторитетности',
        description: null,
        order: 5,
      },
    ],
  },
  {
    title: 'Упаковка петиции и финальная сборка',
    description: 'Собрать полный "submission-grade" пакет.',
    order: 4,
    lessons: [
      {
        title: 'Структура petition package: оглавление, табы, нумерация exhibits',
        description: null,
        order: 1,
      },
      {
        title: 'Cover letter / legal brief: логика по критериям + overall merits',
        description: null,
        order: 2,
      },
      {
        title: 'Exhibit labeling: как сделать "читабельно для офицера"',
        description: null,
        order: 3,
      },
      {
        title: 'Переводы: требования к оформлению и certification',
        description: null,
        order: 4,
      },
      {
        title: 'Финальная QA-проверка: "как мыслит офицер при первом пролистывании"',
        description: null,
        order: 5,
      },
    ],
  },
  {
    title: 'Подача I-140 и процесс после (premium / AOS / consular)',
    description: 'Понять сценарии подачи и что делать после.',
    order: 5,
    lessons: [
      {
        title: 'Что подается: I-140 пакет + зависимости от статуса в США',
        description: null,
        order: 1,
      },
      {
        title: 'Premium processing: когда имеет смысл (без обещаний)',
        description: null,
        order: 2,
      },
      {
        title: 'AOS vs Consular processing: логика выбора',
        description: null,
        order: 3,
      },
      {
        title: 'Что происходит после подачи: receipt, запросы, сроки, действия',
        description: null,
        order: 4,
      },
      {
        title: 'Как реагировать на реальные письма USCIS (процессно)',
        description: null,
        order: 5,
      },
    ],
  },
  {
    title: 'Officer-Style Review',
    description: 'Virtual USCIS Officer Review — слой после Модуля 4.',
    order: 6,
    lessons: [
      {
        title: 'AI Officer Dashboard: обзор функций и логики проверки кейса',
        description: null,
        order: 1,
      },
      {
        title: 'AI Axis & Strategy Engine: выбор оси и стратегии на основе Intake Questionnaire',
        description: null,
        order: 2,
      },
      {
        title: 'Officer-Style Petition Audit: AI-проверка документов, структуры и логики всей EB-1A петиции',
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

  // Production admin: sopot7sergey@gmail.com (permanent admin access)
  const prodAdminPassword = await bcrypt.hash('AdminSeed2025', 12);
  const prodAdmin = await prisma.user.upsert({
    where: { email: 'sopot7sergey@gmail.com' },
    update: { role: 'admin', password: prodAdminPassword },
    create: {
      email: 'sopot7sergey@gmail.com',
      password: prodAdminPassword,
      name: 'Production Admin',
      role: 'admin',
    },
  });
  console.log('Upserted production admin:', prodAdmin.email);

  // 5 test students with lifetime course + Start 30 days
  const TEST_PASSWORD = 'Test1234';
  const testStudents = [
    { email: 'test1@example.com', name: 'Test Student 1' },
    { email: 'test2@example.com', name: 'Test Student 2' },
    { email: 'test3@example.com', name: 'Test Student 3' },
    { email: 'test4@example.com', name: 'Test Student 4' },
    { email: 'test5@example.com', name: 'Test Student 5' },
  ];
  const hashedTestPassword = await bcrypt.hash(TEST_PASSWORD, 12);
  for (const s of testStudents) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: { password: hashedTestPassword },
      create: {
        email: s.email,
        password: hashedTestPassword,
        name: s.name,
        role: 'student',
      },
    });
    await grantStartAfterCoursePurchase(user.id);
    console.log('Upserted test student:', user.email);
  }
  console.log(`Test students password: ${TEST_PASSWORD}`);

  const existingStudents = await prisma.user.findMany({
    where: { role: 'student' },
    include: { courseEntitlement: true, appAccess: true },
  });
  for (const u of existingStudents) {
    if (!u.courseEntitlement || !u.appAccess) {
      await grantStartAfterCoursePurchase(u.id);
      console.log('Backfilled access for:', u.email);
    }
  }

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

  for (const plan of ['start', 'pro', 'ultra'] as const) {
    await prisma.aIQuotaPolicy.upsert({
      where: { plan },
      create: {
        plan,
        advisorChatCallLimit: plan === 'start' ? 5 : plan === 'pro' ? 25 : 100,
        documentReviewLimit: plan === 'start' ? 3 : plan === 'pro' ? 15 : 50,
        finalAuditLimit: plan === 'start' ? 2 : plan === 'pro' ? 10 : 30,
        coverLetterGenerateLimit: plan === 'start' ? 1 : plan === 'pro' ? 5 : 20,
        monthlyCostLimitUsd: plan === 'start' ? 2 : plan === 'pro' ? 15 : 50,
      },
      update: {},
    });
  }
  console.log('Created AI quota policies for start, pro, ultra');

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

  const welcomeCodes = generateWelcomeCodes();
  const testCodes = welcomeCodes.filter((c) => c.isTest).map((c) => c.code);
  const productionCodes = welcomeCodes.filter((c) => !c.isTest).map((c) => c.code);

  for (const { code } of welcomeCodes) {
    await prisma.accessCode.upsert({
      where: { code },
      create: {
        code,
        status: 'active',
        grantCourseAccess: true,
        grantStartAccess: true,
        startDurationDays: 30,
      },
      update: {},
    });
  }
  console.log(`Created ${welcomeCodes.length} welcome access codes (200 production + 5 TEST)`);
  console.log('TEST codes:', testCodes.join(', '));

  console.log('');
  console.log('=== PRODUCTION SEED SUMMARY ===');
  console.log('Admin: sopot7sergey@gmail.com / AdminSeed2025');
  console.log('Test students: test1@example.com .. test5@example.com / Test1234');
  console.log('Welcome codes: 205 total (200 production + 5 TEST)');
  console.log('TEST codes:', testCodes.join(', '));
  console.log('===============================');
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
