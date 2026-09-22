import { getSupabase } from './lib/supabase.js';

export type ProductKey = 'mbti' | 'comprehensive' | 'recruiter';

type ProductPriceRow = {
  product_key: ProductKey;
  display_name: string;
  description: string | null;
  base_amount_cents: number;
  currency: string;
  active: boolean;
};

type PromotionRow = {
  id: number | string;
  product_key: ProductKey;
  override_amount_cents: number;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
  label: string | null;
};

const PRODUCT_KEYS: ProductKey[] = ['mbti', 'comprehensive', 'recruiter'];

function isProductKey(value: unknown): value is ProductKey {
  return PRODUCT_KEYS.includes(value as ProductKey);
}

/**
 * Supabase public.product_prices is the single authoritative pricing source.
 * Promotions are effective only inside their configured date window; an old
 * promotion left active in the database cannot accidentally remain effective.
 */
export async function getPaymentProduct(product: unknown) {
  if (!isProductKey(product)) return null;

  const supabase = getSupabase(true);
  const { data: price, error: priceError } = await supabase
    .from('product_prices')
    .select('product_key,display_name,description,base_amount_cents,currency,active')
    .eq('product_key', product)
    .eq('active', true)
    .single();

  if (priceError) {
    throw new Error(`Unable to load authoritative price for ${product}: ${priceError.message}`);
  }
  if (!price) return null;

  const typedPrice = price as ProductPriceRow;
  const now = new Date().toISOString();
  const { data: promotions, error: promotionError } = await supabase
    .from('price_promotions')
    .select('id,product_key,override_amount_cents,starts_at,ends_at,active,label')
    .eq('product_key', product)
    .eq('active', true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .order('starts_at', { ascending: false });

  if (promotionError) {
    throw new Error(`Unable to load pricing promotions for ${product}: ${promotionError.message}`);
  }

  const effectivePromotion = ((promotions || []) as PromotionRow[]).find((promotion) => {
    const startsOk = !promotion.starts_at || new Date(promotion.starts_at).getTime() <= Date.now();
    const endsOk = !promotion.ends_at || new Date(promotion.ends_at).getTime() > Date.now();
    return promotion.active && startsOk && endsOk;
  });

  const amountCents = effectivePromotion
    ? Math.max(0, Math.round(effectivePromotion.override_amount_cents))
    : Math.max(0, Math.round(typedPrice.base_amount_cents));

  return {
    key: typedPrice.product_key,
    name: typedPrice.display_name,
    description: typedPrice.description || '',
    currency: typedPrice.currency,
    amountCents,
    promotionId: effectivePromotion?.id ?? null,
    promotionLabel: effectivePromotion?.label ?? null,
  };
}
