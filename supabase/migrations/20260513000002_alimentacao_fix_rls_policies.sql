-- Corrigir RLS com qual=true (legível por anon) e auth.jwt()->>'role' (dead policy)
-- Substituir por has_role() que é o padrão do projeto.

-- === meal_forecast_exports ===
DROP POLICY IF EXISTS "Everyone read exports" ON meal_forecast_exports;
DROP POLICY IF EXISTS "Admin and Alimentacao manage exports" ON meal_forecast_exports;

CREATE POLICY "Authenticated read exports"
  ON meal_forecast_exports FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin and Alimentacao manage exports"
  ON meal_forecast_exports FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'secretaria'::app_role)
    OR has_role(auth.uid(), 'alimentacao'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'secretaria'::app_role)
    OR has_role(auth.uid(), 'alimentacao'::app_role)
  );

-- === meal_window_eligibility ===
DROP POLICY IF EXISTS "Everyone read eligibility" ON meal_window_eligibility;
DROP POLICY IF EXISTS "Admin and Alimentacao manage eligibility" ON meal_window_eligibility;

CREATE POLICY "Authenticated read eligibility"
  ON meal_window_eligibility FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin and Alimentacao manage eligibility"
  ON meal_window_eligibility FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'secretaria'::app_role)
    OR has_role(auth.uid(), 'alimentacao'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'secretaria'::app_role)
    OR has_role(auth.uid(), 'alimentacao'::app_role)
  );
