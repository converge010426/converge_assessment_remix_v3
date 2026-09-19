import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { AssessmentResults, typeDescriptions } from '../logic.js';
import { CONVERGE_BADGE_PNG_BASE64, CONVERGE_BADGE_ASPECT_RATIO } from '../assets/logo.js';

interface JobData {
  jobTitle?: string | null;
  jobEnvironment?: string | null;
  jobChallenge?: string | null;
  jobDescription?: string | null;
}

const BADGE = Buffer.from(CONVERGE_BADGE_PNG_BASE64, 'base64');
const COLORS = { navy: '#1a2b4b', gold: '#c5a059', dark: '#111111', grey: '#444444', light: '#f9f7f2', white: '#ffffff' };
const PAGE = { left: 50, right: 545, width: 495, footerTop: 748 };
// Approved CONVERGE contact details, sourced from the existing corporate identity
// constants already used elsewhere in the app (see v2MarketFixes.ts CONTACT_EMAIL /
// WHATSAPP_INTL). Do not change these values here — they must stay in sync with
// that single source of truth.
const CONTACT_EMAIL = 'tomknsn@gmail.com';
const CONTACT_WHATSAPP_DISPLAY = '+27 74 936 1406';

type Competency = { key: string; title: string; score: number; explanation: string };

function clamp(value: number): number { return Math.max(0, Math.min(100, Math.round(value))); }
function avg(...values: number[]): number { return values.reduce((sum, value) => sum + value, 0) / values.length; }
function safe(value: unknown, fallback = 'Not specified'): string { const text = String(value ?? '').trim(); return text || fallback; }
function band(score: number): string { if (score >= 75) return 'STRONG SIGNAL'; if (score >= 55) return 'MODERATE SIGNAL'; return 'AREA TO EXPLORE'; }
// Single source of truth for which competencies count as a current strength vs
// an area to validate. Previously, the "strongest current indicators" text and
// the "contribute strongly" / "structural support" bullet lists each ran their
// own independent top-N / bottom-N ranking over the same competency scores,
// without reference to the STRONG/MODERATE/AREA-TO-EXPLORE band() thresholds
// shown per-competency on the Competency Translation page. That let a
// MODERATE-banded competency (e.g. Team Collaboration at 73/100) be ranked into
// the "strongest"/"contribute strongly" list purely by relative order, directly
// contradicting its own MODERATE SIGNAL label shown two pages earlier. Deriving
// both lists from the same band() classification makes the report internally
// consistent by construction.
function classifyComps(comps: Competency[]): { strong: Competency[]; validate: Competency[] } {
  // Strictly band-pure: "strong" can only ever contain STRONG SIGNAL
  // competencies, and can legitimately be empty if none reach that threshold.
  // There must be no fallback that backfills a MODERATE (or lower) competency
  // into "strong" — that was the exact contradiction this function exists to
  // eliminate (a competency being called "strongest" in prose while its own
  // Competency Translation entry says MODERATE SIGNAL). Callers are
  // responsible for handling an empty strong[] with honest wording rather
  // than assuming it always has at least one entry.
  const strong = comps.filter(c => band(c.score) === 'STRONG SIGNAL').sort((a, b) => b.score - a.score);
  const validate = comps.filter(c => band(c.score) !== 'STRONG SIGNAL').sort((a, b) => a.score - b.score);
  return { strong, validate };
}
// Recruiter-entered free text (role titles, descriptions, challenge notes) is raw
// user input and was previously interpolated verbatim into generated sentences,
// producing awkward, uncapitalized, ungrammatical client-facing copy. These two
// helpers do light, mechanical cleanup only — they do not rewrite or interpret
// the recruiter's actual words.
function titleCase(value: string): string {
  const minor = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor', 'of', 'on', 'or', 'per', 'the', 'to', 'up', 'vs']);
  return value
    .trim()
    .split(/\s+/)
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (i > 0 && minor.has(lower)) return lower;
      return word.length ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word;
    })
    .join(' ');
}
function sentenceCase(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  const withCapital = trimmed[0].toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(withCapital) ? withCapital : `${withCapital}.`;
}
function roleText(job: JobData): string { return titleCase(safe(job.jobTitle, 'the target role')); }
function roleFamily(job: JobData): string {
  const text = `${job.jobTitle ?? ''} ${job.jobDescription ?? ''}`.toLowerCase();
  if (/sales|business development|account|commercial|client|relationship|recruit/.test(text)) return 'commercial';
  if (/manager|director|head|lead|executive|supervisor/.test(text)) return 'leadership';
  if (/analyst|analysis|finance|financial|data|research|engineering|technical|operations/.test(text)) return 'analytical';
  if (/consult|advis|strategy|strategic|planning/.test(text)) return 'advisory';
  return 'general';
}

