/*
  Warnings:

  - You are about to drop the `WebhookLog` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "WebhookLog" DROP CONSTRAINT "WebhookLog_alertId_fkey";

-- AlterTable
ALTER TABLE "AlertTable" ALTER COLUMN "token" DROP NOT NULL;

-- DropTable
DROP TABLE "WebhookLog";

-- CreateTable
CREATE TABLE "LastSourcePayload" (
    "source" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LastSourcePayload_pkey" PRIMARY KEY ("source")
);
