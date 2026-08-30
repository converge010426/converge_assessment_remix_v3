import settings from '../CONVERGE_SETTINGS.json';

export type ProductKey = 'mbti' | 'comprehensive' | 'recruiter';

type ProductConfig = { name: string; price: string; description: string };

const products = settings.PRICING.products as Record<ProductKey, ProductConfig>;

function priceToCents(price: string): number {
  const parsed = Number(price.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`Invalid configured price: ${price}`);
  return Math.round(parsed * 100);
}

export function getPaymentProduct(product: unknown) {
  if (product !== 'mbti' && product !== 'comprehensive' && product !== 'recruiter') return null;
  const configured = products[product];
  return { key: product, name: configured.name, currency: settings.PRICING.currency, amountCents: priceToCents(configured.price) };
}

