-- Только новые таблицы: не изменяет существующих пользователей, медиа, учеников или оплат.
CREATE TABLE "SitePage" (
 "key" TEXT NOT NULL PRIMARY KEY,
 "payload" TEXT NOT NULL,
 "publishedPayload" TEXT,
 "version" INTEGER NOT NULL DEFAULT 1,
 "publishedOn" DATETIME,
 "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "FederationDocument" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "title" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'draft',
 "payload" TEXT NOT NULL,
 "publishedPayload" TEXT,
 "version" INTEGER NOT NULL DEFAULT 1,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "publishedOn" DATETIME
);
CREATE TABLE "SiteAsset" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "ownerKey" TEXT NOT NULL,
 "kind" TEXT NOT NULL,
 "size" INTEGER NOT NULL,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "SiteAsset_ownerKey_idx" ON "SiteAsset"("ownerKey");
