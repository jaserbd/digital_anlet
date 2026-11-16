// Kept apart from mailer.ts (no imports) so tests that replace the mailer still get the real wording.

const MAIL_ERROR_REASONS: Record<string, string> = {
  EAUTH: 'the mail server did not accept the login (address, password, or sending not allowed for this mailbox)',
  ECONNECTION: 'the mail server could not be reached',
  ESOCKET: 'the connection to the mail server failed',
  ETIMEDOUT: 'the mail server did not answer in time',
  ECONNREFUSED: 'the mail server refused the connection',
  EDNS: 'the mail server name could not be found',
  ENOTFOUND: 'the mail server name could not be found',
  ETLS: 'a secure connection to the mail server could not be set up',
  EENVELOPE: 'the mail server rejected the sender or recipient address',
  EMESSAGE: 'the mail server rejected the message',
};

/**
 * What to tell a person about a failed send (ONBOARDING_SECURITY_PLAN.md Phase 6, finding 14):
 * a plain reason by error kind, never the raw error (which can carry host names, addresses and
 * library internals — that goes to the server log). With `serverReply` (super admin screens
 * only) the mail server's own one-line answer is added, which is what tells "wrong password"
 * from "SMTP sending disabled for this mailbox".
 */
export function describeMailError(err: unknown, options: { serverReply?: boolean } = {}): string {
  const e = (err ?? {}) as { code?: unknown; response?: unknown };
  const reason = (typeof e.code === 'string' && MAIL_ERROR_REASONS[e.code]) || 'the email could not be sent';
  if (!options.serverReply || typeof e.response !== 'string') return reason;
  const reply = e.response.split(/\r?\n/)[0]!.trim().slice(0, 200);
  return reply ? `${reason} — server answer: ${reply}` : reason;
}
