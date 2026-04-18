
-- RPC: listar tabelas do schema public
CREATE OR REPLACE FUNCTION public.rpc_get_schema_tables()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'secretaria') OR
    public.has_role(auth.uid(), 'coordenacao_tecnica')
  ) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT jsonb_agg(jsonb_build_object(
      'table_name', t.tablename,
      'rls_enabled', c.relrowsecurity
    ) ORDER BY t.tablename)
    FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename AND c.relnamespace = 'public'::regnamespace
    WHERE t.schemaname = 'public'
  );
END;
$$;

-- RPC: listar colunas
CREATE OR REPLACE FUNCTION public.rpc_get_schema_columns()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'secretaria') OR
    public.has_role(auth.uid(), 'coordenacao_tecnica')
  ) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT jsonb_agg(jsonb_build_object(
      'table_name', c.table_name,
      'column_name', c.column_name,
      'data_type', c.udt_name,
      'is_nullable', c.is_nullable = 'YES',
      'column_default', c.column_default
    ) ORDER BY c.table_name, c.ordinal_position)
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
  );
END;
$$;

-- RPC: listar constraints (pk, unique, fk)
CREATE OR REPLACE FUNCTION public.rpc_get_schema_constraints()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'secretaria') OR
    public.has_role(auth.uid(), 'coordenacao_tecnica')
  ) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT jsonb_agg(row_to_jsonb(sub.*))
    FROM (
      SELECT
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      LEFT JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
        AND tc.table_schema = ccu.table_schema
        AND tc.constraint_type = 'FOREIGN KEY'
      WHERE tc.table_schema = 'public'
      ORDER BY tc.table_name, tc.constraint_type, kcu.ordinal_position
    ) sub
  );
END;
$$;

-- RPC: listar RLS policies
CREATE OR REPLACE FUNCTION public.rpc_get_rls_policies()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'secretaria') OR
    public.has_role(auth.uid(), 'coordenacao_tecnica')
  ) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT jsonb_agg(jsonb_build_object(
      'table_name', p.tablename,
      'policy_name', p.policyname,
      'cmd', p.cmd,
      'roles', p.roles,
      'qual', p.qual,
      'with_check', p.with_check
    ) ORDER BY p.tablename, p.policyname)
    FROM pg_policies p
    WHERE p.schemaname = 'public'
  );
END;
$$;
