/*
  Warnings:

  - You are about to drop the `LastSourcePayload` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "LastSourcePayload";

-- CreateTable
CREATE TABLE "LastAlertPayload" (
    "alertId" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LastAlertPayload_pkey" PRIMARY KEY ("alertId")
);

-- CreateTable
CREATE TABLE "LastFailedPayload" (
    "alertId" INTEGER NOT NULL,
    "raw" TEXT,
    "parsed" JSONB,
    "error" TEXT NOT NULL,
    "stage" TEXT,
    "failedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LastFailedPayload_pkey" PRIMARY KEY ("alertId")
);

-- AddForeignKey
ALTER TABLE "LastAlertPayload" ADD CONSTRAINT "LastAlertPayload_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "AlertTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LastFailedPayload" ADD CONSTRAINT "LastFailedPayload_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "AlertTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
