
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
  const { count, error } = await supabase.from('participants').select('*', { count: 'exact', head: true })
  if (error) {
    console.error(error)
  } else {
    console.log('Total participants:', count)
  }

  const { data: events, error: eventError } = await supabase.from('events').select('id, name').limit(5)
  console.log('Events:', events)
}

check()