function competencyScores(results: AssessmentResults): Record<string, number> {
  const b = results.bigFive, e = results.ei;
  return {
    strategic: clamp(avg(b.openness, b.conscientiousness, results.mbti.includes('N') ? 90 : 55)),
    execution: clamp(avg(b.conscientiousness, e.selfRegulation)),
    analysis: clamp(avg(b.openness, b.conscientiousness, e.selfAwareness)),
    relationship: clamp(avg(b.agreeableness, e.empathy, e.socialSkills)),
    communication: clamp(avg(b.extraversion, e.empathy, e.socialSkills)),
    negotiation: clamp(avg(e.selfRegulation, e.socialSkills, b.conscientiousness)),
    resilience: clamp(avg(e.selfRegulation, b.emotionalStability)),
    independent: clamp(avg(b.conscientiousness, 100 - b.extraversion)),
    teamwork: clamp(avg(b.agreeableness, e.empathy, e.socialSkills)),
    adaptability: clamp(avg(b.openness, e.selfRegulation)),
    process: clamp(b.conscientiousness),
    networking: clamp(avg(b.extraversion, e.socialSkills)),
  };
}

function buildCompetencies(results: AssessmentResults): Competency[] {
  const s = competencyScores(results);
  return [
    { key: 'strategic', title: 'Strategic Thinking & Vision', score: s.strategic, explanation: 'Pattern recognition, longer-horizon thinking and the ability to connect the immediate task to a wider objective.' },
    { key: 'execution', title: 'Execution & Follow-through', score: s.execution, explanation: 'Structure, discipline and the ability to convert intention into controlled, consistent action.' },
    { key: 'analysis', title: 'Analysis & Judgement', score: s.analysis, explanation: 'Capacity to examine complexity, question assumptions and form a reasoned view before acting.' },
    { key: 'relationship', title: 'Deep Relationship Building', score: s.relationship, explanation: 'Capacity for attentive, substantive one-to-one interaction and trust-building.' },
    { key: 'communication', title: 'Communication & Stakeholder Engagement', score: s.communication, explanation: 'Ability to adapt communication, read the interpersonal setting and maintain productive engagement.' },
    { key: 'negotiation', title: 'Negotiation & Influence', score: s.negotiation, explanation: 'Capacity to manage pressure, trade-offs and interpersonal movement toward agreement.' },
    { key: 'resilience', title: 'Resilience Under Pressure', score: s.resilience, explanation: 'Ability to maintain regulation and effectiveness when pressure, ambiguity or setbacks increase.' },
    { key: 'independent', title: 'Independent / Self-Directed Work', score: s.independent, explanation: 'Fit for autonomy, ownership and sustained work without continuous supervision.' },
    { key: 'teamwork', title: 'Team Collaboration', score: s.teamwork, explanation: 'Capacity for cooperation, empathy and productive participation in a shared objective.' },
    { key: 'adaptability', title: 'Adaptability', score: s.adaptability, explanation: 'Capacity to adjust approach when circumstances, information or priorities change.' },
    { key: 'process', title: 'Process & Documentation Discipline', score: s.process, explanation: 'Consistency in organisation, documentation, follow-through and repeatable working practices.' },
    { key: 'networking', title: 'Networking & Broad Social Engagement', score: s.networking, explanation: 'Fit for frequent outward-facing contact, broad networking and continual social engagement.' },
  ];
}

function drawHeader(doc: PDFKit.PDFDocument): void {
  const x = 50, y = 34, h = 52, w = h * CONVERGE_BADGE_ASPECT_RATIO, textX = x + w + 14;
  doc.image(BADGE, x, y, { width: w, height: h });
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(29).text('CONVERGE', textX, y + 3, { characterSpacing: 1 });
  const wordmarkWidth = doc.widthOfString('CONVERGE', { characterSpacing: 1 });
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(12).text('TM', textX + wordmarkWidth + 2, y);
  doc.fillColor(COLORS.grey).font('Helvetica-Oblique').fontSize(10.5).text('Three frameworks. One you.', textX, y + 34, { characterSpacing: 0.5 });
  doc.fillColor(COLORS.grey).font('Helvetica').fontSize(7.5).text(`${CONTACT_EMAIL}   •   WhatsApp ${CONTACT_WHATSAPP_DISPLAY}`, textX, y + 47, { characterSpacing: 0.3 });
  doc.moveTo(x, y + h + 10).lineTo(545, y + h + 10).strokeColor(COLORS.gold).lineWidth(0.75).stroke();
}

