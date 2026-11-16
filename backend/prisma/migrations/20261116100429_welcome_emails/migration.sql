-- CreateEnum
CREATE TYPE "TokenPurpose" AS ENUM ('RESET', 'INVITE');

-- AlterTable
ALTER TABLE "PasswordResetToken" ADD COLUMN     "purpose" "TokenPurpose" NOT NULL DEFAULT 'RESET';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3);
