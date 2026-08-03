-- CreateEnum
CREATE TYPE "AccountMode" AS ENUM ('CREATOR', 'WORKER');

-- CreateEnum
CREATE TYPE "VaultEntryType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'TASK_FUNDED', 'TASK_REFUND', 'REWARD_RELEASED');

-- CreateEnum
CREATE TYPE "VaultEntryStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "defaultMode" "AccountMode" NOT NULL DEFAULT 'WORKER',
ADD COLUMN     "notifyPayouts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyProductNews" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notifyTaskActivity" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "welcomeEmailSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "maxSubmissions" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "refundedAmount" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "vaultFunded" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "signature" DROP NOT NULL;

-- Backfill `rewardPerSubmission` before making it NOT NULL.
--
-- Prisma generates a bare `ADD COLUMN ... BIGINT NOT NULL`, which cannot be
-- applied to a table that already has rows. Existing tasks were all paying
-- `amount / MAX_SUBMISSIONS_PER_TASK` with that constant fixed at 100, so
-- writing that value in preserves exactly what those tasks were already worth
-- to a worker — the column becomes explicit without changing any economics.
ALTER TABLE "Task" ADD COLUMN "rewardPerSubmission" BIGINT NOT NULL DEFAULT 0;
UPDATE "Task" SET "rewardPerSubmission" = "amount" / 100;
ALTER TABLE "Task" ALTER COLUMN "rewardPerSubmission" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Vault" (
    "id" SERIAL NOT NULL,
    "account_id" INTEGER NOT NULL,
    "available" BIGINT NOT NULL DEFAULT 0,
    "reserved" BIGINT NOT NULL DEFAULT 0,
    "totalDeposited" BIGINT NOT NULL DEFAULT 0,
    "totalWithdrawn" BIGINT NOT NULL DEFAULT 0,
    "totalSpent" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultEntry" (
    "id" SERIAL NOT NULL,
    "vault_id" INTEGER NOT NULL,
    "type" "VaultEntryType" NOT NULL,
    "status" "VaultEntryStatus" NOT NULL DEFAULT 'SUCCESS',
    "amount" BIGINT NOT NULL,
    "availableAfter" BIGINT NOT NULL,
    "reservedAfter" BIGINT NOT NULL,
    "signature" TEXT,
    "task_id" INTEGER,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaultEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vault_account_id_key" ON "Vault"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "VaultEntry_signature_key" ON "VaultEntry"("signature");

-- CreateIndex
CREATE INDEX "VaultEntry_vault_id_createdAt_idx" ON "VaultEntry"("vault_id", "createdAt");

-- CreateIndex
CREATE INDEX "VaultEntry_type_createdAt_idx" ON "VaultEntry"("type", "createdAt");

-- CreateIndex
CREATE INDEX "VaultEntry_status_idx" ON "VaultEntry"("status");

-- AddForeignKey
ALTER TABLE "Vault" ADD CONSTRAINT "Vault_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultEntry" ADD CONSTRAINT "VaultEntry_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "Vault"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultEntry" ADD CONSTRAINT "VaultEntry_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

