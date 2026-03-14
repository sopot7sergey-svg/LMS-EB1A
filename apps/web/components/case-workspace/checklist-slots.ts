/**
 * Submission Checklist slot definitions.
 * Each slot maps to a unique slotType for document upload categorization.
 */
import {
  CASE_INTAKE_DOCUMENT_BUILDERS,
  COVER_LETTER_DOCUMENT_BUILDERS,
  EVIDENCE_DOCUMENT_BUILDERS,
  COMPARABLE_EVIDENCE_BUILDERS,
  EXPERT_LETTER_BUILDERS,
  TRANSLATION_BUILDERS,
  DOCUMENT_ASSISTANT_BUILDER_MAP,
} from '@aipas/shared';

export type ChecklistSlotSupport = 'builder' | 'upload_only';

export interface ChecklistSlotConfig {
  label: string;
  slotType: string;
  support: ChecklistSlotSupport;
}

function builderSlot(label: string, slotType: string): ChecklistSlotConfig {
  return { label, slotType, support: 'builder' };
}

function uploadOnlySlot(label: string, slotType: string): ChecklistSlotConfig {
  return { label, slotType, support: 'upload_only' };
}

export const CHECKLIST_SLOT_CONFIGS: Record<string, ChecklistSlotConfig[]> = {
  s1: CASE_INTAKE_DOCUMENT_BUILDERS.map(({ label, slotType }) => builderSlot(label, slotType)),
  s2: [
    builderSlot('Form I-140 (final signed PDF)', 'form_i140_final'),
    builderSlot('Form I-140 (draft / working copy) (optional)', 'form_i140_draft'),
    builderSlot('Form G-1145 (optional, signed)', 'form_g1145'),
    builderSlot('Form I-907 (Premium Processing) (if used, signed)', 'form_i907'),
    uploadOnlySlot('Filing Fee Worksheet / Fee Calculation Sheet (internal)', 'filing_fee_worksheet'),
    uploadOnlySlot('Payment Method Proof — Check copy (front/back) OR Money order copy/receipt OR Form G-1450 (if used)', 'payment_method_proof'),
    uploadOnlySlot('USCIS Filing Address Confirmation (screenshot/PDF)', 'uscis_filing_address_confirmation'),
    uploadOnlySlot('Delivery Label / Courier Preparation Sheet (optional)', 'delivery_label_courier_sheet'),
    uploadOnlySlot('Signed Client Declaration / Attorney Cover Sheet (if used internally) (optional)', 'signed_client_declaration'),
  ],
  s3: [
    uploadOnlySlot('Passport (biographic page scan)', 'passport_biographic_page'),
    uploadOnlySlot('U.S. Visa Stamp(s) (scan/photos) (if any)', 'us_visa_stamps'),
    uploadOnlySlot('Form I-94 (most recent printout)', 'form_i94'),
    uploadOnlySlot('All I-797 Notices (approvals/receipts) (PDFs) (if any)', 'i797_notices'),
    uploadOnlySlot('Current Status Document Set (status-dependent)', 'current_status_document_set'),
    uploadOnlySlot('EAD card (front/back) (if any)', 'ead_card'),
    uploadOnlySlot('Advance Parole document (if any)', 'advance_parole'),
    uploadOnlySlot('Prior USCIS Filings / Receipts (I-129, I-539, I-765 etc.) (if any)', 'prior_uscis_filings'),
    uploadOnlySlot('Entry/Exit / Travel History (optional)', 'entry_exit_travel_history'),
    uploadOnlySlot('Birth Certificate (optional)', 'birth_certificate'),
    uploadOnlySlot('Marriage Certificate / Name Change Documents (optional)', 'marriage_cert_name_change'),
    uploadOnlySlot('Any Court/Police Dispositions (only if applicable) (optional)', 'court_police_dispositions'),
  ],
  s4: [
    ...COVER_LETTER_DOCUMENT_BUILDERS.map(({ label, slotType }) => builderSlot(label, slotType)),
    builderSlot('Cover Letter / Legal Brief (FINAL PDF)', 'cover_letter_legal_brief_final'),
    builderSlot('Cover Letter / Legal Brief (EDITABLE source)', 'cover_letter_legal_brief_editable'),
    builderSlot('Table of Contents (TOC) (FINAL) (if separate)', 'table_of_contents_final'),
    builderSlot('Exhibit List / Exhibit Index (FINAL) (if separate)', 'exhibit_list_index_final'),
    builderSlot('Exhibit Map / Cross-Reference Table (optional)', 'exhibit_map_cross_reference'),
    builderSlot('Drafts Archive (optional)', 'drafts_archive'),
  ],
  s5: [
    ...EVIDENCE_DOCUMENT_BUILDERS.map(({ label, slotType }) => builderSlot(label, slotType)),
    builderSlot('1) Awards — Award certificates / diplomas (PDF)', 'evidence_awards_certificates'),
    builderSlot('1) Awards — Award criteria / selection rules (PDF)', 'evidence_awards_criteria'),
    builderSlot('1) Awards — Award announcement / press (PDF)', 'evidence_awards_announcement'),
    builderSlot('1) Awards — Proof of awarding body reputation (PDF)', 'evidence_awards_reputation'),
    builderSlot('2) Memberships — Membership confirmation/certificate (PDF)', 'evidence_memberships_confirmation'),
    builderSlot('2) Memberships — Membership requirements/criteria (PDF)', 'evidence_memberships_requirements'),
    builderSlot('2) Memberships — Association reputation proof (PDF)', 'evidence_memberships_reputation'),
    builderSlot('3) Published material about you — Articles about beneficiary (PDF)', 'evidence_published_articles'),
    builderSlot('3) Published material about you — Source metadata screenshots/printouts (PDF)', 'evidence_published_metadata'),
    builderSlot('3) Published material about you — Circulation/audience proof (PDF)', 'evidence_published_circulation'),
    builderSlot('4) Judging the work of others — Invitations to judge/review (PDF)', 'evidence_judging_invitations'),
    builderSlot('4) Judging the work of others — Review assignments / platform screenshots (PDF)', 'evidence_judging_assignments'),
    builderSlot('4) Judging the work of others — Confirmation / thank-you letters (PDF)', 'evidence_judging_confirmation'),
    builderSlot('4) Judging the work of others — Event/journal proof of reviewer role (PDF)', 'evidence_judging_proof'),
    builderSlot('5) Original contributions of major significance — Independent third-party proof of impact (PDF)', 'evidence_contributions_impact'),
    builderSlot('5) Original contributions of major significance — Adoption metrics / usage / revenue / deployments (PDF)', 'evidence_contributions_metrics'),
    builderSlot('5) Original contributions of major significance — Patents / IP docs (if any) (PDF)', 'evidence_contributions_patents'),
    builderSlot('5) Original contributions of major significance — Technical docs / product proof (PDF)', 'evidence_contributions_technical'),
    builderSlot('6) Scholarly articles / authorship — Published articles (PDF)', 'evidence_scholarly_articles'),
    builderSlot('6) Scholarly articles / authorship — Acceptance/publication confirmations (PDF)', 'evidence_scholarly_confirmations'),
    builderSlot('6) Scholarly articles / authorship — Citation reports (PDF)', 'evidence_scholarly_citations'),
    builderSlot('6) Scholarly articles / authorship — Venue reputation proof (PDF)', 'evidence_scholarly_venue'),
    builderSlot('7) Leading/critical role — Employment verification letters (PDF)', 'evidence_leading_verification'),
    builderSlot('7) Leading/critical role — Role descriptions + criticality proof (PDF)', 'evidence_leading_role_proof'),
    builderSlot('7) Leading/critical role — Distinguished org reputation proof (PDF)', 'evidence_leading_reputation'),
    builderSlot('7) Leading/critical role — Org charts / leadership proof (PDF)', 'evidence_leading_org_charts'),
    builderSlot('8) High salary / remuneration — Contracts/offer letters showing compensation (PDF)', 'evidence_salary_contracts'),
    builderSlot('8) High salary / remuneration — Pay records / invoices / tax forms excerpts (PDF, redacted)', 'evidence_salary_pay_records'),
    builderSlot('8) High salary / remuneration — Salary benchmarks (PDF)', 'evidence_salary_benchmarks'),
    builderSlot('9) Commercial success (performing arts only) — Sales/streaming/box office reports (PDF)', 'evidence_commercial_reports'),
    builderSlot('9) Commercial success (performing arts only) — Rankings/charts (PDF)', 'evidence_commercial_rankings'),
    builderSlot('9) Commercial success (performing arts only) — Press about commercial success (PDF)', 'evidence_commercial_press'),
  ],
  s6: [
    ...COMPARABLE_EVIDENCE_BUILDERS.map(({ label, slotType }) => builderSlot(label, slotType)),
    builderSlot('Comparable Evidence Explanation (Draft / Final)', 'comparable_explanation'),
    builderSlot('Industry Standards / Benchmark Reports', 'industry_standards_benchmarks'),
    builderSlot('Market Impact Proof', 'market_impact_proof'),
    builderSlot('Revenue / Sales / Commercial Metrics Proof', 'revenue_sales_metrics_proof'),
    builderSlot('User/Customer Adoption Evidence', 'user_customer_adoption'),
    builderSlot('Independent Third-Party Validation', 'independent_third_party_validation'),
    builderSlot('Competition / Selectivity Proof', 'competition_selectivity_proof'),
    builderSlot('Media/Industry Recognition Not Covered Elsewhere', 'media_industry_recognition'),
    builderSlot('Comparable Role/Title Evidence', 'comparable_role_title_evidence'),
    builderSlot('Peer Comparisons / "Top %" Evidence', 'peer_comparisons_top_percent'),
    builderSlot('Contracts / Engagements Showing Elite-Level Demand', 'contracts_elite_demand'),
    builderSlot('Portfolio / Work Product Samples (selected)', 'portfolio_work_product_samples'),
  ],
  s7: [
    ...EXPERT_LETTER_BUILDERS.map(({ label, slotType }) => builderSlot(label, slotType)),
    builderSlot('Expert Letter – Signed (PDF)', 'expert_letter_signed'),
    builderSlot('Expert Letter – Editable Source (DOCX/Google Doc) (optional)', 'expert_letter_editable'),
    builderSlot('Expert CV / Resume (PDF)', 'expert_cv_resume'),
    builderSlot('Expert Bio / Profile Proof (LinkedIn/website screenshot or PDF)', 'expert_bio_profile_proof'),
    builderSlot('Expert Credentials Evidence (licenses, awards, publications, positions — if needed)', 'expert_credentials_evidence'),
    builderSlot('Relationship / Independence Statement (if applicable)', 'relationship_independence_statement'),
    builderSlot('Letter Request Packet (sent to expert)', 'letter_request_packet'),
    builderSlot('Supporting Materials Provided to Expert', 'supporting_materials_to_expert'),
    builderSlot('Communication Record (optional)', 'expert_communication_record'),
    builderSlot('Notarization (if used) (optional)', 'expert_notarization'),
  ],
  s8: [
    ...TRANSLATION_BUILDERS.map(({ label, slotType }) => builderSlot(label, slotType)),
    builderSlot('Certified Translation (PDF)', 'certified_translation'),
    builderSlot('Translator Certificate (PDF)', 'translator_certificate'),
    builderSlot('Source Document (Original Language) (PDF)', 'source_document_original'),
    builderSlot('Translation QA Notes (optional)', 'translation_qa_notes'),
  ],
  s9: [
    uploadOnlySlot('9.1 — RFE Notice (PDF)', 'rfe_notice'),
    uploadOnlySlot('9.1 — NOID Notice (PDF)', 'noid_notice'),
    uploadOnlySlot('9.1 — Courtesy Letter / Deficiency Notice (PDF)', 'courtesy_letter_deficiency'),
    uploadOnlySlot('9.1 — USCIS Online Account Notice (Screenshot/PDF)', 'uscis_online_account_notice'),
    uploadOnlySlot('9.2 — RFE/NOID Response Cover Letter (PDF)', 'rfe_response_cover_letter'),
    uploadOnlySlot('9.2 — RFE Response Table of Contents + Exhibit List (PDF)', 'rfe_response_toc_exhibit_list'),
    uploadOnlySlot('9.2 — Point-by-Point Response Memo (PDF)', 'point_by_point_response_memo'),
    uploadOnlySlot('9.2 — Replacement Pages / Corrected Forms (PDF)', 'replacement_pages_corrected_forms'),
    uploadOnlySlot('9.3 — Additional Evidence Exhibits (PDFs)', 'additional_evidence_exhibits'),
    uploadOnlySlot('9.3 — Updated Expert Letters (PDFs)', 'updated_expert_letters'),
    uploadOnlySlot('9.3 — Updated Translations + Certifications (PDFs)', 'updated_translations_certifications'),
    uploadOnlySlot('9.3 — Errata / Clarification Statement (PDF)', 'errata_clarification_statement'),
    uploadOnlySlot('9.4 — Response Shipping Label (PDF)', 'response_shipping_label'),
    uploadOnlySlot('9.4 — USPS/UPS/FedEx Receipt (PDF)', 'response_carrier_receipt'),
    uploadOnlySlot('9.4 — Tracking + Delivery Confirmation (PDF/Screenshot)', 'response_tracking_delivery'),
    uploadOnlySlot('9.5 — Online Upload Confirmation (PDF/Screenshot)', 'online_upload_confirmation'),
  ],
  s10: [
    uploadOnlySlot('10.1 — Final Filed I-140 Packet (Full PDF)', 'final_filed_i140_packet'),
    uploadOnlySlot('10.1 — Final Table of Contents + Exhibit List (PDF)', 'final_toc_exhibit_list'),
    uploadOnlySlot('10.1 — Final Cover Letter / Legal Brief (PDF)', 'final_cover_letter'),
    uploadOnlySlot('10.1 — Final Forms Set (I-140, G-1145, I-907 if any) (PDF)', 'final_forms_set'),
    uploadOnlySlot('10.2 — Filing Fee Proof (check image / money order / card authorization) (PDF/Image)', 'filing_fee_proof'),
    uploadOnlySlot('10.2 — Fee Receipt / Bank Confirmation (PDF/Screenshot)', 'fee_receipt_bank_confirmation'),
    uploadOnlySlot('10.3 — Shipping Label (PDF)', 'shipping_label'),
    uploadOnlySlot('10.3 — Carrier Receipt (PDF/Image)', 'carrier_receipt'),
    uploadOnlySlot('10.3 — Tracking Page Screenshot (PDF/Image)', 'tracking_page_screenshot'),
    uploadOnlySlot('10.3 — Proof of Delivery (Signature / Delivered status) (PDF/Image)', 'proof_of_delivery'),
    uploadOnlySlot('10.4 — I-797C Receipt Notice (PDF)', 'i797c_receipt_notice'),
    uploadOnlySlot('10.4 — Receipt Number Record (TXT/PDF)', 'receipt_number_record'),
    uploadOnlySlot('10.4 — USCIS Case Status Screenshots (PDF/Image)', 'uscis_case_status_screenshots'),
    uploadOnlySlot('10.5 — I-907 Filed Copy (PDF)', 'i907_filed_copy'),
    uploadOnlySlot('10.5 — Premium Receipt / PP Clock Notice (PDF)', 'premium_receipt_pp_clock'),
    uploadOnlySlot('10.5 — Premium Email Notifications (PDF/Screenshots)', 'premium_email_notifications'),
    uploadOnlySlot('10.6 — Appointment Notice (PDF)', 'biometrics_appointment_notice'),
    uploadOnlySlot('10.6 — Completion Proof (PDF/Screenshot)', 'biometrics_completion_proof'),
    uploadOnlySlot('10.7 — USCIS Call/Chat Log (PDF/TXT)', 'uscis_call_chat_log'),
    uploadOnlySlot('10.7 — Service Request (SR) Confirmation (PDF/Screenshot)', 'service_request_confirmation'),
    uploadOnlySlot('10.8 — G-28 Filed Copy (PDF)', 'g28_filed_copy'),
    uploadOnlySlot('10.8 — G-28 Receipt/Acceptance (PDF)', 'g28_receipt_acceptance'),
  ],
};

export function getChecklistSlotConfig(slotType: string): ChecklistSlotConfig | undefined {
  for (const slots of Object.values(CHECKLIST_SLOT_CONFIGS)) {
    const match = slots.find((slot) => slot.slotType === slotType);
    if (match) return match;
  }
  return undefined;
}

export function getChecklistBuilderConfig(slotType: string) {
  const slot = getChecklistSlotConfig(slotType);
  if (!slot || slot.support !== 'builder') return undefined;
  return DOCUMENT_ASSISTANT_BUILDER_MAP[slotType];
}
