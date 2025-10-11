-- Migration script to convert category text field to category_id foreign key
-- This script should be run after updating the database schema

-- Step 1: Add the new category_id column (if not already added by schema update)
-- ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.user_categories(id) ON DELETE SET NULL;

-- Step 2: For existing transactions with category text, try to match them to user categories
-- This will only work if the category names in transactions exactly match the names in user_categories

UPDATE public.transactions 
SET category_id = uc.id
FROM public.user_categories uc
WHERE transactions.category = uc.name 
  AND transactions.type = uc.type
  AND transactions.category IS NOT NULL
  AND transactions.category != '';

-- Step 3: After verifying the migration worked correctly, drop the old category column
-- WARNING: Only run this after confirming all categories were migrated successfully
-- ALTER TABLE public.transactions DROP COLUMN IF EXISTS category;

-- Step 4: Verify the migration
-- SELECT 
--   COUNT(*) as total_transactions,
--   COUNT(category_id) as transactions_with_category_id,
--   COUNT(*) - COUNT(category_id) as transactions_without_category
-- FROM public.transactions;
