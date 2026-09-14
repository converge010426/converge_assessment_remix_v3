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

type Competency = { key: string; title: string; score: number; explanation: string };

function clamp(value: number): number { return Math.max(0, Math.min(100, Math.round(value))); }
function avg(...values: number[]): number { return values.reduce((sum, value) => sum + value, 0) / values.length; }
function safe(value: unknown, fallback = 'Not specified'): string { const text = String(value ?? '').trim(); return text || fallback; }
function band(score: number): string { if (score >= 75) return 'STRONG SIGNAL'; if (score >= 55) return 'MODERATE SIGNAL'; return 'AREA TO EXPLORE'; }
function roleText(job: JobData): string { return safe(job.jobTitle, 'the target role'); }
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
  doc.moveTo(x, y + h + 10).lineTo(545, y + h + 10).strokeColor(COLORS.gold).lineWidth(0.75).stroke();
}

function drawFooter(doc: PDFKit.PDFDocument, page: number): void {
  doc.fillColor(COLORS.grey).font('Helvetica-Bold').fontSize(9.5).text(`© ${new Date().getFullYear()} CONVERGE™ • ALL RIGHTS RESERVED • PAGE ${page}`, 50, 762, { width: 495, align: 'center' });
  doc.fillColor(COLORS.grey).font('Helvetica-Oblique').fontSize(8.5).text('This assessment protocol and its integrated psychological architecture are protected intellectual property.', 50, 778, { width: 495, align: 'center' });
}

function sectionTitle(doc: PDFKit.PDFDocument, text: string): void {
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(17).text(text.toUpperCase(), PAGE.left, 118, { characterSpacing: 1 });
  doc.moveTo(PAGE.left, 145).lineTo(PAGE.right, 145).strokeColor(COLORS.gold).lineWidth(0.8).stroke();
  doc.y = 164;
}

function paragraph(doc: PDFKit.PDFDocument, text: string, size = 11.2, gap = 5): void {
  doc.fillColor(COLORS.dark).font('Helvetica').fontSize(size).text(text, PAGE.left, doc.y, { width: PAGE.width, align: 'justify', lineGap: gap });
  doc.moveDown(0.65);
}

function subhead(doc: PDFKit.PDFDocument, title: string): void {
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(12.5).text(title.toUpperCase(), PAGE.left, doc.y, { characterSpacing: 0.8 });
  doc.moveDown(0.45);
}

function bullet(doc: PDFKit.PDFDocument, text: string, size = 10.5): void {
  const startY = doc.y;
  const opts = { width: 470, lineGap: 3 };
  doc.fillColor(COLORS.gold).circle(55, startY + 6, 2.3).fill();
  doc.fillColor(COLORS.dark).font('Helvetica').fontSize(size).text(text, 66, startY, opts);
  doc.y = startY + doc.heightOfString(text, opts) + 4;
}

function card(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, heading: string, body: string): void {
  doc.rect(x, y, w, h).fill(COLORS.light);
  doc.fillColor(COLORS.gold).font('Helvetica-Bold').fontSize(8.2).text(heading, x + 13, y + 13, { characterSpacing: 1 });
  doc.fillColor(COLORS.dark).font('Helvetica-Bold').fontSize(11).text(body, x + 13, y + 31, { width: w - 26, lineGap: 3 });
}

function competencyBar(doc: PDFKit.PDFDocument, item: Competency): void {
  const y = doc.y;
  doc.fillColor(COLORS.dark).font('Helvetica-Bold').fontSize(9.3).text(item.title, 50, y, { width: 185 });
  doc.rect(245, y + 2, 175, 8).fill(COLORS.light);
  doc.rect(245, y + 2, 175 * item.score / 100, 8).fill(COLORS.gold);
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(8.5).text(band(item.score), 428, y, { width: 117, align: 'right' });
  doc.fillColor(COLORS.grey).font('Helvetica').fontSize(7.8).text(item.explanation, 50, y + 15, { width: 495 });
  doc.y = y + 43;
}

