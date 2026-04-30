-- Add policies for tables with RLS enabled but no policies

CREATE POLICY "Allow authenticated view of participant_event_roles" ON public.participant_event_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated view of participant_national_eligibility" ON public.participant_national_eligibility FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated view of delegation_requests" ON public.delegation_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated view of disciplinary_cases" ON public.disciplinary_cases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated view of lodging_supervisions" ON public.lodging_supervisions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated view of phase_qualification_rules" ON public.phase_qualification_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated view of document_requirements" ON public.document_requirements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated view of participant_documents" ON public.participant_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated view of disciplinary_sanctions" ON public.disciplinary_sanctions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated view of jerpa_functional_classifications" ON public.jerpa_functional_classifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated view of jerpa_support_needs" ON public.jerpa_support_needs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated view of state_selection_callups" ON public.state_selection_callups FOR SELECT TO authenticated USING (true);

-- Ensure all tables have at least one policy if RLS is enabled
-- (This is a subset of the 358 alerts, focusing on the identified 12 tables)
