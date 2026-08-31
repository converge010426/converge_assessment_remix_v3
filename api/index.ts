// VERSION: 7.7 (ON-DEMAND REGEN & VERCEL OPTIMIZED)
// SYNC_ID: SYNC_20260408_1115
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { getSupabase } from "../src/lib/supabase.js";
import { getPaymentProduct } from "../src/paymentCatalog.js";

// Dynamic imports for heavy services to prevent timeout on cold start
const getReportServices = async () => {
  try {
    // Try relative path first
    return await import("../src/services/reportService.js");
  } catch (err: any) {
    logToFile(`[API] Primary import failed, trying absolute path...`);
    try {
      const absolutePath = path.join(process.cwd(), "src", "services", "reportService.js");
      return await import(absolutePath);
    } catch (err2: any) {
      logToFile(`[API] Absolute import failed: ${err2.message}`);
      throw new Error(`Failed to load report services: ${err2.message}`);
    }
  }
};

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

function constantTimeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && crypto.timingSafeEqual(aBuffer, bBuffer);
}

function publicOrigin() {
  const origin = process.env.APP_PUBLIC_ORIGIN;
  if (!origin) throw new Error('APP_PUBLIC_ORIGIN is not configured.');
  return new URL(origin).origin;
}

function verifyYocoWebhook(req: express.Request): boolean {
  const webhookId = req.header('webhook-id');
  const timestamp = req.header('webhook-timestamp');
  const signatureHeader = req.header('webhook-signature');
  const secret = process.env.YOCO_WEBHOOK_SECRET;
  const rawBody = req.body;
  if (!webhookId || !timestamp || !signatureHeader || !secret?.startsWith('whsec_') || !Buffer.isBuffer(rawBody)) return false;
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(Math.floor(Date.now() / 1000) - seconds) > 180) return false;
  const key = Buffer.from(secret.slice('whsec_'.length), 'base64');
  if (!key.length) return false;
  const expected = crypto.createHmac('sha256', key).update(`${webhookId}.${timestamp}.${rawBody.toString('utf8')}`).digest('base64');
  return signatureHeader.split(' ').some((entry) => {
    const [version, signature] = entry.split(',', 2);
    return version === 'v1' && !!signature && constantTimeEqual(expected, signature);
  });
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function logToFile(message: string) {
  const logMessage = `[${new Date().toISOString()}] ${message}`;
  console.log(logMessage);
  
  // Only write to file if not on Vercel
  if (!process.env.VERCEL) {
    try {
      fs.appendFileSync("api-debug.log", logMessage + "\n");
    } catch (err) {
      console.error("Failed to write to log file:", err);
    }
  }
}

async function sendEmail(to: string, subject: string, text: string, attachments: any[] = []) {
  logToFile(`[API] Attempting to send email to ${to}...`);
  
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    logToFile("[API] ERROR: SMTP not configured. Missing SMTP_HOST, SMTP_USER, or SMTP_PASS in environment variables.");
    return { success: false, error: "SMTP not configured" };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_PORT === "465",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    // Add timeout for better error handling
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
    logToFile(`[API] Email sent successfully to ${to}. Message ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    logToFile(`[API] ERROR: Email failed to ${to}: ${err.message}`);
    if (err.code === 'EAUTH') {
      logToFile("[API] HINT: This is an authentication error. Check your SMTP_USER and SMTP_PASS (App Password).");
    }
    return { success: false, error: err.message };
  }
}

logToFile("API Server Initializing...");

// --- Server-side admin authentication ---
// ADMIN_PASSWORD is a server-only env var (no VITE_ prefix, so it is never
// bundled into client JS). Falls back to the existing client-side default
// so behavior is unchanged until a dedicated server secret is configured.
const ADMIN_SECRET = process.env.ADMIN_PASSWORD || process.env.VITE_ADMIN_PASSWORD || 'admin123';
const ADMIN_TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function signAdminToken(): string {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + ADMIN_TOKEN_TTL_MS;
  const payload = `${issuedAt}.${expiresAt}`;
  const sig = crypto.createHmac('sha256', ADMIN_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}.${sig}`).toString('base64');
}

