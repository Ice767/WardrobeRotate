import {logger} from "../config/logger.config";
import {repos} from "../repositories";
import {createUserWithRole, findUserByEmail} from "../services/auth.service";
import {carrierIdBySlug, seedReferenceData} from "./reference.seed";
import {seedTariffs} from "./tariff.seed";

const ADMIN_EMAIL = "admin@logistics.dev";
const DEV_ADMIN_PASSWORD = "AdminPass123!";
const MANAGER_EMAIL = "manager@aerofreight.dev";
const DEV_MANAGER_PASSWORD = "ManagerPass123!";

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

// Unlike the admin, the server works without a demo carrier, so a missing
// password in production means "no demo account", not a failed start.
const managerPassword = (): string | undefined => {
    const fromEnv = process.env.SEED_MANAGER_PASSWORD;

    if (fromEnv) {
        return fromEnv;
    }

    return process.env.NODE_ENV === "production" ? undefined : DEV_MANAGER_PASSWORD;
};

const seedAdmin = async (): Promise<void> => {
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

const seedDemoManager = async (): Promise<void> => {
    if (await findUserByEmail(MANAGER_EMAIL)) {
        return;
    }

    const password = managerPassword();

    if (!password) {
        logger.info("Demo manager not created: SEED_MANAGER_PASSWORD is not set");
        return;
    }

    await createUserWithRole({
        email: MANAGER_EMAIL,
        password,
        name: "AeroFreight Manager",
        role: "MANAGER",
        carrierId: carrierIdBySlug("aerofreight"),
    });
};

// Runs on every boot and is safe to: tables are created only if missing, and
// seeds skip what is already there. The first admin cannot come through the
// API — registration always issues CLIENT — so it is created here, with the
// password from the environment outside local development.
export const seedDemoData = async (): Promise<void> => {
    await repos().init();
    seedReferenceData();
    await seedTariffs();
    await seedAdmin();
    await seedDemoManager();
};
