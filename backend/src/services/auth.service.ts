import {randomUUID} from "node:crypto";

import type {
    LoginUserRequestBody,
    PublicUser,
    RegisterUserRequestBody,
    StoredUser,
    UserRole,
} from "../contracts/auth.contract";
import {usersByEmail, usersById} from "../data/store";
import {ConflictError, UnauthorizedError} from "../errors/app.error";
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

export const registerUser = async (
    input: RegisterUserRequestBody,
): Promise<PublicUser> => {
    const email = normalizeEmail(input.email);

    if (usersByEmail.has(email)) {
        throw new ConflictError("A user with this email already exists");
    }

    const user: StoredUser = {
        userId: randomUUID(),
        email,
        name: input.name,
        role: "CLIENT",
        ...(input.companyName !== undefined && {companyName: input.companyName}),
        passwordHash: await hashPassword(input.password),
        createdAt: new Date().toISOString(),
    };

    usersById.set(user.userId, user);
    usersByEmail.set(user.email, user);

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

    if (usersByEmail.has(email)) {
        throw new ConflictError("A user with this email already exists");
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

    usersById.set(user.userId, user);
    usersByEmail.set(user.email, user);

    return toPublicUser(user);
};
