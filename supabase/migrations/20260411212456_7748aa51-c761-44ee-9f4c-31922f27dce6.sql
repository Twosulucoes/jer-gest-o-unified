
-- Restaurar profile do usuário Fabiano Vieira
INSERT INTO public.profiles (id, full_name)
VALUES ('5a096804-3eca-47a6-9e4e-e131ef99a3f0', 'Fabiano Vieira')
ON CONFLICT (id) DO NOTHING;

-- Restaurar role admin
INSERT INTO public.user_roles (user_id, role)
VALUES ('5a096804-3eca-47a6-9e4e-e131ef99a3f0', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
