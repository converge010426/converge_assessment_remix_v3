import fs from 'fs';
import path from 'path';

const FALLBACK_PATH = path.join(process.cwd(), 'CONVERGE_SETTINGS.json');

type ProductKey = 'mbti' | 'comprehensive' | 'recruiter';

type ProductRow = {
  product_key: ProductKey;
  name: string;
  price_cents: number;
  currency: string;
  active: boolean;
};

function fallbackPricing() {
  const raw = fs.readFileSync(FALLBACK_PATH, 'utf-8');
  const settings = JSON.parse(raw);
  return {
    currency: settings.PRICING.currency,
    products: settings.PRICING.products,
    source: 'CONVERGE_SETTINGS.json',
  };
}

async function readAuthoritativePricing() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return fallbackPricing();

  const response = await fetch(`${url}/rest/v1/converge_pricing?select=product_key,name,price_cents,currency,active&order=product_key.asc`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) return fallbackPricing();

  const rows = (await response.json()) as ProductRow[];
  if (!Array.isArray(rows) || rows.length !== 3) return fallbackPricing();

  const products = Object.fromEntries(rows.map((row) => [
    row.product_key,
    {
      name: row.name,
      price: `R ${(row.price_cents / 100).toFixed(0)}`,
      description: row.product_key === 'mbti'
        ? 'Myers-Briggs type assessment based on Carl Jung 16 types theory.'
        : row.product_key === 'comprehensive'
          ? 'Multi-dimensional report integrating MBTI, Big Five, and Emotional Intelligence.'
          : 'MBTI, Comprehensive + Job-Specific Candidate Suitability Analysis for hiring.',
    },
  ]));

  return {
    currency: rows[0]?.currency || 'ZAR',
    products,
    source: 'Supabase converge_pricing',
  };
}

export async function GET() {
  try {
    return Response.json(await readAuthoritativePricing(), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return Response.json(fallbackPricing(), {
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
