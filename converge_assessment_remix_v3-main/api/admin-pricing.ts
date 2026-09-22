import crypto from 'crypto';
import { getSupabase } from '../src/lib/supabase.js';

type ProductKey = 'mbti' | 'comprehensive' | 'recruiter';
const PRODUCT_KEYS: ProductKey[] = ['mbti', 'comprehensive', 'recruiter'];
const ADMIN_SECRET = process.env.ADMIN_PASSWORD || process.env.VITE_ADMIN_PASSWORD || 'admin123';
const ADMIN_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

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

function requireAdmin(req: any, res: any) {
  const header = String(req.headers.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!verifyAdminToken(token)) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Admin authentication required.' });
    return false;
  }
  return true;
}

export default async function handler(req: any, res: any) {
  if (!requireAdmin(req, res)) return;
  try {
    const supabase = getSupabase(true);
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('product_prices')
        .select('product_key,display_name,description,base_amount_cents,currency,active,updated_at')
        .in('product_key', PRODUCT_KEYS)
        .order('product_key');
      if (error) throw error;
      return res.status(200).json({ products: data || [] });
    }
    if (req.method === 'PATCH') {
      const body = req.body || {};
      const productKey = body.productKey as ProductKey;
      const amountCents = Number(body.amountCents);
      if (!PRODUCT_KEYS.includes(productKey) || !Number.isInteger(amountCents) || amountCents < 0 || amountCents > 100000000) {
        return res.status(400).json({ error: 'INVALID_PRICE', message: 'Provide a valid product and non-negative whole-number amount in cents.' });
      }
      const { data, error } = await supabase
        .from('product_prices')
        .update({ base_amount_cents: amountCents, updated_at: new Date().toISOString() })
        .eq('product_key', productKey)
        .select('product_key,display_name,description,base_amount_cents,currency,active,updated_at')
        .single();
      if (error) throw error;
      return res.status(200).json({ product: data });
    }
    res.setHeader('Allow', 'GET, PATCH');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  } catch (error: any) {
    console.error('[admin-pricing] failed:', error);
    return res.status(500).json({ error: 'PRICING_ADMIN_ERROR', message: error.message || 'Unable to manage pricing.' });
  }
}
