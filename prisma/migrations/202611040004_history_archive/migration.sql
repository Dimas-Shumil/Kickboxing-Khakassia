-- Additive migration: preserve existing users, people, news, competitions and payments.
CREATE TABLE "HistoryMaterial" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "payload" TEXT NOT NULL,
    "publishedPayload" TEXT,
    "slug" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedOn" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "HistoryMaterial_slug_key" ON "HistoryMaterial"("slug");
CREATE TABLE "HistoryAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "materialId" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HistoryAsset_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "HistoryMaterial" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "HistoryAsset_materialId_idx" ON "HistoryAsset"("materialId");
