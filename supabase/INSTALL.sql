-- Instalação atômica em projeto Supabase Free DEDICADO.
-- Primeiro: desabilite cadastros públicos e crie SOMENTE sua conta Auth pelo Dashboard.
-- Execute somente em projeto dedicado Free, após criar SUA conta de acesso
-- em Authentication > Users e DESABILITAR novos cadastros no painel Auth.
BEGIN;
CREATE TABLE IF NOT EXISTS public.backstage_owners(user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE);
-- A dedicated personal panel permits exactly one authorized owner.
CREATE UNIQUE INDEX IF NOT EXISTS backstage_single_owner ON public.backstage_owners ((true));
CREATE TABLE IF NOT EXISTS public.backstage_entries(
 owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.backstage_owners(user_id),
 id text NOT NULL CHECK(id ~ '^([a-f0-9]{24}|[a-f0-9-]{36})$'),
 kind text NOT NULL CHECK(kind IN ('ideas','calendar','planning','articles','projects','tasks','lab','studies','career','notes','goals','ecosystem','results')),
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object' AND octet_length(data::text)<500000),
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(owner_id,id)
);
CREATE INDEX IF NOT EXISTS backstage_entries_kind ON public.backstage_entries(owner_id,kind,updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS backstage_calendar_source ON public.backstage_entries(owner_id,(data->>'sourceIdea')) WHERE kind='calendar' AND data->>'sourceIdea' IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.backstage_files(
 owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.backstage_owners(user_id),
 id text NOT NULL CHECK(id ~ '^[a-f0-9]{24}$'), name text NOT NULL CHECK(length(name)<=150),
 mime text NOT NULL CHECK(mime IN ('image/png','image/jpeg','image/webp','application/pdf')),
 size integer NOT NULL CHECK(size>0 AND size<=10485760), sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 PRIMARY KEY(owner_id,id)
);
ALTER TABLE public.backstage_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backstage_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backstage_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.backstage_owners,public.backstage_entries,public.backstage_files FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.backstage_owners TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.backstage_entries,public.backstage_files TO authenticated;
DROP POLICY IF EXISTS backstage_self ON public.backstage_owners;
CREATE POLICY backstage_self ON public.backstage_owners FOR SELECT TO authenticated USING(user_id=auth.uid());
DROP POLICY IF EXISTS backstage_entries_owner ON public.backstage_entries;
CREATE POLICY backstage_entries_owner ON public.backstage_entries FOR ALL TO authenticated
 USING(owner_id=auth.uid() AND EXISTS(SELECT 1 FROM public.backstage_owners WHERE user_id=auth.uid()))
 WITH CHECK(owner_id=auth.uid() AND EXISTS(SELECT 1 FROM public.backstage_owners WHERE user_id=auth.uid()));
DROP POLICY IF EXISTS backstage_files_owner ON public.backstage_files;
CREATE POLICY backstage_files_owner ON public.backstage_files FOR ALL TO authenticated
 USING(owner_id=auth.uid() AND EXISTS(SELECT 1 FROM public.backstage_owners WHERE user_id=auth.uid()))
 WITH CHECK(owner_id=auth.uid() AND EXISTS(SELECT 1 FROM public.backstage_owners WHERE user_id=auth.uid()));
CREATE OR REPLACE FUNCTION public.backstage_touch() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN NEW.updated_at=clock_timestamp(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS backstage_updated ON public.backstage_entries;
CREATE TRIGGER backstage_updated BEFORE UPDATE ON public.backstage_entries FOR EACH ROW EXECUTE FUNCTION public.backstage_touch();
-- Bootstrap only when exactly ONE Auth account exists. Never authorize all users.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.backstage_owners) THEN
  IF (SELECT count(*) FROM auth.users)<>1 THEN RAISE EXCEPTION 'Crie somente SUA conta Auth antes de executar. Se houver várias contas, configure o UUID autorizado explicitamente.'; END IF;
  INSERT INTO public.backstage_owners SELECT id FROM auth.users;
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.backstage_snapshot() RETURNS jsonb LANGUAGE sql SECURITY INVOKER STABLE SET search_path='' AS $$
 SELECT jsonb_build_object('records',COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM public.backstage_entries r WHERE owner_id=auth.uid()),'[]'::jsonb),'files',COALESCE((SELECT jsonb_agg(to_jsonb(f) ORDER BY f.id) FROM public.backstage_files f WHERE owner_id=auth.uid()),'[]'::jsonb));
$$;
CREATE OR REPLACE FUNCTION public.backstage_import(records jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r jsonb; existing public.backstage_entries; imported integer:=0; skipped integer:=0;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.backstage_owners WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'Acesso restrito'; END IF;
 IF jsonb_typeof(records)<>'array' OR jsonb_array_length(records)>10000 THEN RAISE EXCEPTION 'Pacote inválido'; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(records) LOOP
  SELECT * INTO existing FROM public.backstage_entries WHERE owner_id=auth.uid() AND id=r->>'id';
  IF FOUND THEN
   IF existing.kind<>r->>'kind' OR existing.data<>r->'data' THEN RAISE EXCEPTION 'Conflito: registro existente diferente. Nenhum registro importado.'; END IF;
   skipped:=skipped+1;
  ELSE
   INSERT INTO public.backstage_entries(owner_id,id,kind,data,updated_at) VALUES(auth.uid(),r->>'id',r->>'kind',r->'data',COALESCE((r->>'updated_at')::timestamptz,now()));
   imported:=imported+1;
  END IF;
 END LOOP;
 RETURN jsonb_build_object('imported',imported,'skipped',skipped);
END $$;
CREATE OR REPLACE FUNCTION public.backstage_schedule(idea_id text) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE source public.backstage_entries; target_id text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.backstage_owners WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'Acesso restrito'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||idea_id,0));
 SELECT * INTO source FROM public.backstage_entries WHERE owner_id=auth.uid() AND id=idea_id AND kind='ideas';
 IF NOT FOUND THEN RAISE EXCEPTION 'Pauta não encontrada'; END IF;
 SELECT id INTO target_id FROM public.backstage_entries WHERE owner_id=auth.uid() AND kind='calendar' AND data->>'sourceIdea'=idea_id;
 IF FOUND THEN RETURN jsonb_build_object('id',target_id,'created',false); END IF;
 target_id:=gen_random_uuid()::text;
 INSERT INTO public.backstage_entries(owner_id,id,kind,data) VALUES(auth.uid(),target_id,'calendar',jsonb_build_object('title',source.data->>'title','theme',COALESCE(source.data->>'summary',''),'category',COALESCE(source.data->>'category',''),'idea',COALESCE(source.data->>'angle',''),'references',COALESCE(source.data->>'sources',''),'notes',COALESCE(source.data->>'developments',''),'channel','Blog','format','Artigo','status','Ideia','date','','sourceIdea',idea_id));
 UPDATE public.backstage_entries SET data=jsonb_set(data,'{status}','"Em produção"') WHERE owner_id=auth.uid() AND id=idea_id;
 RETURN jsonb_build_object('id',target_id,'created',true);
END $$;
REVOKE ALL ON FUNCTION public.backstage_snapshot(),public.backstage_import(jsonb),public.backstage_schedule(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.backstage_snapshot(),public.backstage_import(jsonb),public.backstage_schedule(text) TO authenticated;


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
