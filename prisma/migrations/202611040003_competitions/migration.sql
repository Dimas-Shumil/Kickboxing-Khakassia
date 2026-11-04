CREATE TABLE "Competition" (
 "id" TEXT NOT NULL PRIMARY KEY, "title" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'draft',
 "payload" TEXT NOT NULL, "publishedPayload" TEXT, "slug" TEXT, "version" INTEGER NOT NULL DEFAULT 1,
 "publishedOn" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "Competition_slug_key" ON "Competition"("slug");
CREATE TABLE "CompetitionAsset" (
 "id" TEXT NOT NULL PRIMARY KEY, "competitionId" TEXT NOT NULL, "size" INTEGER NOT NULL, "kind" TEXT NOT NULL,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "CompetitionAsset_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
