# Email sender without a shared Detecon mailbox — plan

**Status: decided 2026-11-19 — option B (dedicated free mailbox); no known rule against a non-Detecon sender.** Source: `admin_management.md` line 51 (2026-11-19).

## Where we are

The sending side is already built (`ONBOARDING_SECURITY_PLAN.md` Phases 2–3):

- Welcome emails with a set-your-password link (7 days), admin-sent and self-service reset links, sent on Create user
  and after both Excel imports (batches of 10, "Retry failed").
- Production sends since 2026-11-16 through an **interim personal Gmail** (`jaser.thesis@gmail.com`, about 500
  emails a day). The super admin can change the mailbox in Management Console → **Email delivery** without a redeploy.

So the gap is not the code but **whose mailbox sends**. IT will not provide a shared Detecon mailbox, and personal
accounts (the Gmail, or `jaserbin.rahman@detecon.com`) are not a good long-term sender: replies go to a person,
the account can be locked, and the volume is tied to one person's quota.

## Options

| | Option | Sender looks like | Cost / effort | Code change |
|---|---|---|---|---|
| **A** | **Transactional email service + own domain** (e.g. Brevo, Mailgun, Postmark, Resend, Amazon SES) | `no-reply@<your-domain>` | Domain about €10–15 a year; free tiers of these services cover ~100–300 emails a day (check the current terms). One-time DNS setup (SPF, DKIM, DMARC) on a domain **you** control — no Detecon IT needed | **None** — every one of them offers SMTP on port 587; entered in Email delivery |
| B | **Dedicated free mailbox** (new Gmail/Outlook.com account only for Anlet, e.g. `anlet.assessment@gmail.com`) | `anlet.assessment@gmail.com` | Free, 30 minutes | None |
| C | **No sending service: emails go out from the admin's own Outlook** | the admin | Free | Yes — see below |

**A is the recommendation.** It is the only option that is neither a person's account nor a free-mail address, it
lands best in corporate inboxes (client mail filters check SPF/DKIM; a Gmail sender sending links to many
corporate addresses is more often marked as spam), and it needs no change to the application. The same domain can
later also give the app a nicer address than `anlet-602185048647.europe-west3.run.app` (Cloud Run domain mapping,
separate step).

Option B is a quick improvement over today's personal Gmail with the same limits and spam risk.

Option C fits only if no service may be used at all (e.g. a client forbids external senders). It would add, to the
users table and both import results:

1. **"Copy invitation"** per user: a ready-to-paste text with the welcome link (no password in it).
2. **"Download invitations (Excel)"** for the selected / imported people: Email · First name · Welcome link ·
   valid until — ready for an **Outlook mail merge** (Word → Mailings), so one click sends personal emails from
   the admin's own mailbox.
3. A short how-to in the Project Admin manual.

Links are still one-time and expire after 7 days, so a forwarded or leaked file does less harm than a temporary
password list.

## Steps for option A (once a service and a domain are chosen)

1. Register the domain (any registrar; or Google Cloud Domains partner) — **your decision, it costs money.**
2. Create the account at the chosen service, add the domain, copy its SPF/DKIM/DMARC records into the domain's DNS,
   wait for "verified".
3. Create SMTP credentials at the service.
4. Management Console → Email delivery → *Change settings*: host, port 587, login, password, From
   `no-reply@<domain>`, From name "Anlet", Reply-To your address (so answers reach a person). Saving runs a live
   check first — nothing is saved if the server refuses.
5. "Send test email to me", then a welcome email to one test user at a client domain; check it is not in spam.
6. Update `gcp_deployment.md` (secret / Known gaps) and the manual's "If emails do not arrive" box.

I can do steps 4–6 with you and write the DNS records list for step 2; steps 1–3 need your accounts.

## Steps for option B (decided)

No code change — the mailbox is switched in the Management Console.

1. **You:** create a new Gmail account only for Anlet (e.g. `anlet.assessment@gmail.com`; any free name). Use a
   recovery phone/address you control, not a person who may leave.
2. **You:** turn on 2-Step Verification for it, then create an **app password** (myaccount.google.com/apppasswords,
   name it "Anlet"). Gmail refuses the normal password over SMTP.
3. **You (super admin):** Management Console → **Email delivery** → *Change settings*:
   host `smtp.gmail.com`, port `587`, login and From = the new address, From name `Anlet`, password = the app
   password, **Reply-To = your Detecon address** (so answers reach a person). Save — Anlet checks the login with
   Gmail first and saves nothing if it is refused.
4. **You:** "Send test email to me", then send a welcome email to one test user at a client address and check it
   is not in spam (if it is, ask the client to mark it "not spam" once).
5. **Me, afterwards:** update `gcp_deployment.md` (sender, Known gaps) and drop the old `jaser.thesis@gmail.com`
   app password from Secret Manager guidance; you can then revoke that app password.

Limits to keep in mind: about 500 recipients a day per Gmail account (a project import of a few hundred people
fits; larger ones can be sent over two days with "Retry failed"), and Gmail may temporarily block sending if many
messages bounce — check addresses in the import file.

## Open questions (answered)

1. Which option: A, B or C (C can also be added on top of A/B as a fallback)?
2. For A: is buying a domain in your name OK, and do you have a preferred service?
3. Does Detecon or any client forbid emails from a non-Detecon domain?
