/**
 * Document categories aligned with Submission Checklist sections.
 * Single source of truth for web + API.
 */

export const DOCUMENT_CATEGORIES = [
  'Case Intake & Profile',
  'Forms & Fees',
  'Identity & Status',
  'Cover Letter / Legal Brief',
  'Evidence (Criteria)',
  'Comparable Evidence',
  'Expert Letters',
  'Translations',
  'Responses to USCIS (RFE/NOID)',
  'Filing & Tracking',
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

/** Map legacy DB enum values to new category labels */
export const LEGACY_CATEGORY_MAP: Record<string, DocumentCategory> = {
  letter: 'Expert Letters',
  pay: 'Forms & Fees',
  media: 'Evidence (Criteria)',
  publication: 'Evidence (Criteria)',
  award: 'Evidence (Criteria)',
  judging: 'Evidence (Criteria)',
  membership: 'Evidence (Criteria)',
  role: 'Evidence (Criteria)',
  contribution: 'Evidence (Criteria)',
  misc: 'Case Intake & Profile',
};

/** Map checklist slotType (lower_snake_case) to document category */
export const SLOT_TYPE_TO_CATEGORY: Record<string, DocumentCategory> = {
  // s1: Case Intake & Profile
  intake_questionnaire: 'Case Intake & Profile',
  beneficiary_master_bio: 'Case Intake & Profile',
  master_cv_resume: 'Case Intake & Profile',
  employment_history_sheet: 'Case Intake & Profile',
  education_history_sheet: 'Case Intake & Profile',
  awards_honors_list: 'Case Intake & Profile',
  publications_list: 'Case Intake & Profile',
  media_press_mentions_list: 'Case Intake & Profile',
  speaking_conferences_list: 'Case Intake & Profile',
  memberships_list: 'Case Intake & Profile',
  judging_peer_review_list: 'Case Intake & Profile',
  patents_products_projects_list: 'Case Intake & Profile',
  reference_contacts_list: 'Case Intake & Profile',
  case_notes_gaps_log: 'Case Intake & Profile',
  document_inventory_evidence_tracker: 'Case Intake & Profile',
  // s2: Forms & Fees
  form_i140_final: 'Forms & Fees',
  form_i140_draft: 'Forms & Fees',
  form_g1145: 'Forms & Fees',
  form_i907: 'Forms & Fees',
  filing_fee_worksheet: 'Forms & Fees',
  payment_method_proof: 'Forms & Fees',
  uscis_filing_address_confirmation: 'Forms & Fees',
  delivery_label_courier_sheet: 'Forms & Fees',
  signed_client_declaration: 'Forms & Fees',
  // s3: Identity & Status
  passport_biographic_page: 'Identity & Status',
  us_visa_stamps: 'Identity & Status',
  form_i94: 'Identity & Status',
  i797_notices: 'Identity & Status',
  current_status_document_set: 'Identity & Status',
  ead_card: 'Identity & Status',
  advance_parole: 'Identity & Status',
  prior_uscis_filings: 'Identity & Status',
  entry_exit_travel_history: 'Identity & Status',
  birth_certificate: 'Identity & Status',
  marriage_cert_name_change: 'Identity & Status',
  court_police_dispositions: 'Identity & Status',
  // s4: Cover Letter / Legal Brief
  cover_letter_legal_brief_final: 'Cover Letter / Legal Brief',
  cover_letter_legal_brief_editable: 'Cover Letter / Legal Brief',
  table_of_contents_final: 'Cover Letter / Legal Brief',
  exhibit_list_index_final: 'Cover Letter / Legal Brief',
  exhibit_map_cross_reference: 'Cover Letter / Legal Brief',
  drafts_archive: 'Cover Letter / Legal Brief',
  // s5: Evidence (Criteria) - all evidence_* slot types
  evidence_awards_certificates: 'Evidence (Criteria)',
  evidence_awards_criteria: 'Evidence (Criteria)',
  evidence_awards_announcement: 'Evidence (Criteria)',
  evidence_awards_reputation: 'Evidence (Criteria)',
  evidence_memberships_confirmation: 'Evidence (Criteria)',
  evidence_memberships_requirements: 'Evidence (Criteria)',
  evidence_memberships_reputation: 'Evidence (Criteria)',
  evidence_published_articles: 'Evidence (Criteria)',
  evidence_published_metadata: 'Evidence (Criteria)',
  evidence_published_circulation: 'Evidence (Criteria)',
  evidence_judging_invitations: 'Evidence (Criteria)',
  evidence_judging_assignments: 'Evidence (Criteria)',
  evidence_judging_confirmation: 'Evidence (Criteria)',
  evidence_judging_proof: 'Evidence (Criteria)',
  evidence_contributions_impact: 'Evidence (Criteria)',
  evidence_contributions_metrics: 'Evidence (Criteria)',
  evidence_contributions_patents: 'Evidence (Criteria)',
  evidence_contributions_technical: 'Evidence (Criteria)',
  evidence_scholarly_articles: 'Evidence (Criteria)',
  evidence_scholarly_confirmations: 'Evidence (Criteria)',
  evidence_scholarly_citations: 'Evidence (Criteria)',
  evidence_scholarly_venue: 'Evidence (Criteria)',
  evidence_leading_verification: 'Evidence (Criteria)',
  evidence_leading_role_proof: 'Evidence (Criteria)',
  evidence_leading_reputation: 'Evidence (Criteria)',
  evidence_leading_org_charts: 'Evidence (Criteria)',
  evidence_salary_contracts: 'Evidence (Criteria)',
  evidence_salary_pay_records: 'Evidence (Criteria)',
  evidence_salary_benchmarks: 'Evidence (Criteria)',
  evidence_commercial_reports: 'Evidence (Criteria)',
  evidence_commercial_rankings: 'Evidence (Criteria)',
  evidence_commercial_press: 'Evidence (Criteria)',
  // s6: Comparable Evidence
  comparable_explanation: 'Comparable Evidence',
  industry_standards_benchmarks: 'Comparable Evidence',
  market_impact_proof: 'Comparable Evidence',
  revenue_sales_metrics_proof: 'Comparable Evidence',
  user_customer_adoption: 'Comparable Evidence',
  independent_third_party_validation: 'Comparable Evidence',
  competition_selectivity_proof: 'Comparable Evidence',
  media_industry_recognition: 'Comparable Evidence',
  comparable_role_title_evidence: 'Comparable Evidence',
  peer_comparisons_top_percent: 'Comparable Evidence',
  contracts_elite_demand: 'Comparable Evidence',
  portfolio_work_product_samples: 'Comparable Evidence',
  // s7: Expert Letters
  expert_letter_signed: 'Expert Letters',
  expert_letter_editable: 'Expert Letters',
  expert_cv_resume: 'Expert Letters',
  expert_bio_profile_proof: 'Expert Letters',
  expert_credentials_evidence: 'Expert Letters',
  relationship_independence_statement: 'Expert Letters',
  letter_request_packet: 'Expert Letters',
  supporting_materials_to_expert: 'Expert Letters',
  expert_communication_record: 'Expert Letters',
  expert_notarization: 'Expert Letters',
  // s8: Translations
  certified_translation: 'Translations',
  translator_certificate: 'Translations',
  source_document_original: 'Translations',
  translation_qa_notes: 'Translations',
  // s9: Responses to USCIS
  rfe_notice: 'Responses to USCIS (RFE/NOID)',
  noid_notice: 'Responses to USCIS (RFE/NOID)',
  courtesy_letter_deficiency: 'Responses to USCIS (RFE/NOID)',
  uscis_online_account_notice: 'Responses to USCIS (RFE/NOID)',
  rfe_response_cover_letter: 'Responses to USCIS (RFE/NOID)',
  rfe_response_toc_exhibit_list: 'Responses to USCIS (RFE/NOID)',
  point_by_point_response_memo: 'Responses to USCIS (RFE/NOID)',
  replacement_pages_corrected_forms: 'Responses to USCIS (RFE/NOID)',
  additional_evidence_exhibits: 'Responses to USCIS (RFE/NOID)',
  updated_expert_letters: 'Responses to USCIS (RFE/NOID)',
  updated_translations_certifications: 'Responses to USCIS (RFE/NOID)',
  errata_clarification_statement: 'Responses to USCIS (RFE/NOID)',
  response_shipping_label: 'Responses to USCIS (RFE/NOID)',
  response_carrier_receipt: 'Responses to USCIS (RFE/NOID)',
  response_tracking_delivery: 'Responses to USCIS (RFE/NOID)',
  online_upload_confirmation: 'Responses to USCIS (RFE/NOID)',
  // s10: Filing & Tracking
  final_filed_i140_packet: 'Filing & Tracking',
  final_toc_exhibit_list: 'Filing & Tracking',
  final_cover_letter: 'Filing & Tracking',
  final_forms_set: 'Filing & Tracking',
  filing_fee_proof: 'Filing & Tracking',
  fee_receipt_bank_confirmation: 'Filing & Tracking',
  shipping_label: 'Filing & Tracking',
  carrier_receipt: 'Filing & Tracking',
  tracking_page_screenshot: 'Filing & Tracking',
  proof_of_delivery: 'Filing & Tracking',
  i797c_receipt_notice: 'Filing & Tracking',
  receipt_number_record: 'Filing & Tracking',
  uscis_case_status_screenshots: 'Filing & Tracking',
  i907_filed_copy: 'Filing & Tracking',
  premium_receipt_pp_clock: 'Filing & Tracking',
  premium_email_notifications: 'Filing & Tracking',
  biometrics_appointment_notice: 'Filing & Tracking',
  biometrics_completion_proof: 'Filing & Tracking',
  uscis_call_chat_log: 'Filing & Tracking',
  service_request_confirmation: 'Filing & Tracking',
  g28_filed_copy: 'Filing & Tracking',
  g28_receipt_acceptance: 'Filing & Tracking',
};

const VALID_SET = new Set<string>(DOCUMENT_CATEGORIES);

/**
 * Normalize a category: map legacy values or slotTypes to new category, return valid new category, or default.
 */
export function normalizeCategory(cat: string | null | undefined): DocumentCategory {
  if (!cat || typeof cat !== 'string') return 'Case Intake & Profile';
  const trimmed = cat.trim();
  if (LEGACY_CATEGORY_MAP[trimmed]) return LEGACY_CATEGORY_MAP[trimmed];
  if (SLOT_TYPE_TO_CATEGORY[trimmed]) return SLOT_TYPE_TO_CATEGORY[trimmed];
  if (VALID_SET.has(trimmed)) return trimmed as DocumentCategory;
  return 'Case Intake & Profile';
}
