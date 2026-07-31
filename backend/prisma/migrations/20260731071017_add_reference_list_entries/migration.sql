-- CreateEnum
CREATE TYPE "ReferenceListCategory" AS ENUM ('COUNTRY', 'WORKING_DOMAIN', 'DESIGNATION', 'NATCO_NAME');

-- CreateTable
CREATE TABLE "ReferenceListEntry" (
    "id" TEXT NOT NULL,
    "category" "ReferenceListCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT,

    CONSTRAINT "ReferenceListEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReferenceListEntry_category_organizationId_name_key" ON "ReferenceListEntry"("category", "organizationId", "name");

-- AddForeignKey
ALTER TABLE "ReferenceListEntry" ADD CONSTRAINT "ReferenceListEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
