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
const COLORS = { navy: '#1a2b4b', gold: '#c5a059', dark: '#111111', grey: '#444444', light: '#f9f7f2' };

function clamp(n: number): number { return Math.max(0, Math.min(100, Math.round(n))); }
function avg(...values: number[]): number { return values.reduce((a, b) => a + b, 0) / values.length; }
function label(score: number): string { return score >= 75 ? 'STRONG' : score >= 55 ? 'MODERATE' : 'WATCH'; }
function safe(value: unknown, fallback = 'Not specified'): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}
function roleText(job: JobData): string { return safe(job.jobTitle, 'the target role'); }
function shortText(value: unknown, max = 280): string {
  const text = safe(value, 'No additional role description was supplied.').replace(/\s+/g, ' ');
  return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
}

function drawHeader(doc: PDFKit.PDFDocument): number {
  const startX = 50, startY = 34, badgeH = 52;
  const badgeW = badgeH * CONVERGE_BADGE_ASPECT_RATIO;
  const textX = startX + badgeW + 14;
  doc.image(BADGE, startX, startY, { width: badgeW, height: badgeH });
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(29).text('CONVERGE', textX, startY + 3, { characterSpacing: 1 });
  const wordmarkWidth = doc.widthOfString('CONVERGE', { characterSpacing: 1 });
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(12).text('TM', textX + wordmarkWidth + 2, startY);
  doc.fillColor(COLORS.grey).font('Helvetica-Oblique').fontSize(10.5).text('Three frameworks. One you.', textX, startY + 34, { characterSpacing: 0.5 });
  const ruleY = startY + badgeH + 10;
  doc.moveTo(startX, ruleY).lineTo(545, ruleY).strokeColor(COLORS.gold).lineWidth(0.75).stroke();
  return ruleY + 14;
}

function drawFooter(doc: PDFKit.PDFDocument, page: number): void {
  doc.fillColor(COLORS.grey).font('Helvetica-Bold').fontSize(9.5)
    .text(`© ${new Date().getFullYear()} CONVERGE™ • ALL RIGHTS RESERVED • PAGE ${page}`, 50, 762, { align: 'center', width: 495 });
  doc.fillColor(COLORS.grey).font('Helvetica-Oblique').fontSize(8.5)
    .text('This assessment protocol and its integrated psychological architecture are protected intellectual property.', 50, 778, { align: 'center', width: 495 });
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string, y: number): number {
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(17).text(title.toUpperCase(), 50, y, { characterSpacing: 1 });
  doc.moveTo(50, y + 27).lineTo(545, y + 27).strokeColor(COLORS.gold).lineWidth(0.8).stroke();
  return y + 45;
}

function paragraph(doc: PDFKit.PDFDocument, text: string, x: number, y: number, width = 495, size = 11.5, gap = 5): number {
  const opts = { width, align: 'justify' as const, lineGap: gap };
  doc.fillColor(COLORS.dark).font('Helvetica').fontSize(size).text(text, x, y, opts);
  return y + doc.heightOfString(text, opts);
}

function card(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, heading: string, body: string): void {
  doc.rect(x, y, w, h).fill(COLORS.light);
  doc.fillColor(COLORS.gold).font('Helvetica-Bold').fontSize(8.5).text(heading, x + 14, y + 14, { characterSpacing: 1 });
  doc.fillColor(COLORS.dark).font('Helvetica-Bold').fontSize(11.5).text(body, x + 14, y + 31, { width: w - 28, lineGap: 3 });
}

function scoreForCompetency(key: string, r: AssessmentResults): number {
  const b = r.bigFive, e = r.ei;
  switch (key) {
    case 'strategic': return clamp(avg(b.openness, b.conscientiousness, r.mbti.includes('N') ? 90 : 55));
    case 'execution': return clamp(avg(b.conscientiousness, e.selfRegulation));
    case 'analysis': return clamp(avg(b.openness, b.conscientiousness, e.selfAwareness));
    case 'deep': return clamp(avg(e.empathy, e.socialSkills, b.agreeableness));
    case 'networking': return clamp(avg(b.extraversion, e.socialSkills));
    case 'solution': return clamp(avg(b.openness, b.conscientiousness, e.selfAwareness));
    case 'negotiation': return clamp(avg(e.socialSkills, e.selfRegulation, b.conscientiousness));
    case 'process': return clamp(b.conscientiousness);
    case 'resilience': return clamp(avg(e.selfRegulation, b.emotionalStability));
    case 'independent': return clamp(avg(b.conscientiousness, 100 - b.extraversion));
    case 'team': return clamp(avg(b.agreeableness, e.empathy, e.socialSkills));
    case 'adaptability': return clamp(avg(b.openness, e.selfRegulation));
    default: return 50;
  }
}

