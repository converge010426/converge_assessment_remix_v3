import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { AssessmentResults, typeDescriptions } from '../logic.js';
import { generateCandidateSuitabilityV2 } from './candidateSuitabilityV2.js';
import { frameworkSummary, mbtiPreferenceText, Insight } from './v2Interpretation.js';
import { CONVERGE_BADGE_PNG_BASE64, CONVERGE_BADGE_ASPECT_RATIO } from '../assets/logo.js';

const BADGE = Buffer.from(CONVERGE_BADGE_PNG_BASE64, 'base64');
const COLORS = { navy: '#1a2b4b', gold: '#c5a059', dark: '#111111', grey: '#444444', light: '#f9f7f2' };
const PAGE = { left: 50, width: 495, bottom: 730 };

function prepareReport(name: string, prefix: string) {
  const dir = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), 'reports');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const filePath = path.join(dir, `${prefix}_${safeName}_${Date.now()}.pdf`);
  const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);
  return { doc, stream, filePath };
}

function header(doc: PDFKit.PDFDocument): void {
  const x = 50, y = 34, h = 52, w = h * CONVERGE_BADGE_ASPECT_RATIO, textX = x + w + 14;
  doc.image(BADGE, x, y, { width: w, height: h });
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(29).text('CONVERGE', textX, y + 3, { characterSpacing: 1 });
  const width = doc.widthOfString('CONVERGE', { characterSpacing: 1 });
  doc.fontSize(11).text('TM', textX + width + 2, y);
  doc.fillColor(COLORS.grey).font('Helvetica-Oblique').fontSize(10.5).text('Three frameworks. One you.', textX, y + 34, { characterSpacing: 0.5 });
  doc.moveTo(50, 96).lineTo(545, 96).strokeColor(COLORS.gold).lineWidth(0.75).stroke();
}

function footer(doc: PDFKit.PDFDocument, page: number): void {
  doc.fillColor(COLORS.grey).font('Helvetica-Bold').fontSize(9).text(`© ${new Date().getFullYear()} CONVERGE™ • ALL RIGHTS RESERVED • PAGE ${page}`, 50, 762, { width: 495, align: 'center' });
  doc.font('Helvetica-Oblique').fontSize(8).text('This assessment protocol and its integrated psychological architecture are protected intellectual property.', 50, 778, { width: 495, align: 'center' });
}

function title(doc: PDFKit.PDFDocument, text: string): void {
  doc.fillColor(COLORS.dark).font('Helvetica-Bold').fontSize(19).text(text.toUpperCase(), 50, 112, { width: 495, characterSpacing: 1 });
  doc.moveTo(50, 140).lineTo(545, 140).strokeColor(COLORS.gold).lineWidth(1).stroke();
  doc.y = 164;
}

function para(doc: PDFKit.PDFDocument, text: string, size = 11, gap = 4): void {
  doc.fillColor(COLORS.dark).font('Helvetica').fontSize(size).text(text, 50, doc.y, { width: 495, align: 'justify', lineGap: gap });
  doc.moveDown(0.65);
}

function sub(doc: PDFKit.PDFDocument, text: string): void {
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(12.5).text(text.toUpperCase(), 50, doc.y, { characterSpacing: 0.8 });
  doc.moveDown(0.45);
}

function bullet(doc: PDFKit.PDFDocument, text: string): void {
  const y = doc.y, opts = { width: 470, lineGap: 3 };
  doc.fillColor(COLORS.gold).circle(55, y + 6, 2.3).fill();
  doc.fillColor(COLORS.dark).font('Helvetica').fontSize(10.5).text(text, 66, y, opts);
  doc.y = y + doc.heightOfString(text, opts) + 5;
}

function scoreBar(doc: PDFKit.PDFDocument, label: string, score: number): void {
  const y = doc.y;
  doc.fillColor(COLORS.dark).font('Helvetica-Bold').fontSize(9.5).text(label.toUpperCase(), 50, y);
  doc.rect(50, y + 16, 495, 9).fill(COLORS.light);
  doc.rect(50, y + 16, Math.max(0, Math.min(100, score)) * 4.95, 9).fill(COLORS.gold);
  doc.fillColor(COLORS.grey).font('Helvetica').fontSize(8.8).text(`${score}/100`, 50, y + 29);
  doc.y = y + 47;
}

