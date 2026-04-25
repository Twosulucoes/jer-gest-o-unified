import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  const { data, error } = await supabase
    .from('participants')
    .select('*')
    .limit(1);

  if (error) {
    console.error("Error fetching participants:", error);
  } else if (data && data.length > 0) {
    console.log("Columns found in participants:", Object.keys(data[0]));
  } else {
    console.log("No data in participants table to check columns.");
    // Try to get column names via another way if no data
    const { data: cols, error: colError } = await supabase.rpc('get_table_columns', { table_name: 'participants' });
    if (colError) {
      console.error("Error getting columns via RPC:", colError);
    } else {
      console.log("Columns from RPC:", cols);
    }
  }
}

checkColumns();
