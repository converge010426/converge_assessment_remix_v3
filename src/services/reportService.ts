import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { AssessmentResults, typeDescriptions } from '../logic.js';
import { comprehensiveDescriptions } from '../comprehensiveDescriptions.js';
import { CONVERGE_BADGE_PNG_BASE64, CONVERGE_BADGE_ASPECT_RATIO } from '../assets/logo.js';
import { generateCandidateSuitabilityV2 } from './candidateSuitabilityV2.js';

const BADGE = Buffer.from(CONVERGE_BADGE_PNG_BASE64, 'base64');
const COLORS = { navy: '#1a2b4b', gold: '#c5a059', dark: '#111111', grey: '#444444', light: '#f9f7f2' };
const PAGE = { bottom: 735 };

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

function drawHeader(doc: PDFKit.PDFDocument): void {
  const x = 50, y = 34, h = 52;
  const w = h * CONVERGE_BADGE_ASPECT_RATIO;
  const textX = x + w + 14;
  doc.image(BADGE, x, y, { width: w, height: h });
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(29).text('CONVERGE', textX, y + 3, { characterSpacing: 1 });
  const wordmarkWidth = doc.widthOfString('CONVERGE', { characterSpacing: 1 });
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(12).text('TM', textX + wordmarkWidth + 2, y);
  doc.fillColor(COLORS.grey).font('Helvetica-Oblique').fontSize(10.5).text('Three frameworks. One you.', textX, y + 34, { characterSpacing: 0.5 });
  doc.moveTo(x, y + h + 10).lineTo(545, y + h + 10).strokeColor(COLORS.gold).lineWidth(0.75).stroke();
}

function drawFooter(doc: PDFKit.PDFDocument, page: number): void {
  doc.fillColor(COLORS.grey).font('Helvetica-Bold').fontSize(9.5)
    .text(`© ${new Date().getFullYear()} CONVERGE™ • ALL RIGHTS RESERVED • PAGE ${page}`, 50, 762, { width: 495, align: 'center' });
  doc.fillColor(COLORS.grey).font('Helvetica-Oblique').fontSize(8.5)
    .text('This assessment protocol and its integrated psychological architecture are protected intellectual property.', 50, 778, { width: 495, align: 'center' });
}

function pageTitle(doc: PDFKit.PDFDocument, text: string): number {
  doc.fillColor(COLORS.dark).font('Helvetica-Bold').fontSize(19).text(text.toUpperCase(), 50, 112, { width: 495, characterSpacing: 1 });
  doc.moveTo(50, 140).lineTo(545, 140).strokeColor(COLORS.gold).lineWidth(1).stroke();
  return 164;
}

function paragraph(doc: PDFKit.PDFDocument, text: string, y: number, size = 11): number {
  const options = { width: 495, align: 'justify' as const, lineGap: 4 };
  doc.fillColor(COLORS.dark).font('Helvetica').fontSize(size).text(text, 50, y, options);
  return y + doc.heightOfString(text, options) + 14;
}

function subhead(doc: PDFKit.PDFDocument, text: string, y: number): number {
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(13).text(text.toUpperCase(), 50, y, { characterSpacing: 0.8 });
  return y + 22;
}

function bullet(doc: PDFKit.PDFDocument, text: string, y: number, size = 10.5): number {
  const options = { width: 479, lineGap: 3 };
  doc.fillColor(COLORS.gold).circle(55, y + 6, 2.3).fill();
  doc.fillColor(COLORS.dark).font('Helvetica').fontSize(size).text(text, 66, y, options);
  return y + doc.heightOfString(text, options) + 8;
}

