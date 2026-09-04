import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { AssessmentResults, typeDescriptions } from '../logic.js';
import { comprehensiveDescriptions } from '../comprehensiveDescriptions.js';
import settings from '../../CONVERGE_SETTINGS.json' with { type: 'json' };
import { CONVERGE_BADGE_PNG_BASE64, CONVERGE_BADGE_ASPECT_RATIO } from '../assets/logo.js';

const SYSTEM_VERSION = settings.SYSTEM_VERSION;

// Round CONVERGE badge (brain + "C" mark) used in the report letterhead.
// Loaded from an embedded base64 constant (rather than reading a file from
// disk) so it renders identically in local dev and on Vercel without needing
// public/ to be part of the serverless function bundle. It's cropped from
// the approved circular badge with the baked-in wordmark/taglines removed —
// those are set separately below in crisp vector type, which stays legible
// at letterhead size where the source art's own type would not. Transparent
// outside the dome so it drops cleanly onto both white and navy pages.
const CONVERGE_BADGE = Buffer.from(CONVERGE_BADGE_PNG_BASE64, 'base64');

// Picks "a" or "an" for a trait phrase used as an adjective ahead of a noun,
// e.g. traitWithArticle('Open-minded') -> 'an open-minded'.
function traitWithArticle(trait: string): string {
  const lower = trait.toLowerCase();
  const article = /^[aeiou]/.test(lower) ? 'an' : 'a';
  return `${article} ${lower}`;
}

interface LetterheadColors {
  navy: string;
  gold: string;
  dark: string;
  grey: string;
}

/**
 * CONVERGE report identity standard.
 *
 * Draws the badge + CONVERGE™ + "Three frameworks. One you." unit that must
 * appear, identically, at the top of every page of every CONVERGE report.
 * Nothing else belongs in this block — no pricing, no system version, no
 * extra marketing lines. Sized to sit comfortably alongside a 20-24pt page
 * title rather than reading as a small afterthought. Returns the
 * y-coordinate immediately below the letterhead's rule, so callers know
 * where it is safe to start page content.
 *
 * `onDark` switches to a light-on-navy treatment for use on dark cover art;
 * the default is the restrained navy-on-white treatment used everywhere
 * else (all report cover pages are white by design — see item 1 below).
 */
function drawLetterhead(doc: PDFKit.PDFDocument, colors: LetterheadColors, onDark: boolean = false): number {
  const { navy, gold, grey } = colors;
  const startX = 50;
  const startY = 34;
  const badgeHeight = 52;
  const badgeWidth = badgeHeight * CONVERGE_BADGE_ASPECT_RATIO;
  const textX = startX + badgeWidth + 14;

  const wordmarkColor = onDark ? gold : navy;
  const taglineColor = onDark ? '#ffffff' : grey;

  doc.image(CONVERGE_BADGE, startX, startY, { width: badgeWidth, height: badgeHeight });

  doc
    .fillColor(wordmarkColor)
    .font('Helvetica-Bold')
    .fontSize(29)
    .text('CONVERGE', textX, startY + 3, { characterSpacing: 1 });

  const wordmarkWidth = doc.widthOfString('CONVERGE', { characterSpacing: 1 });

  doc
    .fillColor(wordmarkColor)
    .font('Helvetica-Bold')
    .fontSize(12)
    .text('TM', textX + wordmarkWidth + 2, startY);

  doc
    .fillColor(taglineColor)
    .font('Helvetica-Oblique')
    .fontSize(10.5)
    .text('Three frameworks. One you.', textX, startY + 34, { characterSpacing: 0.5 });

  const ruleY = startY + badgeHeight + 10;
  doc
    .moveTo(startX, ruleY)
    .lineTo(545, ruleY)
    .strokeColor(gold)
    .lineWidth(0.75)
    .stroke();

  return ruleY + 14;
}

/**
 * CONVERGE report footer standard.
 *
 * Draws the copyright/page line plus the approved intellectual-property
 * statement (sourced verbatim from the live app's footer at /job-context)
 * on every page of every report — matching the letterhead's "every page"
 * requirement on the way out of the document, not just the way in.
 */
function drawReportFooter(doc: PDFKit.PDFDocument, colors: LetterheadColors, pageNumber: number): void {
  const { grey } = colors;

  doc
    .fillColor(grey)
    .fontSize(9.5)
    .font('Helvetica-Bold')
    .text(`© ${new Date().getFullYear()} CONVERGE™ • ALL RIGHTS RESERVED • PAGE ${pageNumber}`, 50, 762, { align: 'center' });

  doc
    .fillColor(grey)
    .fontSize(8.5)
    .font('Helvetica-Oblique')
    .text('This assessment protocol and its integrated psychological architecture are protected intellectual property.', 50, 778, { align: 'center', width: 495 });
}