function drawFooter(doc: PDFKit.PDFDocument, page: number): void {
  doc.fillColor(COLORS.grey).font('Helvetica-Bold').fontSize(9.5).text(`© ${new Date().getFullYear()} CONVERGE™ • ALL RIGHTS RESERVED • PAGE ${page}`, 50, 762, { width: 495, align: 'center' });
  doc.fillColor(COLORS.grey).font('Helvetica-Oblique').fontSize(8.5).text('This assessment protocol and its integrated psychological architecture are protected intellectual property.', 50, 778, { width: 495, align: 'center' });
}

function sectionTitle(doc: PDFKit.PDFDocument, text: string): void {
  const upper = text.toUpperCase();
  const opts = { characterSpacing: 1 };
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(17);
  const textHeight = doc.heightOfString(upper, { ...opts, width: PAGE.width });
  doc.text(upper, PAGE.left, 118, { ...opts, width: PAGE.width });
  const ruleY = 118 + textHeight + 9;
  doc.moveTo(PAGE.left, ruleY).lineTo(PAGE.right, ruleY).strokeColor(COLORS.gold).lineWidth(0.8).stroke();
  doc.y = ruleY + 19;
}

// Checks whether `neededHeight` of content will fit before the footer; if not,
// starts a new page (redrawing the letterhead) first. Used by every text
// primitive below so that arbitrarily long content — including recruiter
// free-text fed through paragraph()/bullet() — paginates safely instead of
// silently overflowing into the footer or off the page.
function ensureSpace(doc: PDFKit.PDFDocument, neededHeight: number): void {
  if (doc.y + neededHeight > PAGE.footerTop - 14) {
    doc.addPage();
    drawHeader(doc);
    doc.y = 112;
  }
}

function paragraph(doc: PDFKit.PDFDocument, text: string, size = 11.2, gap = 5): void {
  const opts = { width: PAGE.width, align: 'justify' as const, lineGap: gap };
  doc.font('Helvetica').fontSize(size);
  ensureSpace(doc, doc.heightOfString(text, opts) + 8);
  doc.fillColor(COLORS.dark).text(text, PAGE.left, doc.y, opts);
  doc.moveDown(0.65);
}

function subhead(doc: PDFKit.PDFDocument, title: string): void {
  ensureSpace(doc, 30);
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(12.5).text(title.toUpperCase(), PAGE.left, doc.y, { characterSpacing: 0.8 });
  doc.moveDown(0.45);
}

function bullet(doc: PDFKit.PDFDocument, text: string, size = 10.5): void {
  const opts = { width: 470, lineGap: 3 };
  doc.font('Helvetica').fontSize(size);
  ensureSpace(doc, doc.heightOfString(text, opts) + 8);
  const startY = doc.y;
  doc.fillColor(COLORS.gold).circle(55, startY + 6, 2.3).fill();
  doc.fillColor(COLORS.dark).text(text, 66, startY, opts);
  doc.y = startY + doc.heightOfString(text, opts) + 4;
}

function card(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, heading: string, body: string): number {
  // Recruiter free text (environment/challenge) can be long enough to overflow
  // a fixed card height; grow the card to fit its actual content instead of
  // letting the text spill into whatever is drawn next. Callers that draw two
  // cards side by side should use the larger of the two returned heights for
  // both, so the row still lines up visually.
  const bodyHeight = doc.heightOfString(body, { width: w - 26, lineGap: 3 });
  const actualHeight = Math.max(h, 31 + bodyHeight + 13);
  doc.rect(x, y, w, actualHeight).fill(COLORS.light);
  doc.fillColor(COLORS.gold).font('Helvetica-Bold').fontSize(8.2).text(heading, x + 13, y + 13, { characterSpacing: 1 });
  doc.fillColor(COLORS.dark).font('Helvetica-Bold').fontSize(11).text(body, x + 13, y + 31, { width: w - 26, lineGap: 3 });
  return actualHeight;
}

function competencyBar(doc: PDFKit.PDFDocument, item: Competency): void {
  const titleOpts = { width: 185 };
  doc.font('Helvetica-Bold').fontSize(9.3);
  const titleHeight = doc.heightOfString(item.title, titleOpts);
  const explanationHeight = doc.heightOfString(item.explanation, { width: 495 });
  ensureSpace(doc, Math.max(15, titleHeight + 4) + explanationHeight + 13);
  const y = doc.y;
  doc.fillColor(COLORS.dark).font('Helvetica-Bold').fontSize(9.3).text(item.title, 50, y, titleOpts);
  doc.rect(245, y + 2, 175, 8).fill(COLORS.light);
  doc.rect(245, y + 2, 175 * item.score / 100, 8).fill(COLORS.gold);
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(8.5).text(band(item.score), 428, y, { width: 117, align: 'right' });
  const explanationY = y + Math.max(15, titleHeight + 4);
  doc.fillColor(COLORS.grey).font('Helvetica').fontSize(7.8).text(item.explanation, 50, explanationY, { width: 495 });
  doc.y = explanationY + explanationHeight + 13;
}

