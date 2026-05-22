-- Lock down products: keep public read, block public writes
DROP POLICY IF EXISTS products_all_write ON public.products;
DROP POLICY IF EXISTS products_all_update ON public.products;
DROP POLICY IF EXISTS products_all_delete ON public.products;

-- Lock down reviews: keep public insert/update (app needs them), block public delete
DROP POLICY IF EXISTS reviews_all_delete ON public.reviews;

-- Lock down product-images storage bucket writes
CREATE POLICY "product_images_block_anon_insert"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id <> 'product-images');

CREATE POLICY "product_images_block_anon_update"
ON storage.objects FOR UPDATE TO anon, authenticated
USING (bucket_id <> 'product-images');

CREATE POLICY "product_images_block_anon_delete"
ON storage.objects FOR DELETE TO anon, authenticated
USING (bucket_id <> 'product-images');