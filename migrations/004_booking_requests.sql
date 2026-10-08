CREATE TABLE IF NOT EXISTS public.booking_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reference text NOT NULL UNIQUE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    product_slug text NOT NULL,
    product_title text NOT NULL,
    offer_tier text CHECK (offer_tier IN ('base', 'economic', 'standard', 'premium')),
    unit_price numeric(12, 2) NOT NULL CHECK (unit_price >= 0),
    currency text NOT NULL,
    total numeric(12, 2) NOT NULL CHECK (total >= 0),
    booking_date date NOT NULL,
    travelers integer NOT NULL CHECK (travelers BETWEEN 1 AND 20),
    pickup text NOT NULL DEFAULT '',
    notes text NOT NULL DEFAULT '',
    customer_name text NOT NULL,
    customer_email text NOT NULL,
    country_code text NOT NULL,
    customer_phone text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    payment_status text NOT NULL DEFAULT 'unpaid',
    consent_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid';
ALTER TABLE public.booking_requests DROP CONSTRAINT IF EXISTS booking_requests_status_check;
ALTER TABLE public.booking_requests ADD CONSTRAINT booking_requests_status_check
    CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled'));
ALTER TABLE public.booking_requests DROP CONSTRAINT IF EXISTS booking_requests_payment_status_check;
ALTER TABLE public.booking_requests ADD CONSTRAINT booking_requests_payment_status_check
    CHECK (payment_status IN ('unpaid', 'paid', 'refunded'));

CREATE INDEX IF NOT EXISTS booking_requests_created_at_idx
    ON public.booking_requests (created_at DESC);
