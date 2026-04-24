CREATE OR REPLACE VIEW public.vw_import_errors AS
SELECT
  ire.id,
  il.file_name,
  il.created_at                         AS imported_at,
  ire.row_number,
  ire.error_code,
  ire.error_message,
  ire.payload->>'full_name'             AS aluno,
  ire.payload->>'institution_name'      AS escola,
  ire.payload->>'sport_name'            AS modalidade,
  ire.payload->>'prova_name'            AS prova,
  ire.payload->>'category_name'         AS categoria,
  ire.event_id,
  ire.import_log_id
FROM public.import_row_errors ire
LEFT JOIN public.import_logs il ON il.id = ire.import_log_id
ORDER BY ire.import_log_id, ire.row_number;
