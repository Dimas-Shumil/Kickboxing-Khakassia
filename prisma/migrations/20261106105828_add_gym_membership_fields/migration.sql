-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FederationDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "payload" TEXT NOT NULL,
    "publishedPayload" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "publishedOn" DATETIME
);
INSERT INTO "new_FederationDocument" ("createdAt", "id", "payload", "publishedOn", "publishedPayload", "status", "title", "updatedAt", "version") SELECT "createdAt", "id", "payload", "publishedOn", "publishedPayload", "status", "title", "updatedAt", "version" FROM "FederationDocument";
DROP TABLE "FederationDocument";
ALTER TABLE "new_FederationDocument" RENAME TO "FederationDocument";
CREATE TABLE "new_SitePage" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "payload" TEXT NOT NULL,
    "publishedPayload" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedOn" DATETIME,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_SitePage" ("key", "payload", "publishedOn", "publishedPayload", "updatedAt", "version") SELECT "key", "payload", "publishedOn", "publishedPayload", "updatedAt", "version" FROM "SitePage";
DROP TABLE "SitePage";
ALTER TABLE "new_SitePage" RENAME TO "SitePage";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
