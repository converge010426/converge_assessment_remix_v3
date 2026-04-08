// VERSION: 7.3 (ROBUST DB & FAST SMTP)
// SYNC_ID: SYNC_20260408_0715
import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import nodemailer from "nodemailer";
import { generateMBTIReport, generateComprehensiveReport } from "../src/services/reportService.js";
import { getSupabase } from "../src/lib/supabase.js";

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

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Test email endpoint
app.get("/api/admin/test-email", async (req, res) => {
  const adminEmail = process.env.ADMIN_EMAIL || "tomknsn@gmail.com";
  const result = await sendEmail(
    adminEmail,
    "TEST EMAIL: Converge System",
    "This is a test email to verify your SMTP configuration is working correctly on Vercel."
  );
  res.json(result);
});

// Diagnostic endpoint for environment variables
app.get("/api/admin/diagnostics", (req, res) => {
  const envKeys = Object.keys(process.env).filter(key => 
    key.startsWith('SMTP_') || 
    key.startsWith('SUPABASE_') || 
    key === 'ADMIN_EMAIL' || 
    key === 'VERCEL' || 
    key === 'VERCEL_URL' ||
    key === 'NODE_ENV'
  );

  const diagnostics = {
    VERSION: "6.7",
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
    version: "6.0 (FINAL POLISH)",
    syncId: "SYNC_20260406_0935",
    environment: process.env.VERCEL ? "vercel" : "local",
    timestamp: new Date().toISOString(),
    env: {
      hasUrl: !!process.env.SUPABASE_URL,
      hasAnonKey: !!process.env.SUPABASE_ANON_KEY,
      hasServiceKey,
      serviceKeyPreview,
      nodeEnv: process.env.NODE_ENV,
      vercel: !!process.env.VERCEL
    }
  });
});

app.post("/api/submit", async (req, res) => {
  const { name, email, answers, results, product, jobTitle, jobEnvironment, jobChallenge, jobDescription } = req.body;
  
  logToFile(`[API] SUBMIT START: ${name} (${email})`);
  
  if (!name || !email || !results) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const supabase = getSupabase();
    
    logToFile(`[API] Data sizes - Answers: ${JSON.stringify(answers).length}, Results: ${JSON.stringify(results).length}`);

    // Try inserting as native objects first, then as strings if it fails
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
      job_description: jobDescription || null
    };

    let finalData = null;
    let finalError = null;
    let finalStatus = null;

    logToFile(`[API] Attempting primary insert for ${name}...`);
    const { data: firstData, error: firstError, status: firstStatus } = await supabase
      .from('submissions')
      .insert([payload])
      .select();

    finalData = firstData;
    finalError = firstError;
    finalStatus = firstStatus;

    // If it failed, try a series of fallbacks
    if (firstError) {
      logToFile(`[API] Primary insert failed: ${firstError.message} (Code: ${firstError.code})`);
      
      // Fallback 1: Try stringifying complex objects (for older TEXT columns)
      logToFile(`[API] Fallback 1: Trying stringified payload...`);
      const stringifiedPayload = {
        ...payload,
        results: JSON.stringify(results),
        answers: JSON.stringify(answers)
      };
      const { data: retry1Data, error: retry1Error, status: retry1Status } = await supabase
        .from('submissions')
        .insert([stringifiedPayload])
        .select();
      
      if (!retry1Error) {
        finalData = retry1Data;
        finalError = null;
        finalStatus = retry1Status;
        logToFile(`[API] Fallback 1 SUCCESS.`);
      } else {
        logToFile(`[API] Fallback 1 failed: ${retry1Error.message}`);
        
        // Fallback 2: Try removing job-specific columns (in case they don't exist in DB)
        logToFile(`[API] Fallback 2: Trying minimal payload (no job columns)...`);
        const minimalPayload = {
          name,
          email,
          product: String(product),
          mbti: String(results.mbti),
          results: typeof results === 'object' ? JSON.stringify(results) : results,
          answers: typeof answers === 'object' ? JSON.stringify(answers) : answers,
          report_url: null
        };
        
        const { data: retry2Data, error: retry2Error, status: retry2Status } = await supabase
          .from('submissions')
          .insert([minimalPayload])
          .select();
          
        if (!retry2Error) {
          finalData = retry2Data;
          finalError = null;
          finalStatus = retry2Status;
          logToFile(`[API] Fallback 2 SUCCESS.`);
        } else {
          logToFile(`[API] Fallback 2 failed: ${retry2Error.message}`);
          finalError = retry2Error;
          finalStatus = retry2Status;
        }
      }
    }

    if (finalError) {
      logToFile(`[API] INSERT ERROR: ${finalError.message} (Code: ${finalError.code})`);
      return res.status(500).json({ 
        error: "DATABASE_REJECTION", 
        message: finalError.message, 
        code: finalError.code,
        hint: finalError.hint,
        details: `This error occurred while trying to save ${JSON.stringify(answers).length} characters of data. If this is a 'too long' error, your Supabase column type is likely too small.`
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

    // Report generation and notification (Awaited to ensure completion on serverless)
    try {
      logToFile(`[API] Starting report generation for ID ${submissionId}...`);
      let reportPath;
      const jobData = { jobTitle, jobEnvironment, jobChallenge, jobDescription };
      if (product === 'comprehensive' || product === 'recruiter') {
        reportPath = await generateComprehensiveReport(name, results, product === 'recruiter', jobData);
      } else {
        reportPath = await generateMBTIReport(name, results);
      }
      logToFile(`[API] Report generated at: ${reportPath}`);
      
      const reportUrl = `/api/reports/${path.basename(reportPath)}`;
      const { error: updateError } = await supabase.from('submissions').update({ report_url: reportUrl }).eq('id', submissionId);
      
      if (updateError) {
        logToFile(`[API] ERROR updating report_url: ${updateError.message}`);
      } else {
        logToFile(`[API] report_url updated successfully: ${reportUrl}`);
      }

      // Send internal notification to admin
      const adminEmail = process.env.ADMIN_EMAIL || "tomknsn@gmail.com";
      const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || "tomknsn@gmail.com";
      
      logToFile(`[API] Sending admin notification FROM: ${fromEmail} TO: ${adminEmail}...`);
      
      const emailResult = await sendEmail(
        adminEmail,
        `NEW ASSESSMENT: ${name}`,
        `A new assessment has been submitted.\n\n--- CANDIDATE DETAILS ---\nName: ${name}\nEmail: ${email}\nProduct: ${product}\nID: ${submissionId}\n\n--- STATUS ---\nThe report has been generated and is stored on the server.\nIt will NOT be sent to the candidate automatically.\n\n--- ACTION REQUIRED ---\nPlease verify payment and then send the report manually via the Admin Dashboard:\n${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/admin/result/${submissionId}\n\nInternal Report Link: ${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}${reportUrl}`,
        [{ filename: path.basename(reportPath), path: reportPath }]
      );
      
      if (emailResult.success) {
        logToFile(`[API] Admin notification sent successfully: ${emailResult.messageId}`);
      } else {
        logToFile(`[API] ERROR: Admin notification failed: ${emailResult.error}`);
      }
      
      logToFile(`[API] Process completed for ID ${submissionId}`);
    } catch (reportErr: any) {
      logToFile(`[API] Report/notification failed for ID ${submissionId}: ${reportErr.message}`);
      console.error(reportErr);
    }

    res.json({ status: "ok", id: submissionId });
  } catch (error: any) {
    logToFile(`[API] CRITICAL ERROR: ${error.message}`);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error", message: error.message });
    }
  }
});

