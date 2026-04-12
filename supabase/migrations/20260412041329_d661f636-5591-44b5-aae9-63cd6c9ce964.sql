
CREATE OR REPLACE FUNCTION public.pesquisa_hash_pin(pin text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public, extensions AS $$
  SELECT crypt(pin, gen_salt('bf'))
$$;

CREATE OR REPLACE FUNCTION public.pesquisa_verify_pin(pin text, pin_hash text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public, extensions AS $$
  SELECT crypt(pin, pin_hash) = pin_hash
$$;
