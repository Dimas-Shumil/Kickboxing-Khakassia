ALTER TABLE "ShopProduct" ADD COLUMN "photos" TEXT NOT NULL DEFAULT '[]';
UPDATE "ShopProduct" SET "photos" = json_array("image") WHERE "image" IS NOT NULL AND "image" <> '';

-- Reserve every previously issued variant code and its original label.
ALTER TABLE "ShopProduct" ADD COLUMN "variantHistory" TEXT NOT NULL DEFAULT '{}';
UPDATE "ShopProduct" SET "variantHistory" = COALESCE((SELECT json_group_object(json_extract(value,'$.code'),json_extract(value,'$.label')) FROM json_each("ShopProduct"."variants")), '{}');
