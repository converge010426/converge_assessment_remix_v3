import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export type ProductKey = 'mbti' | 'comprehensive' | 'recruiter';

type ProductConfig = { name: string; price: string; description: string };
type PricingSettings = { PRICING: { products: Record<ProductKey, ProductConfig>; currency: string } };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Loaded lazily (on first actual use) rather than as a static top-level import.
// A static `import settings from '../CONVERGE_SETTINGS.json'` runs at module
// initialization time, before any request handler exists to catch a failure -
// if that ever failed to resolve in the deployed bundle, it would crash the
// entire serverless function on cold start (FUNCTION_INVOCATION_FAILED), for
// every route, not just this one. Loading it here, inside a function, means
// any failure (missing file, unreadable, malformed JSON) surfaces as a normal
// JS Error at the point of use, which the caller can catch and turn into a
// controlled JSON error response instead.
let cachedSettings: PricingSettings | null = null;

function loadSettings(): PricingSettings {
  if (cachedSettings) return cachedSettings;
  const settingsPath = path.join(__dirname, '..', 'CONVERGE_SETTINGS.json');
  const raw = fs.readFileSync(settingsPath, 'utf-8');
  cachedSettings = JSON.parse(raw) as PricingSettings;
  return cachedSettings;
}

function priceToCents(price: string): number {
  const parsed = Number(price.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`Invalid configured price: ${price}`);
  return Math.round(parsed * 100);
}

export function getPaymentProduct(product: unknown) {
  if (product !== 'mbti' && product !== 'comprehensive' && product !== 'recruiter') return null;
  const settings = loadSettings();
  const configured = settings.PRICING.products[product];
  if (!configured) return null;
  return { key: product, name: configured.name, currency: settings.PRICING.currency, amountCents: priceToCents(configured.price) };
}
