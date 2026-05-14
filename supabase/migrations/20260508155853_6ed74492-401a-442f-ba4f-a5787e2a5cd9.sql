
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "product-images public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');
