-- CreateEnum
CREATE TYPE "Role" AS ENUM ('NORMAL_USER', 'EXECUTIVE', 'ADMIN');

-- CreateEnum
CREATE TYPE "AnswerOption" AS ENUM ('A', 'B', 'C', 'D');

-- CreateEnum
CREATE TYPE "ResponseStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "SubScenarioCode" AS ENUM ('EQUIPMENT', 'PROCESSING_ERROR', 'COMMUNICATIONS', 'ENVIRONMENTAL', 'SECURITY');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Questionnaire" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "networkType" TEXT NOT NULL,
    "hvsCategory" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Questionnaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubScenario" (
    "id" TEXT NOT NULL,
    "code" "SubScenarioCode" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "faultDistributionWeight" DECIMAL(5,4) NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "questionnaireId" TEXT NOT NULL,

    CONSTRAINT "SubScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "cognitiveActivity" TEXT NOT NULL,
    "serviceCapability" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "weight" DECIMAL(5,4) NOT NULL,
    "optionAText" TEXT NOT NULL,
    "optionBText" TEXT,
    "optionCText" TEXT,
    "optionDText" TEXT,
    "optionACriteria" DECIMAL(4,2),
    "optionBCriteria" DECIMAL(4,2),
    "optionCCriteria" DECIMAL(4,2),
    "optionDCriteria" DECIMAL(4,2),
    "includeInE2ECheck" BOOLEAN NOT NULL DEFAULT true,
    "complianceWithStandards" BOOLEAN,
    "standardSource" TEXT,
    "questionnaireId" TEXT NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionnaireResponse" (
    "id" TEXT NOT NULL,
    "status" "ResponseStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "questionnaireId" TEXT NOT NULL,

    CONSTRAINT "QuestionnaireResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL,
    "selectedOption" "AnswerOption" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "responseId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "subScenarioId" TEXT NOT NULL,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreResult" (
    "id" TEXT NOT NULL,
    "finalScore" DECIMAL(6,4) NOT NULL,
    "e2eAutomationRate" DECIMAL(6,4) NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responseId" TEXT NOT NULL,

    CONSTRAINT "ScoreResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubScenarioScoreResult" (
    "id" TEXT NOT NULL,
    "overallScore" DECIMAL(6,4) NOT NULL,
    "e2eAchieved" BOOLEAN NOT NULL,
    "scoreResultId" TEXT NOT NULL,
    "subScenarioId" TEXT NOT NULL,

    CONSTRAINT "SubScenarioScoreResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_name_key" ON "Organization"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Questionnaire_code_key" ON "Questionnaire"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SubScenario_questionnaireId_code_key" ON "SubScenario"("questionnaireId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Question_questionnaireId_sortOrder_key" ON "Question"("questionnaireId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Answer_responseId_questionId_subScenarioId_key" ON "Answer"("responseId", "questionId", "subScenarioId");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreResult_responseId_key" ON "ScoreResult"("responseId");

-- CreateIndex
CREATE UNIQUE INDEX "SubScenarioScoreResult_scoreResultId_subScenarioId_key" ON "SubScenarioScoreResult"("scoreResultId", "subScenarioId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubScenario" ADD CONSTRAINT "SubScenario_questionnaireId_fkey" FOREIGN KEY ("questionnaireId") REFERENCES "Questionnaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_questionnaireId_fkey" FOREIGN KEY ("questionnaireId") REFERENCES "Questionnaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionnaireResponse" ADD CONSTRAINT "QuestionnaireResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionnaireResponse" ADD CONSTRAINT "QuestionnaireResponse_questionnaireId_fkey" FOREIGN KEY ("questionnaireId") REFERENCES "Questionnaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "QuestionnaireResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_subScenarioId_fkey" FOREIGN KEY ("subScenarioId") REFERENCES "SubScenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreResult" ADD CONSTRAINT "ScoreResult_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "QuestionnaireResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubScenarioScoreResult" ADD CONSTRAINT "SubScenarioScoreResult_scoreResultId_fkey" FOREIGN KEY ("scoreResultId") REFERENCES "ScoreResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubScenarioScoreResult" ADD CONSTRAINT "SubScenarioScoreResult_subScenarioId_fkey" FOREIGN KEY ("subScenarioId") REFERENCES "SubScenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
