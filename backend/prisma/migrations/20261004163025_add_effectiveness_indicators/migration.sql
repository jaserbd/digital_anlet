-- AlterTable
ALTER TABLE "Questionnaire" ADD COLUMN     "keiNote" TEXT;

-- AlterTable
ALTER TABLE "ScoreResult" ADD COLUMN     "keiScore" DECIMAL(6,4);

-- CreateTable
CREATE TABLE "EffectivenessIndicator" (
    "id" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "weight" DECIMAL(5,4) NOT NULL,
    "optionAText" TEXT NOT NULL,
    "optionBText" TEXT,
    "optionCText" TEXT,
    "optionDText" TEXT,
    "optionACriteria" DECIMAL(4,2),
    "optionBCriteria" DECIMAL(4,2),
    "optionCCriteria" DECIMAL(4,2),
    "optionDCriteria" DECIMAL(4,2),
    "questionnaireId" TEXT NOT NULL,

    CONSTRAINT "EffectivenessIndicator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResponseKei" (
    "id" TEXT NOT NULL,
    "selectedOption" "AnswerOption",
    "indicatorValue" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "responseId" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,

    CONSTRAINT "ResponseKei_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EffectivenessIndicator_questionnaireId_sortOrder_key" ON "EffectivenessIndicator"("questionnaireId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ResponseKei_responseId_indicatorId_key" ON "ResponseKei"("responseId", "indicatorId");

-- AddForeignKey
ALTER TABLE "EffectivenessIndicator" ADD CONSTRAINT "EffectivenessIndicator_questionnaireId_fkey" FOREIGN KEY ("questionnaireId") REFERENCES "Questionnaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseKei" ADD CONSTRAINT "ResponseKei_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "QuestionnaireResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseKei" ADD CONSTRAINT "ResponseKei_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "EffectivenessIndicator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
