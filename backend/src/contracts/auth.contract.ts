export const USER_ROLES = ["CLIENT", "MANAGER", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface RegisterUserRequestBody {
    email: string;
    password: string;
    name: string;
    companyName?: string;
}

export interface LoginUserRequestBody {
    email: string;
    password: string;
}

export interface PublicUser {
    userId: string;
    email: string;
    name: string;
    role: UserRole;
    companyName?: string;
    /** The carrier a MANAGER posts services for. Absent on CLIENT and ADMIN. */
    carrierId?: string;
}

export interface StoredUser extends PublicUser {
    passwordHash: string;
    createdAt: string;
}
