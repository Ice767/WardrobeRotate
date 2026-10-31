import {randomUUID} from "node:crypto";

import type {
    LoginUserRequestBody,
    PublicUser,
    RegisterUserRequestBody,
    StoredUser,
    UserRole,
} from "../contracts/auth.contract";
import {usersByEmail, usersById} from "../data/store";
import {BadRequestError, ConflictError, UnauthorizedError} from "../errors/app.error";
import {carrierExists} from "./carrier.service";
import {comparePassword, hashPassword} from "./password.service";

// The single place where a StoredUser becomes something safe to send out.
// passwordHash never physically reaches it, so it cannot be forgotten here.
const toPublicUser = (user: StoredUser): PublicUser => {
    return {
        userId: user.userId,
        email: user.email,
        name: user.name,
        role: user.role,
        ...(user.companyName !== undefined && {companyName: user.companyName}),
        ...(user.carrierId !== undefined && {carrierId: user.carrierId}),
    };
};

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const assertEmailFree = (email: string): void => {
    if (usersByEmail.has(email)) {
        throw new ConflictError("A user with this email already exists");
    }
};

// Called after hashing, with no await between the check and the writes. The
// early check only spares a pointless hash; this one is what keeps two
// concurrent sign-ups for one email from both landing, since the ~100 ms hash
// lets a second request pass the early check before the first one is stored.
const insertUser = (user: StoredUser): void => {
    assertEmailFree(user.email);

    usersById.set(user.userId, user);
    usersByEmail.set(user.email, user);
};

export const registerUser = async (
    input: RegisterUserRequestBody,
): Promise<PublicUser> => {
    const email = normalizeEmail(input.email);

    assertEmailFree(email);

    const user: StoredUser = {
        userId: randomUUID(),
        email,
        name: input.name,
        role: "CLIENT",
        ...(input.companyName !== undefined && {companyName: input.companyName}),
        passwordHash: await hashPassword(input.password),
        createdAt: new Date().toISOString(),
    };

    insertUser(user);

    return toPublicUser(user);
};

export const loginUser = async (
    input: LoginUserRequestBody,
): Promise<PublicUser> => {
    const user = usersByEmail.get(normalizeEmail(input.email));

    // The same message for "no such user" and "wrong password": otherwise the
    // endpoint becomes a way to probe which emails are registered.
    if (!user || !(await comparePassword(input.password, user.passwordHash))) {
        throw new UnauthorizedError("Invalid email or password");
    }

    return toPublicUser(user);
};

export const getUserById = (userId: string): PublicUser => {
    const user = usersById.get(userId);

    if (!user) {
        throw new UnauthorizedError("Unauthorized");
    }

    return toPublicUser(user);
};

export const createUserWithRole = async (input: {
    email: string;
    password: string;
    name: string;
    role: UserRole;
    companyName?: string;
    carrierId?: string;
}): Promise<PublicUser> => {
    const email = normalizeEmail(input.email);

    assertEmailFree(email);

    // Referential integrity, checked here because this is the only door through
    // which a user gets a carrier: a manager bound to a carrier that does not
    // exist would pass every later permission check and manage nothing.
    if (input.carrierId !== undefined && !carrierExists(input.carrierId)) {
        throw new BadRequestError("Unknown carrierId");
    }

    const user: StoredUser = {
        userId: randomUUID(),
        email,
        name: input.name,
        role: input.role,
        ...(input.companyName !== undefined && {companyName: input.companyName}),
        ...(input.carrierId !== undefined && {carrierId: input.carrierId}),
        passwordHash: await hashPassword(input.password),
        createdAt: new Date().toISOString(),
    };

    insertUser(user);

    return toPublicUser(user);
};
