import pg from "pg";

import type {StoredUser, UserRole} from "../contracts/auth.contract";
import type {CargoCategory} from "../contracts/cargo.contract";
import type {Rfq, RfqQuote} from "../contracts/rfq.contract";
import type {Shipment, ShipmentEvent} from "../contracts/shipment.contract";
import type {Tariff} from "../contracts/tariff.contract";
import type {TransportType} from "../contracts/transport.contract";
import {SCHEMA} from "../db/schema";
import {DuplicateError, type Repositories, type TariffFilter} from "./types";

// bigint columns (money, declared value) arrive as strings by default, because
// they can exceed JavaScript's safe integers. Ours never do — the validators cap
// them far below 2^53 — so they are read back as plain numbers.
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => Number(value));

const UNIQUE_VIOLATION = "23505";
const DUPLICATE_BY_CONSTRAINT: Record<string, DuplicateError["field"]> = {
    users_email_key: "email",
    tariffs_lane_key: "lane",
    shipments_tracking_code_key: "trackingCode",
    shipments_rfq_id_key: "rfqId",
};

const rethrowDuplicate = (error: unknown): never => {
    const pgError = error as {code?: string; constraint?: string};
    const field = pgError.constraint ? DUPLICATE_BY_CONSTRAINT[pgError.constraint] : undefined;

    if (pgError.code === UNIQUE_VIOLATION && field) {
        throw new DuplicateError(field);
    }

    throw error;
};

type Row = Record<string, unknown>;

const iso = (value: unknown): string => (value as Date).toISOString();
const optional = <K extends string, V>(key: K, value: V | null): Partial<Record<K, V>> =>
    (value === null ? {} : {[key]: value}) as Partial<Record<K, V>>;

const toUser = (r: Row): StoredUser => ({
    userId: r.user_id as string,
    email: r.email as string,
    name: r.name as string,
    role: r.role as UserRole,
    ...optional("companyName", r.company_name as string | null),
    ...optional("carrierId", r.carrier_id as string | null),
    passwordHash: r.password_hash as string,
    createdAt: iso(r.created_at),
});

const toTariff = (r: Row): Tariff => ({
    tariffId: r.tariff_id as string,
    carrierId: r.carrier_id as string,
    fromRegionId: r.from_region_id as string,
    toRegionId: r.to_region_id as string,
    transportType: r.transport_type as TransportType,
    pricePerKgCents: r.price_per_kg_cents as number,
    pricePerM3Cents: r.price_per_m3_cents as number,
    minChargeCents: r.min_charge_cents as number,
    transitDays: r.transit_days as number,
});

const toRfq = (r: Row): Rfq => ({
    rfqId: r.rfq_id as string,
    clientId: r.client_id as string,
    fromRegionId: r.from_region_id as string,
    toRegionId: r.to_region_id as string,
    weightKg: r.weight_kg as number,
    volumeM3: r.volume_m3 as number,
    cargoCategory: r.cargo_category as CargoCategory,
    ...optional("transportType", r.transport_type as TransportType | null),
    ...optional("readyDate", r.ready_date as string | null),
    ...optional("description", r.description as string | null),
    ...optional("declaredValueCents", r.declared_value_cents as number | null),
    status: r.status as Rfq["status"],
    eligibleCarrierIds: r.eligible_carrier_ids as string[],
    ...optional("acceptedQuoteId", r.accepted_quote_id as string | null),
    createdAt: iso(r.created_at),
    expiresAt: iso(r.expires_at),
});

const toQuote = (r: Row): RfqQuote => ({
    quoteId: r.quote_id as string,
    rfqId: r.rfq_id as string,
    carrierId: r.carrier_id as string,
    transportType: r.transport_type as TransportType,
    priceCents: r.price_cents as number,
    transitDays: r.transit_days as number,
    validUntil: iso(r.valid_until),
    ...optional("comment", r.comment as string | null),
    status: r.status as RfqQuote["status"],
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
});

const toShipment = (r: Row): Shipment => ({
    shipmentId: r.shipment_id as string,
    trackingCode: r.tracking_code as string,
    source: r.source as Shipment["source"],
    ...optional("rfqId", r.rfq_id as string | null),
    ...optional("tariffId", r.tariff_id as string | null),
    clientId: r.client_id as string,
    carrierId: r.carrier_id as string,
    transportType: r.transport_type as TransportType,
    fromRegionId: r.from_region_id as string,
    toRegionId: r.to_region_id as string,
    weightKg: r.weight_kg as number,
    volumeM3: r.volume_m3 as number,
    cargoCategory: r.cargo_category as CargoCategory,
    ...optional("description", r.description as string | null),
    ...optional("declaredValueCents", r.declared_value_cents as number | null),
    priceCents: r.price_cents as number,
    transitDays: r.transit_days as number,
    status: r.status as Shipment["status"],
    history: r.history as ShipmentEvent[],
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
});