function twoColumns(doc: PDFKit.PDFDocument, leftTitle: string, leftItems: string[], rightTitle: string, rightItems: string[], startY: number): number {
  const lx = 50, rx = 305, width = 235;
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(12.5).text(leftTitle.toUpperCase(), lx, startY, { characterSpacing: 0.7 });
  doc.text(rightTitle.toUpperCase(), rx, startY, { characterSpacing: 0.7 });
  let ly = startY + 25, ry = startY + 25;
  const opts = { width: width - 18, lineGap: 3 };
  const count = Math.max(leftItems.length, rightItems.length);
  for (let i = 0; i < count; i++) {
    if (leftItems[i]) {
      doc.fillColor(COLORS.gold).circle(lx + 4, ly + 5, 2.2).fill();
      doc.fillColor(COLORS.dark).font('Helvetica').fontSize(10.3).text(leftItems[i], lx + 14, ly, opts);
      ly += doc.heightOfString(leftItems[i], opts) + 9;
    }
    if (rightItems[i]) {
      doc.fillColor(COLORS.gold).circle(rx + 4, ry + 5, 2.2).fill();
      doc.fillColor(COLORS.dark).font('Helvetica').fontSize(10.3).text(rightItems[i], rx + 14, ry, opts);
      ry += doc.heightOfString(rightItems[i], opts) + 9;
    }
  }
  return Math.max(ly, ry);
}

function scoreBar(doc: PDFKit.PDFDocument, label: string, score: number, y: number): number {
  doc.fillColor(COLORS.dark).font('Helvetica-Bold').fontSize(9.5).text(label.toUpperCase(), 50, y);
  doc.rect(50, y + 16, 495, 9).fill(COLORS.light);
  doc.rect(50, y + 16, Math.max(0, Math.min(100, score)) * 4.95, 9).fill(COLORS.gold);
  doc.fillColor(COLORS.grey).font('Helvetica').fontSize(8.8).text(`${score}/100`, 50, y + 29);
  return y + 47;
}

function finish(doc: PDFKit.PDFDocument, stream: fs.WriteStream, filePath: string): Promise<string> {
  const pages = doc.bufferedPageRange().count;
  for (let i = 0; i < pages; i++) {
    doc.switchToPage(i);
    drawFooter(doc, i + 1);
  }
  doc.end();
  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
}

export async function generateMBTIReport(name: string, results: AssessmentResults): Promise<string> {
  const { doc, stream, filePath } = prepareReport(name, 'MBTI_Report');
  const info = typeDescriptions[results.mbti];
  const dims = [
    results.mbti[0] === 'E' ? 'Extraverted' : 'Introverted',
    results.mbti[1] === 'S' ? 'Sensing' : 'Intuitive',
    results.mbti[2] === 'T' ? 'Thinking' : 'Feeling',
    results.mbti[3] === 'J' ? 'Judging' : 'Perceiving',
  ];

  drawHeader(doc);
  let y = pageTitle(doc, 'MBTI Personality Profile');
  y = paragraph(doc, 'This protocol integrates MBTI, IPIP Big Five, and Emotional Intelligence frameworks to build a verified psychological architecture of your personality profile.', y, 10.8);
  doc.fillColor(COLORS.grey).font('Helvetica-Bold').fontSize(9).text('CANDIDATE NAME', 50, y, { characterSpacing: 1.5 });
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(18).text(name.toUpperCase(), 50, y + 16);
  y += 62;
  doc.rect(50, y, 495, 118).fill(COLORS.light);
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(56).text(results.mbti, 70, y + 25);
  doc.fillColor(COLORS.gold).font('Helvetica-BoldOblique').fontSize(17).text(`${info.title} • ${info.subtitle}`, 235, y + 31, { width: 290 });
  doc.fillColor(COLORS.grey).font('Helvetica-Bold').fontSize(9).text('PERSONALITY PATTERN', 235, y + 70, { characterSpacing: 1 });
  y += 145;
  y = paragraph(doc, info.description, y, 11.5);
  y = Math.max(y + 8, 500);
  dims.forEach((label, i) => {
    const x = 50 + i * 128;
    doc.rect(x, y, 110, 78).fill(COLORS.light);
    doc.fillColor(COLORS.navy).font('Helvetica-BoldOblique').fontSize(25).text(results.mbti[i], x + 18, y + 12);
    doc.fillColor(COLORS.gold).font('Helvetica-Bold').fontSize(7.5).text(label.toUpperCase(), x + 18, y + 49, { width: 85, characterSpacing: 0.5 });
  });

  doc.addPage();
  drawHeader(doc);
  y = pageTitle(doc, 'Core Strengths & Challenges');
  y = twoColumns(doc, 'Key Strengths', info.strengths, 'Potential Challenges', info.challenges, y);
  y += 16;
  y = subhead(doc, 'Behavioural Architecture', y);
  y = paragraph(doc, `As an ${results.mbti}, your psychological profile suggests a combination of ${dims[0].toLowerCase()} energy and ${dims[1].toLowerCase()} processing. This pattern is associated with ${info.title.toLowerCase()}, with strengths that include ${info.strengths[0].toLowerCase()} and ${info.strengths[1].toLowerCase()}.`, y, 11);
  paragraph(doc, `Your approach to problem-solving is also influenced by ${info.strengths[2].toLowerCase()}. The value of this assessment is not in treating the pattern as a fixed label, but in recognising how these tendencies may show up in everyday decisions, relationships and work.`, y, 11);

  doc.addPage();
  drawHeader(doc);
  y = pageTitle(doc, 'Workplace Dynamics & Growth');
  y = subhead(doc, 'Professional Environment', y);
  y = paragraph(doc, info.workplace, y, 11.2);
  y = subhead(doc, 'Development Pathway', y + 6);
  y = paragraph(doc, info.growth, y, 11.2);
  y = subhead(doc, 'Integrated View', y + 8);
  paragraph(doc, 'The MBTI result is one part of your CONVERGE profile. It provides a lens on preferred ways of processing information and making decisions. The wider assessment adds Big Five and EQ indicators so that your profile can be considered from more than one perspective.', y, 11.2);
  return finish(doc, stream, filePath);
}