function roleFitParagraph(job: JobData, comps: Competency[]): string {
  const role = roleText(job);
  const family = roleFamily(job);
  const strong = [...comps].sort((a, b) => b.score - a.score).slice(0, 3).map(c => c.title.toLowerCase());
  const support = [...comps].sort((a, b) => a.score - b.score).slice(0, 2).map(c => c.title.toLowerCase());
  const familySentence: Record<string, string> = {
    commercial: `For a commercially oriented role such as ${role}, the profile is most relevant where the work rewards deliberate strategy, client understanding, disciplined follow-through and the ability to build credibility over time.`,
    leadership: `For a leadership role such as ${role}, the central question is how the candidate balances independent judgement and execution with the interpersonal demands of leading through other people.`,
    analytical: `For an analytical role such as ${role}, the profile is most relevant where the work rewards structured reasoning, careful execution, sustained concentration and the ability to turn information into sound decisions.`,
    advisory: `For an advisory role such as ${role}, the profile is most relevant where the work rewards synthesis, independent judgement, clear communication and the ability to translate complexity into practical direction.`,
    general: `For ${role}, the strongest evidence comes from comparing the role's actual demands with the candidate's pattern rather than treating the assessment as a universal measure of suitability.`
  };
  return `${familySentence[family]} The strongest current indicators are ${strong.join(', ')}. The areas that deserve the most deliberate validation are ${support.join(' and ')}. These are not predictions of performance; they identify where the structured interview should confirm, qualify or challenge the assessment pattern.`;
}

