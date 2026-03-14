-- Migrate Document.category from enum to string with legacy value mapping
-- Step 1: Add new column
ALTER TABLE "Document" ADD COLUMN "category_new" TEXT;

-- Step 2: Copy and map existing values (legacy enum -> new category labels)
UPDATE "Document" SET "category_new" = CASE "category"::text
  WHEN 'letter' THEN 'Expert Letters'
  WHEN 'pay' THEN 'Forms & Fees'
  WHEN 'media' THEN 'Evidence (Criteria)'
  WHEN 'publication' THEN 'Evidence (Criteria)'
  WHEN 'award' THEN 'Evidence (Criteria)'
  WHEN 'judging' THEN 'Evidence (Criteria)'
  WHEN 'membership' THEN 'Evidence (Criteria)'
  WHEN 'role' THEN 'Evidence (Criteria)'
  WHEN 'contribution' THEN 'Evidence (Criteria)'
  WHEN 'misc' THEN 'Case Intake & Profile'
  ELSE 'Case Intake & Profile'
END;

-- Step 3: Set default for any nulls, then make NOT NULL
UPDATE "Document" SET "category_new" = 'Case Intake & Profile' WHERE "category_new" IS NULL;
ALTER TABLE "Document" ALTER COLUMN "category_new" SET NOT NULL;
ALTER TABLE "Document" ALTER COLUMN "category_new" SET DEFAULT 'Case Intake & Profile';

-- Step 4: Drop old column and rename new
ALTER TABLE "Document" DROP COLUMN "category";
ALTER TABLE "Document" RENAME COLUMN "category_new" TO "category";

-- Step 5: Drop enum
DROP TYPE "DocumentCategory";
