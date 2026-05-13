-- Adicionar tabelas meal_* à publicação supabase_realtime
-- Sem isso, todos os subscriptions do frontend ficam em silêncio.
ALTER PUBLICATION supabase_realtime ADD TABLE meal_consumptions;
ALTER PUBLICATION supabase_realtime ADD TABLE meal_windows;
ALTER PUBLICATION supabase_realtime ADD TABLE meal_window_eligibility;
ALTER PUBLICATION supabase_realtime ADD TABLE meal_types;
ALTER PUBLICATION supabase_realtime ADD TABLE meal_locations;
