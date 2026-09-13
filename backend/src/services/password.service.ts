import {compare, hash} from "bcryptjs";

// Hashing cost: 2^10 iterations. Higher is safer but slower; 10 keeps login
// around 100 ms while staying expensive to brute-force.
const BCRYPT_WORK_FACTOR = 10;

export const hashPassword = async (password: string): Promise<string> => {
    return hash(password, BCRYPT_WORK_FACTOR);
};

export const comparePassword = async (
    password: string,
    passwordHash: string,
): Promise<boolean> => {
    return compare(password, passwordHash);
};
