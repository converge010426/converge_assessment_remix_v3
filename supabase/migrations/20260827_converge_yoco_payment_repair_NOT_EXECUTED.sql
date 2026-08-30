-- NOT YET EXECUTED. Review and apply to local/staging Supabase only.
-- Do not apply to production until the full release gate has passed.
BEGIN;

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS payment_token_hash text,
  ADD COLUMN IF NOT EXISTS payment_provider text,
  ADD COLUMN IF NOT EXISTS payment_currency text,
  ADD COLUMN IF NOT EXISTS payment_amount_cents integer,
  ADD COLUMN IF NOT EXISTS yoco_checkout_id text,
  ADD COLUMN IF NOT EXISTS yoco_payment_id text,
  ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'submissions_payment_status_allowed' AND conrelid = 'public.submissions'::regclass) THEN
    ALTER TABLE public.submissions ADD CONSTRAINT submissions_payment_status_allowed
      CHECK (payment_status IN ('pending', 'checkout_created', 'paid', 'failed', 'cancelled')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'submissions_payment_amount_nonnegative' AND conrelid = 'public.submissions'::regclass) THEN
    ALTER TABLE public.submissions ADD CONSTRAINT submissions_payment_amount_nonnegative
      CHECK (payment_amount_cents IS NULL OR payment_amount_cents >= 0) NOT VALID;
  END IF;
END $$;

-- These deliberately fail if historic non-null duplicates exist; resolve them first.
CREATE UNIQUE INDEX IF NOT EXISTS submissions_payment_ref_unique ON public.submissions (payment_ref) WHERE payment_ref IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS submissions_yoco_checkout_id_unique ON public.submissions (yoco_checkout_id) WHERE yoco_checkout_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS submissions_yoco_payment_id_unique ON public.submissions (yoco_payment_id) WHERE yoco_payment_id IS NOT NULL;

COMMIT;

