-- CreateTable
CREATE TABLE "AlertTable" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "input" TEXT,
    "triggerType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bundle" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "alertId" INTEGER NOT NULL,
    "discussion_list" BIGINT[],
    "formating" TEXT NOT NULL DEFAULT 'Unformatted',
    "custom_script" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookLog" (
    "id" SERIAL NOT NULL,
    "alertId" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AlertTable_token_key" ON "AlertTable"("token");

-- AddForeignKey
ALTER TABLE "Bundle" ADD CONSTRAINT "Bundle_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "AlertTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookLog" ADD CONSTRAINT "WebhookLog_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "AlertTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
