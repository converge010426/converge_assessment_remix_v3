import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { getSupabase } from '../src/lib/supabase.js';
import { generateCandidateSuitabilityV2 } from '../src/services/candidateSuitabilityV2.js';

const ADMIN_SECRET = process.env.ADMIN_PASSWORD || process.env.VITE_ADMIN_PASSWORD || 'admin123';
const ADMIN_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function constantTimeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && crypto.timingSafeEqual(aBuffer, bBuffer);
}

function verifyAdminToken(token: string | undefined): boolean {
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const [issuedAtText, expiresAtText, signature] = decoded.split('.');
    const issuedAt = Number(issuedAtText);
    const expiresAt = Number(expiresAtText);
    if (!issuedAt || !expiresAt || !signature || Date.now() > expiresAt || issuedAt > Date.now() + 60_000) return false;
    const payload = `${issuedAt}.${expiresAt}`;
    const expected = crypto.createHmac('sha256', ADMIN_SECRET).update(payload).digest('hex');
    return constantTimeEqual(expected, signature);
  } catch {
    return false;
  }
}

function requireAdmin(req: any, res: any): boolean {
  const header = req.headers?.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!verifyAdminToken(token)) {
    res.status(401).json({ error: 'UNAUTHORIZED' });
    return false;
  }
  return true;
}

async function sendEmail(to: string, subject: string, text: string, attachments: any[] = []) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return { success: false, error: 'SMTP not configured' };
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
  });
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      attachments,
    });
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

function jobDataFromSubmission(sub: any) {
  return {
    jobTitle: sub.job_title,
    jobEnvironment: sub.job_environment,
    jobChallenge: sub.job_challenge,
    jobDescription: sub.job_description,
  };
}

async function generateForSubmission(sub: any): Promise<string> {
  const results = typeof sub.results === 'string' ? JSON.parse(sub.results) : sub.results;
  if (!results?.mbti) throw new Error('Assessment results are missing MBTI type.');
  if (sub.product === 'recruiter') {
    return generateCandidateSuitabilityV2(sub.name, results, jobDataFromSubmission(sub));
  }
  const { generateMBTIReport, generateComprehensiveReport } = await import('../src/services/reportService.js');
  if (sub.product === 'comprehensive') {
    return generateComprehensiveReport(sub.name, results, false, jobDataFromSubmission(sub));
  }
  return generateMBTIReport(sub.name, results);
}

export default async function handler(req: any, res: any) {
  if (!requireAdmin(req, res)) return;
  const requestPath = String(req.url || '').split('?')[0];
  const body = req.body || {};
  const supabase = getSupabase(true);

  try {
    if (requestPath === '/api/admin/generate-report') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
      const id = body.id;
      if (!id) return res.status(400).json({ error: 'ID required' });

      const { data: sub, error } = await supabase.from('submissions').select('*').eq('id', id).single();
      if (error || !sub) return res.status(404).json({ error: 'Submission not found' });
      if (sub.payment_status !== 'paid') {
        return res.status(403).json({ error: 'PAYMENT_NOT_CONFIRMED', message: 'A report can be generated only after payment is confirmed.' });
      }

      const reportPath = await generateForSubmission(sub);
      const reportUrl = `/api/reports/${path.basename(reportPath)}`;
      await supabase.from('submissions').update({ report_url: reportUrl }).eq('id', id);
      return res.json({ status: 'ok', reportUrl });
    }

    if (requestPath === '/api/admin/send-report') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
      const { id, email, name, reportUrl: providedUrl } = body;
      if (!id || !email) return res.status(400).json({ error: 'Missing required fields (id, email)' });

      const { data: paymentCheck, error: paymentError } = await supabase.from('submissions').select('payment_status').eq('id', id).single();
      if (paymentError || !paymentCheck || paymentCheck.payment_status !== 'paid') {
        return res.status(403).json({ error: 'PAYMENT_NOT_CONFIRMED', message: 'This submission has not been marked as paid. Mark the payment as received before sending the report.' });
      }

      const reportsDir = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), 'reports');
      let reportPath = '';
      let finalReportUrl = providedUrl;
      const suppliedPath = providedUrl ? path.join(reportsDir, path.basename(providedUrl)) : '';
      const needsRegen = !providedUrl || !fs.existsSync(suppliedPath);

      const { data: sub, error: subError } = await supabase.from('submissions').select('*').eq('id', id).single();
      if (subError || !sub) return res.status(404).json({ error: 'Submission not found for sending' });

      // Recruiter reports always regenerate through V2 when a report is sent.
      // This prevents an older pre-V2 Candidate Suitability PDF from being
      // reused after the V2 rollout.
      const mustUseV2 = sub.product === 'recruiter';
      if (needsRegen || mustUseV2) {
        reportPath = await generateForSubmission(sub);
        finalReportUrl = `/api/reports/${path.basename(reportPath)}`;
        await supabase.from('submissions').update({ report_url: finalReportUrl }).eq('id', id);
      } else {
        reportPath = suppliedPath;
      }

      const recipientName = name || sub.name;
      const emailResult = await sendEmail(
        email,
        `Your CONVERGE™ Integrated Psychological Protocol: ${recipientName}`,
        `Dear ${recipientName},\n\nThank you again for completing the CONVERGE™ assessment protocol.\n\nI have completed the final triangulation of your psychological markers. Your verified report is attached to this email as a PDF.\n\nPlease note that this MBTI profile is only one of three specialized reports we provide. Our frameworks are designed to fulfill specific roles towards integrated psychological insight, executive advantage, and transformational growth.\n\nIn particular, our Candidate Suitability Report (Converge 3) can significantly enhance hiring decisions by contextualizing these results against specific organizational challenges.\n\nI trust you will find these insights valuable for your professional strategy.\n\nBest regards,\n\nThomas Knoesen\nCONVERGE™ | Psychological Architecture`,
        [{ filename: `Converge_Report_${recipientName.replace(/\s+/g, '_')}.pdf`, path: reportPath }]
      );

      if (!emailResult.success) return res.status(500).json({ error: 'Failed to send email', details: emailResult.error });
      await supabase.from('submissions').update({ email_sent: true }).eq('id', id);
      return res.json({ status: 'ok', reportUrl: finalReportUrl });
    }

    return res.status(404).json({ error: 'NOT_FOUND' });
  } catch (err: any) {
    return res.status(500).json({ error: 'REPORT_OPERATION_FAILED', message: err.message });
  }
}
