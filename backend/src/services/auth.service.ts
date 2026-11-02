import {randomUUID} from "node:crypto";

import type {
    LoginUserRequestBody,
    PublicUser,
    RegisterUserRequestBody,
    StoredUser,
    UserRole,
} from "../contracts/auth.contract";
import {BadRequestError, ConflictError, UnauthorizedError} from "../errors/app.error";
import {DuplicateError, repos} from "../repositories";
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

// No "does this email exist?" read beforehand: the storage's unique rule is the
// check, so two sign-ups racing on one address cannot both get through.
const insertUser = async (user: StoredUser): Promise<PublicUser> => {
    try {
        await repos().users.insert(user);
    } catch (error) {
        if (error instanceof DuplicateError) {
            throw new ConflictError("A user with this email already exists");
        }
        throw error;
    }

    return toPublicUser(user);
};

export const registerUser = async (input: RegisterUserRequestBody): Promise<PublicUser> => {
    return insertUser({
        userId: randomUUID(),
        email: normalizeEmail(input.email),
        name: input.name,
        role: "CLIENT",
        ...(input.companyName !== undefined && {companyName: input.companyName}),
        passwordHash: await hashPassword(input.password),
        createdAt: new Date().toISOString(),
    });
};

export const loginUser = async (input: LoginUserRequestBody): Promise<PublicUser> => {
    const user = await repos().users.findByEmail(normalizeEmail(input.email));

    // The same message for "no such user" and "wrong password": otherwise the
    // endpoint becomes a way to probe which emails are registered.
    if (!user || !(await comparePassword(input.password, user.passwordHash))) {
        throw new UnauthorizedError("Invalid email or password");
    }

    return toPublicUser(user);
};

export const getUserById = async (userId: string): Promise<PublicUser> => {
    const user = await repos().users.findById(userId);

    if (!user) {
        throw new UnauthorizedError("Unauthorized");
    }

    return toPublicUser(user);
};

export const findUserByEmail = async (email: string): Promise<PublicUser | undefined> => {
    const user = await repos().users.findByEmail(normalizeEmail(email));
    return user ? toPublicUser(user) : undefined;
};

export const createUserWithRole = async (input: {
    email: string;
    password: string;
    name: string;
    role: UserRole;
    companyName?: string;
    carrierId?: string;
}): Promise<PublicUser> => {
    // Referential integrity, checked here because this is the only door through
    // which a user gets a carrier: a manager bound to a carrier that does not
    // exist would pass every later permission check and manage nothing.
    if (input.carrierId !== undefined && !carrierExists(input.carrierId)) {
        throw new BadRequestError("Unknown carrierId");
    }

    return insertUser({
        userId: randomUUID(),
        email: normalizeEmail(input.email),
        name: input.name,
        role: input.role,
        ...(input.companyName !== undefined && {companyName: input.companyName}),
        ...(input.carrierId !== undefined && {carrierId: input.carrierId}),
        passwordHash: await hashPassword(input.password),
        createdAt: new Date().toISOString(),
    });
};