app.post("/api/admin/send-report", async (req, res) => {
  const { id, email, name, reportUrl } = req.body;
  logToFile(`[API] Admin requesting to send report for ID ${id} to ${email}`);

  if (!id || !email || !reportUrl) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const reportsDir = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), 'reports');
    const fileName = path.basename(reportUrl);
    let reportPath = path.join(reportsDir, fileName);

    logToFile(`[API] Checking for report file at ${reportPath}...`);
    if (!fs.existsSync(reportPath)) {
      logToFile(`[API] Report file NOT found at ${reportPath}. Attempting to regenerate...`);
      
      // Fetch submission data to regenerate
      const supabase = getSupabase(true);
      const { data: sub, error: subError } = await supabase.from('submissions').select('*').eq('id', id).single();
      
      if (subError || !sub) {
        logToFile(`[API] ERROR: Could not find submission ${id} to regenerate report: ${subError?.message}`);
        return res.status(404).json({ error: "Submission not found for regeneration" });
      }

      // Regenerate
      try {
        const results = typeof sub.results === 'string' ? JSON.parse(sub.results) : sub.results;
        const product = sub.product;
        const name = sub.name;

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
        logToFile(`[API] Report successfully regenerated at: ${reportPath}`);
        
        // Update report_url in case filename changed (though it shouldn't if we use the same logic)
        const newReportUrl = `/api/reports/${path.basename(reportPath)}`;
        await supabase.from('submissions').update({ report_url: newReportUrl }).eq('id', id);
      } catch (regenErr: any) {
        logToFile(`[API] ERROR regenerating report: ${regenErr.message}`);
        return res.status(500).json({ error: "Failed to regenerate missing report" });
      }
    }

    const emailResult = await sendEmail(
      email,
      `Your CONVERGE™ Integrated Psychological Protocol: ${name}`,
      `Dear ${name},\n\nThank you for your patience while I personally reviewed your assessment results.\n\nI have completed the final triangulation of your MBTI, Big Five, and Emotional Intelligence markers. Your integrated psychological protocol is now verified and attached to this email as a PDF.\n\nThis report provides a deep architectural view of your cognitive preferences and professional suitability. I trust you will find these insights valuable for your continued growth and career strategy.\n\nShould you have any specific questions regarding the findings, please feel free to reach out.\n\nBest regards,\n\nThomas Knoesen\nCONVERGE™ | Psychological Architecture`,
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

app.get("/api/results", async (req, res) => {
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

app.patch("/api/results/:id", async (req, res) => {
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

app.delete("/api/results/:id", async (req, res) => {
  const { id } = req.params;
  logToFile(`Attempting to delete submission ${id}`);
  try {
    const supabase = getSupabase();
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

app.get("/api/reports/:filename", (req, res) => {
  const reportsDir = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), 'reports');
  const filePath = path.join(reportsDir, req.params.filename);
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).send('Report not found');
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
