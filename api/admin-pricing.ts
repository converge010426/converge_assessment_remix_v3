import crypto from 'crypto';

const ADMIN_SECRET = process.env.ADMIN_PASSWORD || process.env.VITE_ADMIN_PASSWORD || 'admin123';
const ADMIN_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

type ProductKey = 'mbti' | 'comprehensive' | 'recruiter';

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
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;
    return Date.now() <= Number(expiresAt) && Number(issuedAt) <= Date.now();
  } catch {
    return false;
  }
}

function authorized(request: Request) {
  const auth = request.headers.get('authorization') || '';
  return verifyAdminToken(auth.startsWith('Bearer ') ? auth.slice(7) : undefined);
}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase server configuration is missing.');
  return { url, key };
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  try {
    const { url, key } = supabaseConfig();
    const response = await fetch(`${url}/rest/v1/converge_pricing?select=product_key,name,price_cents,currency,active&order=product_key.asc`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Pricing read failed (${response.status}).`);
    return Response.json(await response.json(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    return Response.json({ error: error.message || 'Unable to read pricing.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!authorized(request)) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  try {
    const body = await request.json();
    const product = body?.product as ProductKey;
    const price = Number(body?.price);
    if (!['mbti', 'comprehensive', 'recruiter'].includes(product)) {
      return Response.json({ error: 'Invalid product.' }, { status: 400 });
    }
    if (!Number.isFinite(price) || price < 0 || price > 1000000) {
      return Response.json({ error: 'Price must be a valid non-negative amount.' }, { status: 400 });
    }

    const { url, key } = supabaseConfig();
    const response = await fetch(`${url}/rest/v1/converge_pricing?product_key=eq.${product}`, {
      method: 'PATCH',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ price_cents: Math.round(price * 100), updated_at: new Date().toISOString() }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return Response.json({ error: `Pricing update failed (${response.status}).`, detail }, { status: 500 });
    }

    const updated = await response.json();
    return Response.json({ ok: true, updated });
  } catch (error: any) {
    return Response.json({ error: error.message || 'Unable to update pricing.' }, { status: 500 });
  }
}
