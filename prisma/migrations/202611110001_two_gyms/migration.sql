-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN "gymId" TEXT;

-- CreateTable
CREATE TABLE "Gym" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "FinanceEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gymId" TEXT,
    "kind" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "occurredOn" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FinanceEntry_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Add nullable ownership without rebuilding existing tables or assigning legacy rows.
ALTER TABLE "User" ADD COLUMN "gymId" TEXT REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Student" ADD COLUMN "gymId" TEXT REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrainingGroup" ADD COLUMN "gymId" TEXT REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GymSession" ADD COLUMN "gymId" TEXT REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
DROP INDEX "TrainingGroup_name_key";
CREATE UNIQUE INDEX "TrainingGroup_gymId_name_key" ON "TrainingGroup"("gymId", "name");
CREATE INDEX "Student_gymId_idx" ON "Student"("gymId");
CREATE INDEX "TrainingGroup_gymId_idx" ON "TrainingGroup"("gymId");
CREATE INDEX "GymSession_gymId_idx" ON "GymSession"("gymId");
INSERT INTO "Gym" ("id", "name") VALUES ('school-12', 'Школа №12'), ('school-25', 'Школа №25');

-- CreateIndex
CREATE INDEX "FinanceEntry_gymId_occurredOn_idx" ON "FinanceEntry"("gymId", "occurredOn");

-- CreateIndex
CREATE INDEX "AuditLog_gymId_createdAt_idx" ON "AuditLog"("gymId", "createdAt");
