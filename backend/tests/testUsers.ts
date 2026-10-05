import { prisma } from '../src/lib/prisma';
import { resolveRequestUser, type RequestUser } from '../src/lib/userContext';

// Integration-test helpers for multi-organization memberships (MULTI_ORG_PLAN.md): services
// that act "as the caller" take the active membership, not just a user id.

/** The caller as getOrCreateResponse sees it — the user's first membership. */
export async function callerFor(userId: string): Promise<{ sub: string; membershipId: string }> {
  const membership = await prisma.membership.findFirstOrThrow({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });
  return { sub: userId, membershipId: membership.id };
}

/** The full request user (default context), as the auth middleware would resolve it. */
export async function requestUserFor(userId: string): Promise<RequestUser> {
  const user = await resolveRequestUser(userId, null);
  if (!user) throw new Error(`No such user ${userId}`);
  return user;
}
