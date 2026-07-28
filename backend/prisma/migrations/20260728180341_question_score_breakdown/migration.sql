-- CreateTable
CREATE TABLE "QuestionScoreResult" (
    "id" TEXT NOT NULL,
    "originalScore" DECIMAL(6,4),
    "compensatedScore" DECIMAL(6,4),
    "scoreResultId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "subScenarioId" TEXT NOT NULL,

    CONSTRAINT "QuestionScoreResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuestionScoreResult_scoreResultId_questionId_subScenarioId_key" ON "QuestionScoreResult"("scoreResultId", "questionId", "subScenarioId");

-- AddForeignKey
ALTER TABLE "QuestionScoreResult" ADD CONSTRAINT "QuestionScoreResult_scoreResultId_fkey" FOREIGN KEY ("scoreResultId") REFERENCES "ScoreResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionScoreResult" ADD CONSTRAINT "QuestionScoreResult_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionScoreResult" ADD CONSTRAINT "QuestionScoreResult_subScenarioId_fkey" FOREIGN KEY ("subScenarioId") REFERENCES "SubScenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
