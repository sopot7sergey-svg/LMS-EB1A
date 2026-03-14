export const MODULE_IDS = {
  M0: 'module-0',
  M1: 'module-1',
  M2: 'module-2',
  M3: 'module-3',
  M4: 'module-4',
  M5: 'module-5',
  M6: 'module-6',
} as const;

export const MODULE_TITLES = {
  [MODULE_IDS.M0]: '"Case Axis" and Strategy',
  [MODULE_IDS.M1]: 'Diagnosis Across the 10 Criteria',
  [MODULE_IDS.M2]: 'Building Evidence for the 10 Criteria',
  [MODULE_IDS.M3]: 'Recommendation Letters',
  [MODULE_IDS.M4]: 'Petition Packaging and Final Assembly',
  [MODULE_IDS.M5]: 'Filing the I-140 and What Comes After',
  [MODULE_IDS.M6]: 'Officer-Style Review',
} as const;

export const CRITERIA_IDS = {
  C1: 'C1',
  C2: 'C2',
  C3: 'C3',
  C4: 'C4',
  C5: 'C5',
  C6: 'C6',
  C7: 'C7',
  C8: 'C8',
  C9: 'C9',
  C10: 'C10',
} as const;

export const RAG_SOURCES = {
  USCIS_PM_VOL6_PART_F_CH2: 'USCIS Policy Manual Vol 6 Part F Ch 2',
  CFR_204_5_H: '8 CFR 204.5(h)',
  USCIS_PM_VOL1_PART_E_CH6: 'USCIS PM Vol 1 Part E Ch 6',
  USCIS_PM_VOL1_PART_E_CH9: 'USCIS PM Vol 1 Part E Ch 9',
  CFR_103_2: '8 CFR 103.2',
  KAZARIAN: 'Kazarian v. USCIS (9th Cir. 2010)',
  CHAWATHE: 'Matter of Chawathe (AAO 2010)',
  BULETINI: 'Buletini v. INS (E.D. Mich. 1994)',
  MUNI: 'Muni v. INS (N.D. Ill. 1995)',
  AAO_DECISIONS: 'USCIS AAO Adopted Decisions',
} as const;

export const EER_PRIORITIES = {
  CRITICAL: 'critical',
  RECOMMENDED: 'recommended',
  OPTIONAL: 'optional',
} as const;

export const API_ROUTES = {
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    LOGOUT: '/api/auth/logout',
    ME: '/api/auth/me',
  },
  USERS: '/api/users',
  CASES: '/api/cases',
  MODULES: '/api/modules',
  LESSONS: '/api/lessons',
  PROGRESS: '/api/progress',
  DOCUMENTS: '/api/documents',
  EER: '/api/eer',
  CHAT: '/api/chat',
  ADMIN: {
    VIDEOS: '/api/admin/videos',
    LESSONS: '/api/admin/lessons',
    MODULES: '/api/admin/modules',
    USERS: '/api/admin/users',
  },
  AI: {
    INTAKE: '/api/ai/intake',
    CRITERIA_MAPPER: '/api/ai/criteria-mapper',
    EVIDENCE_TODO: '/api/ai/evidence-todo',
    ROLE_BUILDER: '/api/ai/role-builder',
    COMPENSATION_BUILDER: '/api/ai/compensation-builder',
    CONTRIBUTION_GENERATOR: '/api/ai/contribution-generator',
    JUDGING_BUILDER: '/api/ai/judging-builder',
    MEDIA_KIT_BUILDER: '/api/ai/media-kit-builder',
    MEMBERSHIP_ANALYZER: '/api/ai/membership-analyzer',
    LETTER_PLANNER: '/api/ai/letter-planner',
    LETTER_DRAFT: '/api/ai/letter-draft',
    REPETITION_CHECKER: '/api/ai/repetition-checker',
    PETITION_ASSEMBLER: '/api/ai/petition-assembler',
    CONSISTENCY_CHECKER: '/api/ai/consistency-checker',
    TRANSLATION_HELPER: '/api/ai/translation-helper',
    FILING_CHECKLIST: '/api/ai/filing-checklist',
    EER_GENERATOR: '/api/ai/eer-generator',
  },
} as const;
