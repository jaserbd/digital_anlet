-- Questionnaires still "In Review" in TM Forum's library (REVIEW_QUESTIONNAIRES_PLAN.md).
ALTER TABLE "Questionnaire" ADD COLUMN "inReview" BOOLEAN NOT NULL DEFAULT false;
