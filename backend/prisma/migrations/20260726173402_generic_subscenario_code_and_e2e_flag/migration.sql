-- AlterTable
ALTER TABLE "Questionnaire" ADD COLUMN     "hasE2ECheck" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: cast the existing enum values to text instead of dropping the column,
-- preserving any existing rows (SubScenarioCode is now a free-form string — see
-- schema.prisma's SubScenario.code comment).
ALTER TABLE "SubScenario" ALTER COLUMN "code" TYPE TEXT USING "code"::text;

-- DropEnum
DROP TYPE "SubScenarioCode";

-- Note: no CREATE UNIQUE INDEX here — the existing SubScenario_questionnaireId_code_key
-- index (from the original @@unique) remains valid on the retyped column.
