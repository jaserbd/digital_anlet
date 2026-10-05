-- Multi-organization memberships (MULTI_ORG_PLAN.md). Hand-written so existing data moves
-- across: every non-admin user becomes one membership (their current organization, role and
-- profile), every response is linked to its user's membership, then the per-user profile
-- columns are dropped and User.role keeps only the global meaning (ADMIN or NORMAL_USER).

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "opCoId" TEXT,
    "workingDomain" TEXT,
    "designation" TEXT,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- Data: one membership per non-admin user (an admin who somehow has responses gets an
-- EXECUTIVE membership so those responses keep a home).
-- Timestamps are copied from the user (written by Prisma in UTC) rather than CURRENT_TIMESTAMP,
-- whose value depends on the database session's time zone — memberships created later by the
-- app are UTC too, so "first membership" ordering stays correct.
INSERT INTO "Membership" ("id", "role", "createdAt", "updatedAt", "userId", "organizationId", "opCoId", "workingDomain", "designation")
SELECT 'm_' || md5(u."id"),
       CASE WHEN u."role" = 'ADMIN' THEN 'EXECUTIVE'::"Role" ELSE u."role" END,
       u."createdAt", u."createdAt", u."id", u."organizationId", u."opCoId", u."workingDomain", u."designation"
FROM "User" u
WHERE u."role" <> 'ADMIN'
   OR EXISTS (SELECT 1 FROM "QuestionnaireResponse" r WHERE r."userId" = u."id");

-- AlterTable: link responses to their user's membership
ALTER TABLE "QuestionnaireResponse" ADD COLUMN "membershipId" TEXT;
UPDATE "QuestionnaireResponse" r SET "membershipId" = m."id"
FROM "Membership" m WHERE m."userId" = r."userId";
ALTER TABLE "QuestionnaireResponse" ALTER COLUMN "membershipId" SET NOT NULL;

-- User.role is now global only: ADMIN, or NORMAL_USER for everyone else
UPDATE "User" SET "role" = 'NORMAL_USER' WHERE "role" <> 'ADMIN';

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_opCoId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "designation",
DROP COLUMN "opCoId",
DROP COLUMN "workingDomain";

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_organizationId_key" ON "Membership"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionnaireResponse_membershipId_questionnaireId_key" ON "QuestionnaireResponse"("membershipId", "questionnaireId");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_opCoId_fkey" FOREIGN KEY ("opCoId") REFERENCES "OpCo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionnaireResponse" ADD CONSTRAINT "QuestionnaireResponse_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
