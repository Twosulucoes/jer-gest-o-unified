-- Adiciona a role 'material' ao enum public.app_role.
--
-- Role dedicada para operadores do ponto de Protocolo de Entrega de Material
-- (segue o mesmo padrão de 'alimentacao' / 'transporte').
--
-- IMPORTANTE: ALTER TYPE ... ADD VALUE precisa ser efetivado (committed) antes
-- de qualquer objeto referenciar o novo valor com o cast '::app_role'. Por isso
-- este ADD VALUE fica em migration separada, aplicada antes de
-- 20260705010001_protocolo_entrega_material.sql (tabelas/RPCs/policies).

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'material';
