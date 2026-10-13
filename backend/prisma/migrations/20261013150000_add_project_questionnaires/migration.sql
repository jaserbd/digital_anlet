-- Questionnaires per project (PROJECT_QUESTIONNAIRES_PLAN.md)
CREATE TABLE "ProjectQuestionnaire" (
    "projectId" TEXT NOT NULL,
    "questionnaireId" TEXT NOT NULL,

    CONSTRAINT "ProjectQuestionnaire_pkey" PRIMARY KEY ("projectId","questionnaireId")
);

ALTER TABLE "ProjectQuestionnaire" ADD CONSTRAINT "ProjectQuestionnaire_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectQuestionnaire" ADD CONSTRAINT "ProjectQuestionnaire_questionnaireId_fkey" FOREIGN KEY ("questionnaireId") REFERENCES "Questionnaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing projects keep every questionnaire.
INSERT INTO "ProjectQuestionnaire" ("projectId", "questionnaireId")
SELECT p."id", q."id" FROM "Project" p CROSS JOIN "Questionnaire" q;