function competencyDetail(key: string, score: number): string {
  const l = label(score).toLowerCase();
  const details: Record<string, string> = {
    strategic: `Indicative ${l} capacity for seeing patterns, connecting ideas and thinking beyond the immediate task.`,
    execution: `Indicative ${l} capacity for disciplined follow-through, structure and controlled execution.`,
    analysis: `Indicative ${l} capacity for examining complexity, questioning assumptions and forming reasoned views.`,
    deep: `Indicative ${l} capacity for building trust through attentive, substantive one-to-one interaction.`,
    networking: `Indicative ${l} fit for high-volume social contact, networking and continual outward engagement.`,
    solution: `Indicative ${l} capacity for translating needs into practical, well-considered solutions.`,
    negotiation: `Indicative ${l} capacity for managing interpersonal pressure, trade-offs and movement toward agreement.`,
    process: `Indicative ${l} capacity for consistency, organisation, documentation and process discipline.`,
    resilience: `Indicative ${l} capacity for maintaining regulation and effectiveness when pressure or setbacks rise.`,
    independent: `Indicative ${l} fit for autonomy, self-direction and ownership without constant supervision.`,
    team: `Indicative ${l} capacity for cooperation, empathy and productive participation in a team.`,
    adaptability: `Indicative ${l} capacity for adjusting approach when circumstances, information or priorities change.`
  };
  return details[key];
}

