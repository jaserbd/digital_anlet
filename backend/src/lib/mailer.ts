import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env';
import { prisma } from './prisma';
import { SecretBoxError, decryptSecret, parseKey } from './secretBox';

// Plain SMTP (OVERVIEW.md item 12) rather than a vendor-specific SDK, so any provider (Microsoft
// 365, Gmail, Brevo, a plain relay) works via its SMTP credentials (ONBOARDING_SECURITY_PLAN.md
// Phase 2). Settings saved in the Management Console (MailSettings row, Phase 2b) win over the
// SMTP_* environment variables, which stay as the fallback.

export interface MailConfig {
  source: 'database' | 'environment';
  enabled: boolean;
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
  fromName: string;
  replyTo: string | null;
  updatedAt: Date | null;
  updatedByEmail: string | null;
  // Why saved settings couldn't be used (and the environment applies instead).
  problem: string | null;
}

export function mailEncryptionKey(): Buffer | null {
  return env.MAIL_ENCRYPTION_KEY ? parseKey(env.MAIL_ENCRYPTION_KEY) : null;
}

function environmentConfig(problem: string | null = null): MailConfig {
  return {
    source: 'environment',
    enabled: env.MAIL_ENABLED,
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    user: env.SMTP_USER,
    password: env.SMTP_PASSWORD,
    from: env.SMTP_FROM,
    fromName: env.SMTP_FROM_NAME,
    replyTo: null,
    updatedAt: null,
    updatedByEmail: null,
    problem,
  };
}

// Read on every send (a single-row lookup), so a save applies to every instance immediately.
export async function resolveMailConfig(): Promise<MailConfig> {
  const saved = await prisma.mailSettings.findUnique({ where: { id: 'default' } });
  if (!saved) return environmentConfig();
  const key = mailEncryptionKey();
  if (!key) {
    console.error('MailSettings exist but MAIL_ENCRYPTION_KEY is not set — using the SMTP_* environment variables');
    return environmentConfig('Saved settings need MAIL_ENCRYPTION_KEY on the server; using the server defaults instead.');
  }
  let password: string;
  try {
    password = decryptSecret(saved.passwordEncrypted, key);
  } catch (err) {
    if (!(err instanceof SecretBoxError)) throw err;
    console.error('MailSettings password could not be decrypted — using the SMTP_* environment variables');
    return environmentConfig('The saved password could not be decrypted (encryption key changed?); using the server defaults. Save the settings again.');
  }
  return {
    source: 'database',
    enabled: saved.enabled,
    host: saved.host,
    port: saved.port,
    user: saved.user,
    password,
    from: saved.fromAddress,
    fromName: saved.fromName,
    replyTo: saved.replyTo,
    updatedAt: saved.updatedAt,
    updatedByEmail: saved.updatedByEmail,
    problem: null,
  };
}

