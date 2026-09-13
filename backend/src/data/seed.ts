import {createUserWithRole} from "../services/auth.service";
import {seedReferenceData} from "./reference.seed";
import {usersByEmail} from "./store";

const ADMIN_EMAIL = "admin@logistics.dev";

// The in-memory store is empty on every start, and the first admin cannot be
// created through the API — registration always issues CLIENT. So it happens
// here. In production a migration does this and the password comes from env.
export const seedDemoData = async (): Promise<void> => {
    seedReferenceData();

    if (usersByEmail.has(ADMIN_EMAIL)) {
        return;
    }

    await createUserWithRole({
        email: ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD ?? "AdminPass123!",
        name: "Platform Admin",
        role: "ADMIN",
    });
};
