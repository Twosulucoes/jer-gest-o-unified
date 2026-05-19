-- Adiciona protocol_number e contact_email à tabela substitutions
ALTER TABLE public.substitutions
  ADD COLUMN IF NOT EXISTS protocol_number TEXT,
  ADD COLUMN IF NOT EXISTS contact_email   TEXT;

-- Unique constraint separado para facilitar re-execução segura
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'substitutions_protocol_number_key'
      AND conrelid = 'public.substitutions'::regclass
  ) THEN
    ALTER TABLE public.substitutions
      ADD CONSTRAINT substitutions_protocol_number_key UNIQUE (protocol_number);
  END IF;
END $$;

-- Função para gerar o número de protocolo automaticamente
CREATE OR REPLACE FUNCTION public.generate_substitution_protocol()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.protocol_number := 'SUB-' || UPPER(SUBSTRING(NEW.id::text, 1, 8));
  RETURN NEW;
END;
$$;

-- Trigger: dispara antes do INSERT se protocol_number ainda não foi definido
DROP TRIGGER IF EXISTS trg_substitution_protocol ON public.substitutions;
CREATE TRIGGER trg_substitution_protocol
  BEFORE INSERT ON public.substitutions
  FOR EACH ROW
  WHEN (NEW.protocol_number IS NULL)
  EXECUTE FUNCTION public.generate_substitution_protocol();

-- Backfill: gera protocol_number para registros antigos que não têm
UPDATE public.substitutions
SET protocol_number = 'SUB-' || UPPER(SUBSTRING(id::text, 1, 8))
WHERE protocol_number IS NULL;

-- Bucket para documentos de substituição
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'substitution-docs',
  'substitution-docs',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- RLS Storage: usuários autenticados podem fazer upload, leitura e exclusão
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'sub_docs_insert' AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "sub_docs_insert" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'substitution-docs');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'sub_docs_select' AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "sub_docs_select" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'substitution-docs');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'sub_docs_delete' AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "sub_docs_delete" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'substitution-docs');
  END IF;
END $$;