function roleFitParagraph(job: JobData, comps: Competency[]): string {
  const role = roleText(job);
  const family = roleFamily(job);
  const { strong: strongComps, validate: validateComps } = classifyComps(comps);
  const strong = strongComps.slice(0, 3).map(c => c.title.toLowerCase());
  const support = validateComps.slice(0, 2).map(c => c.title.toLowerCase());
  const familySentence: Record<string, string> = {
    commercial: `For a commercially oriented role such as ${role}, the profile is most relevant where the work rewards deliberate strategy, client understanding, disciplined follow-through and the ability to build credibility over time.`,
    leadership: `For a leadership role such as ${role}, the central question is how the candidate balances independent judgement and execution with the interpersonal demands of leading through other people.`,
    analytical: `For an analytical role such as ${role}, the profile is most relevant where the work rewards structured reasoning, careful execution, sustained concentration and the ability to turn information into sound decisions.`,
    advisory: `For an advisory role such as ${role}, the profile is most relevant where the work rewards synthesis, independent judgement, clear communication and the ability to translate complexity into practical direction.`,
    general: `For ${role}, the strongest evidence comes from comparing the role's actual demands with the candidate's pattern rather than treating the assessment as a universal measure of suitability.`
  };
  // strong[] can legitimately be empty (no competency reaches the STRONG
  // SIGNAL threshold for this role). In that case the sentence must not claim
  // a "strongest indicators" list — that would contradict the MODERATE/AREA
  // TO EXPLORE labels shown for every competency on the Competency
  // Translation page. support[] (validate) is drawn from every competency
  // that isn't STRONG SIGNAL, so it is only empty in the reverse edge case
  // (every competency is STRONG), which is handled the same way.
  const strongSentence = strong.length
    ? `The strongest current indicators are ${strong.join(', ')}.`
    : `No competency in this profile currently reaches a strong-signal threshold for this role; all current indicators sit at a moderate level or below.`;
  const supportSentence = support.length
    ? `The areas that deserve the most deliberate validation are ${support.join(' and ')}.`
    : `Every competency in this profile currently reaches a strong signal, so interview time is best spent confirming those signals translate into real behaviour rather than probing for weaknesses.`;
  return `${familySentence[family]} ${strongSentence} ${supportSentence} These are not predictions of performance; they identify where the structured interview should confirm, qualify or challenge the assessment pattern.`;
}

function interviewQuestions(job: JobData, comps: Competency[]): string[] {
  const role = roleText(job);
  // The recruiter-entered challenge field may be a full sentence, a short phrase,
  // or a comma-separated list of terms (e.g. "creative, innovative, goal driven").
  // A colon-led construction reads naturally for all three forms without having
  // to guess sentence structure or force a particular case onto list-style input.
  const rawChallenge = safe(job.jobChallenge, 'the principal challenge of the role').replace(/[.!?]+$/, '').trim();
  const family = roleFamily(job);
  const weakest = classifyComps(comps).validate.slice(0, 2);
  // weakest can have 0, 1, or 2 entries (e.g. if 7 of 8 competencies are
  // STRONG SIGNAL, only 1 remains here) — build the closing question to fit
  // however many there actually are, rather than assuming exactly 2.
  const weakestTitles = weakest.map(c => c.title.toLowerCase());
  const weakestQuestion = weakestTitles.length === 2
    ? `The assessment flags ${weakestTitles[0]} and ${weakestTitles[1]} as areas worth exploring. What would a previous manager or colleague say about these two areas in practice?`
    : weakestTitles.length === 1
      ? `The assessment flags ${weakestTitles[0]} as an area worth exploring. What would a previous manager or colleague say about this in practice?`
      : `Every competency in this profile currently reaches a strong signal. What would a previous manager or colleague say when asked to name this candidate's least developed area?`;
  const questions = [
    'Describe a time in a previous role when you identified an important issue or opportunity before it was obvious to others. What did you do with that insight, and what happened?',
    `Within ${role}, the recruiter has flagged this as a key challenge area: ${rawChallenge}. Talk through how you would approach that from first principles rather than giving the ideal answer.`,
    'Tell us about a project where you had substantial autonomy. How did you create your own accountability, monitor progress and know when the work was good enough to release?',
    "Give an example of a situation where another person's priorities or communication style differed sharply from your own. How did you adapt?",
  ];
  if (family === 'commercial') {
    questions.push('Describe the most complex client, account or commercial opportunity you have developed over time. How did you structure the relationship and protect momentum?');
    questions.push('When a prospect, client or stakeholder pushes back on your preferred solution, how do you distinguish between a useful challenge and an unnecessary compromise?');
  } else if (family === 'leadership') {
    questions.push('Tell us about a time when a strong performer or colleague did not meet your standards. How did you address it without damaging the working relationship?');
    questions.push('How do you decide when to take control personally and when to give another person autonomy?');
  } else if (family === 'analytical') {
    questions.push('Describe a decision where the available information was incomplete or contradictory. How did you decide what was sufficient evidence to act?');
    questions.push('Tell us about a time when your analysis was challenged. What changed in your thinking, if anything?');
  } else {
    questions.push('What type of working environment brings out your best work, and what type makes it harder for you to perform consistently?');
    questions.push('Tell us about a time when changing circumstances forced you to abandon a preferred plan. How did you respond?');
  }
  questions.push(weakestQuestion);
  questions.push('What conditions, management behaviours or resources help you sustain high-quality performance when workload or pressure remains elevated for an extended period?');
  return questions;
}

