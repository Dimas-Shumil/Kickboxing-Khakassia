-- CreateTable
CREATE TABLE "ShopProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "image" TEXT,
    "variants" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ShopRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "items" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "consent" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ShopSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "operator" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "inn" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "policy" TEXT NOT NULL,
    "consent" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopProduct_slug_key" ON "ShopProduct"("slug");

-- CreateIndex
CREATE INDEX "ShopProduct_published_category_idx" ON "ShopProduct"("published", "category");

-- CreateIndex
CREATE INDEX "ShopProduct_image_idx" ON "ShopProduct"("image");

-- CreateIndex
CREATE UNIQUE INDEX "ShopRequest_number_key" ON "ShopRequest"("number");

-- CreateIndex
CREATE UNIQUE INDEX "ShopRequest_key_key" ON "ShopRequest"("key");

-- CreateIndex
CREATE INDEX "ShopRequest_createdAt_idx" ON "ShopRequest"("createdAt");
