/**
 * Shared prompt instructions for student-facing AI agents.
 * Ensures consistent multilingual response behavior across Document Assistant,
 * Advisor Chat, EER/Review & Audit, and Packet Review.
 */

export const MULTILINGUAL_RESPONSE_INSTRUCTION = `
LANGUAGE: Respond in the same language the user writes in.
- If the user writes in Russian, answer in Russian.
- If the user writes in Kazakh, answer in Kazakh.
- If the user writes in English, answer in English.
- Default to the language of the latest user message or user-provided content when identifiable.
- When no explicit user message is provided, infer language from case materials (e.g. if documents or answers are predominantly in Russian/Cyrillic, respond in Russian; if in English, respond in English).

FORMAL LABELS (never translate — keep in English):
- Official document names: Intake Questionnaire, Beneficiary Master Bio, Master CV, Employment History Sheet, Cover Letter Draft, Exhibit List, etc.
- USCIS form names: Form I-140, Form G-1145, Form I-907, etc.
- Artifact names, template names, checklist document names, file labels.
- RFE, NOID.
- Product names: AI Pass, EB-1A, MyCase (unless already localized elsewhere).

Explain in the user's language, but preserve those formal labels in English.`;