export async function generateCandidateSuitabilityReport(name: string, results: AssessmentResults, jobData: JobData = {}): Promise<string> {
  const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
  const reportsDir = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const filePath = path.join(reportsDir, `Candidate_Suitability_V2_${safeName}_${Date.now()}.pdf`);
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  const title = roleText(jobData);
  const environment = safe(jobData.jobEnvironment, 'the stated work environment');
  const challenge = safe(jobData.jobChallenge, 'the principal challenge supplied for the role');
  const description = shortText(jobData.jobDescription);
  const typeInfo = typeDescriptions[results.mbti];

  // PAGE 1 — DECISION-ORIENTED COVER
  drawHeader(doc);
  doc.fillColor(COLORS.dark).font('Helvetica-Bold').fontSize(21).text('CANDIDATE SUITABILITY ASSESSMENT', 50, 125, { characterSpacing: 1.2 });
  doc.moveTo(50, 157).lineTo(545, 157).strokeColor(COLORS.gold).lineWidth(1).stroke();
  doc.fillColor(COLORS.grey).font('Helvetica-Oblique').fontSize(11.5)
    .text('An integrated decision-support report translating three psychological perspectives into role-relevant insight.', 50, 177, { width: 495 });
  doc.fillColor(COLORS.grey).font('Helvetica-Bold').fontSize(9).text('CANDIDATE', 50, 225, { characterSpacing: 1.5 });
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(27).text(name.toUpperCase(), 50, 242);
  doc.fillColor(COLORS.grey).font('Helvetica-Bold').fontSize(9).text('TARGET ROLE', 50, 292, { characterSpacing: 1.5 });
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(16).text(title.toUpperCase(), 50, 309, { width: 495 });
  doc.fillColor(COLORS.grey).font('Helvetica-Bold').fontSize(9).text('ASSESSMENT DATE', 50, 355, { characterSpacing: 1.5 });
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(13).text(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), 50, 372);
  card(doc, 50, 430, 155, 100, 'ROLE ALIGNMENT', label(scoreForCompetency('strategic', results)));
  card(doc, 220, 430, 155, 100, 'PRIMARY PROFILE', results.mbti);
  card(doc, 390, 430, 155, 100, 'INTERVIEW VIEW', 'PROCEED');
  doc.fillColor(COLORS.grey).font('Helvetica-Oblique').fontSize(9.5)
    .text('CONVERGE indicators are decision-support signals, not predictions of job performance and not a substitute for structured interviewing, references or professional judgement.', 50, 570, { width: 495, align: 'justify' });
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(12).text('Three perspectives. One integrated view.', 50, 640);
  paragraph(doc, `This report considers ${name} in relation to ${title}. It combines MBTI preferences with 0–100 Big Five trait indicators and 0–100 EQ dimension indicators, then translates those patterns into practical questions for the role and working environment described.`, 50, 665, 495, 10.5, 4);
  drawFooter(doc, 1);

  // PAGE 2 — EXECUTIVE SUMMARY + PROFILE
  doc.addPage(); drawHeader(doc);
  let y = sectionTitle(doc, 'Executive Summary', 118);
  y = paragraph(doc, `${name} presents a ${results.mbti} pattern characterised by ${typeInfo.strengths.slice(0, 2).join(' and ').toLowerCase()}. In the context of ${title}, the most relevant question is not whether the profile is "good" or "bad", but how its natural tendencies interact with the demands of the role. The strongest signals point toward ${scoreForCompetency('strategic', results) >= 70 ? 'strategic and analytical work' : 'practical and relationship-oriented execution'}, while the areas requiring deliberate attention are identified later in this report.`, 50, y);
  y += 18;
  y = sectionTitle(doc, 'Role Context', y);
  card(doc, 50, y, 240, 82, 'ENVIRONMENT', environment);
  card(doc, 305, y, 240, 82, 'KEY CHALLENGE', challenge);
  y += 105;
  doc.fillColor(COLORS.grey).font('Helvetica-Bold').fontSize(8.5).text('ROLE DESCRIPTION / BRIEF', 50, y, { characterSpacing: 1 });
  y += 16; y = paragraph(doc, description, 50, y, 495, 10.5, 4);
  y += 24;
  y = sectionTitle(doc, 'Candidate Profile', y);
  const profileRows = [
    ['MBTI', `${results.mbti} — ${typeInfo.title}`],
    ['BIG FIVE', `Openness ${results.bigFive.openness} • Conscientiousness ${results.bigFive.conscientiousness} • Extraversion ${results.bigFive.extraversion}`],
    ['BIG FIVE', `Agreeableness ${results.bigFive.agreeableness} • Emotional Stability ${results.bigFive.emotionalStability}`],
    ['EQ', `Self-Awareness ${results.ei.selfAwareness} • Self-Regulation ${results.ei.selfRegulation} • Motivation ${results.ei.motivation}`],
    ['EQ', `Empathy ${results.ei.empathy} • Social Skills ${results.ei.socialSkills}`]
  ];
  profileRows.forEach(([k, v]) => { doc.fillColor(COLORS.gold).font('Helvetica-Bold').fontSize(8.5).text(k, 50, y, { width: 85 }); doc.fillColor(COLORS.dark).font('Helvetica').fontSize(10.5).text(v, 140, y, { width: 405 }); y += 27; });
  drawFooter(doc, 2);

  // PAGE 3 — COMPETENCY TRANSLATION
  doc.addPage(); drawHeader(doc);
  y = sectionTitle(doc, 'Competency Translation', 118);
  y = paragraph(doc, 'The following indicators translate the assessment into capabilities that recruiters can explore in a structured interview. They are intentionally indicative rather than predictive: a strong signal is an area to investigate, not proof of performance.', 50, y, 495, 10.5, 4) + 20;
  const competencies = [
    ['Strategic Thinking & Vision', 'strategic'], ['Execution & Follow-through', 'execution'], ['Client / Stakeholder Analysis', 'analysis'], ['Deep Relationship Building', 'deep'],
    ['Networking & Broad Social Selling', 'networking'], ['Proposal & Solution Design', 'solution'], ['Negotiation & Closing', 'negotiation'], ['CRM / Process Discipline', 'process'],
    ['Resilience Under Pressure', 'resilience'], ['Independent / Self-Directed Work', 'independent'], ['Team Collaboration', 'team'], ['Adaptability', 'adaptability']
  ];
  competencies.forEach(([nameLabel, key], i) => {
    const score = scoreForCompetency(key, results);
    if (i > 0 && i % 6 === 0) { /* keep six rows per page section; this report uses one page and compact rows */ }
    doc.fillColor(COLORS.dark).font('Helvetica-Bold').fontSize(9.5).text(nameLabel, 50, y, { width: 185 });
    doc.rect(245, y + 2, 175, 8).fill(COLORS.light);
    doc.rect(245, y + 2, 175 * score / 100, 8).fill(COLORS.gold);
    doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(9).text(label(score), 430, y, { width: 55, align: 'right' });
    doc.fillColor(COLORS.grey).font('Helvetica').fontSize(7.8).text(competencyDetail(key, score), 50, y + 15, { width: 495 });
    y += 46;
  });
  drawFooter(doc, 3);

  // PAGE 4 — ROLE FIT + STRUCTURAL SUPPORT
  doc.addPage(); drawHeader(doc);
  y = sectionTitle(doc, 'Role Fit Analysis', 118);
  y = paragraph(doc, `${title} operates within ${environment}. The supplied role challenge is ${challenge.toLowerCase()}. The profile therefore deserves particular attention around the balance between independent cognitive work, delivery discipline and the human demands of the role.`, 50, y);
  y += 20;
  const strengths: string[] = [];
  if (scoreForCompetency('strategic', results) >= 70) strengths.push('Strategic account thinking and pattern recognition');
  if (scoreForCompetency('solution', results) >= 70) strengths.push('Complex solution and proposal development');
  if (scoreForCompetency('process', results) >= 70) strengths.push('Pipeline, process and follow-through discipline');
  if (scoreForCompetency('independent', results) >= 70) strengths.push('Autonomous ownership and self-directed execution');
  if (scoreForCompetency('deep', results) >= 70) strengths.push('Substantive one-to-one stakeholder relationships');
  if (!strengths.length) strengths.push('A balanced set of role-relevant indicators worth exploring through interview evidence');
  const risks: string[] = [];
  if (scoreForCompetency('networking', results) < 55) risks.push('High-volume networking or continual social selling may require deliberate structure.');
  if (scoreForCompetency('resilience', results) < 55) risks.push('Pressure, setbacks or sustained workload should be explored rather than assumed to be easily absorbed.');
  if (results.bigFive.agreeableness < 45 || results.ei.empathy < 45) risks.push('Directness or task focus may need to be balanced with relationship sensitivity.');
  if (results.ei.selfRegulation < 55) risks.push('Explore how the candidate regulates reactions when priorities, people or outcomes become difficult.');
  if (!risks.length) risks.push('No major structural watch-out is indicated by the current profile; interview evidence should still test role-specific demands.');
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(13).text('WHERE THIS PROFILE MAY EXCEL', 50, y);
  y += 24; strengths.forEach(s => { doc.circle(55, y + 5, 2.5).fill(COLORS.gold); doc.fillColor(COLORS.dark).font('Helvetica').fontSize(10.8).text(s, 68, y, { width: 465 }); y += 25; });
  y += 15;
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(13).text('AREAS REQUIRING STRUCTURAL SUPPORT', 50, y);
  y += 24; risks.forEach(s => { doc.circle(55, y + 5, 2.5).fill(COLORS.gold); y = paragraph(doc, s, 68, y, 465, 10.5, 3) + 10; });
  y += 12;
  doc.rect(50, y, 495, 95).fill(COLORS.light);
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(12).text('ROLE-SPECIFIC QUESTION TO TEST', 68, y + 18, { characterSpacing: 0.8 });
  const testQuestion = `Given the role's stated challenge — ${challenge} — ask the candidate to describe a real situation where they had to achieve the required outcome while working outside their natural comfort zone.`;
  paragraph(doc, testQuestion, 68, y + 42, 450, 10.5, 3);
  drawFooter(doc, 4);

  // PAGE 5 — INTERVIEW QUESTIONS
  doc.addPage(); drawHeader(doc);
  y = sectionTitle(doc, 'Recommended Interview Questions', 118);
  y = paragraph(doc, `These questions are designed to turn the assessment into evidence. They should be asked against specific examples, with follow-up questions on the candidate's actions, decisions, outcomes and lessons learned.`, 50, y, 495, 10.5, 4) + 20;
  const interviewGroups: Array<[string, string[]]> = [
    ['STRATEGIC THINKING', [
      `Describe a situation in which you identified an opportunity or risk that others had not yet seen. What did you do with that insight?`,
      `What is the most complex ${title.toLowerCase()}-related problem you have structured from uncertainty into a workable plan?`
    ]],
    ['EXECUTION & SELF-MANAGEMENT', [
      `How do you impose accountability on yourself when nobody is closely supervising the work?`,
      `Tell us about a period when several priorities competed for your attention. How did you decide what received your time?`
    ]],
    ['RELATIONSHIP ARCHITECTURE', [
      `Which matters more in your work: a smaller number of deep relationships or a much broader network? Give an example of the advantage and limitation of your preference.`,
      `Describe a difficult stakeholder relationship you successfully repaired or strengthened. What changed because of your approach?`
    ]],
    ['PRESSURE, SETBACKS & ADAPTATION', [
      `Tell us about a significant rejection, setback or delayed outcome. What happened to your performance afterwards?`,
      `What are the early signs that your workload or pressure is beginning to affect your judgement or effectiveness, and what do you do about it?`
    ]]
  ];
  interviewGroups.forEach(([heading, questions]) => {
    doc.fillColor(COLORS.gold).font('Helvetica-Bold').fontSize(9).text(heading, 50, y, { characterSpacing: 1.2 }); y += 18;
    questions.forEach(q => { doc.circle(55, y + 5, 2.5).fill(COLORS.navy); y = paragraph(doc, q, 68, y, 465, 10.5, 3) + 13; });
    y += 7;
  });
  drawFooter(doc, 5);

  // PAGE 6 — ONBOARDING + FINAL VIEW
  doc.addPage(); drawHeader(doc);
  y = sectionTitle(doc, 'Onboarding & Management Recommendations', 118);
  const recommendations = [
    'Define role scope, decision rights and success measures clearly at the outset.',
    'Establish measurable KPIs and review them against outcomes rather than activity alone.',
    'Protect focused work time where the role requires analysis, planning or complex problem-solving.',
    'Use the interview findings to agree how networking, collaboration and stakeholder contact will be managed.',
    'Check in on workload and pressure, not only visible output and completed tasks.',
    'Give autonomy where competence is demonstrated, while maintaining clear accountability for results.'
  ];
  y += 10; recommendations.forEach((r, i) => { doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(11).text(`${i + 1}.`, 50, y); y = paragraph(doc, r, 75, y, 470, 10.8, 3) + 10; });
  y += 12;
  doc.rect(50, y, 495, 170).fill(COLORS.light);
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(14).text('FINAL CONVERGE VIEW', 75, y + 22, { characterSpacing: 1 });
  doc.moveTo(75, y + 47).lineTo(520, y + 47).strokeColor(COLORS.gold).lineWidth(0.8).stroke();
  const finalView = `The available assessment evidence supports ${label(scoreForCompetency('strategic', results)).toLowerCase()} investigation of ${name} for ${title}. The strongest potential contribution appears to lie in the areas highlighted above, while the identified watch-outs should be tested through behavioural evidence rather than treated as fixed limitations. CONVERGE should inform the interview, not replace it.`;
  paragraph(doc, finalView, 75, y + 68, 445, 11.5, 5);
  doc.fillColor(COLORS.gold).font('Helvetica-Bold').fontSize(15).text('BETTER INFORMATION. BETTER QUESTIONS. BETTER-INFORMED DECISIONS.', 50, 680, { width: 495, align: 'center', characterSpacing: 0.6 });
  drawFooter(doc, 6);

  doc.end();
  return new Promise((resolve, reject) => { stream.on('finish', () => resolve(filePath)); stream.on('error', reject); });
}
