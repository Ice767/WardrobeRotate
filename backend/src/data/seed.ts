import {repos} from "../repositories";
import {createUserWithRole, findUserByEmail} from "../services/auth.service";
import {seedReferenceData} from "./reference.seed";
import {seedTariffs} from "./tariff.seed";

const ADMIN_EMAIL = "admin@logistics.dev";

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
        password: process.env.SEED_ADMIN_PASSWORD ?? "AdminPass123!",
        name: "Platform Admin",
        role: "ADMIN",
    });
};
