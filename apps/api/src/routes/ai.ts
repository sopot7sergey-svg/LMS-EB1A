import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AIGateway } from '../services/ai/gateway';

const router = Router();
const prisma = new PrismaClient();
const aiGateway = new AIGateway();

router.post('/intake', authenticate, async (req: AuthRequest, res) => {
  try {
    const { messages, caseId } = req.body;

    const response = await aiGateway.chat({
      messages,
      systemPrompt: `You are an AI assistant helping users define their EB-1A case axis and proposed endeavor.
Your goal is to extract:
1. Their core specialty and field
2. Their signature contributions
3. Their future endeavor in the U.S.

Ask clarifying questions to understand their background, achievements, and goals.
Be conversational but focused on gathering the information needed for an EB-1A petition.
Do NOT provide legal advice or predict outcomes.`,
    });

    res.json({ response });
  } catch (error) {
    console.error('AI intake error:', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

router.post('/criteria-mapper', authenticate, async (req: AuthRequest, res) => {
  try {
    const { caseId, documents, caseAxis } = req.body;

    const response = await aiGateway.chat({
      messages: [
        {
          role: 'user',
          content: `Based on the following case axis and documents, map the evidence to the 10 EB-1A criteria.

Case Axis: ${caseAxis}

Documents summary: ${JSON.stringify(documents)}

For each criterion (C1-C10), indicate:
- "strong": Clear evidence exists
- "possible": Some evidence, needs strengthening
- "gap": No current evidence
- "not_applicable": Criterion doesn't fit this profile

Return a JSON object with the mapping and brief notes for each criterion.`,
        },
      ],
      systemPrompt: `You are an evidence mapping assistant for EB-1A petitions.
Analyze the provided information and map it to the 10 regulatory criteria.
Be objective and realistic in your assessment.
Do NOT provide legal advice or predict outcomes.
Return structured JSON output.`,
    });

    res.json({ response });
  } catch (error) {
    console.error('Criteria mapper error:', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

router.post('/evidence-todo', authenticate, async (req: AuthRequest, res) => {
  try {
    const { criteriaMatrix, selectedCriteria } = req.body;

    const response = await aiGateway.chat({
      messages: [
        {
          role: 'user',
          content: `Based on the criteria matrix and selected criteria, generate an evidence to-do list.

Criteria Matrix: ${JSON.stringify(criteriaMatrix)}
Selected Criteria: ${JSON.stringify(selectedCriteria)}

For each selected criterion, provide:
1. What evidence to obtain
2. Where to get it
3. What to substitute if unavailable
4. Priority level`,
        },
      ],
      systemPrompt: `You are an evidence planning assistant for EB-1A petitions.
Generate actionable to-do items for gathering evidence.
Be specific and practical.
Do NOT provide legal advice.`,
    });

    res.json({ response });
  } catch (error) {
    console.error('Evidence todo error:', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

router.post('/role-builder', authenticate, async (req: AuthRequest, res) => {
  try {
    const { projectDetails, roleInfo } = req.body;

    const response = await aiGateway.chat({
      messages: [
        {
          role: 'user',
          content: `Help me build a Project Impact Brief for the Leading/Critical Role criterion.

Project Details: ${JSON.stringify(projectDetails)}
Role Information: ${JSON.stringify(roleInfo)}

Generate:
1. Project Impact Brief (scope, ownership, impact, metrics)
2. Attachments checklist (org chart, releases, KPIs, letters, awards)
3. Suggested narrative points`,
        },
      ],
      systemPrompt: `You are an evidence builder for the Leading/Critical Role criterion.
Help structure project impact documentation.
Focus on demonstrating critical role and measurable impact.
Do NOT provide legal advice.`,
    });

    res.json({ response });
  } catch (error) {
    console.error('Role builder error:', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

router.post('/compensation-builder', authenticate, async (req: AuthRequest, res) => {
  try {
    const { compensationData, marketData } = req.body;

    const response = await aiGateway.chat({
      messages: [
        {
          role: 'user',
          content: `Help me build a Compensation Evidence Pack.

Compensation Data: ${JSON.stringify(compensationData)}
Market Data (if available): ${JSON.stringify(marketData)}

Generate:
1. Evidence structure (pay stubs, offer letters, W-2, equity docs)
2. Market comparison memo outline
3. Suggested presentation approach`,
        },
      ],
      systemPrompt: `You are an evidence builder for the High Salary criterion.
Help structure compensation documentation and market comparisons.
Be factual and avoid overstatements.
Do NOT provide legal advice.`,
    });

    res.json({ response });
  } catch (error) {
    console.error('Compensation builder error:', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

router.post('/contribution-generator', authenticate, async (req: AuthRequest, res) => {
  try {
    const { contributions } = req.body;

    const response = await aiGateway.chat({
      messages: [
        {
          role: 'user',
          content: `Help me structure contribution claims for the Original Contributions criterion.

Contributions: ${JSON.stringify(contributions)}

For each contribution, generate:
1. Claim statement (innovation → adoption/impact → proof)
2. Required evidence list
3. Metrics to highlight
4. Potential confirming parties`,
        },
      ],
      systemPrompt: `You are an evidence builder for the Original Contributions criterion.
Help structure contribution narratives with claim-based approach.
Focus on demonstrating major significance beyond the immediate team.
Do NOT provide legal advice.`,
    });

    res.json({ response });
  } catch (error) {
    console.error('Contribution generator error:', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

router.post('/judging-builder', authenticate, async (req: AuthRequest, res) => {
  try {
    const { judgingActivities } = req.body;

    const response = await aiGateway.chat({
      messages: [
        {
          role: 'user',
          content: `Help me build a Judging Portfolio.

Judging Activities: ${JSON.stringify(judgingActivities)}

Generate:
1. Judging log structure
2. Email templates for organizer confirmations
3. Exhibit pack organization
4. Suggestions for additional judging opportunities`,
        },
      ],
      systemPrompt: `You are an evidence builder for the Judging criterion.
Help document judging activities with proper evidence.
Focus on demonstrating expertise recognition through judging invitations.
Do NOT provide legal advice.`,
    });

    res.json({ response });
  } catch (error) {
    console.error('Judging builder error:', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

router.post('/media-kit-builder', authenticate, async (req: AuthRequest, res) => {
  try {
    const { mediaAppearances, profile } = req.body;

    const response = await aiGateway.chat({
      messages: [
        {
          role: 'user',
          content: `Help me build a Media Kit for the Published Material About You criterion.

Media Appearances: ${JSON.stringify(mediaAppearances)}
Profile: ${JSON.stringify(profile)}

Generate:
1. Press bio
2. Pitch angles for new coverage
3. Target publication list
4. Exhibit formatting guidance`,
        },
      ],
      systemPrompt: `You are an evidence builder for the Published Material criterion.
Help create media documentation and outreach materials.
Focus on professional/major media coverage about the person.
Do NOT provide legal advice.`,
    });

    res.json({ response });
  } catch (error) {
    console.error('Media kit builder error:', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

router.post('/membership-analyzer', authenticate, async (req: AuthRequest, res) => {
  try {
    const { membershipDetails } = req.body;

    const response = await aiGateway.chat({
      messages: [
        {
          role: 'user',
          content: `Analyze membership selectivity for the Membership criterion.

Membership Details: ${JSON.stringify(membershipDetails)}

Provide:
1. Selectivity assessment (can use / questionable / not suitable)
2. Evidence needed to prove selectivity
3. Alternative criteria recommendations if not suitable`,
        },
      ],
      systemPrompt: `You are an evidence analyzer for the Membership criterion.
Evaluate whether memberships meet the selectivity requirement.
Be objective about whether memberships are truly selective.
Do NOT provide legal advice or predict outcomes.`,
    });

    res.json({ response });
  } catch (error) {
    console.error('Membership analyzer error:', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

router.post('/letter-planner', authenticate, async (req: AuthRequest, res) => {
  try {
    const { caseAxis, criteria, potentialSigners } = req.body;

    const response = await aiGateway.chat({
      messages: [
        {
          role: 'user',
          content: `Help me plan recommendation letters.

Case Axis: ${caseAxis}
Criteria: ${JSON.stringify(criteria)}
Potential Signers: ${JSON.stringify(potentialSigners)}

Generate:
1. Letter assignment plan (who confirms what)
2. Coverage matrix (criteria × signers)
3. Independent vs. dependent letter balance
4. Missing coverage areas`,
        },
      ],
      systemPrompt: `You are a letter planning assistant for EB-1A petitions.
Help distribute letter responsibilities across signers.
Ensure criteria coverage and independent verification.
Do NOT provide legal advice.`,
    });

    res.json({ response });
  } catch (error) {
    console.error('Letter planner error:', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

router.post('/letter-draft', authenticate, async (req: AuthRequest, res) => {
  try {
    const { signerInfo, claims, criteria } = req.body;

    const response = await aiGateway.chat({
      messages: [
        {
          role: 'user',
          content: `Help me draft a recommendation letter.

Signer Info: ${JSON.stringify(signerInfo)}
Claims to Address: ${JSON.stringify(claims)}
Criteria: ${JSON.stringify(criteria)}

Generate:
1. Letter draft with claim → evidence → impact structure
2. Signer-friendly version (what to send to the signer)
3. Suggested attachments`,
        },
      ],
      systemPrompt: `You are a letter drafting assistant for EB-1A petitions.
Create letters with specific claims and supporting evidence.
Avoid generic praise; focus on concrete achievements.
Do NOT provide legal advice.`,
    });

    res.json({ response });
  } catch (error) {
    console.error('Letter draft error:', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

router.post('/repetition-checker', authenticate, async (req: AuthRequest, res) => {
  try {
    const { letters } = req.body;

    const response = await aiGateway.chat({
      messages: [
        {
          role: 'user',
          content: `Check these letters for repetition and risky wording.

Letters: ${JSON.stringify(letters)}

Identify:
1. Repeated phrases across letters
2. Generic or weak content
3. Risky wording to revise
4. Suggestions for differentiation`,
        },
      ],
      systemPrompt: `You are a letter review assistant for EB-1A petitions.
Identify repetitive or problematic content across letters.
Suggest improvements for uniqueness and strength.
Do NOT provide legal advice.`,
    });

    res.json({ response });
  } catch (error) {
    console.error('Repetition checker error:', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

router.post('/petition-assembler', authenticate, async (req: AuthRequest, res) => {
  try {
    const { caseData, exhibits, letters } = req.body;

    const response = await aiGateway.chat({
      messages: [
        {
          role: 'user',
          content: `Help me assemble the petition package.

Case Data: ${JSON.stringify(caseData)}
Exhibits: ${JSON.stringify(exhibits)}
Letters: ${JSON.stringify(letters)}

Generate:
1. Table of contents structure
2. Exhibit list with labels
3. Brief section outlines
4. Cross-reference suggestions`,
        },
      ],
      systemPrompt: `You are a petition assembly assistant for EB-1A petitions.
Help organize and structure the petition package.
Ensure proper labeling and cross-referencing.
Do NOT provide legal advice.`,
    });

    res.json({ response });
  } catch (error) {
    console.error('Petition assembler error:', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

router.post('/consistency-checker', authenticate, async (req: AuthRequest, res) => {
  try {
    const { documents } = req.body;

    const response = await aiGateway.chat({
      messages: [
        {
          role: 'user',
          content: `Check these documents for consistency issues.

Documents: ${JSON.stringify(documents)}

Identify:
1. Date inconsistencies
2. Title/position mismatches
3. Organization name variations
4. Metric discrepancies
5. Missing citations`,
        },
      ],
      systemPrompt: `You are a consistency checker for EB-1A petitions.
Identify inconsistencies across petition documents.
Flag issues that could raise questions during adjudication.
Do NOT provide legal advice.`,
    });

    res.json({ response });
  } catch (error) {
    console.error('Consistency checker error:', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

router.post('/translation-helper', authenticate, async (req: AuthRequest, res) => {
  try {
    const { documents } = req.body;

    const response = await aiGateway.chat({
      messages: [
        {
          role: 'user',
          content: `Identify translation requirements for these documents.

Documents: ${JSON.stringify(documents)}

Generate:
1. List of documents requiring translation
2. Certification requirements
3. Formatting guidelines`,
        },
      ],
      systemPrompt: `You are a translation planning assistant for EB-1A petitions.
Identify documents needing translation and certification.
Provide formatting guidance for translated documents.
Do NOT provide legal advice.`,
    });

    res.json({ response });
  } catch (error) {
    console.error('Translation helper error:', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

router.post('/filing-checklist', authenticate, async (req: AuthRequest, res) => {
  try {
    const { petitionPackage } = req.body;

    const response = await aiGateway.chat({
      messages: [
        {
          role: 'user',
          content: `Generate a filing readiness checklist.

Petition Package Summary: ${JSON.stringify(petitionPackage)}

Generate:
1. Document completeness checklist
2. Form requirements
3. Fee information (informational only)
4. Packaging instructions`,
        },
      ],
      systemPrompt: `You are a filing preparation assistant for EB-1A petitions.
Generate checklists for filing readiness.
Provide informational guidance only.
Do NOT provide legal advice or guarantee outcomes.`,
    });

    res.json({ response });
  } catch (error) {
    console.error('Filing checklist error:', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

export default router;
