
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = "https://dfzjrijdcskncrwaiykr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmempyaWpkY3NrbmNyd2FpeWtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTUwNjYsImV4cCI6MjA5MDczMTA2Nn0.jYPuKoPcNC5sEBLXtgTyo9e4oqDsc69zOVrzHrf4lUw";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)

async function check() {
  const { error } = await supabase.from('participants').select('organization_subtype').limit(1)
  console.log('organization_subtype exists?', !error)
}

check()
