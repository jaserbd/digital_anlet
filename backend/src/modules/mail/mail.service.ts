import type { MailStatusDto, UpdateMailSettingsRequestDto } from '@anlet/shared';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { createMailTransport, mailEncryptionKey, resolveMailConfig } from '../../lib/mailer';
import { describeMailError } from '../../lib/mailErrors';
import { assertPublicMailHost } from '../../lib/mailHost';
import { encryptSecret } from '../../lib/secretBox';

// Email delivery settings in the Management Console (ONBOARDING_SECURITY_PLAN.md Phase 2b).

// The server has no MAIL_ENCRYPTION_KEY, so a password can't be stored.
export class MailSettingsNotEditableError extends Error {}
// A new server or login needs its own password.
export class MailPasswordRequiredError extends Error {}
// The mail server refused the new settings — nothing was saved.
export class MailLoginFailedError extends Error {}

export async function getMailStatus(): Promise<MailStatusDto> {
  const config = await resolveMailConfig();
  return {
    source: config.source,
    enabled: config.enabled,
    host: config.host,
    port: config.port,
    user: config.user,
    from: config.from,
    fromName: config.fromName,
    replyTo: config.replyTo,
    updatedAt: config.updatedAt?.toISOString() ?? null,
    updatedByEmail: config.updatedByEmail,
    editable: mailEncryptionKey() !== null,
    problem: config.problem,
  };
}

/** Saves the settings after proving them: with sending on, the server must accept the login first
 * (a typo can't silently break password reset emails). The password is kept when omitted, as long
 * as host and login are unchanged. */
export async function saveMailSettings(input: UpdateMailSettingsRequestDto, callerEmail: string): Promise<MailStatusDto> {
  const key = mailEncryptionKey();
  if (!key) throw new MailSettingsNotEditableError();

  const current = await resolveMailConfig();
  const sameLogin = input.host === current.host && input.user === current.user;
  const password = input.password || (sameLogin ? current.password : undefined);
  if (!password) throw new MailPasswordRequiredError();

  // Only public mail servers on mail ports (lib/mailHost.ts). Production only: local
  // development uses a mail catcher on localhost.
  if (env.NODE_ENV === 'production') await assertPublicMailHost(input.host, input.port);

  if (input.enabled) {
    const transport = createMailTransport({ host: input.host, port: input.port, user: input.user, password });
    try {
      await transport.verify();
    } catch (err) {
      console.error('Mail settings check failed', err);
      throw new MailLoginFailedError(describeMailError(err, { serverReply: true }));
    } finally {
      transport.close();
    }
  }

  const data = {
    enabled: input.enabled,
    host: input.host,
    port: input.port,
    user: input.user,
    fromAddress: input.from,
    fromName: input.fromName,
    replyTo: input.replyTo,
    passwordEncrypted: encryptSecret(password, key),
    updatedByEmail: callerEmail,
  };
  await prisma.mailSettings.upsert({ where: { id: 'default' }, create: { id: 'default', ...data }, update: data });
  return getMailStatus();
}

/** Back to the server's SMTP_* environment defaults. */
export async function resetMailSettings(): Promise<MailStatusDto> {
  await prisma.mailSettings.deleteMany({});
  return getMailStatus();
}
