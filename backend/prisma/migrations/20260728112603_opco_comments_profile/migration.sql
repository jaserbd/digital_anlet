-- AlterTable
ALTER TABLE "SubScenarioScoreResult" ALTER COLUMN "overallScore" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "designation" TEXT,
ADD COLUMN     "opCoId" TEXT,
ADD COLUMN     "workingDomain" TEXT;

-- CreateTable
CREATE TABLE "OpCo" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "OpCo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionComment" (
    "id" TEXT NOT NULL,
    "commentText" TEXT NOT NULL,
    "appliesToNone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "responseId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,

    CONSTRAINT "QuestionComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionCommentSubScenario" (
    "commentId" TEXT NOT NULL,
    "subScenarioId" TEXT NOT NULL,

    CONSTRAINT "QuestionCommentSubScenario_pkey" PRIMARY KEY ("commentId","subScenarioId")
);

-- CreateIndex
CREATE UNIQUE INDEX "OpCo_organizationId_name_key" ON "OpCo"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionComment_responseId_questionId_key" ON "QuestionComment"("responseId", "questionId");

-- AddForeignKey
ALTER TABLE "OpCo" ADD CONSTRAINT "OpCo_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_opCoId_fkey" FOREIGN KEY ("opCoId") REFERENCES "OpCo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionComment" ADD CONSTRAINT "QuestionComment_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "QuestionnaireResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionComment" ADD CONSTRAINT "QuestionComment_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionCommentSubScenario" ADD CONSTRAINT "QuestionCommentSubScenario_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "QuestionComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionCommentSubScenario" ADD CONSTRAINT "QuestionCommentSubScenario_subScenarioId_fkey" FOREIGN KEY ("subScenarioId") REFERENCES "SubScenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
