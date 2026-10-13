-- Projects v2 (PROJECTS_V2_PLAN.md): organizations in many projects, memberships (and so
-- answers) per project, Project Admins per project, open/close per project + organization.

-- Memberships become per (user, organization, project). NULLS NOT DISTINCT so project-less
-- memberships stay unique per (user, organization) as before.
DROP INDEX "Membership_userId_organizationId_key";
ALTER TABLE "Membership" ADD COLUMN "projectId" TEXT;
CREATE UNIQUE INDEX "Membership_userId_organizationId_projectId_key"
  ON "Membership"("userId", "organizationId", "projectId") NULLS NOT DISTINCT;

CREATE TABLE "ProjectOrganization" (
    "projectId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "ProjectOrganization_pkey" PRIMARY KEY ("projectId","organizationId")
);

CREATE TABLE "QuestionnaireProjectSetting" (
    "projectId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "questionnaireId" TEXT NOT NULL,
    "acceptingResponses" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionnaireProjectSetting_pkey" PRIMARY KEY ("projectId","organizationId","questionnaireId")
);

-- 1. Each organization's single project becomes a link — except Detecon, whose people are
--    picked as Project Admins per project instead of Detecon being part of projects.
INSERT INTO "ProjectOrganization" ("projectId", "organizationId")
SELECT "projectId", "id" FROM "Organization"
WHERE "projectId" IS NOT NULL AND "name" <> 'Detecon';

-- 2. Memberships of linked organizations take part in that project.
UPDATE "Membership" m SET "projectId" = o."projectId"
FROM "Organization" o
WHERE m."organizationId" = o."id" AND o."projectId" IS NOT NULL AND o."name" <> 'Detecon';

-- 3. A Project Admin membership in Detecon within project P becomes Project Admin of P: the
--    Project Admin role in each of P's (other) organizations. The Detecon membership stays as a
--    project-less Executive membership, keeping any answers it holds.
INSERT INTO "Membership" ("id", "role", "createdAt", "updatedAt", "userId", "organizationId", "projectId")
SELECT 'm_' || md5(m."userId" || ':' || po."organizationId" || ':' || po."projectId"),
       'PROJECT_ADMIN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, m."userId", po."organizationId", po."projectId"
FROM "Membership" m
JOIN "Organization" d ON d."id" = m."organizationId" AND d."name" = 'Detecon' AND d."projectId" IS NOT NULL
JOIN "ProjectOrganization" po ON po."projectId" = d."projectId"
WHERE m."role" = 'PROJECT_ADMIN'
ON CONFLICT ("userId", "organizationId", "projectId") DO NOTHING;

UPDATE "Membership" m SET "role" = 'EXECUTIVE'
FROM "Organization" d
WHERE d."id" = m."organizationId" AND d."name" = 'Detecon' AND m."role" = 'PROJECT_ADMIN';

-- 4. Open/close settings per project + organization start from the organization's setting.
INSERT INTO "QuestionnaireProjectSetting" ("projectId", "organizationId", "questionnaireId", "acceptingResponses", "updatedAt")
SELECT po."projectId", s."organizationId", s."questionnaireId", s."acceptingResponses", CURRENT_TIMESTAMP
FROM "ProjectOrganization" po
JOIN "QuestionnaireOrgSetting" s ON s."organizationId" = po."organizationId";

-- 5. The single-project column goes away.
ALTER TABLE "Organization" DROP CONSTRAINT "Organization_projectId_fkey";
ALTER TABLE "Organization" DROP COLUMN "projectId";

ALTER TABLE "ProjectOrganization" ADD CONSTRAINT "ProjectOrganization_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectOrganization" ADD CONSTRAINT "ProjectOrganization_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuestionnaireProjectSetting" ADD CONSTRAINT "QuestionnaireProjectSetting_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestionnaireProjectSetting" ADD CONSTRAINT "QuestionnaireProjectSetting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuestionnaireProjectSetting" ADD CONSTRAINT "QuestionnaireProjectSetting_questionnaireId_fkey" FOREIGN KEY ("questionnaireId") REFERENCES "Questionnaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
