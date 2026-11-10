// Idempotent: safe to run on every boot. Constraint names are spelled out
// because the repository maps a violated constraint back to a DuplicateError
// by name; a generated name would silently stop matching.
//
// Regions and transport types are not here: they are reference data defined in
// code. Carriers are stored, because new ones join through the site; the ones
// defined in code are written into the table on every boot.
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS carriers (
    carrier_id       uuid PRIMARY KEY,
    name             text NOT NULL,
    legal_name       text NOT NULL,
    transport_types  text[] NOT NULL,
    cargo_categories text[] NOT NULL,
    created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
    user_id       uuid PRIMARY KEY,
    email         text NOT NULL CONSTRAINT users_email_key UNIQUE,
    name          text NOT NULL,
    role          text NOT NULL CHECK (role IN ('CLIENT', 'MANAGER', 'ADMIN')),
    company_name  text,
    carrier_id    uuid,
    password_hash text NOT NULL,
    created_at    timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS tariffs (
    tariff_id          uuid PRIMARY KEY,
    carrier_id         uuid NOT NULL,
    from_region_id     uuid NOT NULL,
    to_region_id       uuid NOT NULL,
    transport_type     text NOT NULL,
    price_per_kg_cents integer NOT NULL CHECK (price_per_kg_cents >= 0),
    price_per_m3_cents integer NOT NULL CHECK (price_per_m3_cents >= 0),
    min_charge_cents   integer NOT NULL CHECK (min_charge_cents >= 0),
    transit_days       integer NOT NULL CHECK (transit_days > 0),
    CONSTRAINT tariffs_lane_key UNIQUE (carrier_id, from_region_id, to_region_id, transport_type)
);
CREATE INDEX IF NOT EXISTS tariffs_ends_idx ON tariffs (from_region_id, to_region_id);

CREATE TABLE IF NOT EXISTS rfqs (
    rfq_id               uuid PRIMARY KEY,
    client_id            uuid NOT NULL,
    from_region_id       uuid NOT NULL,
    to_region_id         uuid NOT NULL,
    weight_kg            double precision NOT NULL,
    volume_m3            double precision NOT NULL,
    cargo_category       text NOT NULL,
    transport_type       text,
    ready_date           text,
    description          text,
    declared_value_cents bigint,
    status               text NOT NULL,
    eligible_carrier_ids uuid[] NOT NULL,
    accepted_quote_id    uuid,
    created_at           timestamptz NOT NULL,
    expires_at           timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS rfqs_client_idx ON rfqs (client_id);
CREATE INDEX IF NOT EXISTS rfqs_invited_idx ON rfqs USING GIN (eligible_carrier_ids);

CREATE TABLE IF NOT EXISTS rfq_quotes (
    quote_id       uuid PRIMARY KEY,
    rfq_id         uuid NOT NULL REFERENCES rfqs (rfq_id) ON DELETE CASCADE,
    carrier_id     uuid NOT NULL,
    transport_type text NOT NULL,
    price_cents    bigint NOT NULL,
    transit_days   integer NOT NULL,
    valid_until    timestamptz NOT NULL,
    comment        text,
    status         text NOT NULL,
    created_at     timestamptz NOT NULL,
    updated_at     timestamptz NOT NULL,
    CONSTRAINT rfq_quotes_carrier_key UNIQUE (rfq_id, carrier_id)
);

CREATE TABLE IF NOT EXISTS shipments (
    shipment_id          uuid PRIMARY KEY,
    tracking_code        text NOT NULL CONSTRAINT shipments_tracking_code_key UNIQUE,
    source               text NOT NULL,
    rfq_id               uuid CONSTRAINT shipments_rfq_id_key UNIQUE,
    tariff_id            uuid,
    client_id            uuid NOT NULL,
    carrier_id           uuid NOT NULL,
    transport_type       text NOT NULL,
    from_region_id       uuid NOT NULL,
    to_region_id         uuid NOT NULL,
    weight_kg            double precision NOT NULL,
    volume_m3            double precision NOT NULL,
    cargo_category       text NOT NULL,
    description          text,
    declared_value_cents bigint,
    price_cents          bigint NOT NULL,
    transit_days         integer NOT NULL,
    status               text NOT NULL,
    history              jsonb NOT NULL,
    created_at           timestamptz NOT NULL,
    updated_at           timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS shipments_client_idx ON shipments (client_id);
CREATE INDEX IF NOT EXISTS shipments_carrier_idx ON shipments (carrier_id);
`;