// Port 465 is implicit TLS; anything else (587) must upgrade with STARTTLS — requireTLS refuses
// to send credentials in clear text. Short timeouts so a request never hangs on a dead relay.
export function createMailTransport(config: Pick<MailConfig, 'host' | 'port' | 'user' | 'password'>): Transporter {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    requireTLS: config.port !== 465,
    auth: { user: config.user, pass: config.password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

// One pooled transport per distinct server/login, rebuilt when the settings change.
let cachedTransport: { key: string; transport: Transporter } | null = null;
function transportFor(config: MailConfig): Transporter {
  const key = JSON.stringify([config.host, config.port, config.user, config.password]);
  if (cachedTransport?.key !== key) {
    cachedTransport?.transport.close();
    cachedTransport = { key, transport: createMailTransport(config) };
  }
  return cachedTransport.transport;
}

// Same address as the frontend's components/SupportContact.tsx.
const SUPPORT_EMAIL = 'jaserbin.rahman@detecon.com';
const BRAND_COLOR = '#e20074';

// Thrown when sending is switched off (settings or MAIL_ENABLED) — the email is only logged.
export class MailDisabledError extends Error {}

export interface EmailContent {
  subject: string;
  heading: string;
  paragraphs: string[];
  button?: { label: string; url: string };
  // Smaller grey text under the button (e.g. "ignore this email if…").
  footnote?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Branded HTML (table layout + inline styles, which email clients render reliably) plus a
 * plain-text alternative. Every value is escaped; only http(s) links become buttons. */
export function renderEmail(content: EmailContent): { html: string; text: string } {
  const button =
    content.button && /^https?:\/\//i.test(content.button.url) ? content.button : undefined;
  const paragraphs = content.paragraphs
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#1c1c1c;">${escapeHtml(p)}</p>`)
    .join('');
  const buttonHtml = button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tr><td style="border-radius:8px;background:${BRAND_COLOR};">` +
      `<a href="${escapeHtml(button.url)}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${escapeHtml(button.label)}</a>` +
      `</td></tr></table>` +
      `<p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#666666;">If the button doesn't work, copy this link into your browser:<br><a href="${escapeHtml(button.url)}" style="color:${BRAND_COLOR};word-break:break-all;">${escapeHtml(button.url)}</a></p>`
    : '';
  const footnote = content.footnote
    ? `<p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#666666;">${escapeHtml(content.footnote)}</p>`
    : '';

  const html =
    `<!doctype html><html><body style="margin:0;padding:0;background:#f7f5f6;font-family:'Segoe UI',Arial,sans-serif;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f5f6;padding:24px 0;"><tr><td align="center">` +
    `<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">` +
    `<tr><td style="background:${BRAND_COLOR};padding:16px 32px;font-size:20px;font-weight:800;letter-spacing:1px;color:#ffffff;">ANLET</td></tr>` +
    `<tr><td style="padding:32px;">` +
    `<h1 style="margin:0 0 16px;font-size:22px;color:#1c1c1c;">${escapeHtml(content.heading)}</h1>` +
    paragraphs +
    buttonHtml +
    footnote +
    `</td></tr>` +
    `<tr><td style="padding:16px 32px;border-top:1px solid #eeeeee;font-size:12px;line-height:1.5;color:#999999;">` +
    `ANLET — TM Forum Autonomous Network maturity assessment.<br>Problems signing in? Contact ${escapeHtml(SUPPORT_EMAIL)}.` +
    `</td></tr></table></td></tr></table></body></html>`;

  const text = [
    content.heading,
    '',
    ...content.paragraphs.flatMap((p) => [p, '']),
    ...(button ? [`${button.label}: ${button.url}`, ''] : []),
    ...(content.footnote ? [content.footnote, ''] : []),
    '--',
    'ANLET — TM Forum Autonomous Network maturity assessment.',
    `Problems signing in? Contact ${SUPPORT_EMAIL}.`,
  ].join('\n');

  return { html, text };
}

async function sendEmail(to: string, content: EmailContent): Promise<void> {
  const config = await resolveMailConfig();
  if (!config.enabled) {
    // Links carry one-time tokens, so they're only logged outside production (local dev).
    const link = env.NODE_ENV !== 'production' && content.button ? ` — ${content.button.url}` : '';
    console.info(`[mail disabled] "${content.subject}" to ${to}${link}`);
    throw new MailDisabledError();
  }
  const { html, text } = renderEmail(content);
  await transportFor(config).sendMail({
    from: { name: config.fromName, address: config.from },
    ...(config.replyTo ? { replyTo: config.replyTo } : {}),
    to,
    subject: content.subject,
    text,
    html,
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await sendEmail(to, {
    subject: 'Reset your ANLET password',
    heading: 'Reset your password',
    paragraphs: ['We received a request to reset your ANLET password. Use the button below within the next hour to choose a new one.'],
    button: { label: 'Choose a new password', url: resetUrl },
    footnote: "If you didn't request this, you can safely ignore this email — your password stays the same.",
  });
}

// Super admin's "Send test email" (Management Console) — proves the active settings work.
export async function sendTestEmail(to: string): Promise<void> {
  const config = await resolveMailConfig();
  await sendEmail(to, {
    subject: 'ANLET test email',
    heading: 'Email delivery works',
    paragraphs: [
      `This test email was sent from ANLET through ${config.host}:${config.port} as ${config.from}.`,
      'Welcome and password reset emails will be delivered the same way.',
    ],
    button: { label: 'Open ANLET', url: env.APP_BASE_URL },
  });
}
