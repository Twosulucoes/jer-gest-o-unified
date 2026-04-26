
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
  const { data, error } = await supabase.from('participants').select('id, category').limit(1)
  if (error) {
    console.error('Error fetching category:', error.message)
  } else {
    console.log('Successfully fetched category:', data)
  }
}

check()
