import nodemailer from 'nodemailer';
import { env } from '../config/env';

// Plain SMTP transport (OVERVIEW.md item 12) rather than a vendor-specific SDK, so any
// provider (SendGrid, SES, Postmark, a plain relay) works via its SMTP credentials.
const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
});

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: 'Reset your Anlet password',
    text: `We received a request to reset your Anlet password. Use the link below within the next hour to choose a new one:\n\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
    html: `<p>We received a request to reset your Anlet password. Use the link below within the next hour to choose a new one:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, you can safely ignore this email.</p>`,
  });
}