const tariffWhere = (filter: TariffFilter): {sql: string; params: unknown[]} => {
    const clauses: string[] = [];
    const params: unknown[] = [];
    const add = (column: string, value: unknown) => {
        if (value !== undefined) {
            params.push(value);
            clauses.push(`${column} = $${params.length}`);
        }
    };

    add("carrier_id", filter.carrierId);
    add("from_region_id", filter.fromRegionId);
    add("to_region_id", filter.toRegionId);
    add("transport_type", filter.transportType);

    return {sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params};
};

export const createPostgresRepositories = (connectionString: string): Repositories => {
    // A handful of connections: Neon's free tier caps them, and a single small
    // Render instance cannot use more anyway.
    const pool = new pg.Pool({connectionString, max: 5});

    const one = async <T>(sql: string, params: unknown[], map: (r: Row) => T): Promise<T | undefined> => {
        const {rows} = await pool.query(sql, params);
        return rows[0] ? map(rows[0]) : undefined;
    };

    const many = async <T>(sql: string, params: unknown[], map: (r: Row) => T): Promise<T[]> => {
        const {rows} = await pool.query(sql, params);
        return rows.map(map);
    };

    // Closing an RFQ touches the RFQ and every quote on it; both happen or
    // neither does. The status condition in the UPDATE is what makes two
    // simultaneous "accept" clicks safe: only one of them finds it still OPEN.
    const closeOpenRfq = async (rfqId: string, setRfq: string, rfqParams: unknown[], quoteStatusSql: string, quoteParams: unknown[]): Promise<boolean> => {
        const client = await pool.connect();

        try {
            await client.query("BEGIN");
            const result = await client.query(`UPDATE rfqs SET ${setRfq} WHERE rfq_id = $1 AND status = 'OPEN'`, [rfqId, ...rfqParams]);

            if (result.rowCount !== 1) {
                await client.query("ROLLBACK");
                return false;
            }

            await client.query(`UPDATE rfq_quotes SET status = ${quoteStatusSql}, updated_at = $2 WHERE rfq_id = $1`, [rfqId, ...quoteParams]);
            await client.query("COMMIT");
            return true;
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    };

    return {
        users: {
            findById: (id) => one("SELECT * FROM users WHERE user_id = $1", [id], toUser),
            findByEmail: (email) => one("SELECT * FROM users WHERE email = $1", [email], toUser),
            insert: async (u) => {
                await pool
                    .query(
                        `INSERT INTO users (user_id, email, name, role, company_name, carrier_id, password_hash, created_at)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                        [u.userId, u.email, u.name, u.role, u.companyName ?? null, u.carrierId ?? null, u.passwordHash, u.createdAt],
                    )
                    .catch(rethrowDuplicate);
            },
        },

        tariffs: {
            findById: (id) => one("SELECT * FROM tariffs WHERE tariff_id = $1", [id], toTariff),
            findByLane: (lane) =>
                one(
                    "SELECT * FROM tariffs WHERE carrier_id = $1 AND from_region_id = $2 AND to_region_id = $3 AND transport_type = $4",
                    [lane.carrierId, lane.fromRegionId, lane.toRegionId, lane.transportType],
                    toTariff,
                ),
            list: (filter) => {
                const where = tariffWhere(filter);
                return many(`SELECT * FROM tariffs ${where.sql} ORDER BY tariff_id`, where.params, toTariff);
            },
            listBetween: (fromIds, toIds) =>
                many(
                    "SELECT * FROM tariffs WHERE from_region_id = ANY($1::uuid[]) AND to_region_id = ANY($2::uuid[])",
                    [fromIds, toIds],
                    toTariff,
                ),
            insert: async (t) => {
                await pool
                    .query(
                        `INSERT INTO tariffs (tariff_id, carrier_id, from_region_id, to_region_id, transport_type,
                                              price_per_kg_cents, price_per_m3_cents, min_charge_cents, transit_days)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                        [t.tariffId, t.carrierId, t.fromRegionId, t.toRegionId, t.transportType,
                            t.pricePerKgCents, t.pricePerM3Cents, t.minChargeCents, t.transitDays],
                    )
                    .catch(rethrowDuplicate);
            },
            updatePrices: async (id, p) => {
                await pool.query(
                    `UPDATE tariffs SET price_per_kg_cents = $2, price_per_m3_cents = $3, min_charge_cents = $4, transit_days = $5
                     WHERE tariff_id = $1`,
                    [id, p.pricePerKgCents, p.pricePerM3Cents, p.minChargeCents, p.transitDays],
                );
            },
            delete: async (id) => {
                await pool.query("DELETE FROM tariffs WHERE tariff_id = $1", [id]);
            },
        },

        rfqs: {
            insert: async (r) => {
                await pool.query(
                    `INSERT INTO rfqs (rfq_id, client_id, from_region_id, to_region_id, weight_kg, volume_m3, cargo_category,
                                       transport_type, ready_date, description, declared_value_cents, status,
                                       eligible_carrier_ids, accepted_quote_id, created_at, expires_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
                    [r.rfqId, r.clientId, r.fromRegionId, r.toRegionId, r.weightKg, r.volumeM3, r.cargoCategory,
                        r.transportType ?? null, r.readyDate ?? null, r.description ?? null, r.declaredValueCents ?? null,
                        r.status, r.eligibleCarrierIds, r.acceptedQuoteId ?? null, r.createdAt, r.expiresAt],
                );
            },
            findById: (id) => one("SELECT * FROM rfqs WHERE rfq_id = $1", [id], toRfq),
            list: (scope) =>
                many(
                    `SELECT * FROM rfqs
                     WHERE ($1::uuid IS NULL OR client_id = $1) AND ($2::uuid IS NULL OR $2 = ANY(eligible_carrier_ids))
                     ORDER BY created_at DESC`,
                    [scope.clientId ?? null, scope.carrierId ?? null],
                    toRfq,
                ),
            expireIfDue: async (id, now) => {
                const result = await pool.query(
                    "UPDATE rfqs SET status = 'EXPIRED' WHERE rfq_id = $1 AND status = 'OPEN' AND expires_at <= $2",
                    [id, now],
                );
                return result.rowCount === 1;
            },
            quotesOf: (id) => many("SELECT * FROM rfq_quotes WHERE rfq_id = $1 ORDER BY price_cents", [id], toQuote),
            findQuote: (id) => one("SELECT * FROM rfq_quotes WHERE quote_id = $1", [id], toQuote),
            // ON CONFLICT keeps the first quote's id and createdAt, so a revised
            // price is the same quote, not a second one.
            upsertQuote: async (q) => {
                const stored = await one(
                    `INSERT INTO rfq_quotes (quote_id, rfq_id, carrier_id, transport_type, price_cents, transit_days,
                                             valid_until, comment, status, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                     ON CONFLICT ON CONSTRAINT rfq_quotes_carrier_key DO UPDATE SET
                         transport_type = EXCLUDED.transport_type, price_cents = EXCLUDED.price_cents,
                         transit_days = EXCLUDED.transit_days, valid_until = EXCLUDED.valid_until,
                         comment = EXCLUDED.comment, status = EXCLUDED.status, updated_at = EXCLUDED.updated_at
                     RETURNING *`,
                    [q.quoteId, q.rfqId, q.carrierId, q.transportType, q.priceCents, q.transitDays,
                        q.validUntil, q.comment ?? null, q.status, q.createdAt, q.updatedAt],
                    toQuote,
                );
                return stored!;
            },
            accept: (rfqId, quoteId, now) =>
                closeOpenRfq(
                    rfqId,
                    "status = 'ACCEPTED', accepted_quote_id = $2",
                    [quoteId],
                    "CASE WHEN quote_id = $3 THEN 'ACCEPTED' ELSE 'DECLINED' END",
                    [now, quoteId],
                ),
            cancel: (rfqId, now) => closeOpenRfq(rfqId, "status = 'CANCELLED'", [], "'DECLINED'", [now]),
        },

        shipments: {
            insert: async (s) => {
                await pool
                    .query(
                        `INSERT INTO shipments (shipment_id, tracking_code, source, rfq_id, tariff_id, client_id, carrier_id,
                                                transport_type, from_region_id, to_region_id, weight_kg, volume_m3,
                                                cargo_category, description, declared_value_cents, price_cents, transit_days,
                                                status, history, created_at, updated_at)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
                        [s.shipmentId, s.trackingCode, s.source, s.rfqId ?? null, s.tariffId ?? null, s.clientId, s.carrierId,
                            s.transportType, s.fromRegionId, s.toRegionId, s.weightKg, s.volumeM3, s.cargoCategory,
                            s.description ?? null, s.declaredValueCents ?? null, s.priceCents, s.transitDays,
                            s.status, JSON.stringify(s.history), s.createdAt, s.updatedAt],
                    )
                    .catch(rethrowDuplicate);
            },
            findById: (id) => one("SELECT * FROM shipments WHERE shipment_id = $1", [id], toShipment),
            findByTrackingCode: (code) => one("SELECT * FROM shipments WHERE tracking_code = $1", [code], toShipment),
            list: (scope) =>
                many(
                    `SELECT * FROM shipments
                     WHERE ($1::uuid IS NULL OR client_id = $1) AND ($2::uuid IS NULL OR carrier_id = $2)
                     ORDER BY created_at DESC`,
                    [scope.clientId ?? null, scope.carrierId ?? null],
                    toShipment,
                ),
            // The WHERE on the old status is the lock: if two managers press
            // "picked up" at once, the second update matches no row.
            transition: async (next, expected) => {
                const result = await pool.query(
                    "UPDATE shipments SET status = $3, history = $4, updated_at = $5 WHERE shipment_id = $1 AND status = $2",
                    [next.shipmentId, expected, next.status, JSON.stringify(next.history), next.updatedAt],
                );
                return result.rowCount === 1;
            },
        },

        init: async () => {
            await pool.query(SCHEMA);
        },
        close: () => pool.end(),
    };
};