function verifyAdminToken(token: string | undefined): boolean {
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const parts = decoded.split('.');
    if (parts.length !== 3) return false;
    const [issuedAt, expiresAt, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', ADMIN_SECRET).update(`${issuedAt}.${expiresAt}`).digest('hex');
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return false;
    }
    if (Date.now() > Number(expiresAt)) return false;
    return true;
  } catch {
    return false;
  }
}

function requireAdminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  if (!verifyAdminToken(token)) {
    logToFile(`[API] Unauthorized admin request blocked: ${req.method} ${req.path}`);
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Admin authentication required.' });
  }
  next();
}

const app = express();

// Yoco webhook: preserve the raw request body for signature verification.
// IMPORTANT: this must come BEFORE the general JSON parser.
app.use(
  "/api/yoco/webhook",
  express.raw({ type: "application/json", limit: "2mb" })
);

// General JSON parser for all other API routes.
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

app.post("/api/admin/login", (req, res) => {
  const { password } = req.body || {};
  if (password && password === ADMIN_SECRET) {
    logToFile('[API] Admin login successful.');
    return res.json({ status: 'ok', token: signAdminToken() });
  }
  logToFile('[API] Admin login failed: invalid credentials.');
  return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid administrative credentials.' });
});

// Test email endpoint
app.get("/api/admin/test-email", requireAdminAuth, async (req, res) => {
  const adminEmail = process.env.ADMIN_EMAIL || "tomknsn@gmail.com";
  const result = await sendEmail(
    adminEmail,
    "TEST EMAIL: Converge System",
    "This is a test email to verify your SMTP configuration is working correctly on Vercel."
  );
  res.json(result);
});

// Diagnostic endpoint for environment variables
app.get("/api/admin/diagnostics", requireAdminAuth, (req, res) => {
  const envKeys = Object.keys(process.env).filter(key => 
    key.startsWith('SMTP_') || 
    key.startsWith('SUPABASE_') || 
    key === 'ADMIN_EMAIL' || 
    key === 'VERCEL' || 
    key === 'VERCEL_URL' ||
    key === 'NODE_ENV'
  );

  const diagnostics = {
    VERSION: "7.6",
    VERCEL: !!process.env.VERCEL,
    VERCEL_URL: process.env.VERCEL_URL || 'NOT SET',
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    SMTP_HOST: !!process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT || 'NOT SET',
    SMTP_USER: !!process.env.SMTP_USER,
    SMTP_PASS: !!process.env.SMTP_PASS,
    SMTP_FROM: process.env.SMTP_FROM || 'NOT SET',
    ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'NOT SET (defaults to tomknsn@gmail.com)',
    NODE_ENV: process.env.NODE_ENV || 'NOT SET',
    DETECTED_KEYS: envKeys,
    DOTENV_FILE_EXISTS: fs.existsSync(path.join(process.cwd(), '.env')),
    HINT: "If SMTP variables show as 'false' or 'NOT SET' but are configured in Vercel, they might be in 'Team' settings but not linked to this 'Project'. Check Project Settings -> Environment Variables specifically."
  };
  res.json(diagnostics);
});

// API routes
app.get("/api/health", (req, res) => {
  logToFile("Health check called");
  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const serviceKeyPreview = hasServiceKey ? `${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 5)}...` : 'NOT SET';
  
  res.json({ 
    status: "ok", 
    version: "7.5 (AUTO-GEN & PREVIEW)",
    syncId: "SYNC_20260408_0820",
    environment: process.env.VERCEL ? "vercel" : "local",
    timestamp: new Date().toISOString(),
    env: {
      hasUrl: !!process.env.SUPABASE_URL,
      hasAnonKey: !!process.env.SUPABASE_ANON_KEY,
      hasServiceKey,
      serviceKeyPreview,
      nodeEnv: process.env.NODE_ENV,
      vercel: !!process.env.VERCEL,
      smtpHost: !!process.env.SMTP_HOST
    }
  });
});

