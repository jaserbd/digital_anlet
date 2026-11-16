-- Case-insensitive email addresses (ONBOARDING_SECURITY_PLAN.md Phase 1): every stored address is
-- trimmed and lowercased; the check constraint keeps it that way (lib/email.ts's normalizeEmail
-- runs on every write), so the existing unique index on "email" is case-insensitive in effect.
-- One transaction: the guard leaves everything untouched when two accounts differ only in case.

BEGIN;

-- 1. Guard: two accounts whose addresses differ only in case/spacing must be merged by hand first.
DO $$
DECLARE offenders TEXT;
BEGIN
  SELECT string_agg(emails, '; ') INTO offenders
  FROM (
    SELECT string_agg("email", ', ' ORDER BY "email") AS emails
    FROM "User"
    GROUP BY lower(btrim("email"))
    HAVING count(*) > 1
  ) duplicates;
  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION 'Accounts differing only in email case: % — merge them before migrating', offenders;
  END IF;
END $$;

-- 2. Normalize.
UPDATE "User" SET "email" = lower(btrim("email")) WHERE "email" <> lower(btrim("email"));

-- 3. Keep it normalized.
ALTER TABLE "User" ADD CONSTRAINT "User_email_normalized" CHECK ("email" = lower(btrim("email")));

COMMIT;
