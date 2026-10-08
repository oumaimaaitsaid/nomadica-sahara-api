-- Bring the catalog schema under version control. Existing rows are preserved.
ALTER TABLE public.categories ALTER COLUMN image_key DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type text NOT NULL CHECK (type IN ('activity', 'hotel', 'dinner', 'hammam', 'private-tour')),
    title text NOT NULL,
    slug text NOT NULL UNIQUE,
    location text NOT NULL,
    destination text NOT NULL,
    image text NOT NULL,
    gallery text[] NOT NULL DEFAULT '{}',
    price numeric(12, 2) NOT NULL CHECK (price >= 0),
    currency text NOT NULL DEFAULT 'EUR' CHECK (currency IN ('EUR', 'MAD')),
    rating numeric(3, 2),
    review_count integer,
    description text NOT NULL DEFAULT '',
    duration text,
    duration_hours numeric(6, 2),
    date text,
    availability text,
    category text,
    tags text[] NOT NULL DEFAULT '{}',
    discount numeric(12, 2),
    featured boolean NOT NULL DEFAULT false,
    meeting_point text,
    pickup_included boolean NOT NULL DEFAULT false,
    stars integer,
    hotel_facilities text[] NOT NULL DEFAULT '{}',
    vehicle_type text,
    passengers integer,
    menu_type text,
    show_included boolean NOT NULL DEFAULT false,
    treatment_duration text,
    treatment text,
    time text,
    private_group_size text,
    href text,
    itinerary jsonb NOT NULL DEFAULT '{}',
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('active', 'draft', 'paused')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pricing_options jsonb;

CREATE INDEX IF NOT EXISTS products_public_listing_idx
    ON public.products (status, type, destination, created_at DESC);
