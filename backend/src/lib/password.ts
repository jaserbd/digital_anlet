import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

let dummyHash: Promise<string> | null = null;

/** Spends the same time as a real check, for sign-ins with an unknown address — so response
 * time doesn't tell registered addresses from unregistered ones. Always false. */
export async function verifyAgainstNothing(plain: string): Promise<false> {
  dummyHash ??= bcrypt.hash('no-such-account', SALT_ROUNDS);
  await bcrypt.compare(plain, await dummyHash);
  return false;
}
