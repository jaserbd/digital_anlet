-- Projects + Project Admins (PROJECTS_PLAN.md)
ALTER TYPE "Role" ADD VALUE 'PROJECT_ADMIN';

CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Project_name_key" ON "Project"("name");

ALTER TABLE "Organization" ADD COLUMN "projectId" TEXT;

ALTER TABLE "Organization" ADD CONSTRAINT "Organization_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- One project per existing client organization, named after it (the internal org is skipped).
INSERT INTO "Project" ("id", "name", "createdAt", "updatedAt")
SELECT 'p_' || md5("id"), "name", "createdAt", CURRENT_TIMESTAMP
FROM "Organization"
WHERE "name" <> 'Anlet (Internal)';

UPDATE "Organization" SET "projectId" = 'p_' || md5("id")
WHERE "name" <> 'Anlet (Internal)';
