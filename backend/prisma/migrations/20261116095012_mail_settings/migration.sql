-- Email delivery settings edited in the Management Console (ONBOARDING_SECURITY_PLAN.md Phase 2b).
-- CreateTable
CREATE TABLE "MailSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "user" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "fromName" TEXT NOT NULL,
    "replyTo" TEXT,
    "passwordEncrypted" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByEmail" TEXT,

    CONSTRAINT "MailSettings_pkey" PRIMARY KEY ("id")
);

-- A single row.
ALTER TABLE "MailSettings" ADD CONSTRAINT "MailSettings_single_row" CHECK ("id" = 'default');
