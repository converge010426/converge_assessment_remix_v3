// VERSION: 5.4 (FINAL ROUTING FIX)
// SYNC_ID: SYNC_20260406_0705
import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
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

logToFile("API Server Initializing...");

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// API routes
app.get("/api/health", (req, res) => {
  logToFile("Health check called");
  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const serviceKeyPreview = hasServiceKey ? `${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 5)}...` : 'NOT SET';
  
  res.json({ 
    status: "ok", 
    version: "5.4 (FINAL ROUTING FIX)",
    syncId: "SYNC_20260406_0705",
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
  const { name, email, answers, results, product } = req.body;
  
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
      report_url: null 
    };

    let finalData = null;
    let finalError = null;
    let finalStatus = null;

    const { data: firstData, error: firstError, status: firstStatus } = await supabase
      .from('submissions')
      .insert([payload])
      .select();

    finalData = firstData;
    finalError = firstError;
    finalStatus = firstStatus;

    // If it failed, try stringifying the complex objects (for TEXT columns)
    if (firstError) {
      logToFile(`[API] First attempt failed (${firstError.message}), trying stringified payload...`);
      const stringifiedPayload = {
        ...payload,
        results: JSON.stringify(results),
        answers: JSON.stringify(answers)
      };
      const { data: retryData, error: retryError, status: retryStatus } = await supabase
        .from('submissions')
        .insert([stringifiedPayload])
        .select();
      
      finalData = retryData;
      finalError = retryError;
      finalStatus = retryStatus;
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

    res.json({ status: "ok", id: submissionId });

    // Background report generation
    try {
      let reportPath;
      if (product === 'comprehensive' || product === 'recruiter') {
        reportPath = await generateComprehensiveReport(name, results, product === 'recruiter');
      } else {
        reportPath = await generateMBTIReport(name, results);
      }
      const reportUrl = `/api/reports/${path.basename(reportPath)}`;
      await supabase.from('submissions').update({ report_url: reportUrl }).eq('id', submissionId);
    } catch (reportErr: any) {
      logToFile(`[API] Background report failed: ${reportErr.message}`);
    }

  } catch (error: any) {
    logToFile(`[API] CRITICAL ERROR: ${error.message}`);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error", message: error.message });
    }
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
    
    res.setHeader('X-Supabase-Status', String(status));
    res.setHeader('X-Supabase-Count', String(data?.length || 0));
    res.setHeader('X-Supabase-Exact-Count', String(count || 0));
    res.setHeader('X-Using-Service-Role', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'true' : 'false');
    res.setHeader('X-Connection-Ok', String(connectionOk));
    if (connectionError) {
      res.setHeader('X-Connection-Error', connectionError.replace(/\n/g, ' '));
    }
    
    res.json(data);
  } catch (error: any) {
    logToFile(`Error fetching results: ${error.message}`);
    res.status(500).json({ error: error.message });
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