export async function generateComprehensiveReport(name: string, results: AssessmentResults, isRecruiter: boolean = false, jobData?: any): Promise<string> {
  if (isRecruiter) {
    return generateCandidateSuitabilityV2(name, results, {
      jobTitle: jobData?.jobTitle,
      jobEnvironment: jobData?.jobEnvironment,
      jobChallenge: jobData?.jobChallenge,
      jobDescription: jobData?.jobDescription,
    });
  }

  const { doc, stream, filePath } = prepareReport(name, 'Comprehensive_Report');
  const info = typeDescriptions[results.mbti];
  const comp = comprehensiveDescriptions[results.mbti] || {
    introduction: info.description,
    strengths: info.strengths,
    challenges: info.challenges,
    workplace: { asLeader: info.workplace, asColleague: info.workplace, asSubordinate: info.workplace },
    growth: [info.growth],
  };

  // PAGE 1 — COVER
  drawHeader(doc);
  let y = pageTitle(doc, 'Comprehensive Personality Assessment');
  y = paragraph(doc, 'This protocol integrates MBTI, IPIP Big Five, and Emotional Intelligence frameworks to build a multi-dimensional view of your personality.', y, 11);
  doc.fillColor(COLORS.grey).font('Helvetica-Bold').fontSize(9).text('PREPARED FOR', 50, y + 8, { characterSpacing: 1.5 });
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(27).text(name.toUpperCase(), 50, y + 25);
  doc.fillColor(COLORS.grey).font('Helvetica-Bold').fontSize(9).text('ASSESSMENT DATE', 50, y + 78, { characterSpacing: 1.5 });
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(13).text(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), 50, y + 95);
  y += 150;
  doc.rect(50, y, 495, 105).fill(COLORS.light);
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(44).text(results.mbti, 70, y + 23);
  doc.fillColor(COLORS.gold).font('Helvetica-BoldOblique').fontSize(16).text(`${info.title} • ${info.subtitle}`, 180, y + 35, { width: 340 });
  paragraph(doc, 'The assessment is designed to be read as an integrated profile rather than as three unrelated scores. MBTI describes preferences, Big Five describes broad trait tendencies, and EQ describes emotional and interpersonal capacities.', y + 135, 11);

  // PAGE 2 — METHODOLOGY / PROFILE
  doc.addPage();
  drawHeader(doc);
  y = pageTitle(doc, 'The CONVERGE Methodology');
  y = paragraph(doc, 'The CONVERGE Comprehensive Assessment brings together three distinct perspectives to provide a broader view of how you tend to think, behave and relate. The objective is not to reduce you to a label, but to identify patterns that can be considered together.', y, 11.2);
  y = subhead(doc, 'Your Three Perspectives', y + 5);
  [['MBTI', 'Cognitive preferences and mental models.'], ['BIG FIVE', 'Broad personality traits and behavioural tendencies.'], ['EQ', 'Emotional awareness, regulation and interpersonal effectiveness.']].forEach(([h, b]) => {
    doc.rect(50, y, 495, 60).fill(COLORS.light);
    doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(16).text(h, 65, y + 20);
    doc.fillColor(COLORS.dark).font('Helvetica').fontSize(10.8).text(b, 165, y + 22, { width: 360 });
    y += 74;
  });
  y = subhead(doc, 'Your Profile', y + 2);
  paragraph(doc, comp.introduction, y, 10.7);

  // PAGE 3 — MBTI
  doc.addPage();
  drawHeader(doc);
  y = pageTitle(doc, 'MBTI Architecture');
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(38).text(results.mbti, 50, y);
  doc.fillColor(COLORS.gold).font('Helvetica-BoldOblique').fontSize(17).text(info.title, 175, y + 10, { width: 300 });
  y += 62;
  y = paragraph(doc, comp.introduction, y, 10.5);
  y = subhead(doc, 'Core Strengths', y + 4);
  y = twoColumns(doc, '', comp.strengths.slice(0, 3), '', comp.strengths.slice(3), y - 2);
  if (y < PAGE.bottom - 90) {
    y += 10;
    y = subhead(doc, 'Potential Challenges', y);
    twoColumns(doc, '', comp.challenges.slice(0, 3), '', comp.challenges.slice(3), y - 2);
  }

  // PAGE 4 — WORKPLACE / GROWTH
  doc.addPage();
  drawHeader(doc);
  y = pageTitle(doc, 'Workplace & Growth');
  y = subhead(doc, 'As a Leader', y);
  y = paragraph(doc, comp.workplace.asLeader, y, 10.7);
  y = subhead(doc, 'As a Colleague', y + 3);
  y = paragraph(doc, comp.workplace.asColleague, y, 10.7);
  y = subhead(doc, 'As a Subordinate', y + 3);
  y = paragraph(doc, comp.workplace.asSubordinate, y, 10.7);
  y = subhead(doc, 'Development Pathway', y + 3);
  comp.growth.forEach(item => { if (y < PAGE.bottom - 25) y = bullet(doc, item, y, 10.1); });

  // PAGE 5 — BIG FIVE / EQ
  doc.addPage();
  drawHeader(doc);
  y = pageTitle(doc, 'Big Five & Emotional Intelligence');
  y = subhead(doc, 'IPIP Big Five Factor Model', y);
  const bigFive: [string, number][] = [
    ['Openness', results.bigFive.openness], ['Conscientiousness', results.bigFive.conscientiousness], ['Extraversion', results.bigFive.extraversion], ['Agreeableness', results.bigFive.agreeableness], ['Emotional Stability', results.bigFive.emotionalStability],
  ];
  bigFive.forEach(([label, score]) => { y = scoreBar(doc, label, score, y); });
  y = subhead(doc, 'Emotional Intelligence (EQ)', y + 2);
  const eq: [string, number][] = [
    ['Self-Awareness', results.ei.selfAwareness], ['Self-Regulation', results.ei.selfRegulation], ['Motivation', results.ei.motivation], ['Empathy', results.ei.empathy], ['Social Skills', results.ei.socialSkills],
  ];
  eq.forEach(([label, score]) => { if (y < PAGE.bottom - 45) y = scoreBar(doc, label, score, y); });
  if (y < PAGE.bottom - 20) paragraph(doc, 'These values are assessment indicators from the current CONVERGE scoring model. They are most useful when read as a pattern across dimensions rather than as population rankings.', y, 9.5);

  return finish(doc, stream, filePath);
}
