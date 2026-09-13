import settings from '../CONVERGE_SETTINGS.json';

export const PRICING = settings.PRICING;
export const BANKING_DETAILS = settings.BANKING_DETAILS;
export const SYSTEM_VERSION = settings.SYSTEM_VERSION;

// CONVERGE_SETTINGS remains a build-time fallback for non-browser/local use.
// In the browser, Supabase-backed pricing is loaded from the server endpoint
// and cached only for the current tab. The database remains authoritative.
if (typeof window !== 'undefined') {
  const applyPricing = (products: Record<string, any>) => {
    for (const key of ['mbti', 'comprehensive', 'recruiter']) {
      const remote = products[key];
      const local = (PRICING.products as any)[key];
      if (!remote || !local) continue;
      local.price = remote.displayPrice;
      local.name = remote.name;
      local.description = remote.description;
      PRICING.currency = remote.currency;
    }
  };

  try {
    const cached = window.sessionStorage.getItem('converge_authoritative_pricing');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.products) applyPricing(parsed.products);
    }
  } catch {
    // Build-time pricing remains the safe fallback if browser storage is unavailable.
  }

  void fetch('/api/pricing', { cache: 'no-store' })
    .then((response) => response.ok ? response.json() : null)
    .then((remote) => {
      if (!remote?.products) return;

      // Compare only the actual pricing payload. The endpoint also returns a
      // fresh `asOf` timestamp on every request, so comparing the entire
      // response would cause an endless reload loop.
      const serializedProducts = JSON.stringify(remote.products);
      const previous = window.sessionStorage.getItem('converge_authoritative_pricing_products');
      window.sessionStorage.setItem('converge_authoritative_pricing', JSON.stringify({ products: remote.products }));
      window.sessionStorage.setItem('converge_authoritative_pricing_products', serializedProducts);
      applyPricing(remote.products);

      if (previous !== serializedProducts) {
        // Reload once after a genuine pricing change so every React render uses
        // the authoritative values rather than relying on DOM mutation.
        window.location.reload();
      }
    })
    .catch(() => {
      // If the pricing endpoint is temporarily unavailable, keep the last
      // known session value or the build-time fallback rather than blocking the site.
    });
}
