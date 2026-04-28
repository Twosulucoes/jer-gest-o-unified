-- Tabela de locais de refeição
CREATE TABLE IF NOT EXISTS public.meal_locations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    capacity INTEGER,
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de elegibilidade
CREATE TABLE IF NOT EXISTS public.meal_window_eligibility (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    meal_window_id UUID REFERENCES public.meal_windows(id) ON DELETE CASCADE,
    eligibility_type TEXT NOT NULL CHECK (eligibility_type IN ('participant_type', 'delegation', 'institution')),
    participant_type_value TEXT, -- athlete, coach, staff, etc
    reference_id UUID, -- delegation_id ou institution_id
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Auditoria de exportação
CREATE TABLE IF NOT EXISTS public.meal_forecast_exports (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    event_stage_id UUID REFERENCES public.event_stages(id) ON DELETE CASCADE,
    generated_by UUID REFERENCES auth.users(id),
    service_date DATE NOT NULL,
    export_format TEXT NOT NULL, -- pdf, xlsx
    filters JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Adicionar FK em meal_windows para local
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name='meal_windows' AND column_name='meal_window_location_id') THEN
        ALTER TABLE public.meal_windows ADD COLUMN meal_window_location_id UUID REFERENCES public.meal_locations(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Enable RLS
ALTER TABLE public.meal_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_window_eligibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_forecast_exports ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admin and Alimentacao manage locations" ON public.meal_locations FOR ALL USING (auth.jwt() ->> 'role' IN ('admin', 'secretaria', 'alimentacao'));
CREATE POLICY "Everyone read locations" ON public.meal_locations FOR SELECT USING (true);

CREATE POLICY "Admin and Alimentacao manage eligibility" ON public.meal_window_eligibility FOR ALL USING (auth.jwt() ->> 'role' IN ('admin', 'secretaria', 'alimentacao'));
CREATE POLICY "Everyone read eligibility" ON public.meal_window_eligibility FOR SELECT USING (true);

CREATE POLICY "Admin and Alimentacao manage exports" ON public.meal_forecast_exports FOR ALL USING (auth.jwt() ->> 'role' IN ('admin', 'secretaria', 'alimentacao'));
CREATE POLICY "Everyone read exports" ON public.meal_forecast_exports FOR SELECT USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meal_window_eligibility_window ON public.meal_window_eligibility(meal_window_id);
CREATE INDEX IF NOT EXISTS idx_meal_forecast_exports_event ON public.meal_forecast_exports(event_id, event_stage_id);
