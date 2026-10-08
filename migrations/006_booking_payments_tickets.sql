-- Stripe Checkout, one electronic ticket per traveler, and a policy snapshot.
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS cancellation_policy text NOT NULL DEFAULT
    'Cancelación gratuita hasta 24 horas antes de la actividad. Después de ese plazo, contacta con soporte. Si el operador cancela la actividad, recibirás un reembolso completo.';

ALTER TABLE public.booking_requests
    ADD COLUMN IF NOT EXISTS checkout_session_id text UNIQUE,
    ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
    ADD COLUMN IF NOT EXISTS ticket_code text UNIQUE,
    ADD COLUMN IF NOT EXISTS ticket_email_sent_at timestamptz,
    ADD COLUMN IF NOT EXISTS cancellation_policy text NOT NULL DEFAULT
    'Cancelación gratuita hasta 24 horas antes de la actividad. Después de ese plazo, contacta con soporte. Si el operador cancela la actividad, recibirás un reembolso completo.';

CREATE INDEX IF NOT EXISTS booking_requests_payment_status_idx
    ON public.booking_requests (payment_status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.booking_tickets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id uuid NOT NULL REFERENCES public.booking_requests(id) ON DELETE CASCADE,
    booking_reference text NOT NULL REFERENCES public.booking_requests(reference) ON DELETE CASCADE,
    ticket_number integer NOT NULL CHECK (ticket_number >= 1),
    ticket_code text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (booking_id, ticket_number)
);

CREATE INDEX IF NOT EXISTS booking_tickets_reference_idx
    ON public.booking_tickets (booking_reference, ticket_number);
