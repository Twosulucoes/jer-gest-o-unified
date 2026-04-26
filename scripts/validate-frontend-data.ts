
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/integrations/supabase/types';

// Using environment variables for connection
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://dfzjrijdcskncrwaiykr.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmempyaWpkY3NrbmNyd2FpeWtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTUwNjYsImV4cCI6MjA5MDczMTA2Nn0.jYPuKoPcNC5sEBLXtgTyo9e4oqDsc69zOVrzHrf4lUw";

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runValidation() {
  console.log('🚀 Iniciando Checklist de Validação de Dados...\n');

  const checks = [
    {
      name: 'Relacionamento Participants -> People (person_id)',
      test: async () => {
        const { data, error } = await supabase
          .from('participants')
          .select('id, person_id, people(id, full_name)')
          .limit(1);
        if (error) throw error;
        return true;
      }
    },
    {
      name: 'Relacionamento Delegations -> Institutions (institution_id)',
      test: async () => {
        const { data, error } = await supabase
          .from('delegations')
          .select('id, institution_id, institutions(id, name)')
          .limit(1);
        if (error) throw error;
        return true;
      }
    },
    {
      name: 'Colunas críticas em Participants',
      test: async () => {
        const { data, error } = await supabase
          .from('participants')
          .select('id, status, participant_type, is_active')
          .limit(1);
        if (error) throw error;
        return true;
      }
    },
    {
      name: 'Colunas críticas em Delegations',
      test: async () => {
        const { data, error } = await supabase
          .from('delegations')
          .select('id, school_name, status, event_id')
          .limit(1);
        if (error) throw error;
        return true;
      }
    }
  ];

  let allPassed = true;

  for (const check of checks) {
    process.stdout.write(`[ ] ${check.name}... `);
    try {
      await check.test();
      process.stdout.write(`\r[✅] ${check.name}\n`);
    } catch (err: any) {
      process.stdout.write(`\r[❌] ${check.name}\n`);
      console.error(`    Erro: ${err.message}\n`);
      allPassed = false;
    }
  }

  console.log('\n--- Resumo ---');
  if (allPassed) {
    console.log('✅ Todas as validações passaram! Pronto para compilar.\n');
    process.exit(0);
  } else {
    console.log('❌ Algumas validações falharam. Verifique o banco de dados antes de compilar.\n');
    process.exit(1);
  }
}

runValidation();