function insight(doc: PDFKit.PDFDocument, item: Insight): void {
  const y = doc.y;
  doc.rect(50, y, 495, 0.5).fill(COLORS.gold);
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(11).text(item.title.toUpperCase(), 50, y + 10, { characterSpacing: 0.7 });
  doc.fillColor(COLORS.grey).font('Helvetica-Bold').fontSize(8.5).text(item.band, 445, y + 10, { width: 100, align: 'right' });
  doc.fillColor(COLORS.dark).font('Helvetica').fontSize(10.5).text(item.text, 50, y + 27, { width: 495, lineGap: 3 });
  doc.y = y + 27 + doc.heightOfString(item.text, { width: 495, lineGap: 3 }) + 13;
}

function finish(doc: PDFKit.PDFDocument, stream: fs.WriteStream, filePath: string): Promise<string> {
  const count = doc.bufferedPageRange().count;
  for (let i = 0; i < count; i++) { doc.switchToPage(i); footer(doc, i + 1); }
  doc.end();
  return new Promise((resolve, reject) => { stream.on('finish', () => resolve(filePath)); stream.on('error', reject); });
}

function mbtiLabels(type: string): string[] {
  return [type[0] === 'E' ? 'Extraverted' : 'Introverted', type[1] === 'S' ? 'Sensing' : 'Intuitive', type[2] === 'T' ? 'Thinking' : 'Feeling', type[3] === 'J' ? 'Judging' : 'Perceiving'];
}

export async function generateMBTIReport(name: string, results: AssessmentResults): Promise<string> {
  const { doc, stream, filePath } = prepareReport(name, 'MBTI_Report');
  const info = typeDescriptions[results.mbti];
  const labels = mbtiLabels(results.mbti);
  const insights = frameworkSummary(results);

  header(doc); title(doc, 'MBTI Personality Profile');
  para(doc, 'This personal assessment presents the MBTI result as one perspective within the wider CONVERGE architecture. The interpretation uses the individual response pattern rather than treating the four-letter type as a complete description of the person.', 10.8);
  doc.fillColor(COLORS.grey).font('Helvetica-Bold').fontSize(9).text('PREPARED FOR', 50, doc.y + 4, { characterSpacing: 1.5 });
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(18).text(name.toUpperCase(), 50, doc.y + 18);
  doc.y += 58;
  doc.rect(50, doc.y, 495, 112).fill(COLORS.light);
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(54).text(results.mbti, 70, doc.y + 25);
  doc.fillColor(COLORS.gold).font('Helvetica-BoldOblique').fontSize(16).text(`${info.title} • ${info.subtitle}`, 225, doc.y + 34, { width: 305 });
  doc.y += 142;
  para(doc, info.description, 11.4);
  sub(doc, 'Your Four Preference Dimensions');
  labels.forEach((label, i) => {
    const x = 50 + i * 128;
    const y = doc.y;
    doc.rect(x, y, 110, 74).fill(COLORS.light);
    doc.fillColor(COLORS.navy).font('Helvetica-BoldOblique').fontSize(25).text(results.mbti[i], x + 18, y + 10);
    doc.fillColor(COLORS.gold).font('Helvetica-Bold').fontSize(7.2).text(label.toUpperCase(), x + 18, y + 47, { width: 82, characterSpacing: 0.4 });
  });

  doc.addPage(); header(doc); title(doc, 'Preference Strength & Integrated Pattern');
  para(doc, mbtiPreferenceText(results));
  sub(doc, 'What the Wider Profile Adds');
  insights.slice(0, 3).forEach((item) => insight(doc, item));
  sub(doc, 'Key Strengths');
  info.strengths.forEach((item) => bullet(doc, item));

  doc.addPage(); header(doc); title(doc, 'Potential Challenges & Development');
  sub(doc, 'Potential Challenges');
  info.challenges.forEach((item) => bullet(doc, item));
  sub(doc, 'Development Pathway');
  bullet(doc, info.growth);
  sub(doc, 'The CONVERGE Perspective');
  para(doc, 'The MBTI result is a description of preferred patterns, not a fixed limit on behaviour. The Big Five and EQ results provide additional evidence about traits and emotional or interpersonal capacities. Where the perspectives agree, the pattern becomes more informative; where they differ, the difference is worth understanding rather than forcing into one label.', 10.7);

  return finish(doc, stream, filePath);
}

