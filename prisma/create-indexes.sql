CREATE UNIQUE INDEX IF NOT EXISTS "brand_name_active" ON "Brand" (name) WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "phone_model_active" ON "PhoneModel" ("brandId", name) WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "part_brand_active" ON "PartBrand" ("categoryId", name) WHERE "deletedAt" IS NULL;
