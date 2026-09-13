import { getSupabase } from '../src/lib/supabase.js';

type ProductKey = 'mbti' | 'comprehensive' | 'recruiter';

export default async function handler(_req: any, res: any) {
  try {
    const supabase = getSupabase(true);
    const { data: prices, error: priceError } = await supabase
      .from('product_prices')
      .select('product_key,display_name,description,base_amount_cents,currency,active')
      .eq('active', true)
      .in('product_key', ['mbti', 'comprehensive', 'recruiter']);

    if (priceError) throw priceError;

    const now = new Date();
    const { data: promotions, error: promotionError } = await supabase
      .from('price_promotions')
      .select('id,product_key,override_amount_cents,starts_at,ends_at,active,label')
      .eq('active', true);

    if (promotionError) throw promotionError;

    const result = (prices || []).reduce<Record<string, any>>((acc, row: any) => {
      const promotion = (promotions || []).find((item: any) =>
        item.product_key === row.product_key &&
        item.active &&
        (!item.starts_at || new Date(item.starts_at) <= now) &&
        (!item.ends_at || new Date(item.ends_at) > now)
      );
      const amountCents = promotion
        ? Math.max(0, Math.round(promotion.override_amount_cents))
        : Math.max(0, Math.round(row.base_amount_cents));
      acc[row.product_key as ProductKey] = {
        key: row.product_key,
        name: row.display_name,
        description: row.description || '',
        currency: row.currency,
        amountCents,
        displayPrice: `${row.currency === 'ZAR' ? 'R' : row.currency} ${(amountCents / 100).toFixed(0)}`,
        promotionId: promotion?.id ?? null,
        promotionLabel: promotion?.label ?? null,
      };
      return acc;
    }, {});

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ products: result, asOf: now.toISOString() });
  } catch (error: any) {
    console.error('[pricing] failed:', error);
    return res.status(500).json({ error: 'PRICING_UNAVAILABLE', message: 'Unable to load current pricing.' });
  }
}
