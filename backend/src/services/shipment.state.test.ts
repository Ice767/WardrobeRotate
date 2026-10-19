import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {SHIPMENT_STATUSES} from "../contracts/shipment.contract";
import {checkTransition} from "./shipment.state";

describe("checkTransition", () => {
    it("walks the happy path as the carrier", () => {
        assert.deepEqual(checkTransition("CONFIRMED", "PICKED_UP", "MANAGER"), {allowed: true});
        assert.deepEqual(checkTransition("PICKED_UP", "IN_TRANSIT", "MANAGER"), {allowed: true});
        assert.deepEqual(checkTransition("IN_TRANSIT", "DELIVERED", "MANAGER"), {allowed: true});
    });

    it("does not let a client report physical progress", () => {
        assert.deepEqual(checkTransition("CONFIRMED", "PICKED_UP", "CLIENT"), {
            allowed: false,
            reason: "ROLE_NOT_ALLOWED",
        });
    });

    it("allows cancelling only before pickup", () => {
        assert.deepEqual(checkTransition("CONFIRMED", "CANCELLED", "CLIENT"), {allowed: true});
        assert.equal(checkTransition("PICKED_UP", "CANCELLED", "CLIENT").allowed, false);
        assert.equal(checkTransition("IN_TRANSIT", "CANCELLED", "ADMIN").allowed, false);
    });

    it("never skips a step or moves backwards", () => {
        assert.equal(checkTransition("CONFIRMED", "DELIVERED", "MANAGER").allowed, false);
        assert.equal(checkTransition("IN_TRANSIT", "PICKED_UP", "MANAGER").allowed, false);
    });

    it("treats DELIVERED and CANCELLED as final", () => {
        for (const to of SHIPMENT_STATUSES) {
            assert.equal(checkTransition("DELIVERED", to, "ADMIN").allowed, false);
            assert.equal(checkTransition("CANCELLED", to, "ADMIN").allowed, false);
        }
    });
});
