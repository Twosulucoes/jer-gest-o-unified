export interface SportEventRow {
  id: string;
  name: string;
  sports: { name: string; is_collective: boolean } | null;
  categories: { name: string; gender_scope: string } | null;
}
