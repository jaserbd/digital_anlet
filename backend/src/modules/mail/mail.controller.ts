import type { Request, Response } from 'express';
import { MailDisabledError, getMailStatus, sendTestEmail } from '../../lib/mailer';
import { isCallerSuperAdmin } from '../users/users.service';

export function mailStatusHandler(_req: Request, res: Response) {
  res.json(getMailStatus());
}

// Sends to the caller's own address only, so the endpoint can't be used to mail anyone else.
// The SMTP error is returned verbatim (super admin only): it's what tells "wrong password"
// apart from "SMTP AUTH disabled for this mailbox".
export async function sendTestEmailHandler(req: Request, res: Response) {
  if (!(await isCallerSuperAdmin(req.user!.sub))) {
    res.status(403).json({ error: 'Only the super admin can send a test email' });
    return;
  }
  try {
    await sendTestEmail(req.user!.email);
    res.status(204).end();
  } catch (err) {
    if (err instanceof MailDisabledError) {
      res.status(409).json({ error: 'Email sending is switched off (MAIL_ENABLED is not "true")' });
      return;
    }
    res.status(502).json({ error: `The mail server refused: ${err instanceof Error ? err.message : String(err)}` });
  }
}
