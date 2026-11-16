import { randomBytes } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Integration test against the real local Postgres. Covers ONBOARDING_SECURITY_PLAN.md Phase 2b:
// email settings saved in the Management Console, encrypted, verified before saving.

// env.ts is parsed on import, so the key has to exist before the modules load.
process.env.MAIL_ENCRYPTION_KEY = randomBytes(32).toString('base64');

// No real SMTP connection: verify() is controlled per test, sendMail records what would go out.
const verify = vi.fn();
const sendMail = vi.fn().mockResolvedValue({});
const createTransport = vi.fn(() => ({ verify, sendMail, close: vi.fn() }));
vi.mock('nodemailer', () => ({ default: { createTransport } }));

const { prisma } = await import('../src/lib/prisma');
const { env } = await import('../src/config/env');
const { resolveMailConfig, sendTestEmail } = await import('../src/lib/mailer');
const { MailLoginFailedError, MailPasswordRequiredError, getMailStatus, resetMailSettings, saveMailSettings } =
  await import('../src/modules/mail/mail.service');

const settings = {
  enabled: true,
  host: 'smtp.shared-mailbox.test',
  port: 587,
  user: 'anlet@shared-mailbox.test',
  from: 'anlet@shared-mailbox.test',
  fromName: 'ANLET Assessment',
  replyTo: 'support@shared-mailbox.test',
};

beforeEach(async () => {
  await prisma.mailSettings.deleteMany({});
  verify.mockReset().mockResolvedValue(true);
  createTransport.mockClear();
  sendMail.mockClear();
});

afterAll(async () => {
  await prisma.mailSettings.deleteMany({});
  await prisma.$disconnect();
});

describe('mail settings (real DB)', () => {
  it('uses the environment until settings are saved', async () => {
    const status = await getMailStatus();
    expect(status).toMatchObject({ source: 'environment', host: env.SMTP_HOST, editable: true, problem: null });
  });

  it('verifies the login, stores the password encrypted and applies the settings to sending', async () => {
    const status = await saveMailSettings({ ...settings, password: 'app-password-1' }, 'super@example.com');
    expect(status).toMatchObject({ source: 'database', host: settings.host, replyTo: settings.replyTo, updatedByEmail: 'super@example.com' });
    expect(status).not.toHaveProperty('password');
    expect(verify).toHaveBeenCalledTimes(1);

    const row = await prisma.mailSettings.findUniqueOrThrow({ where: { id: 'default' } });
    expect(row.passwordEncrypted).not.toContain('app-password-1');
    expect((await resolveMailConfig()).password).toBe('app-password-1');

    await sendTestEmail('super@example.com');
    expect(createTransport).toHaveBeenLastCalledWith(
      expect.objectContaining({ host: settings.host, auth: { user: settings.user, pass: 'app-password-1' } }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: { name: 'ANLET Assessment', address: settings.from }, replyTo: settings.replyTo }),
    );
  });

  it('saves nothing when the mail server refuses the login', async () => {
    verify.mockRejectedValueOnce(
      Object.assign(new Error('Invalid login: 535-5.7.8 Username and Password not accepted'), {
        code: 'EAUTH',
        response: '535-5.7.8 Username and Password not accepted\n535 5.7.8 more',
      }),
    );
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const refusal = await saveMailSettings({ ...settings, password: 'wrong' }, 'super@example.com').catch((e) => e);
    consoleError.mockRestore();
    expect(refusal).toBeInstanceOf(MailLoginFailedError);
    // The super admin sees the reason plus the server's own first line.
    expect(refusal.message).toMatch(/did not accept the login.*server answer: 535-5\.7\.8 Username and Password not accepted$/);
    expect(await prisma.mailSettings.count()).toBe(0);
  });

  it('keeps the password only while host and login stay the same', async () => {
    await saveMailSettings({ ...settings, password: 'app-password-1' }, 'super@example.com');
    await saveMailSettings({ ...settings, fromName: 'Renamed' }, 'super@example.com');
    expect((await resolveMailConfig()).password).toBe('app-password-1');

    await expect(
      saveMailSettings({ ...settings, user: 'other@shared-mailbox.test' }, 'super@example.com'),
    ).rejects.toBeInstanceOf(MailPasswordRequiredError);
  });

  it('switching sending off skips the login check', async () => {
    await saveMailSettings({ ...settings, enabled: false, password: 'x' }, 'super@example.com');
    expect(verify).not.toHaveBeenCalled();
    expect((await getMailStatus()).enabled).toBe(false);
  });

  it('falls back to the environment, with a reason, when the saved password cannot be decrypted', async () => {
    await saveMailSettings({ ...settings, password: 'app-password-1' }, 'super@example.com');
    await prisma.mailSettings.update({ where: { id: 'default' }, data: { passwordEncrypted: 'v1:AAAA:AAAA:AAAA' } });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const status = await getMailStatus();
    expect(status.source).toBe('environment');
    expect(status.problem).toMatch(/could not be decrypted/);
    consoleError.mockRestore();
  });

  it('resets to the environment defaults', async () => {
    await saveMailSettings({ ...settings, password: 'app-password-1' }, 'super@example.com');
    expect((await resetMailSettings()).source).toBe('environment');
  });
});
