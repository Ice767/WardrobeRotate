import {createUserWithRole} from "../services/auth.service";
import {seedReferenceData} from "./reference.seed";
import {usersByEmail} from "./store";
import {seedTariffs} from "./tariff.seed";

const ADMIN_EMAIL = "admin@logistics.dev";
const DEV_ADMIN_PASSWORD = "AdminPass123!";

// The fallback is printed in the public README, so outside development it would
// hand the admin account to anyone who reads it. Refusing to start is the only
// safe answer: a server without an admin is unusable anyway.
const adminPassword = (): string => {
    const fromEnv = process.env.SEED_ADMIN_PASSWORD;

    if (fromEnv) {
        return fromEnv;
    }

    if (process.env.NODE_ENV === "production") {
        throw new Error("SEED_ADMIN_PASSWORD must be set in production");
    }

    return DEV_ADMIN_PASSWORD;
};

// The in-memory store is empty on every start, and the first admin cannot be
// created through the API — registration always issues CLIENT. So it happens
// here. In production a migration does this and the password comes from env.
export const seedDemoData = async (): Promise<void> => {
    seedReferenceData();
    seedTariffs();

    if (usersByEmail.has(ADMIN_EMAIL)) {
        return;
    }

    await createUserWithRole({
        email: ADMIN_EMAIL,
        password: adminPassword(),
        name: "Platform Admin",
        role: "ADMIN",
    });
};