export async function generateComprehensiveReport(name: string, results: AssessmentResults, isRecruiter = false, jobData?: any): Promise<string> {
  if (isRecruiter) return generateCandidateSuitabilityV2(name, results, { jobTitle: jobData?.jobTitle, jobEnvironment: jobData?.jobEnvironment, jobChallenge: jobData?.jobChallenge, jobDescription: jobData?.jobDescription });

  const { doc, stream, filePath } = prepareReport(name, 'Comprehensive_Report');
  const info = typeDescriptions[results.mbti];
  const insights = frameworkSummary(results);
  const b = results.bigFive, e = results.ei;

  // PAGE 1 — COVER
  header(doc); title(doc, 'Comprehensive Personality Assessment');
  para(doc, 'CONVERGE brings together three distinct perspectives to provide a broader, more individualised view of how you tend to think, behave and relate. The report should be read as an integrated pattern, not as three unrelated scores.', 11);
  doc.fillColor(COLORS.grey).font('Helvetica-Bold').fontSize(9).text('PREPARED FOR', 50, doc.y + 8, { characterSpacing: 1.5 });
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(27).text(name.toUpperCase(), 50, doc.y + 24);
  doc.fillColor(COLORS.grey).font('Helvetica-Bold').fontSize(9).text('ASSESSMENT DATE', 50, doc.y + 76, { characterSpacing: 1.5 });
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(13).text(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), 50, doc.y + 93);
  doc.y += 145;
  doc.rect(50, doc.y, 495, 105).fill(COLORS.light);
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(44).text(results.mbti, 70, doc.y + 23);
  doc.fillColor(COLORS.gold).font('Helvetica-BoldOblique').fontSize(16).text(`${info.title} • ${info.subtitle}`, 180, doc.y + 35, { width: 340 });
  doc.y += 132;
  para(doc, 'MBTI describes preferences. Big Five describes broad trait tendencies. Emotional Intelligence describes emotional and interpersonal capacities. The value of CONVERGE comes from considering the evidence together.', 11);

  // PAGE 2 — INTEGRATED PROFILE
  doc.addPage(); header(doc); title(doc, 'Your Integrated CONVERGE Profile');
  para(doc, mbtiPreferenceText(results), 10.9);
  insights.forEach((item) => insight(doc, item));
  sub(doc, 'Response Evidence');
  const consistency = results.evidence?.responseConsistency ?? 0;
  para(doc, `The assessment contains ${results.evidence?.expectedCount ?? 76} measurement items. The current response-consistency indicator is ${consistency}/100. This is an interpretive signal, not a validity certificate or a pass/fail judgement.`, 10.3);

  // PAGE 3 — BIG FIVE
  doc.addPage(); header(doc); title(doc, 'Big Five Personality Traits');
  para(doc, 'The Big Five section provides independent trait evidence. Scores are scaled indicators from the CONVERGE response model; they are not population percentiles.', 10.7);
  [['Openness', b.openness], ['Conscientiousness', b.conscientiousness], ['Extraversion', b.extraversion], ['Agreeableness', b.agreeableness], ['Emotional Stability', b.emotionalStability]].forEach(([label, score]) => { scoreBar(doc, String(label), Number(score)); });
  sub(doc, 'Individual Interpretation');
  const bfNarratives: Array<[string, number, string]> = [
    ['Openness', b.openness, b.openness >= 75 ? 'The results suggest a strong tendency toward curiosity, new perspectives and complex ideas.' : b.openness >= 55 ? 'The results suggest a balanced approach to new ideas, with openness influenced by context and purpose.' : 'The results suggest a stronger preference for concrete, familiar or immediately useful information.'],
    ['Conscientiousness', b.conscientiousness, b.conscientiousness >= 75 ? 'The results suggest strong structure, follow-through and attention to completion.' : b.conscientiousness >= 55 ? 'The results suggest reasonable organisation and persistence, with consistency likely to vary by context.' : 'The results suggest that external structure, priorities and accountability may be particularly useful for sustained execution.'],
    ['Extraversion', b.extraversion, b.extraversion >= 75 ? 'The independent Extraversion evidence suggests comfort with active social engagement and outward interaction.' : b.extraversion >= 55 ? 'The independent Extraversion evidence suggests a flexible social style that can adapt to context.' : 'The independent Extraversion evidence suggests that extended outward-facing interaction may require more deliberate energy.'],
    ['Agreeableness', b.agreeableness, b.agreeableness >= 75 ? 'The results suggest strong attention to cooperation, interpersonal consideration and constructive relationships.' : b.agreeableness >= 55 ? 'The results suggest a balanced approach to cooperation and disagreement.' : 'The results suggest a stronger willingness to challenge or prioritise independent judgement over accommodation.'],
    ['Emotional Stability', b.emotionalStability, b.emotionalStability >= 75 ? 'The results suggest comparatively steady emotional functioning under ordinary pressure.' : b.emotionalStability >= 55 ? 'The results suggest reasonable emotional steadiness with some sensitivity to demanding conditions.' : 'The results suggest that sustained pressure may place greater demands on emotional regulation and recovery.'],
  ];
  bfNarratives.forEach(([label, score, text]) => { sub(doc, String(label)); para(doc, String(text), 10.2); });

  // PAGE 4 — EQ
  doc.addPage(); header(doc); title(doc, 'Emotional Intelligence Profile');
  para(doc, 'The EQ section considers five distinct capacities. These are indicators of self-reported tendencies and should be understood as part of the wider evidence pattern.', 10.7);
  [['Self-Awareness', e.selfAwareness], ['Self-Regulation', e.selfRegulation], ['Motivation', e.motivation], ['Empathy', e.empathy], ['Social Skills', e.socialSkills]].forEach(([label, score]) => { scoreBar(doc, String(label), Number(score)); });
  sub(doc, 'Where the EQ Pattern Is Strongest');
  topTwo(e).forEach(([label, score]) => bullet(doc, `${label}: ${score}/100 — this is one of the stronger measured EQ indicators in the profile.`));
  sub(doc, 'Where Development May Add Value');
  lowTwo(e).forEach(([label, score]) => bullet(doc, `${label}: ${score}/100 — this is an area worth understanding and developing rather than treating as a fixed limitation.`));

  // PAGE 5 — PRACTICAL INTEGRATION
  doc.addPage(); header(doc); title(doc, 'Putting the Pattern to Work');
  sub(doc, 'What the Results Suggest');
  insights.slice(0, 5).forEach((item) => insight(doc, item));
  sub(doc, 'Practical Development');
  const development = developmentActions(results);
  development.forEach((item) => bullet(doc, item));
  sub(doc, 'Important Context');
  para(doc, 'CONVERGE is designed to identify useful patterns for reflection and development. The strongest use of the report is to compare these indicators with lived experience, feedback from others and real situations. A result should invite useful questions, not replace judgement.', 10.7);

  return finish(doc, stream, filePath);
}