export async function generateMBTIReport(name: string, results: AssessmentResults): Promise<string> {
  const doc = new PDFDocument({
    margin: 50,
    size: 'A4',
    bufferPages: true,
  });

  const reportsDir = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), 'reports');
  console.log(`[ReportService] Generating MBTI report for ${name}. Reports dir: ${reportsDir}`);
  try {
    if (!fs.existsSync(reportsDir)) {
      console.log(`[ReportService] Creating reports directory: ${reportsDir}`);
      fs.mkdirSync(reportsDir, { recursive: true });
    }
  } catch (err: any) {
    console.error(`[ReportService] Failed to create reports directory at ${reportsDir}:`, err.message);
    throw new Error(`FileSystem Error: ${err.message}`);
  }

  const sanitizedName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const fileName = `MBTI_Report_${sanitizedName}_${Date.now()}.pdf`;
  const filePath = path.join(reportsDir, fileName);
  const stream = fs.createWriteStream(filePath);

  doc.pipe(stream);

  // --- PAGE 1: SUMMARY ---
  // Branding Colors
  const navy = '#1a2b4b';
  const gold = '#c5a059';
  const dark = '#111111';
  const grey = '#444444';
  const lightGrey = '#f9f7f2';

  // Letterhead (CONVERGE report identity standard — badge + CONVERGE™ + tagline)
  drawLetterhead(doc, { navy, gold, dark, grey });

  // Report Title
  doc
    .fillColor(dark)
    .fontSize(22)
    .font('Helvetica-Bold')
    .text('MBTI PERSONALITY PROFILE', 50, 118);

  doc
    .fillColor(grey)
    .fontSize(11)
    .font('Helvetica-Oblique')
    .text('This protocol integrates MBTI, IPIP Big Five, and Emotional Intelligence frameworks to build a verified psychological architecture of your personality profile.', 50, 150, { width: 495, align: 'justify' });

  doc
    .moveTo(50, 182)
    .lineTo(545, 182)
    .strokeColor(gold)
    .lineWidth(1)
    .stroke();

  // Candidate Info
  doc
    .fillColor(grey)
    .fontSize(10)
    .font('Helvetica-Bold')
    .text('CANDIDATE NAME', 50, 202, { characterSpacing: 2 })
    .fillColor(navy)
    .fontSize(18)
    .text(name.toUpperCase(), 50, 217);

  doc
    .fillColor(grey)
    .fontSize(10)
    .font('Helvetica-Bold')
    .text('ASSESSMENT DATE', 350, 202, { characterSpacing: 2 })
    .fillColor(navy)
    .fontSize(14)
    .text(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), 350, 217);

  // MBTI Type Result
  const typeInfo = typeDescriptions[results.mbti];
  
  doc
    .rect(50, 272, 495, 120)
    .fill(lightGrey);

  doc
    .fillColor(navy)
    .fontSize(60)
    .font('Helvetica-Bold')
    .text(results.mbti, 70, 292);

  doc
    .fillColor(gold)
    .fontSize(18)
    .font('Helvetica-BoldOblique')
    .text(`${typeInfo.title} • ${typeInfo.subtitle}`, 240, 297);

  doc
    .fillColor(grey)
    .fontSize(10)
    .font('Helvetica-Bold')
    .text('VERIFIED PSYCHOLOGICAL ARCHITECTURE', 240, 337, { characterSpacing: 1 });

  // Description
  doc
    .fillColor(dark)
    .fontSize(13)
    .font('Helvetica')
    .text(typeInfo.description, 50, 422, {
      align: 'justify',
      lineGap: 5,
      width: 495,
      height: 100, // Limit height to prevent overlap with dimensions
      ellipsis: true
    });

  // Dimensions
  const dimensions = [
    { char: results.mbti[0], label: results.mbti[0] === 'E' ? 'Extraverted' : 'Introverted' },
    { char: results.mbti[1], label: results.mbti[1] === 'S' ? 'Sensing' : 'Intuitive' },
    { char: results.mbti[2], label: results.mbti[2] === 'T' ? 'Thinking' : 'Feeling' },
    { char: results.mbti[3], label: results.mbti[3] === 'J' ? 'Judging' : 'Perceiving' },
  ];

  let xPos = 50;
  dimensions.forEach((dim) => {
    doc
      .rect(xPos, 542, 110, 80)
      .fill(lightGrey);
    
    doc
      .fillColor(navy)
      .fontSize(30)
      .font('Helvetica-BoldOblique')
      .text(dim.char, xPos + 20, 557);
    
    doc
      .fillColor(gold)
      .fontSize(8.5)
      .font('Helvetica-Bold')
      .text(dim.label.toUpperCase(), xPos + 20, 597, { characterSpacing: 1 });
    
    xPos += 128;
  });

  // Footer
  drawReportFooter(doc, { navy, gold, dark, grey }, 1);

  // --- PAGE 2: DETAILED ANALYSIS ---
  doc.addPage();

  // Letterhead (CONVERGE report identity standard)
  drawLetterhead(doc, { navy, gold, dark, grey });

  doc
    .fillColor(dark)
    .fontSize(18)
    .font('Helvetica-Bold')
    .text('CORE STRENGTHS & CHALLENGES', 50, 115);

  doc
    .moveTo(50, 140)
    .lineTo(545, 140)
    .strokeColor(gold)
    .lineWidth(1)
    .stroke();

  // Side-by-Side: Strengths and Challenges
  const colWidth = 230;
  const leftCol = 50;
  const rightCol = 315;
  let yStart = 170;

  // Strengths Header
  doc
    .fillColor(navy)
    .fontSize(14)
    .font('Helvetica-Bold')
    .text('KEY STRENGTHS', leftCol, yStart, { characterSpacing: 1 });

  // Challenges Header
  doc
    .text('POTENTIAL CHALLENGES', rightCol, yStart, { characterSpacing: 1 });

  let yPosLeft = yStart + 36;
  typeInfo.strengths.forEach((strength) => {
    doc
      .circle(leftCol + 5, yPosLeft + 6, 2.5)
      .fill(gold);
    
    doc
      .fillColor(dark)
      .fontSize(13)
      .font('Helvetica')
      .text(strength, leftCol + 16, yPosLeft, { width: colWidth - 20 });
    
    yPosLeft += 38;
  });

  let yPosRight = yStart + 36;
  typeInfo.challenges.forEach((challenge) => {
    doc
      .circle(rightCol + 5, yPosRight + 6, 2.5)
      .fill(gold);
    
    doc
      .fillColor(dark)
      .fontSize(13)
      .font('Helvetica')
      .text(challenge, rightCol + 16, yPosRight, { width: colWidth - 20 });
    
    yPosRight += 38;
  });

  // Behavioural Architecture — boxed to match the visual weight of the
  // result panel on page 1, and to use the page's vertical space properly
  // rather than trailing off into blank space beneath a short paragraph.
  const yArch = Math.max(yPosLeft, yPosRight) + 35;
  const archBoxHeight = 230;

  doc
    .rect(50, yArch, 495, archBoxHeight)
    .fill(lightGrey);

  doc
    .fillColor(navy)
    .fontSize(16)
    .font('Helvetica-Bold')
    .text('BEHAVIOURAL ARCHITECTURE', 75, yArch + 30);

  doc
    .moveTo(75, yArch + 55)
    .lineTo(520, yArch + 55)
    .strokeColor(gold)
    .lineWidth(0.75)
    .stroke();

  doc
    .fillColor(dark)
    .fontSize(13)
    .font('Helvetica')
    .text(`As an ${results.mbti}, your psychological profile suggests a unique combination of ${dimensions[0].label.toLowerCase()} energy and ${dimensions[1].label.toLowerCase()} processing. This architecture manifests as ${typeInfo.title.toLowerCase()}, who values ${typeInfo.strengths[0].toLowerCase()} and ${typeInfo.strengths[1].toLowerCase()}.

Your approach to problem-solving is defined by ${traitWithArticle(typeInfo.strengths[2])} approach, allowing you to navigate complex professional landscapes with precision.`, 75, yArch + 75, {
      width: 445,
      align: 'justify',
      lineGap: 6,
      paragraphGap: 10,
    });

  // Footer
  drawReportFooter(doc, { navy, gold, dark, grey }, 2);

  // --- PAGE 3: WORKPLACE & GROWTH ---
  doc.addPage();

  // Letterhead (CONVERGE report identity standard)
  drawLetterhead(doc, { navy, gold, dark, grey });

  doc
    .fillColor(dark)
    .fontSize(18)
    .font('Helvetica-Bold')
    .text('WORKPLACE DYNAMICS & GROWTH', 50, 115);

  doc
    .moveTo(50, 140)
    .lineTo(545, 140)
    .strokeColor(gold)
    .lineWidth(1)
    .stroke();

  // Side-by-Side: Workplace and Growth
  yStart = 170;

  doc
    .fillColor(navy)
    .fontSize(14)
    .font('Helvetica-Bold')
    .text('PROFESSIONAL ENVIRONMENT', leftCol, yStart, { characterSpacing: 1 });

  doc
    .text('DEVELOPMENT PATHWAY', rightCol, yStart, { characterSpacing: 1 });

  const workplaceTextOptions = { width: colWidth, align: 'justify' as const, lineGap: 6 };
  const growthTextOptions = { width: colWidth, align: 'justify' as const, lineGap: 6 };

  doc
    .fillColor(dark)
    .fontSize(13)
    .font('Helvetica')
    .text(typeInfo.workplace, leftCol, yStart + 34, workplaceTextOptions);

  doc
    .text(typeInfo.growth, rightCol, yStart + 34, growthTextOptions);

  const workplaceHeight = doc.heightOfString(typeInfo.workplace, workplaceTextOptions);
  const growthHeight = doc.heightOfString(typeInfo.growth, growthTextOptions);

  // Final Verdict — sized and positioned to use the remaining page height
  // properly rather than leaving a large gap above the footer, but capped to
  // its own content so the box itself doesn't trail off into empty space.
  const verdictY = yStart + 34 + Math.max(workplaceHeight, growthHeight) + 40;
  const verdictText = `The ${results.mbti} profile represents a highly consistent psychological structure. In the context of the CONVERGE™ protocol, this result serves as the foundational layer for your integrated personality architecture. This assessment integrates MBTI typology with IPIP Big Five clinical data and Emotional Intelligence metrics to provide a verified representation of current psychological predispositions.`;
  const verdictTextOptions = { width: 445, align: 'justify' as const, lineGap: 6 };
  const verdictTextHeight = doc.heightOfString(verdictText, verdictTextOptions);
  const verdictHeight = Math.min(Math.max(verdictTextHeight + 110, 190), 745 - verdictY);

  doc
    .rect(50, verdictY, 495, verdictHeight)
    .fill(lightGrey);

  doc
    .fillColor(navy)
    .fontSize(15)
    .font('Helvetica-Bold')
    .text('CONVERGE™ INTEGRATED VERDICT', 75, verdictY + 28, { characterSpacing: 1 });

  doc
    .moveTo(75, verdictY + 52)
    .lineTo(520, verdictY + 52)
    .strokeColor(gold)
    .lineWidth(0.75)
    .stroke();

  doc
    .fillColor(dark)
    .fontSize(13)
    .font('Helvetica-Oblique')
    .text(verdictText, 75, verdictY + 72, verdictTextOptions);

  // Footer
  drawReportFooter(doc, { navy, gold, dark, grey }, 3);

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
}

