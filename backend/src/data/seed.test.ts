import assert from "node:assert/strict";
import {afterEach, describe, it} from "node:test";

import {findUserByEmail} from "../services/auth.service";
import {carrierIdBySlug} from "./reference.seed";
import {seedDemoData} from "./seed";

const MANAGER_EMAIL = "manager@aerofreight.dev";
const originalEnv = {...process.env};

// Order matters: the store lives for the whole file, so the case that must find
// no manager runs first.
describe("seedDemoData", () => {
    afterEach(() => {
        process.env = {...originalEnv};
    });

    it("skips the demo manager in production without SEED_MANAGER_PASSWORD", async () => {
        process.env.NODE_ENV = "production";
        process.env.SEED_ADMIN_PASSWORD = "admin-password-for-test";
        delete process.env.SEED_MANAGER_PASSWORD;

        await seedDemoData();

        assert.equal(await findUserByEmail(MANAGER_EMAIL), undefined);
    });

    it("creates the demo manager bound to AeroFreight when SEED_MANAGER_PASSWORD is set", async () => {
        process.env.NODE_ENV = "production";
        process.env.SEED_ADMIN_PASSWORD = "admin-password-for-test";
        process.env.SEED_MANAGER_PASSWORD = "manager-password-for-test";

        await seedDemoData();

        const manager = await findUserByEmail(MANAGER_EMAIL);
        assert.equal(manager?.role, "MANAGER");
        assert.equal(manager?.carrierId, carrierIdBySlug("aerofreight"));
    });

    it("does not fail when run twice", async () => {
        process.env.SEED_MANAGER_PASSWORD = "manager-password-for-test";

        await seedDemoData();
        await seedDemoData();
    });
});