function topTwo(e: AssessmentResults['ei']): Array<[string, number]> {
  return Object.entries(e).map(([key, value]) => [eqLabel(key), value] as [string, number]).sort((a, b) => b[1] - a[1]).slice(0, 2);
}
function lowTwo(e: AssessmentResults['ei']): Array<[string, number]> {
  return Object.entries(e).map(([key, value]) => [eqLabel(key), value] as [string, number]).sort((a, b) => a[1] - b[1]).slice(0, 2);
}
function eqLabel(key: string): string { return ({ selfAwareness: 'Self-Awareness', selfRegulation: 'Self-Regulation', motivation: 'Motivation', empathy: 'Empathy', socialSkills: 'Social Skills' } as Record<string, string>)[key] || key; }
function developmentActions(r: AssessmentResults): string[] {
  const actions: string[] = [];
  if (r.bigFive.conscientiousness < 65) actions.push('Use explicit priorities, milestones and review points when a project requires sustained follow-through.');
  if (r.bigFive.extraversion < 55) actions.push('Protect recovery time after intensive social demands and prepare deliberately for high-contact situations.');
  if (r.bigFive.extraversion >= 75) actions.push('Use strong outward engagement deliberately, while allowing quieter colleagues or stakeholders room to contribute.');
  if (r.bigFive.emotionalStability < 60 || r.ei.selfRegulation < 60) actions.push('Build practical recovery and regulation routines for periods of sustained pressure.');
  if (r.bigFive.openness < 55) actions.push('When appropriate, deliberately test at least one alternative approach before settling on the familiar solution.');
  if (r.bigFive.openness >= 75) actions.push('Translate strong curiosity and idea generation into prioritised experiments and executable decisions.');
  if (r.ei.empathy < 60 || r.ei.socialSkills < 60) actions.push('Use explicit perspective-taking and communication checks when relationships or stakeholder alignment matter.');
  if (r.ei.selfAwareness < 60) actions.push('Pause periodically to identify the emotion or assumption influencing an important decision.');
  if (!actions.length) actions.push('Use the strongest measured capacities deliberately while continuing to seek feedback in situations where the profile is tested.');
  return actions.slice(0, 6);
}