app.post("/api/submit", async (req, res) => {
  const { name, email, answers, results, product, jobTitle, jobEnvironment, jobChallenge, jobDescription } = req.body;
  
  logToFile(`[API] SUBMIT START: ${name} (${email})`);
  logToFile(`[API] SUBMIT CONTEXT: UserAgent="${req.headers['user-agent'] || 'unknown'}" AnswersCount=${answers ? Object.keys(answers).length : 0} Product=${product || 'unset'}`);
  // Environment check
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    logToFile("[API] ERROR: Missing Supabase environment variables in Vercel.");
    return res.status(500).json({ 
      error: "CONFIGURATION_ERROR", 
      message: "Supabase environment variables are missing. Please check Vercel Project Settings." 
    });
  }
  
  if (!name || !email || !results) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  let paymentProduct: ReturnType<typeof getPaymentProduct>;
  try {
    paymentProduct = getPaymentProduct(product);
  } catch (configErr: any) {
    logToFile(`[API] CONFIGURATION_ERROR resolving payment product for "${product}": ${configErr.message}`);
    return res.status(500).json({
      error: "CONFIGURATION_ERROR",
      message: "Pricing configuration could not be loaded. Please try again shortly, or contact support if this persists."
    });
  }
  if (!paymentProduct) return res.status(400).json({ error: "INVALID_PRODUCT", message: "Unknown assessment product." });

  try {
    const supabase = getSupabase(true);
    
    logToFile(`[API] Data sizes - Answers: ${JSON.stringify(answers).length}, Results: ${JSON.stringify(results).length}`);

    const paymentRef = crypto.randomBytes(24).toString('base64url');
    const checkoutToken = crypto.randomBytes(32).toString('base64url');
    const isComplimentary = paymentProduct.amountCents === 0;
    const payload = { 
      name, 
      email, 
      product: String(product), 
      mbti: String(results.mbti),
      results: results, 
      answers: answers, 
      report_url: null,
      job_title: jobTitle || null,
      job_environment: jobEnvironment || null,
      job_challenge: jobChallenge || null,
      job_description: jobDescription || null,
      payment_status: isComplimentary ? 'paid' : 'pending',
      payment_ref: paymentRef,
      payment_token_hash: sha256(checkoutToken),
      payment_provider: isComplimentary ? 'complimentary' : null,
      payment_currency: paymentProduct.currency,
      payment_amount_cents: paymentProduct.amountCents,
      paid_at: isComplimentary ? new Date().toISOString() : null
    };
    const { data: finalData, error: finalError, status: finalStatus } = await supabase
      .from('submissions').insert([payload]).select();

   if (finalError) {
      logToFile(`[API] INSERT ERROR: ${finalError.message} (Code: ${finalError.code})`);
      logToFile(`[API] INSERT ERROR RAW DETAILS: ${finalError.details || 'none provided'}`);
      logToFile(`[API] INSERT ERROR HINT: ${finalError.hint || 'none provided'}`);
      return res.status(500).json({ 
        error: "DATABASE_REJECTION", 
        message: finalError.message, 
        code: finalError.code,
        hint: finalError.hint,
        details: finalError.details || `This error occurred while trying to save ${JSON.stringify(answers).length} characters of data. If this is a 'too long' error, your Supabase column type is likely too small.`
      });
    }
    if (!finalData || finalData.length === 0) {
      logToFile(`[API] RLS WARNING: Insert returned no data. Status: ${finalStatus}`);
      return res.status(500).json({ 
        error: "RLS_BLOCKED", 
        message: "The database accepted the request but returned no data. This usually means Row Level Security (RLS) is enabled on the 'submissions' table but no 'INSERT' policy exists for anonymous users.",
        hint: "Go to Supabase -> Authentication -> Policies and add an 'INSERT' and 'SELECT' policy for the 'submissions' table."
      });
    }

    const submissionId = finalData[0].id;
    logToFile(`[API] INSERT SUCCESS: ID ${submissionId}`);

    // Reports are generated only after payment confirmation. Creating a report
    // or a report URL here would make a paid deliverable exist while payment is pending.
    logToFile(`[API] Submission ${submissionId} saved with payment status ${payload.payment_status}; report generation deferred until payment is confirmed.`);

    // 4. Send fast notification to admin
    try {
      logToFile(`[API] Sending notification for ID ${submissionId}...`);
      const adminEmail = process.env.ADMIN_EMAIL || "tomknsn@gmail.com";
      
      const emailResult = await sendEmail(
        adminEmail,
        `NEW ASSESSMENT: ${name} (${results.mbti})`,
        `A new assessment has been submitted.
        
Candidate: ${name}
Email: ${email}
Type: ${results.mbti}
Product: ${product}

REPORT PENDING: Generate and release the report only after payment verification.

Admin Link: ${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/admin/result/${submissionId}` : `Check Admin Dashboard for ID ${submissionId}`}

(Note: If the report was not generated during submission, it will be automatically generated when you open the result in the dashboard.)`
      );
      
      if (emailResult.success) {
        logToFile(`[API] Admin notification sent successfully.`);
      } else {
        logToFile(`[API] Admin notification failed: ${emailResult.error}`);
      }
    } catch (emailErr: any) {
      logToFile(`[API] Admin notification error: ${emailErr.message}`);
    }

    return res.json({ status: "ok", id: submissionId, checkoutToken, paymentStatus: payload.payment_status });
  } catch (error: any) {
    logToFile(`[API] CRITICAL ERROR: ${error.message}`);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error", message: error.message });
    }
  }
});

app.post('/api/yoco/create-checkout', async (req, res) => {
  const { submissionId, checkoutToken } = req.body || {};
  if (!submissionId || typeof checkoutToken !== 'string') return res.status(400).json({ error: 'INVALID_REQUEST', message: 'Payment session is required.' });
  try {
    const supabase = getSupabase(true);
    const { data: submission, error } = await supabase.from('submissions')
      .select('id,product,payment_status,payment_ref,payment_token_hash,payment_amount_cents,payment_currency,yoco_checkout_id')
      .eq('id', submissionId).single();
    if (error || !submission || !submission.payment_token_hash || !constantTimeEqual(sha256(checkoutToken), submission.payment_token_hash)) {
      return res.status(403).json({ error: 'INVALID_PAYMENT_SESSION', message: 'Payment session is invalid.' });
    }
    const product = getPaymentProduct(submission.product);
    if (!product || submission.payment_amount_cents !== product.amountCents || submission.payment_currency !== product.currency || !submission.payment_ref) {
      logToFile(`[API] Payment configuration mismatch for submission ${submission.id}`);
      return res.status(409).json({ error: 'PAYMENT_CONFIGURATION_MISMATCH', message: 'Payment configuration requires review.' });
    }
    if (submission.payment_status === 'paid') return res.json({ status: 'paid' });
    if (product.amountCents === 0) {
      await supabase.from('submissions').update({ payment_status: 'paid', payment_provider: 'complimentary', paid_at: new Date().toISOString() })
        .eq('id', submission.id).neq('payment_status', 'paid');
      return res.json({ status: 'paid' });
    }
    const secret = process.env.YOCO_SECRET_KEY;
    if (!secret) return res.status(503).json({ error: 'PAYMENT_UNAVAILABLE', message: 'Online payment is not configured.' });
    const origin = publicOrigin();
    const yocoResponse = await fetch('https://payments.yoco.com/api/checkouts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json', 'Idempotency-Key': submission.payment_ref },
      body: JSON.stringify({
        amount: product.amountCents, currency: product.currency,
        successUrl: `${origin}/thank-you?payment=success`, cancelUrl: `${origin}/thank-you?payment=cancelled`, failureUrl: `${origin}/thank-you?payment=failed`,
        clientReferenceId: submission.payment_ref, externalId: submission.payment_ref,
        metadata: { submissionId: String(submission.id), paymentRef: submission.payment_ref, product: product.key }
      })
    });
    const checkout = await yocoResponse.json().catch(() => null);
    if (!yocoResponse.ok || !checkout?.id || !checkout?.redirectUrl) {
      logToFile(`[API] Yoco checkout creation failed for submission ${submission.id}: ${yocoResponse.status}`);
      return res.status(502).json({ error: 'CHECKOUT_CREATION_FAILED', message: 'Unable to create secure checkout.' });
    }
    const { error: updateError } = await supabase.from('submissions').update({ yoco_checkout_id: checkout.id, payment_status: 'checkout_created', payment_provider: 'yoco' })
      .eq('id', submission.id).neq('payment_status', 'paid');
    if (updateError) throw updateError;
    return res.json({ status: 'checkout_created', redirectUrl: checkout.redirectUrl });
  } catch (err: any) {
    logToFile(`[API] Checkout error: ${err.message}`);
    return res.status(500).json({ error: 'CHECKOUT_ERROR', message: 'Unable to start checkout.' });
  }
});

app.post('/api/yoco/webhook', async (req, res) => {
  if (!verifyYocoWebhook(req)) return res.status(403).json({ error: 'INVALID_WEBHOOK_SIGNATURE' });
  try {
    const event = JSON.parse((req.body as Buffer).toString('utf8'));
    if (event?.type !== 'payment.succeeded' || event?.payload?.status !== 'succeeded') return res.sendStatus(200);
    const checkoutId = event.payload?.metadata?.checkoutId;
    const paymentId = event.payload?.id;
    if (!checkoutId || !paymentId) return res.status(400).json({ error: 'INVALID_PAYMENT_EVENT' });
    const supabase = getSupabase(true);
    const { data: submission, error } = await supabase.from('submissions')
      .select('id,payment_status,payment_amount_cents,payment_currency,yoco_payment_id')
      .eq('yoco_checkout_id', checkoutId).single();
    if (error || !submission) return res.status(404).json({ error: 'UNKNOWN_CHECKOUT' });
    if (submission.payment_status === 'paid') return res.sendStatus(200);
    if (submission.payment_amount_cents !== event.payload.amount || submission.payment_currency !== event.payload.currency) {
      logToFile(`[API] Yoco amount/currency mismatch for checkout ${checkoutId}`);
      return res.status(422).json({ error: 'PAYMENT_MISMATCH' });
    }
    const { error: updateError } = await supabase.from('submissions').update({ payment_status: 'paid', payment_provider: 'yoco', yoco_payment_id: paymentId, paid_at: new Date().toISOString() })
      .eq('id', submission.id).neq('payment_status', 'paid');
    if (updateError) throw updateError;
    return res.sendStatus(200);
  } catch (err: any) {
    logToFile(`[API] Yoco webhook error: ${err.message}`);
    return res.status(500).json({ error: 'WEBHOOK_PROCESSING_FAILED' });
  }
});

app.post("/api/admin/generate-report", requireAdminAuth, async (req, res) => {
  const { id } = req.body;
  logToFile(`[API] Admin requesting to generate report for ID ${id}`);
  if (!id) return res.status(400).json({ error: "ID required" });
  
  try {
    const { generateMBTIReport, generateComprehensiveReport } = await getReportServices();
    const supabase = getSupabase(true);
    const { data: sub, error: subError } = await supabase.from('submissions').select('*').eq('id', id).single();
    
    if (subError || !sub) {
      logToFile(`[API] ERROR: Submission ${id} not found for generation`);
      return res.status(404).json({ error: "Submission not found" });
    }

    if (sub.payment_status !== 'paid') {
      logToFile(`[API] BLOCKED generate-report for ID ${id}: payment_status is not paid.`);
      return res.status(403).json({
        error: "PAYMENT_NOT_CONFIRMED",
        message: "A report can be generated only after payment is confirmed."
      });
    }
    
    if (!sub.results) {
      throw new Error("Assessment results are missing for this submission.");
    }
    
    const results = typeof sub.results === 'string' ? JSON.parse(sub.results) : sub.results;
    const product = sub.product;
    const name = sub.name;
    
    if (!results.mbti) {
      throw new Error("MBTI type is missing from results.");
    }
    
    let reportPath;
    if (product === 'comprehensive' || product === 'recruiter') {
      const jobData = {
        jobTitle: sub.job_title,
        jobEnvironment: sub.job_environment,
        jobChallenge: sub.job_challenge,
        jobDescription: sub.job_description
      };
      reportPath = await generateComprehensiveReport(name, results, product === 'recruiter', jobData);
    } else {
      reportPath = await generateMBTIReport(name, results);
    }
    
    const reportUrl = `/api/reports/${path.basename(reportPath)}`;
    await supabase.from('submissions').update({ report_url: reportUrl }).eq('id', id);
    
    logToFile(`[API] Report generated successfully for ID ${id}: ${reportUrl}`);
    res.json({ status: "ok", reportUrl });
  } catch (err: any) {
    logToFile(`[API] ERROR generating report for ID ${id}: ${err.message}`);
    res.status(500).json({ 
      error: "GENERATION_FAILED", 
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

app.post("/api/admin/send-report", requireAdminAuth, async (req, res) => {
  const { id, email, name, reportUrl: providedUrl } = req.body;
  logToFile(`[API] Admin requesting to send report for ID ${id} to ${email}`);

  if (!id || !email) {
    return res.status(400).json({ error: "Missing required fields (id, email)" });
  }

  try {
    // Payment gate: the report must never be emailed to the client unless
    // payment_status is exactly 'paid'. Anything else - 'pending', null,
    // missing, or any unexpected value (including on old submissions created
    // before this column existed) - is treated as NOT PAID.
    const paymentGateSupabase = getSupabase(true);
    const { data: paymentCheck, error: paymentCheckError } = await paymentGateSupabase
      .from('submissions')
      .select('payment_status')
      .eq('id', id)
      .single();

    if (paymentCheckError || !paymentCheck || paymentCheck.payment_status !== 'paid') {
      logToFile(`[API] BLOCKED send-report for ID ${id}: payment_status is not 'paid' (was: ${paymentCheck?.payment_status ?? 'unknown/missing'})`);
      return res.status(403).json({
        error: "PAYMENT_NOT_CONFIRMED",
        message: "This submission has not been marked as paid. Mark the payment as received before sending the report."
      });
    }

    const { generateMBTIReport, generateComprehensiveReport } = await getReportServices();
    const reportsDir = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), 'reports');
    
    let reportPath = "";
    let finalReportUrl = providedUrl;

    // If no URL provided or file doesn't exist, we MUST regenerate
    const needsRegen = !providedUrl || !fs.existsSync(path.join(reportsDir, path.basename(providedUrl)));

    if (needsRegen) {
      logToFile(`[API] Report needs regeneration for ID ${id}...`);
      const supabase = getSupabase(true);
      const { data: sub, error: subError } = await supabase.from('submissions').select('*').eq('id', id).single();
      
      if (subError || !sub) {
        return res.status(404).json({ error: "Submission not found for regeneration" });
      }

      const results = typeof sub.results === 'string' ? JSON.parse(sub.results) : sub.results;
      const product = sub.product;
      const candidateName = sub.name;

      if (product === 'comprehensive' || product === 'recruiter') {
        const jobData = {
          jobTitle: sub.job_title,
          jobEnvironment: sub.job_environment,
          jobChallenge: sub.job_challenge,
          jobDescription: sub.job_description
        };
        reportPath = await generateComprehensiveReport(candidateName, results, product === 'recruiter', jobData);
      } else {
        reportPath = await generateMBTIReport(candidateName, results);
      }
      finalReportUrl = `/api/reports/${path.basename(reportPath)}`;
      await supabase.from('submissions').update({ report_url: finalReportUrl }).eq('id', id);
    } else {
      reportPath = path.join(reportsDir, path.basename(providedUrl));
    }

    const emailResult = await sendEmail(
      email,
      `Your CONVERGE™ Integrated Psychological Protocol: ${name}`,
      `Dear ${name},\n\nThank you again for completing the CONVERGE™ assessment protocol.\n\nI have completed the final triangulation of your psychological markers. Your verified report is attached to this email as a PDF.\n\nPlease note that this MBTI profile is only one of three specialized reports we provide. Our frameworks are designed to fulfill specific roles towards integrated psychological insight, executive advantage, and transformational growth.\n\nIn particular, our Candidate Suitability Report (Converge 3) can significantly enhance hiring decisions by contextualizing these results against specific organizational challenges.\n\nI trust you will find these insights valuable for your professional strategy.\n\nBest regards,\n\nThomas Knoesen\nCONVERGE™ | Psychological Architecture`,
      [{ filename: `Converge_Report_${name.replace(/\s+/g, '_')}.pdf`, path: reportPath }]
    );

    if (emailResult.success) {
      const supabase = getSupabase(true);
      await supabase.from('submissions').update({ email_sent: true }).eq('id', id);
      res.json({ status: "ok" });
    } else {
      res.status(500).json({ error: "Failed to send email", details: emailResult.error });
    }
  } catch (err: any) {
    logToFile(`[API] Failed to send report: ${err.message}`);
    res.status(500).json({ error: "Failed to send report", message: err.message });
  }
});

app.post("/api/admin/mark-paid", requireAdminAuth, async (req, res) => {
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: "ID required" });

  try {
    const supabase = getSupabase(true);
    const { data, error } = await supabase
      .from('submissions')
      .update({ payment_status: 'paid', payment_provider: 'manual_eft', paid_at: new Date().toISOString() })
      .eq('id', id)
      .neq('payment_status', 'paid')
      .select();

    if (error) {
      logToFile(`[API] Failed to mark ID ${id} as paid: ${error.message}`);
      return res.status(500).json({ error: "UPDATE_FAILED", message: error.message });
    }

    logToFile(`[API] Admin marked submission ID ${id} as PAID.`);
    return res.json({ status: "ok", data });
  } catch (err: any) {
    logToFile(`[API] Error marking ID ${id} as paid: ${err.message}`);
    return res.status(500).json({ error: "Internal server error", message: err.message });
  }
});

app.get("/api/results", requireAdminAuth, async (req, res) => {
  logToFile("API: GET /api/results called");
  try {
    const supabase = getSupabase(true);
    
    // Diagnostic 1: Simple connectivity test
    const { data: testData, error: testError } = await supabase.from('submissions').select('id').limit(1);
    const connectionOk = !testError;
    const connectionError = testError ? testError.message : null;

    // Diagnostic 2: Fetch actual data
    const { data, error, status, count } = await supabase
      .from('submissions')
      .select('*', { count: 'exact' })
      .order('id', { ascending: false });

    if (error) {
      logToFile(`Supabase Fetch Error: ${JSON.stringify(error)}`);
      return res.status(500).json({ 
        error: error.message, 
        details: error,
        connectionOk,
        connectionError
      });
    }
    
    logToFile(`Supabase Response: Status ${status}, Count: ${data?.length || 0}, Exact Count: ${count}`);
    
    res.setHeader('x-supabase-status', String(status));
    res.setHeader('x-supabase-count', String(data?.length || 0));
    res.setHeader('x-supabase-exact-count', String(count || 0));
    const urlVal = process.env.SUPABASE_URL || 'NONE';
    res.setHeader('x-supabase-url-preview', urlVal.length > 10 ? `${urlVal.substring(0, 30)}...` : urlVal);
    res.setHeader('x-using-service-role', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'true' : 'false');
    res.setHeader('x-connection-ok', String(connectionOk));
    if (connectionError) {
      res.setHeader('X-Connection-Error', connectionError.replace(/\n/g, ' '));
    }
    
    res.json(data);
  } catch (error: any) {
    logToFile(`Error fetching results: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/results/:id", requireAdminAuth, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  logToFile(`[API] Attempting to update submission ${id} with: ${JSON.stringify(updates)}`);
  try {
    const supabase = getSupabase(true);
    const { data, error } = await supabase
      .from('submissions')
      .update(updates)
      .eq('id', Number(id))
      .select();

    if (error) {
      logToFile(`[API] Supabase Update Error: ${error.message}`);
      throw error;
    }
    
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    
    logToFile(`[API] Successfully updated submission ${id}`);
    res.json(data[0]);
  } catch (error: any) {
    logToFile(`[API] Error updating submission: ${error.message}`);
    res.status(500).json({ error: 'Failed to update submission', details: error.message });
  }
});

app.delete("/api/results/:id", requireAdminAuth, async (req, res) => {
  const { id } = req.params;
  logToFile(`Attempting to delete submission ${id}`);
  try {
    const supabase = getSupabase(true);
    const { data, error } = await supabase
      .from('submissions')
      .delete()
      .eq('id', Number(id))
      .select();

    if (error) {
      logToFile(`Supabase Delete Error: ${JSON.stringify(error)}`);
      throw error;
    }
    
    if (!data || data.length === 0) {
      logToFile(`No rows deleted for submission ${id}. This might be due to RLS policies or an invalid ID.`);
      return res.status(404).json({ 
        error: 'Submission not found or permission denied',
        details: 'The record was not deleted. Please ensure you have the correct permissions in Supabase (RLS policies) to delete from the submissions table.'
      });
    }
    
    logToFile(`Successfully deleted submission ${id}`);
    res.json({ status: "ok", message: "Submission deleted" });
  } catch (error: any) {
    logToFile(`Error deleting submission: ${error.message || error}`);
    res.status(500).json({ 
      error: 'Failed to delete submission',
      details: error.message || error.details || String(error)
    });
  }
});

app.get("/api/reports/:filename", async (req, res) => {
  const requestedFilename = req.params.filename;
  const filename = path.basename(requestedFilename);
  if (filename !== requestedFilename || !filename.toLowerCase().endsWith('.pdf')) {
    return res.status(400).send('Invalid report filename.');
  }

  // Resolve the report record and enforce the payment gate before touching the
  // filesystem. Report URLs are deliberately not customer credentials.
  const reportUrl = `/api/reports/${filename}`;
  let sub: any;
  try {
    const supabase = getSupabase(true);
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('report_url', reportUrl)
      .single();
    if (error || !data) return res.status(404).send('Report not found.');
    if (data.payment_status !== 'paid') {
      logToFile(`[API] BLOCKED report download for submission ${data.id}: payment_status is not paid.`);
      return res.status(403).send('Payment has not been confirmed.');
    }
    sub = data;
  } catch (err: any) {
    logToFile(`[API] Report authorization lookup failed for ${filename}: ${err.message}`);
    return res.status(500).send('Unable to authorize report access.');
  }

  const reportsDir = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), 'reports');
  const filePath = path.join(reportsDir, filename);
  
  if (fs.existsSync(filePath)) {
    return res.download(filePath);
  }

  // If file is missing, try to re-generate it on the fly
  logToFile(`[API] Report ${filename} missing from disk. Attempting on-demand regeneration...`);
  try {
    logToFile(`[API] Found submission ${sub.id} for missing report. Re-generating...`);
    const { generateMBTIReport, generateComprehensiveReport } = await getReportServices();
    const results = typeof sub.results === 'string' ? JSON.parse(sub.results) : sub.results;
    const product = sub.product;
    const name = sub.name;

    let reportPath;
    if (product === 'comprehensive' || product === 'recruiter') {
      const jobData = {
        jobTitle: sub.job_title,
        jobEnvironment: sub.job_environment,
        jobChallenge: sub.job_challenge,
        jobDescription: sub.job_description
      };
      reportPath = await generateComprehensiveReport(name, results, product === 'recruiter', jobData);
    } else {
      reportPath = await generateMBTIReport(name, results);
    }

    // The filename might have changed (timestamp), so we should update the DB if it's different
    const newFilename = path.basename(reportPath);
    const newReportUrl = `/api/reports/${newFilename}`;
    
    if (newFilename !== filename) {
      logToFile(`[API] Filename changed during regen: ${filename} -> ${newFilename}. Updating DB.`);
      await getSupabase(true).from('submissions').update({ report_url: newReportUrl }).eq('id', sub.id);
    }

    if (fs.existsSync(reportPath)) {
      return res.download(reportPath);
    } else {
      throw new Error("Report file was not created after generation attempt.");
    }
  } catch (err: any) {
    logToFile(`[API] On-demand regeneration failed for ${filename}: ${err.message}`);
    res.status(500).send(`Error re-generating report: ${err.message}`);
  }
});

// Start the server if this file is run directly (Production/Cloud Run)
if (process.env.NODE_ENV === "production" && !process.env.VERCEL) {
  const PORT = 3000;
  
  // Serve static files from the 'dist' directory
  const distPath = path.join(process.cwd(), 'dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    // Handle SPA routing - send all non-API requests to index.html
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api/')) {
        res.sendFile(path.join(distPath, 'index.html'));
      }
    });
  } else {
    logToFile("WARNING: 'dist' directory not found. Static files will not be served.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Production server running on port ${PORT}`);
  });
}

export default app;