export async function generateComprehensiveReport(name: string, results: AssessmentResults, isRecruiter: boolean = false, jobData?: any): Promise<string> {
  const doc = new PDFDocument({
    margin: 50,
    size: 'A4',
    bufferPages: true,
  });

  const reportsDir = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), 'reports');
  console.log(`[ReportService] Generating Comprehensive report for ${name}. Reports dir: ${reportsDir}`);
  try {
    if (!fs.existsSync(reportsDir)) {
      console.log(`[ReportService] Creating reports directory: ${reportsDir}`);
      fs.mkdirSync(reportsDir, { recursive: true });
    }
  } catch (err: any) {
    console.error(`[ReportService] Failed to create reports directory at ${reportsDir}:`, err.message);
    throw new Error(`FileSystem Error: ${err.message}`);
  }

  const sanitizedName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const reportType = isRecruiter ? 'Candidate_Suitability' : 'Comprehensive';
  const fileName = `${reportType}_Report_${sanitizedName}_${Date.now()}.pdf`;
  const filePath = path.join(reportsDir, fileName);
  const stream = fs.createWriteStream(filePath);

  doc.pipe(stream);

  // Branding Colors
  const navy = '#1a2b4b';
  const gold = '#c5a059';
  const dark = '#111111';
  const grey = '#444444';
  const lightGrey = '#f9f7f2';

  // --- PAGE 1: COVER ---
  // A restrained white cover — the report identity standard, then the title
  // and candidate details. No full-bleed navy background.

  // Letterhead (CONVERGE report identity standard)
  drawLetterhead(doc, { navy, gold, dark, grey });

  const coverTitle = isRecruiter ? 'CANDIDATE SUITABILITY ASSESSMENT' : 'COMPREHENSIVE PERSONALITY ASSESSMENT';
  const coverTitleWidth = 495;
  const coverTitleOptions = { characterSpacing: 1.5, width: coverTitleWidth };

  doc
    .fillColor(dark)
    .fontSize(20)
    .font('Helvetica-Bold');

  const coverTitleHeight = doc.heightOfString(coverTitle, coverTitleOptions);
  doc.text(coverTitle, 50, 165, coverTitleOptions);

  const coverRuleY = 165 + coverTitleHeight + 20;
  doc
    .moveTo(50, coverRuleY)
    .lineTo(545, coverRuleY)
    .strokeColor(gold)
    .lineWidth(1)
    .stroke();

  doc
    .fillColor(grey)
    .fontSize(11.5)
    .font('Helvetica-Oblique')
    .text('This protocol integrates MBTI, IPIP Big Five, and Emotional Intelligence frameworks to build a verified psychological architecture.', 50, coverRuleY + 18, { width: 495 });

  doc
    .fillColor(grey)
    .fontSize(10)
    .font('Helvetica-Bold')
    .text('PREPARED FOR', 50, coverRuleY + 65, { characterSpacing: 2 })
    .fillColor(navy)
    .fontSize(28)
    .font('Helvetica-Bold')
    .text(name.toUpperCase(), 50, coverRuleY + 82);

  doc
    .fillColor(grey)
    .fontSize(10)
    .font('Helvetica-Bold')
    .text('DATE', 50, coverRuleY + 150, { characterSpacing: 2 })
    .fillColor(navy)
    .fontSize(16)
    .font('Helvetica-Bold')
    .text(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), 50, coverRuleY + 168);


  // --- PAGE 2: INTRODUCTION ---
  doc.addPage();
  
  // Letterhead (CONVERGE report identity standard), then the existing page
  // content — unchanged relative layout — nudged down to sit below it.
  drawLetterhead(doc, { navy, gold, dark, grey });
  doc.save();
  doc.translate(0, 108);

  doc
    .rect(0, 0, doc.page.width, 100)
    .fill(navy);

  doc
    .fillColor(gold)
    .fontSize(18)
    .font('Helvetica-Bold')
    .text('INTRODUCTION', 50, 40, { characterSpacing: 2 });

  if (isRecruiter) {
    doc
      .fillColor('#ffffff')
      .fontSize(8)
      .font('Helvetica-Bold')
      .text('CANDIDATE SUITABILITY REPORT', 50, 75, { characterSpacing: 1 });
  }

  doc
    .fillColor(dark)
    .fontSize(15)
    .font('Helvetica-Bold')
    .text('The Converge Methodology', 50, 130);

  const introPara1 = isRecruiter
    ? 'The Converge Candidate Suitability Assessment is a multi-dimensional psychological protocol designed for hiring managers to evaluate a candidate\'s fit within a specific organizational context. It integrates three of the most robust frameworks in modern personality science: the Myers-Briggs Type Indicator (MBTI), the IPIP Big Five Factor Model, and Emotional Intelligence (EQ) metrics.'
    : 'The Converge Comprehensive Assessment is a multi-dimensional psychological protocol that integrates three of the most robust frameworks in modern personality science: the Myers-Briggs Type Indicator (MBTI), the IPIP Big Five Factor Model, and Emotional Intelligence (EQ) metrics.';
  const introPara2 = isRecruiter
    ? 'By converging these three distinct perspectives, we provide recruiters and HR professionals with a verified psychological architecture of the candidate. This report explores their cognitive preferences, behavioral tendencies, and emotional capacities to provide a complete picture of how they will navigate the workplace, interact with team members, and manage professional challenges.'
    : 'By converging these three distinct perspectives, we move beyond simple labels to provide a verified psychological architecture of your personality. This report explores your cognitive preferences, your behavioral tendencies, and your emotional capacities to give you a complete picture of how you navigate the world, interact with others, and manage your internal state.';
  const introParaOptions = { width: 495, align: 'justify' as const, lineGap: 5 };
  const introPara1Y = 165;

  doc
    .fillColor(dark)
    .fontSize(12.5)
    .font('Helvetica')
    .text(introPara1, 50, introPara1Y, introParaOptions);

  const introPara2Y = introPara1Y + doc.heightOfString(introPara1, introParaOptions) + 18;
  doc.text(introPara2, 50, introPara2Y, introParaOptions);

  // Frameworks Table
  const frameworks = [
    { title: 'MBTI', desc: 'Cognitive preferences and mental models.' },
    { title: 'BIG FIVE', desc: 'Core personality traits and behavioral patterns.' },
    { title: 'EQ', desc: 'Emotional awareness and interpersonal effectiveness.' }
  ];

  let yPos = introPara2Y + doc.heightOfString(introPara2, introParaOptions) + 35;
  frameworks.forEach(f => {
    doc
      .rect(50, yPos, 100, 60)
      .fill(lightGrey);
    
    doc
      .fillColor(navy)
      .fontSize(17)
      .font('Helvetica-Bold')
      .text(f.title, 65, yPos + 20);
    
    doc
      .fillColor(dark)
      .fontSize(11)
      .font('Helvetica')
      .text(f.desc, 165, yPos + 25, { width: 380 });
    
    yPos += 75;
  });

  doc.restore();

  // --- PAGE 3: MBTI DEEP DIVE ---
  doc.addPage();

  drawLetterhead(doc, { navy, gold, dark, grey });
  doc.save();
  doc.translate(0, 108);

  doc
    .rect(0, 0, doc.page.width, 100)
    .fill(navy);

  doc
    .fillColor(gold)
    .fontSize(18)
    .font('Helvetica-Bold')
    .text('MBTI ARCHITECTURE', 50, 40, { characterSpacing: 2 });

  // `workplace` is intentionally omitted here (rather than set to "N/A"
  // placeholders) so that the MBTI-based dynamic generator further down
  // (`workplaceDynamics = compDesc.workplace || {...}`) actually runs when
  // this fallback is used, instead of being permanently short-circuited by
  // an always-truthy placeholder object.
  const compDesc = comprehensiveDescriptions[results.mbti] || {
    introduction: typeDescriptions[results.mbti].description,
    strengths: typeDescriptions[results.mbti].strengths,
    challenges: typeDescriptions[results.mbti].challenges,
    growth: [typeDescriptions[results.mbti].growth]
  };

  doc
    .fillColor(navy)
    .fontSize(40)
    .font('Helvetica-Bold')
    .text(results.mbti, 50, 130);

  doc
    .fillColor(gold)
    .fontSize(18)
    .font('Helvetica-BoldOblique')
    .text(typeDescriptions[results.mbti].title, 180, 145);

  doc
    .fillColor(dark)
    .fontSize(12.5)
    .font('Helvetica')
    .text(compDesc.introduction, 50, 200, { width: 495, align: 'justify', lineGap: 5 });

  doc
    .fillColor(navy)
    .fontSize(15)
    .font('Helvetica-Bold')
    .text('Core Strengths', 50, 320);

  yPos = 345;
  compDesc.strengths.forEach(s => {
    doc
      .circle(55, yPos + 6, 2)
      .fill(gold);
    doc
      .fillColor(dark)
      .fontSize(11.5)
      .font('Helvetica')
      .text(s, 65, yPos, { width: 480 });
    yPos += 27;
  });

  doc
    .fillColor(navy)
    .fontSize(15)
    .font('Helvetica-Bold')
    .text('Potential Challenges', 50, yPos + 20);

  yPos += 45;
  compDesc.challenges.forEach(c => {
    doc
      .circle(55, yPos + 6, 2)
      .fill(gold);
    doc
      .fillColor(dark)
      .fontSize(11.5)
      .font('Helvetica')
      .text(c, 65, yPos, { width: 480 });
    yPos += 27;
  });

  doc.restore();

  // --- PAGE 4: WORKPLACE & GROWTH ---
  doc.addPage();

  drawLetterhead(doc, { navy, gold, dark, grey });
  doc.save();
  doc.translate(0, 108);

  doc
    .rect(0, 0, doc.page.width, 100)
    .fill(navy);

  doc
    .fillColor(gold)
    .fontSize(18)
    .font('Helvetica-Bold')
    .text('WORKPLACE & GROWTH', 50, 40, { characterSpacing: 2 });

  // Workplace Dynamics Fallback
  const workplaceDynamics = compDesc.workplace || {
    asLeader: `As a leader, you tend to be ${results.mbti.includes('J') ? 'highly organized and goal-oriented' : 'flexible and adaptive'}. You focus on ${results.mbti.includes('T') ? 'logical outcomes' : 'team harmony'} and expect excellence from your team.`,
    asColleague: `As a colleague, you are likely ${results.mbti.includes('E') ? 'collaborative and outgoing' : 'focused and independent'}. You value ${results.mbti.includes('S') ? 'practicality' : 'innovation'} in your professional relationships.`,
    asSubordinate: `As a subordinate, you work best when given ${results.mbti.includes('J') ? 'clear structure' : 'creative freedom'}. You respect competence and are motivated by ${results.mbti.includes('F') ? 'appreciation' : 'results'}.`
  };

  doc
    .fillColor(navy)
    .fontSize(15)
    .font('Helvetica-Bold')
    .text('Workplace Dynamics', 50, 130);

  doc
    .fillColor(gold)
    .fontSize(10)
    .font('Helvetica-Bold')
    .text('AS A LEADER', 50, 160)
    .fillColor(dark)
    .fontSize(12)
    .font('Helvetica')
    .text(workplaceDynamics.asLeader, 50, 178, { width: 495, lineGap: 3 });

  doc
    .fillColor(gold)
    .fontSize(10)
    .font('Helvetica-Bold')
    .text('AS A COLLEAGUE', 50, 253)
    .fillColor(dark)
    .fontSize(12)
    .font('Helvetica')
    .text(workplaceDynamics.asColleague, 50, 271, { width: 495, lineGap: 3 });

  doc
    .fillColor(gold)
    .fontSize(10)
    .font('Helvetica-Bold')
    .text('AS A SUBORDINATE', 50, 346)
    .fillColor(dark)
    .fontSize(12)
    .font('Helvetica')
    .text(workplaceDynamics.asSubordinate, 50, 364, { width: 495, lineGap: 3 });

  doc
    .fillColor(navy)
    .fontSize(15)
    .font('Helvetica-Bold')
    .text('Development Pathway', 50, 440);

  yPos = 465;
  compDesc.growth.forEach(g => {
    doc
      .circle(55, yPos + 6, 2)
      .fill(gold);
    doc
      .fillColor(dark)
      .fontSize(11.5)
      .font('Helvetica')
      .text(g, 65, yPos, { width: 480 });
    yPos += 27;
  });

  doc.restore();

  // --- PAGE 5: BIG FIVE & EQ ---
  doc.addPage();

  drawLetterhead(doc, { navy, gold, dark, grey });
  doc.save();
  doc.translate(0, 108);

  doc
    .rect(0, 0, doc.page.width, 100)
    .fill(navy);

  doc
    .fillColor(gold)
    .fontSize(18)
    .font('Helvetica-Bold')
    .text('BEHAVIORAL & EMOTIONAL METRICS', 50, 40, { characterSpacing: 2 });

  // Big Five Section
  doc
    .fillColor(navy)
    .fontSize(16)
    .font('Helvetica-Bold')
    .text('IPIP Big Five Factor Model', 50, 130);

  const bigFiveData = [
    { label: 'Openness', score: results.bigFive.openness, desc: 'Curiosity, creativity, and openness to new experiences.' },
    { label: 'Conscientiousness', score: results.bigFive.conscientiousness, desc: 'Organization, dependability, and discipline.' },
    { label: 'Extraversion', score: results.bigFive.extraversion, desc: 'Sociability, assertiveness, and emotional expressiveness.' },
    { label: 'Agreeableness', score: results.bigFive.agreeableness, desc: 'Trust, altruism, and kindness.' },
    { label: 'Neuroticism', score: results.bigFive.emotionalStability, desc: 'Emotional stability and impulse control.' }
  ];

  yPos = 160;
  bigFiveData.forEach(trait => {
    doc
      .fillColor(dark)
      .fontSize(10)
      .font('Helvetica-Bold')
      .text(trait.label.toUpperCase(), 50, yPos);
    
    // Progress Bar
    doc
      .rect(50, yPos + 15, 495, 10)
      .fill(lightGrey);
    doc
      .rect(50, yPos + 15, (trait.score / 100) * 495, 10)
      .fill(gold);
    
    doc
      .fillColor(grey)
      .fontSize(9)
      .font('Helvetica')
      .text(trait.desc, 50, yPos + 30);
    
    yPos += 50;
  });

  // EQ Section
  doc
    .fillColor(navy)
    .fontSize(16)
    .font('Helvetica-Bold')
    .text('Emotional Intelligence (EQ)', 50, yPos + 20);

  const eqData = [
    { label: 'Self-Awareness', score: results.ei.selfAwareness },
    { label: 'Self-Regulation', score: results.ei.selfRegulation },
    { label: 'Motivation', score: results.ei.motivation },
    { label: 'Empathy', score: results.ei.empathy },
    { label: 'Social Skills', score: results.ei.socialSkills }
  ];

  yPos += 50;
  eqData.forEach(trait => {
    doc
      .fillColor(dark)
      .fontSize(10)
      .font('Helvetica-Bold')
      .text(trait.label.toUpperCase(), 50, yPos);
    
    doc
      .rect(50, yPos + 15, 495, 10)
      .fill(lightGrey);
    doc
      .rect(50, yPos + 15, (trait.score / 100) * 495, 10)
      .fill(navy);
    
    yPos += 36;
  });

  doc.restore();

  // --- RECRUITER SECTION (IF APPLICABLE) ---
  if (isRecruiter) {
    doc.addPage();

    drawLetterhead(doc, { navy, gold, dark, grey });
    doc.save();
    doc.translate(0, 108);

    doc
      .rect(0, 0, doc.page.width, 100)
      .fill(navy);

    doc
      .fillColor(gold)
      .fontSize(18)
      .font('Helvetica-Bold')
      .text('SUITABILITY ANALYSIS', 50, 40, { characterSpacing: 2 });

    doc
      .fillColor(dark)
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('Role Definition', 50, 130);

    // Job Context Box
    doc
      .rect(50, 155, 495, 110)
      .fill(lightGrey);

    doc
      .fillColor(grey)
      .fontSize(8)
      .font('Helvetica-Bold')
      .text('TARGET POSITION', 65, 170, { characterSpacing: 1 })
      .fillColor(navy)
      .fontSize(14)
      .text(jobData?.jobTitle?.toUpperCase() || 'NOT SPECIFIED', 65, 185, { width: 210 });

    doc
      .fillColor(grey)
      .fontSize(8)
      .font('Helvetica-Bold')
      .text('ENVIRONMENT', 300, 170, { characterSpacing: 1 })
      .fillColor(navy)
      .fontSize(12)
      .text(jobData?.jobEnvironment || 'NOT SPECIFIED', 300, 185);

    doc
      .fillColor(grey)
      .fontSize(8)
      .font('Helvetica-Bold')
      .text('KEY CHALLENGE', 65, 230, { characterSpacing: 1 })
      .fillColor(dark)
      .fontSize(10)
      .font('Helvetica')
      .text(jobData?.jobChallenge || 'NOT SPECIFIED', 65, 245, { width: 460 });

    doc
      .fillColor(navy)
      .fontSize(15)
      .font('Helvetica-Bold')
      .text('Executive Summary for Hiring Managers', 50, 280);

    const execSummaryText = `Candidate ${name} presents a robust ${results.mbti} profile, characterized by high-level cognitive agility and ${results.mbti.includes('J') ? 'structured execution' : 'adaptive problem-solving'}. In the context of a ${jobData?.jobEnvironment || 'professional'} environment, their natural tendencies suggest a strong alignment with roles requiring ${results.mbti.includes('T') ? 'analytical rigor' : 'interpersonal empathy'}.`;
    const execSummaryOptions = { width: 495, lineGap: 5, align: 'justify' as const };
    const execSummaryY = 308;

    doc
      .fillColor(dark)
      .font('Helvetica')
      .fontSize(12)
      .text(execSummaryText, 50, execSummaryY, execSummaryOptions);

    const execSummaryHeight = doc.heightOfString(execSummaryText, execSummaryOptions);
    const suitIndicatorsY = execSummaryY + execSummaryHeight + 20;

    doc
      .fillColor(navy)
      .fontSize(13)
      .font('Helvetica-Bold')
      .text('Suitability Indicators', 50, suitIndicatorsY);
    
    const suitabilityPoints = [
      { label: 'Leadership Potential', value: results.ei.socialSkills > 70 ? 'High' : 'Moderate', detail: results.ei.socialSkills > 70 ? 'Natural influencer' : 'Individual contributor focus' },
      { label: 'Stress Tolerance', value: results.ei.selfRegulation > 65 ? 'Stable' : 'Adaptive', detail: results.ei.selfRegulation > 65 ? 'High resilience' : 'Needs supportive environment' },
      { label: 'Strategic Thinking', value: results.mbti.includes('N') ? 'Exceptional' : 'Practical', detail: results.mbti.includes('N') ? 'Future oriented' : 'Detail oriented' },
      { label: 'Team Collaboration', value: results.mbti.includes('E') ? 'Active' : 'Focused', detail: results.mbti.includes('E') ? 'Energized by groups' : 'Focused - Prefers deep work' }
    ];
    
    // Fixed-column layout: each column gets an explicit x/width, rather than
    // relying on PDFKit's ambient cursor position (doc.x) after a previous
    // .text() call, which does not reliably track "end of that text" and was
    // causing the value/detail text to render on top of each other.
    let suitY = suitIndicatorsY + 30;
    suitabilityPoints.forEach(point => {
      doc
        .fillColor(dark)
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(point.label + ':', 50, suitY, { width: 125 });
      
      doc
        .fillColor(gold)
        .text(point.value, 180, suitY, { width: 85 });
      
      doc
        .fillColor(grey)
        .font('Helvetica')
        .text('— ' + point.detail, 270, suitY, { width: 275 });
      
      suitY += 26;
    });
    
    doc
      .fillColor(navy)
      .fontSize(13)
      .font('Helvetica-Bold')
      .text('Role-Specific Recommendation', 50, suitY + 16);

    const recommendationText = `Based on the integrated psychological architecture and the defined challenge (${jobData?.jobChallenge || 'standard operations'}), this candidate is ${results.ei.selfAwareness > 60 ? 'highly recommended' : 'recommended with support'} for the ${jobData?.jobTitle || 'position'}. Their ${results.mbti.includes('J') ? 'systematic organization' : 'flexible innovation'} will be a key asset in managing the ${jobData?.jobEnvironment || 'workplace'} dynamics.`;
    const recommendationY = suitY + 40;

    // Guard against overrunning the footer: a lengthy free-text "key
    // challenge" from the job context form can push this paragraph past the
    // safe content zone at the default size, so check before drawing (never
    // after — erasing and redrawing over already-rendered text leaves a
    // ghosting artifact) and step down a size if it would overflow. Page
    // content here is drawn inside translate(0, 108) while the footer is
    // drawn afterward in absolute coordinates at y=762, so the page-local
    // budget is 762 - 108, minus a small margin.
    // Guard against overrunning the footer: a lengthy free-text "key
    // challenge" from the job context form can push this paragraph past the
    // safe content zone, so step the font size down (checking again each
    // time, never erasing/redrawing already-rendered text) until it
    // actually fits. Page content here is drawn inside translate(0, 108)
    // while the footer is drawn afterward in absolute coordinates at
    // y=762, so the page-local budget is 762 - 108, minus a margin.
    const footerSafeY = 648;
    let recommendationFontSize = 12;
    let recommendationOptions = { width: 495, lineGap: 5, align: 'justify' as const };
    doc.font('Helvetica').fontSize(recommendationFontSize);
    let recommendationHeight = doc.heightOfString(recommendationText, recommendationOptions);
    while (recommendationY + recommendationHeight > footerSafeY && recommendationFontSize > 9) {
      recommendationFontSize -= 0.5;
      recommendationOptions = { width: 495, lineGap: 3, align: 'justify' as const };
      doc.font('Helvetica').fontSize(recommendationFontSize);
      recommendationHeight = doc.heightOfString(recommendationText, recommendationOptions);
    }

    doc
      .fillColor(dark)
      .font('Helvetica')
      .fontSize(recommendationFontSize)
      .text(recommendationText, 50, recommendationY, recommendationOptions);

    doc.restore();
  }

  // Footer on all pages
  const totalPages = doc.bufferedPageRange().count;
  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    drawReportFooter(doc, { navy, gold, dark, grey }, i + 1);
  }

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
}
