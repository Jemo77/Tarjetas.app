-- AlterTable
ALTER TABLE "AuthChallenge" ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'LOGIN';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
