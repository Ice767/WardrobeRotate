import {repos} from "../repositories";
import {createUserWithRole, findUserByEmail} from "../services/auth.service";
import {seedReferenceData} from "./reference.seed";
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

// Runs on every boot and is safe to: tables are created only if missing, and
// seeds skip what is already there. The first admin cannot come through the
// API — registration always issues CLIENT — so it is created here, with the
// password from the environment outside local development.
export const seedDemoData = async (): Promise<void> => {
    await repos().init();
    seedReferenceData();
    await seedTariffs();

    if (await findUserByEmail(ADMIN_EMAIL)) {
        return;
    }

    await createUserWithRole({
        email: ADMIN_EMAIL,
        password: adminPassword(),
        name: "Platform Admin",
        role: "ADMIN",
    });
};
