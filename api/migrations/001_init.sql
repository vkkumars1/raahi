-- Raahi schema. Requires PostGIS + citext (both available on Neon, Supabase, RDS).
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           citext UNIQUE NOT NULL,
  name            text,
  role            text CHECK (role IN ('host', 'guest')),
  vehicle_type    text CHECK (vehicle_type IN ('car', 'bike')),
  office_location text,
  email_verified  boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rides (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  origin_label      text NOT NULL,
  origin            geography(Point, 4326) NOT NULL,
  destination_label text NOT NULL,
  destination       geography(Point, 4326) NOT NULL,
  route             geography(LineString, 4326) NOT NULL,
  route_length_m    double precision NOT NULL CHECK (route_length_m > 0),
  depart_time       timestamptz NOT NULL,
  seats_total       smallint NOT NULL CHECK (seats_total BETWEEN 1 AND 6),
  seats_left        smallint NOT NULL CHECK (seats_left >= 0),
  vehicle_type      text NOT NULL DEFAULT 'car' CHECK (vehicle_type IN ('car', 'bike')),
  price_per_km      numeric(6,2) NOT NULL CHECK (price_per_km >= 0),
  status            text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (seats_left <= seats_total)
);
-- Spatial index: makes ST_DWithin on routes fast
CREATE INDEX rides_route_gix ON rides USING GIST (route);
CREATE INDEX rides_depart_idx ON rides (depart_time) WHERE status = 'scheduled';
CREATE INDEX rides_host_idx ON rides (host_id);

CREATE TABLE bookings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id       uuid NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  guest_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pickup_label  text NOT NULL,
  pickup        geography(Point, 4326) NOT NULL,
  dropoff_label text NOT NULL,
  dropoff       geography(Point, 4326) NOT NULL,
  distance_m    double precision NOT NULL,
  fare          numeric(8,2) NOT NULL CHECK (fare >= 0),
  status        text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ride_id, guest_id)
);
CREATE INDEX bookings_guest_idx ON bookings (guest_id);
CREATE INDEX bookings_ride_idx ON bookings (ride_id);

CREATE TABLE messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id    uuid NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  sender_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_ride_idx ON messages (ride_id, created_at);

CREATE TABLE ratings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id    uuid NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  rater_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ratee_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating     smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    text CHECK (char_length(comment) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ride_id, rater_id, ratee_id),
  CHECK (rater_id <> ratee_id)
);
CREATE INDEX ratings_ratee_idx ON ratings (ratee_id);
