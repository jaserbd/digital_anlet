import type { AccountEmailKind, AccountEmailResultDto } from '@anlet/shared';
import { prisma } from '../../lib/prisma';
import { MailDisabledError, sendPasswordResetEmail, sendWelcomeEmail } from '../../lib/mailer';
import type { ProjectAdminScope } from '../../lib/projectAccess';
import { LINK_TTL_MS, issueAccountLink } from '../auth/auth.service';
import {
  CannotModifyAdminError,
  OutsideProjectError,
  SuperAdminRequiredError,
  UserNotFoundError,
  isCallerSuperAdmin,
} from './users.service';

// Welcome and password reset emails sent by admins (ONBOARDING_SECURITY_PLAN.md Phase 3): a
// single-use link, never a password. Sending doesn't change the account — the current password
// (e.g. a temporary one) keeps working until the person sets their own through the link.

// At most this many per request: the frontend sends an import's welcome emails in batches, so
// no request runs into Cloud Run's timeout and the admin sees progress.
export const MAX_ACCOUNT_EMAILS_PER_REQUEST = 10;

/** Same rules as temporary passwords: any admin for a non-admin; only the super admin for another
 * admin; never the super admin or yourself (use Forgot password). A Project Admin only for
 * Executives / Normal Users of their project — any organization of it, since their member import
 * creates accounts across the project. */
async function assertMaySendAccountEmail(callerId: string, userId: string, scope?: ProjectAdminScope) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      isSuperAdmin: true,
      isActive: true,
      firstName: true,
      organization: { select: { name: true } },
      memberships: { select: { projectId: true, role: true } },
    },
  });
  if (!user) throw new UserNotFoundError();
  if (user.isSuperAdmin || userId === callerId) throw new CannotModifyAdminError();
  if (user.role === 'ADMIN' && !(await isCallerSuperAdmin(callerId))) throw new SuperAdminRequiredError();
  if (scope) {
    const inProject =
      user.role !== 'ADMIN' &&
      user.memberships.length > 0 &&
      user.memberships.every((m) => m.projectId === scope.projectId && (m.role === 'EXECUTIVE' || m.role === 'NORMAL_USER'));
    if (!inProject) throw new OutsideProjectError();
  }
  return user;
}

function describeFailure(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/** Sends one welcome or reset email. Permission problems throw; delivery problems are reported
 * in the result (the link was issued but may not have arrived). */
export async function sendAccountEmail(
  callerId: string,
  userId: string,
  kind: AccountEmailKind,
  scope?: ProjectAdminScope,
): Promise<AccountEmailResultDto> {
  const user = await assertMaySendAccountEmail(callerId, userId, scope);
  if (!user.isActive) {
    return { userId, email: user.email, outcome: 'failed', error: 'This account is deactivated — reactivate it first' };
  }
  try {
    if (kind === 'welcome') {
      const url = await issueAccountLink(user.id, 'INVITE', LINK_TTL_MS.INVITE);
      await sendWelcomeEmail(user.email, url, {
        firstName: user.firstName,
        organizationName: user.organization.name,
        validFor: '7 days',
      });
    } else {
      const url = await issueAccountLink(user.id, 'RESET', LINK_TTL_MS.ADMIN_RESET);
      await sendPasswordResetEmail(user.email, url, '24 hours');
    }
    return { userId, email: user.email, outcome: 'sent' };
  } catch (err) {
    if (err instanceof MailDisabledError) return { userId, email: user.email, outcome: 'disabled' };
    console.error(`Account email (${kind}) to ${user.email} failed`, err);
    return { userId, email: user.email, outcome: 'failed', error: describeFailure(err) };
  }
}

/** Welcome emails for several users (an import's new accounts), one after the other; a user the
 * caller may not email is reported, not fatal. */
export async function sendWelcomeEmails(
  callerId: string,
  userIds: string[],
  scope?: ProjectAdminScope,
): Promise<AccountEmailResultDto[]> {
  const results: AccountEmailResultDto[] = [];
  for (const userId of userIds) {
    try {
      results.push(await sendAccountEmail(callerId, userId, 'welcome', scope));
    } catch (err) {
      const notAllowed =
        err instanceof UserNotFoundError ||
        err instanceof CannotModifyAdminError ||
        err instanceof SuperAdminRequiredError ||
        err instanceof OutsideProjectError;
      if (!notAllowed) throw err;
      results.push({ userId, email: '', outcome: 'failed', error: 'Not allowed to email this user' });
    }
  }
  return results;
}
