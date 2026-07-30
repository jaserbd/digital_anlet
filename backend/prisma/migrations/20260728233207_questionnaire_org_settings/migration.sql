-- CreateTable
CREATE TABLE "QuestionnaireOrgSetting" (
    "questionnaireId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "acceptingResponses" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionnaireOrgSetting_pkey" PRIMARY KEY ("questionnaireId","organizationId")
);

-- AddForeignKey
ALTER TABLE "QuestionnaireOrgSetting" ADD CONSTRAINT "QuestionnaireOrgSetting_questionnaireId_fkey" FOREIGN KEY ("questionnaireId") REFERENCES "Questionnaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionnaireOrgSetting" ADD CONSTRAINT "QuestionnaireOrgSetting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: one row per existing (Questionnaire, Organization) pair, seeded from the
-- questionnaire's current global acceptingResponses value, before that column is dropped.
INSERT INTO "QuestionnaireOrgSetting" ("questionnaireId", "organizationId", "acceptingResponses", "updatedAt")
SELECT q.id, o.id, q."acceptingResponses", now()
FROM "Questionnaire" q CROSS JOIN "Organization" o;

-- AlterTable
ALTER TABLE "Questionnaire" DROP COLUMN "acceptingResponses";