function managementRecommendations(results: AssessmentResults, job: JobData): string[] {
  const s = competencyScores(results);
  const role = roleText(job);
  return [
    `Define the expected outcomes for ${role} clearly at the outset, then give the candidate enough autonomy to determine how to achieve them.`,
    'Set measurable priorities and review points rather than relying only on informal impressions of progress.',
    s.independent >= 70 ? 'Protect periods of uninterrupted work where the role permits it; sustained concentration may be an important performance condition.' : 'Use regular short check-ins to maintain alignment without creating unnecessary supervision.',
    s.communication < 60 ? 'Pay attention to communication style in the first months. Direct or concise communication should be tested for impact, not assumed to be a problem.' : 'Use early stakeholder feedback to confirm that communication style is landing as intended across different audiences.',
    s.resilience < 60 ? 'Monitor workload and recovery, especially during prolonged periods of pressure. The objective is early support, not a judgement about capability.' : 'Continue to monitor workload during sustained pressure rather than assuming a strong regulation signal removes the need for support.',
    s.teamwork < 60 ? 'Make team interfaces and decision rights explicit so collaboration does not depend on unspoken expectations.' : 'Use the candidate's collaborative capacity deliberately by giving clear shared outcomes and ownership boundaries.',
  ];
}

export async function generateCandidateSuitabilityV2(name: string, results: AssessmentResults, jobData: JobData = {}): Promise<string> {
  const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
  const reportsDir = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const filePath = path.join(reportsDir, `Candidate_Suitability_V2_${safeName}_${Date.now()}.pdf`);
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  const role = roleText(jobData);
  const environment = safe(jobData.jobEnvironment, 'the stated work environment');
  const challenge = safe(jobData.jobChallenge, 'the principal challenge supplied for the role');
  const description = safe(jobData.jobDescription, 'No additional role description was supplied.');
  const typeInfo = typeDescriptions[results.mbti];
  const allComps = buildCompetencies(results);
  const family = roleFamily(jobData);
  const preferredKeys: Record<string, string[]> = {
    commercial: ['strategic', 'execution', 'relationship', 'communication', 'negotiation', 'resilience', 'teamwork', 'adaptability'],
    leadership: ['strategic', 'execution', 'communication', 'resilience', 'teamwork', 'relationship', 'adaptability', 'analysis'],
    analytical: ['analysis', 'strategic', 'execution', 'process', 'independent', 'adaptability', 'resilience', 'communication'],
      advisory: ['strategic', 'analysis', 'communication', 'relationship', 'adaptability', 'execution', 'resilience', 'teamwork'],
      general: ['strategic', 'execution', 'analysis', 'communication', 'teamwork', 'adaptability', 'resilience', 'independent'],
  };
  const keyOrder = preferredKeys[family];
  const comps = keyOrder.map(key => allComps.find(c => c.key === key)!).filter(Boolean);
  const alignmentScore = clamp(avg(...comps.map(c => c.score)));
  const alignmentBand = band(alignmentScore);
  const interviewQs = interviewQuestions(jobData, comps);
  const recommendations = managementRecommendations(results, jobData);
  // Single source of truth for "strong" vs "areas to validate" competencies,
  // used consistently everywhere in this report that refers to current
  // strengths or development areas (Role Fit Analysis bullets and the closing
  // Final CONVERGE View paragraph), so a competency's classification can never
  // read differently on different pages.
  const { strong: strongComps, validate: validateComps } = classifyComps(comps);

  drawHeader(doc);
  doc.fillColor(COLORS.dark).font('Helvetica-Bold').fontSize(21).text('CANDIDATE SUITABILITY ASSESSMENT', 50, 125, { characterSpacing: 1.2 });
  doc.moveTo(50, 157).lineTo(545, 157).strokeColor(COLORS.gold).lineWidth(1).stroke();
  doc.fillColor(COLORS.grey).font('Helvetica-Oblique').fontSize(11.2).text('An integrated decision-support report translating MBTI, EQ and Big Five indicators into role-relevant insight.', 50, 177, { width: 495 });
  doc.fillColor(COLORS.grey).font('Helvetica-Bold').fontSize(9).text('CANDIDATE', 50, 225, { characterSpacing: 1.5 });
  doc.font('Helvetica-Bold').fontSize(27);
  const nameUpper = name.toUpperCase();
  const nameHeight = doc.heightOfString(nameUpper, { width: 495 });
  doc.fillColor(COLORS.navy).text(nameUpper, 50, 242, { width: 495 });
  const targetRoleLabelY = 242 + nameHeight + 14;
  doc.fillColor(COLORS.grey).font('Helvetica-Bold').fontSize(9).text('TARGET ROLE', 50, targetRoleLabelY, { characterSpacing: 1.5 });
  doc.font('Helvetica-Bold').fontSize(16);
  const roleUpper = role.toUpperCase();
  const roleY = targetRoleLabelY + 17;
  const roleHeight = doc.heightOfString(roleUpper, { width: 495 });
  doc.fillColor(COLORS.navy).text(roleUpper, 50, roleY, { width: 495 });
  const dateLabelY = roleY + roleHeight + 14;
  doc.fillColor(COLORS.grey).font('Helvetica-Bold').fontSize(9).text('ASSESSMENT DATE', 50, dateLabelY, { characterSpacing: 1.5 });
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(13).text(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), 50, dateLabelY + 17);
  // The three summary cards, the disclaimer and "purpose of this report" text
  // below all used fixed absolute Y positions on the assumption that the name
  // and role always fit on one line each. Long recruiter-entered role titles
  // (or long candidate names) can push this whole block down; recompute the
  // remaining fixed offsets relative to the actual dateLabelY instead.
  const cardsY = dateLabelY + 58;
  card(doc, 50, cardsY, 155, 100, 'ROLE ALIGNMENT SIGNAL', alignmentBand);
  card(doc, 220, cardsY, 155, 100, 'PRIMARY PROFILE', `${results.mbti} • ${typeInfo.title}`);
  card(doc, 390, cardsY, 155, 100, 'INTERVIEW PRIORITY', alignmentScore >= 70 ? 'DEEP VALIDATION' : alignmentScore >= 55 ? 'STANDARD REVIEW' : 'TARGETED REVIEW');
  const disclaimerY = cardsY + 140;
  // Guard against an unusually long name + role title pushing this content
  // (and everything after it) too close to, or past, the footer. The
  // disclaimer + "purpose" heading + up to ~4 lines of paragraph text need
  // roughly 180pt of clearance above the footer.
  if (disclaimerY > 560) {
    doc.addPage(); drawHeader(doc);
    doc.fillColor(COLORS.grey).font('Helvetica-Oblique').fontSize(9.2).text('These indicators are decision-support signals. They are not predictions of job performance and do not replace structured interviewing, references, work samples or professional judgement.', 50, 112, { width: 495, align: 'justify' });
    doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(12).text('The purpose of this report', 50, 182);
    doc.fillColor(COLORS.dark).font('Helvetica').fontSize(10.5).text(`To help a recruiter or hiring manager turn the assessment into better questions, clearer role-fit discussion and more informed onboarding decisions for ${name} in relation to ${role}.`, 50, 207, { width: 495, lineGap: 4 });
  } else {
    doc.fillColor(COLORS.grey).font('Helvetica-Oblique').fontSize(9.2).text('These indicators are decision-support signals. They are not predictions of job performance and do not replace structured interviewing, references, work samples or professional judgement.', 50, disclaimerY, { width: 495, align: 'justify' });
    doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(12).text('The purpose of this report', 50, disclaimerY + 70);
    doc.fillColor(COLORS.dark).font('Helvetica').fontSize(10.5).text(`To help a recruiter or hiring manager turn the assessment into better questions, clearer role-fit discussion and more informed onboarding decisions for ${name} in relation to ${role}.`, 50, disclaimerY + 95, { width: 495, lineGap: 4 });
  }

  doc.addPage(); drawHeader(doc); sectionTitle(doc, 'Executive Summary');
  // strongComps can be empty (no competency reaches STRONG SIGNAL for this
  // role) — the sentence must not then claim indicators point "most strongly"
  // toward a MODERATE-banded competency, which is exactly the contradiction
  // this report must avoid.
  const execStrongClause = strongComps.length
    ? `The current indicators point most strongly toward ${strongComps.slice(0, 2).map(c => c.title.toLowerCase()).join(' and ')}, while the lower signals identify areas that deserve deliberate validation rather than assumptions.`
    : `None of the current indicators reach a strong-signal threshold for this role; the profile is best read as a set of moderate signals, with ${validateComps.slice(0, 2).map(c => c.title.toLowerCase()).join(' and ')} deserving the closest validation in interview.`;
  paragraph(doc, `${name} presents an ${results.mbti} pattern associated with ${typeInfo.strengths.slice(0, 2).join(' and ').toLowerCase()}. In relation to ${role}, the useful question is not whether the profile is inherently good or bad. It is how the candidate's natural tendencies interact with the actual demands, environment and challenge of the role. ${execStrongClause}`, 11.4, 5);
  paragraph(doc, 'The report therefore treats the assessment as a starting point for a better recruitment conversation. It translates the three current CONVERGE perspectives — MBTI, EQ and Big Five — into role-relevant competencies, likely strengths, structural support needs and interview questions.', 11.4, 5);
  subhead(doc, 'Role Context');
  const envBodyText = sentenceCase(environment), challengeBodyText = sentenceCase(challenge);
  const rowCardHeight = Math.max(82, 31 + doc.heightOfString(envBodyText, { width: 214, lineGap: 3 }) + 13, 31 + doc.heightOfString(challengeBodyText, { width: 214, lineGap: 3 }) + 13);
  ensureSpace(doc, rowCardHeight);
  const cardY = doc.y;
  card(doc, 50, cardY, 240, rowCardHeight, 'ENVIRONMENT', envBodyText);
  card(doc, 305, cardY, 240, rowCardHeight, 'KEY CHALLENGE', challengeBodyText);
  doc.y = cardY + rowCardHeight + 21;
  subhead(doc, 'Role Description / Brief'); paragraph(doc, sentenceCase(description), 10.2, 4);
  subhead(doc, 'Candidate Profile');
  const profile = [
    ['MBTI', `${results.mbti} — ${typeInfo.title}`],
    ['BIG FIVE', `Openness ${results.bigFive.openness} • Conscientiousness ${results.bigFive.conscientiousness} • Extraversion ${results.bigFive.extraversion}`],
    ['BIG FIVE', `Agreeableness ${results.bigFive.agreeableness} • Emotional Stability ${results.bigFive.emotionalStability}`],
    ['EQ', `Self-Awareness ${results.ei.selfAwareness} • Self-Regulation ${results.ei.selfRegulation} • Motivation ${results.ei.motivation}`],
    ['EQ', `Empathy ${results.ei.empathy} • Social Skills ${results.ei.socialSkills}`],
  ];
  profile.forEach(([label, value]) => { const rowY = doc.y; doc.fillColor(COLORS.gold).font('Helvetica-Bold').fontSize(8.4).text(label, 50, rowY, { width: 82 }); doc.fillColor(COLORS.dark).font('Helvetica').fontSize(10.2).text(value, 140, rowY, { width: 405 }); doc.y = rowY + 24; });

  doc.addPage(); drawHeader(doc); sectionTitle(doc, 'Competency Translation');
  paragraph(doc, 'The following indicators translate the assessment into capabilities a recruiter can explore in a structured interview. They are deliberately presented as signals rather than promises: the strongest value comes from comparing them with evidence from the candidate\'s actual experience.', 10.6, 4);
  comps.forEach(item => competencyBar(doc, item));
  subhead(doc, 'Reading the indicators');
  paragraph(doc, `A ${alignmentBand.toLowerCase()} across these indicators does not constitute a hiring decision. It means the assessment provides a coherent set of hypotheses for the interview. The recruiter should test the strongest signals for evidence of past performance and the weaker signals for context, compensating behaviours and development potential.`, 10.2, 4);

  doc.addPage(); drawHeader(doc); sectionTitle(doc, 'Role Fit Analysis');
  paragraph(doc, roleFitParagraph(jobData, comps), 11.2, 5);
  // Both lists must stay strictly band-pure: a MODERATE (or AREA TO EXPLORE)
  // competency must never be presented under a "contribute strongly" heading,
  // and a STRONG SIGNAL competency must never be presented as a "risk area" —
  // either would directly contradict that competency's own label on the
  // Competency Translation page. When a list is empty, the heading and body
  // change to say so honestly instead of silently borrowing from the other
  // band.
  if (strongComps.length) {
    subhead(doc, 'Where this profile may contribute strongly');
    strongComps.slice(0, 4).forEach(item => bullet(doc, `${item.title}: ${item.explanation}`));
  } else {
    subhead(doc, 'Where this profile is currently most relevant');
    bullet(doc, 'No competency in this profile currently reaches a strong-signal threshold for this role. The moderate signals below are the most relevant currently available evidence, not confirmed strengths.');
  }
  if (validateComps.length) {
    subhead(doc, 'Structural support / risk areas');
    validateComps.slice(0, 3).forEach(item => bullet(doc, `${item.title}: treat this as an area to validate. Explore the circumstances in which the candidate performs well, the strategies they use to compensate and what the role would require from them.`));
  } else {
    subhead(doc, 'Structural support / risk areas');
    bullet(doc, 'Every competency in this profile currently reaches a strong signal for this role. Interview time is best spent confirming those signals translate into real behaviour, rather than probing for a weak area the assessment has not identified.');
  }
  subhead(doc, 'Important qualification');
  paragraph(doc, 'The current Big Five and EQ values are 0–100 assessment indicators derived from the questionnaire scoring model; they are not population percentiles. They should therefore not be presented as evidence that a candidate ranks at a particular percentile in the wider population. The report\'s value is in the pattern across dimensions and its relevance to the specific role.', 9.9, 4);

  doc.addPage(); drawHeader(doc); sectionTitle(doc, 'Recommended Interview Questions');
  paragraph(doc, `The strongest use of a Candidate Suitability report is not to make the interview shorter. It is to make the interview better. The questions below are designed around the profile, the role context and the areas most worth validating for ${role}.`, 10.8, 5);
  interviewQs.forEach((question, index) => { const qY = doc.y; doc.fillColor(COLORS.gold).font('Helvetica-Bold').fontSize(10).text(`${index + 1}`, 50, qY, { width: 20 }); const opts = { width: 467, lineGap: 4 }; doc.fillColor(COLORS.dark).font('Helvetica').fontSize(10.5).text(question, 78, qY, opts); doc.y = qY + doc.heightOfString(question, opts) + 8; });
  subhead(doc, 'Interview discipline'); paragraph(doc, 'Use the same core questions and evidence standard for comparable candidates. The assessment should generate better questions, not become a reason to apply a different standard to one candidate.', 10.2, 4);

  doc.addPage(); drawHeader(doc); sectionTitle(doc, 'Onboarding & Management Recommendations');
  paragraph(doc, `If ${name} progresses into ${role}, the assessment suggests several practical conditions worth considering during onboarding and early management. These are support recommendations, not prescriptions.`, 10.8, 5);
  recommendations.forEach(item => bullet(doc, item, 10.4));
  subhead(doc, 'Final CONVERGE View');
  const finalStrongClause = strongComps.length
    ? `The strongest current signals are in ${strongComps.slice(0, 3).map(c => c.title.toLowerCase()).join(', ')}.`
    : `No current signal reaches a strong-signal threshold for this role.`;
  const finalValidateClause = validateComps.length
    ? `particularly around ${validateComps.slice(0, 2).map(c => c.title.toLowerCase()).join(' and ')}`
    : `across every competency, since each currently reads as a strong signal that still deserves interview confirmation`;
  paragraph(doc, `${name}'s profile presents a coherent set of tendencies that can be meaningfully compared with the demands of ${role}. ${finalStrongClause} The most important interview work is to establish how those tendencies have translated into real behaviour under comparable conditions — ${finalValidateClause}.`, 10.8, 5);
  paragraph(doc, 'CONVERGE therefore does not issue a mechanical hire / do-not-hire verdict from the assessment alone. Its purpose is to give the decision-maker a richer starting point: better information, better questions and a more informed view of the person behind the CV.', 10.8, 5);
  ensureSpace(doc, 120);
  const calloutY = doc.y + 8; doc.rect(50, calloutY, 495, 78).fill(COLORS.light); doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(14).text('BETTER INFORMATION. BETTER QUESTIONS. BETTER-INFORMED DECISIONS.', 68, calloutY + 22, { width: 459, align: 'center', characterSpacing: 0.7 }); doc.fillColor(COLORS.grey).font('Helvetica-Oblique').fontSize(9.2).text('Strictly Confidential • Candidate Suitability Assessment • Decision-support document', 50, calloutY + 92, { width: 495, align: 'center' });

  const totalPages = doc.bufferedPageRange().count;
  for (let i = 0; i < totalPages; i++) { doc.switchToPage(i); drawFooter(doc, i + 1); }
  doc.end();
  return new Promise((resolve, reject) => { stream.on('finish', () => resolve(filePath)); stream.on('error', reject); });
}