BEGIN;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM storage.buckets WHERE id='backstage-private' AND public) THEN RAISE EXCEPTION 'O bucket já existe como público. Interromper e revisar.'; END IF; END $$;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('backstage-private','backstage-private',false,10485760,ARRAY['image/png','image/jpeg','image/webp','application/pdf']) ON CONFLICT(id) DO NOTHING;
DROP POLICY IF EXISTS backstage_storage_guard ON storage.objects;
CREATE POLICY backstage_storage_guard ON storage.objects AS RESTRICTIVE FOR ALL TO anon,authenticated
 USING(bucket_id<>'backstage-private' OR ((storage.foldername(name))[1]=auth.uid()::text AND EXISTS(SELECT 1 FROM public.backstage_owners WHERE user_id=auth.uid())))
 WITH CHECK(bucket_id<>'backstage-private' OR ((storage.foldername(name))[1]=auth.uid()::text AND EXISTS(SELECT 1 FROM public.backstage_owners WHERE user_id=auth.uid())));
DROP POLICY IF EXISTS backstage_storage_read ON storage.objects;
CREATE POLICY backstage_storage_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='backstage-private' AND (storage.foldername(name))[1]=auth.uid()::text AND EXISTS(SELECT 1 FROM public.backstage_owners WHERE user_id=auth.uid()));
DROP POLICY IF EXISTS backstage_storage_write ON storage.objects;
CREATE POLICY backstage_storage_write ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='backstage-private' AND (storage.foldername(name))[1]=auth.uid()::text AND EXISTS(SELECT 1 FROM public.backstage_owners WHERE user_id=auth.uid()));
DROP POLICY IF EXISTS backstage_storage_delete ON storage.objects;
CREATE POLICY backstage_storage_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='backstage-private' AND (storage.foldername(name))[1]=auth.uid()::text AND EXISTS(SELECT 1 FROM public.backstage_owners WHERE user_id=auth.uid()));
COMMIT;
