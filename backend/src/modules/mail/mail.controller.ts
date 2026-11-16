import type { Request, Response } from 'express';
import { z } from 'zod';
import { MailDisabledError, sendTestEmail } from '../../lib/mailer';
import { describeMailError } from '../../lib/mailErrors';
import { MailHostNotAllowedError } from '../../lib/mailHost';
import { isCallerSuperAdmin } from '../users/users.service';
import {
  MailLoginFailedError,
  MailPasswordRequiredError,
  MailSettingsNotEditableError,
  getMailStatus,
  resetMailSettings,
  saveMailSettings,
} from './mail.service';

// Header values must never carry line breaks (header injection).
const singleLine = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .regex(/^[^\r\n]*$/, 'must be a single line');

const updateSettingsSchema = z.object({
  enabled: z.boolean(),
  host: singleLine(255),
  port: z.number().int().min(1).max(65535),
  user: singleLine(320),
  from: z.string().trim().email(),
  fromName: singleLine(100),
  replyTo: z
    .string()
    .trim()
    .email()
    .nullable()
    .or(z.literal('').transform(() => null)),
  password: z.string().max(500).optional(),
});

async function requireSuperAdmin(req: Request, res: Response, action: string): Promise<boolean> {
  if (await isCallerSuperAdmin(req.user!.sub)) return true;
  res.status(403).json({ error: `Only the super admin can ${action}` });
  return false;
}

export async function mailEnabledHandler(_req: Request, res: Response) {
  res.json({ enabled: (await getMailStatus()).enabled });
}

export async function mailStatusHandler(_req: Request, res: Response) {
  res.json(await getMailStatus());
}

export async function updateMailSettingsHandler(req: Request, res: Response) {
  if (!(await requireSuperAdmin(req, res, 'change the email settings'))) return;
  const parsed = updateSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid email settings' });
    return;
  }
  try {
    res.json(await saveMailSettings(parsed.data, req.user!.email));
  } catch (err) {
    if (err instanceof MailSettingsNotEditableError) {
      res.status(409).json({ error: 'The server has no MAIL_ENCRYPTION_KEY, so settings can only be changed in GCP' });
      return;
    }
    if (err instanceof MailPasswordRequiredError) {
      res.status(400).json({ error: 'Enter the password for this mail server and login' });
      return;
    }
    if (err instanceof MailHostNotAllowedError) {
      res.status(422).json({ error: `Not saved — ${err.message}` });
      return;
    }
    if (err instanceof MailLoginFailedError) {
      res.status(422).json({ error: `Not saved — ${err.message}` });
      return;
    }
    throw err;
  }
}

export async function resetMailSettingsHandler(req: Request, res: Response) {
  if (!(await requireSuperAdmin(req, res, 'change the email settings'))) return;
  res.json(await resetMailSettings());
}

// Sends to the caller's own address only, so the endpoint can't be used to mail anyone else.
// The super admin gets a plain reason plus the mail server's own one-line answer — what tells
// "wrong password" apart from "SMTP AUTH disabled for this mailbox"; the raw error is logged.
export async function sendTestEmailHandler(req: Request, res: Response) {
  if (!(await requireSuperAdmin(req, res, 'send a test email'))) return;
  try {
    await sendTestEmail(req.user!.email);
    res.status(204).end();
  } catch (err) {
    if (err instanceof MailDisabledError) {
      res.status(409).json({ error: 'Email sending is switched off' });
      return;
    }
    console.error('Test email failed', err);
    const reason = describeMailError(err, { serverReply: true });
    res.status(502).json({ error: `Not sent — ${reason}` });
  }
}