function interviewQuestions(job: JobData, comps: Competency[]): string[] {
  const role = roleText(job);
  const challenge = safe(job.jobChallenge, 'the principal challenge of the role');
  const family = roleFamily(job);
  const weakest = [...comps].sort((a, b) => a.score - b.score).slice(0, 2);
  const questions = [
    'Describe a time in a previous role when you identified an important issue or opportunity before it was obvious to others. What did you do with that insight, and what happened?',
    `In ${role}, you may face ${challenge.toLowerCase()}. Talk through how you would approach that situation from first principles rather than giving the ideal answer.`,
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
  questions.push(`The assessment flags ${weakest[0].title.toLowerCase()} and ${weakest[1].title.toLowerCase()} as areas worth exploring. What would a previous manager or colleague say about these two areas in practice?`);
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
    s.teamwork < 60 ? 'Make team interfaces and decision rights explicit so collaboration does not depend on unspoken expectations.' : 'Use the candidate’s collaborative capacity deliberately by giving clear shared outcomes and ownership boundaries.',
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
  // Eight competencies keep the page decision-focused and leave safe room for the interpretation below.
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

  // PAGE 1 — DECISION-ORIENTED COVER
  drawHeader(doc);
  doc.fillColor(COLORS.dark).font('Helvetica-Bold').fontSize(21).text('CANDIDATE SUITABILITY ASSESSMENT', 50, 125, { characterSpacing: 1.2 });
  doc.moveTo(50, 157).lineTo(545, 157).strokeColor(COLORS.gold).lineWidth(1).stroke();
  doc.fillColor(COLORS.grey).font('Helvetica-Oblique').fontSize(11.2).text('An integrated decision-support report translating MBTI, EQ and Big Five indicators into role-relevant insight.', 50, 177, { width: 495 });
  doc.fillColor(COLORS.grey).font('Helvetica-Bold').fontSize(9).text('CANDIDATE', 50, 225, { characterSpacing: 1.5 });
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(27).text(name.toUpperCase(), 50, 242);
  doc.fillColor(COLORS.grey).font('Helvetica-Bold').fontSize(9).text('TARGET ROLE', 50, 292, { characterSpacing: 1.5 });
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(16).text(role.toUpperCase(), 50, 309, { width: 495 });
  doc.fillColor(COLORS.grey).font('Helvetica-Bold').fontSize(9).text('ASSESSMENT DATE', 50, 355, { characterSpacing: 1.5 });
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(13).text(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), 50, 372);
  card(doc, 50, 430, 155, 100, 'ROLE ALIGNMENT SIGNAL', alignmentBand);
  card(doc, 220, 430, 155, 100, 'PRIMARY PROFILE', `${results.mbti} • ${typeInfo.title}`);
  card(doc, 390, 430, 155, 100, 'INTERVIEW PRIORITY', alignmentScore >= 70 ? 'DEEP VALIDATION' : alignmentScore >= 55 ? 'STANDARD REVIEW' : 'TARGETED REVIEW');
  doc.fillColor(COLORS.grey).font('Helvetica-Oblique').fontSize(9.2).text('These indicators are decision-support signals. They are not predictions of job performance and do not replace structured interviewing, references, work samples or professional judgement.', 50, 570, { width: 495, align: 'justify' });
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(12).text('The purpose of this report', 50, 640);
  doc.fillColor(COLORS.dark).font('Helvetica').fontSize(10.5).text(`To help a recruiter or hiring manager turn the assessment into better questions, clearer role-fit discussion and more informed onboarding decisions for ${name} in relation to ${role}.`, 50, 665, { width: 495, lineGap: 4 });

  // PAGE 2 — EXECUTIVE SUMMARY + PROFILE
  doc.addPage(); drawHeader(doc); sectionTitle(doc, 'Executive Summary');
  paragraph(doc, `${name} presents a ${results.mbti} pattern associated with ${typeInfo.strengths.slice(0, 2).join(' and ').toLowerCase()}. In relation to ${role}, the useful question is not whether the profile is inherently good or bad. It is how the candidate's natural tendencies interact with the actual demands, environment and challenge of the role. The current indicators point most strongly toward ${comps.slice().sort((a, b) => b.score - a.score).slice(0, 2).map(c => c.title.toLowerCase()).join(' and ')}, while the lower signals identify areas that deserve deliberate validation rather than assumptions.`, 11.4, 5);
  paragraph(doc, 'The report therefore treats the assessment as a starting point for a better recruitment conversation. It translates the three current CONVERGE perspectives — MBTI, EQ and Big Five — into role-relevant competencies, likely strengths, structural support needs and interview questions.', 11.4, 5);
  subhead(doc, 'Role Context');
  const cardY = doc.y; card(doc, 50, cardY, 240, 82, 'ENVIRONMENT', environment); card(doc, 305, cardY, 240, 82, 'KEY CHALLENGE', challenge); doc.y = cardY + 103;
  subhead(doc, 'Role Description / Brief'); paragraph(doc, description, 10.2, 4);
  subhead(doc, 'Candidate Profile');
  const profile = [
    ['MBTI', `${results.mbti} — ${typeInfo.title}`],
    ['BIG FIVE', `Openness ${results.bigFive.openness} • Conscientiousness ${results.bigFive.conscientiousness} • Extraversion ${results.bigFive.extraversion}`],
    ['BIG FIVE', `Agreeableness ${results.bigFive.agreeableness} • Emotional Stability ${results.bigFive.emotionalStability}`],
    ['EQ', `Self-Awareness ${results.ei.selfAwareness} • Self-Regulation ${results.ei.selfRegulation} • Motivation ${results.ei.motivation}`],
    ['EQ', `Empathy ${results.ei.empathy} • Social Skills ${results.ei.socialSkills}`],
  ];
  profile.forEach(([label, value]) => { const rowY = doc.y; doc.fillColor(COLORS.gold).font('Helvetica-Bold').fontSize(8.4).text(label, 50, rowY, { width: 82 }); doc.fillColor(COLORS.dark).font('Helvetica').fontSize(10.2).text(value, 140, rowY, { width: 405 }); doc.y = rowY + 24; });

  // PAGE 3 — COMPETENCY TRANSLATION
  doc.addPage(); drawHeader(doc); sectionTitle(doc, 'Competency Translation');
  paragraph(doc, 'The following indicators translate the assessment into capabilities a recruiter can explore in a structured interview. They are deliberately presented as signals rather than promises: the strongest value comes from comparing them with evidence from the candidate’s actual experience.', 10.6, 4);
  comps.forEach(item => competencyBar(doc, item));
  subhead(doc, 'Reading the indicators');
  paragraph(doc, `A ${alignmentBand.toLowerCase()} across these indicators does not constitute a hiring decision. It means the assessment provides a coherent set of hypotheses for the interview. The recruiter should test the strongest signals for evidence of past performance and the weaker signals for context, compensating behaviours and development potential.`, 10.2, 4);

  // PAGE 4 — ROLE FIT + STRUCTURAL SUPPORT
  doc.addPage(); drawHeader(doc); sectionTitle(doc, 'Role Fit Analysis');
  paragraph(doc, roleFitParagraph(jobData, comps), 11.2, 5);
  subhead(doc, 'Where this profile may contribute strongly');
  [...comps].sort((a, b) => b.score - a.score).slice(0, 4).forEach(item => bullet(doc, `${item.title}: ${item.explanation}`));
  subhead(doc, 'Structural support / risk areas');
  [...comps].sort((a, b) => a.score - b.score).slice(0, 3).forEach(item => bullet(doc, `${item.title}: treat this as an area to validate. Explore the circumstances in which the candidate performs well, the strategies they use to compensate and what the role would require from them.`));
  subhead(doc, 'Important qualification');
  paragraph(doc, 'The current Big Five and EQ values are 0–100 assessment indicators derived from the questionnaire scoring model; they are not population percentiles. They should therefore not be presented as evidence that a candidate ranks at a particular percentile in the wider population. The report’s value is in the pattern across dimensions and its relevance to the specific role.', 9.9, 4);

  // PAGE 5 — INTERVIEW QUESTIONS
  doc.addPage(); drawHeader(doc); sectionTitle(doc, 'Recommended Interview Questions');
  paragraph(doc, `The strongest use of a Candidate Suitability report is not to make the interview shorter. It is to make the interview better. The questions below are designed around the profile, the role context and the areas most worth validating for ${role}.`, 10.8, 5);
  interviewQs.forEach((question, index) => { const qY = doc.y; doc.fillColor(COLORS.gold).font('Helvetica-Bold').fontSize(10).text(`${index + 1}`, 50, qY, { width: 20 }); const opts = { width: 467, lineGap: 4 }; doc.fillColor(COLORS.dark).font('Helvetica').fontSize(10.5).text(question, 78, qY, opts); doc.y = qY + doc.heightOfString(question, opts) + 8; });
  subhead(doc, 'Interview discipline'); paragraph(doc, 'Use the same core questions and evidence standard for comparable candidates. The assessment should generate better questions, not become a reason to apply a different standard to one candidate.', 10.2, 4);

  // PAGE 6 — ONBOARDING + FINAL VIEW
  doc.addPage(); drawHeader(doc); sectionTitle(doc, 'Onboarding & Management Recommendations');
  paragraph(doc, `If ${name} progresses into ${role}, the assessment suggests several practical conditions worth considering during onboarding and early management. These are support recommendations, not prescriptions.`, 10.8, 5);
  recommendations.forEach(item => bullet(doc, item, 10.4));
  subhead(doc, 'Final CONVERGE View');
  paragraph(doc, `${name}'s profile presents a coherent set of tendencies that can be meaningfully compared with the demands of ${role}. The strongest current signals are in ${comps.slice().sort((a, b) => b.score - a.score).slice(0, 3).map(c => c.title.toLowerCase()).join(', ')}. The most important interview work is to establish how those tendencies have translated into real behaviour under comparable conditions — particularly around ${comps.slice().sort((a, b) => a.score - b.score).slice(0, 2).map(c => c.title.toLowerCase()).join(' and ')}.`, 10.8, 5);
  paragraph(doc, 'CONVERGE therefore does not issue a mechanical hire / do-not-hire verdict from the assessment alone. Its purpose is to give the decision-maker a richer starting point: better information, better questions and a more informed view of the person behind the CV.', 10.8, 5);
  const calloutY = doc.y + 8; doc.rect(50, calloutY, 495, 78).fill(COLORS.light); doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(14).text('BETTER INFORMATION. BETTER QUESTIONS. BETTER-INFORMED DECISIONS.', 68, calloutY + 22, { width: 459, align: 'center', characterSpacing: 0.7 }); doc.fillColor(COLORS.grey).font('Helvetica-Oblique').fontSize(9.2).text('Strictly Confidential • Candidate Suitability Assessment • Decision-support document', 50, calloutY + 92, { width: 495, align: 'center' });

  const totalPages = doc.bufferedPageRange().count;
  for (let i = 0; i < totalPages; i++) { doc.switchToPage(i); drawFooter(doc, i + 1); }
  doc.end();
  return new Promise((resolve, reject) => { stream.on('finish', () => resolve(filePath)); stream.on('error', reject); });
}
