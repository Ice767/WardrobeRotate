import {createHash} from "node:crypto";

// The standard RFC 4122 DNS namespace. The exact value does not matter — only
// that it never changes, otherwise every seeded id shifts with it.
const NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const NAMESPACE_BYTES = Buffer.from(NAMESPACE.replaceAll("-", ""), "hex");

const UUID_BYTE_LENGTH = 16;
const VERSION_BYTE = 6;
const VARIANT_BYTE = 8;

/**
 * UUID v5: the id is derived from a key string instead of being random. Seed
 * data needs this — the in-memory store is rebuilt on every start, and without
 * it region ids would change on each restart.
 *
 * Seeds only. Records created through the API use randomUUID: hashing user
 * input would collide for two records with the same name and would turn the id
 * into a reversible hint about what was hashed.
 */
export const stableId = (key: string): string => {
    const hash = createHash("sha1")
        .update(Buffer.concat([NAMESPACE_BYTES, Buffer.from(key, "utf8")]))
        .digest()
        .subarray(0, UUID_BYTE_LENGTH);

    hash[VERSION_BYTE] = (hash[VERSION_BYTE]! & 0x0f) | 0x50;
    hash[VARIANT_BYTE] = (hash[VARIANT_BYTE]! & 0x3f) | 0x80;

    const hex = hash.toString("hex");

    return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20, 32),
    ].join("-");
};
