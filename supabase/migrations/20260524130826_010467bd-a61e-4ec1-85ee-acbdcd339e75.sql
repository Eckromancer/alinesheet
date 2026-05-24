-- Explicit RESTRICTIVE policies to deny anon writes on the product-images bucket.
-- These are belt-and-suspenders on top of Postgres's default deny.

DROP POLICY IF EXISTS "product_images_deny_anon_insert" ON storage.objects;
DROP POLICY IF EXISTS "product_images_deny_anon_update" ON storage.objects;
DROP POLICY IF EXISTS "product_images_deny_anon_delete" ON storage.objects;

CREATE POLICY "product_images_deny_anon_insert"
ON storage.objects
AS RESTRICTIVE
FOR INSERT
TO anon
WITH CHECK (bucket_id <> 'product-images');

CREATE POLICY "product_images_deny_anon_update"
ON storage.objects
AS RESTRICTIVE
FOR UPDATE
TO anon
USING (bucket_id <> 'product-images')
WITH CHECK (bucket_id <> 'product-images');

CREATE POLICY "product_images_deny_anon_delete"
ON storage.objects
AS RESTRICTIVE
FOR DELETE
TO anon
USING (bucket_id <> 'product-images');