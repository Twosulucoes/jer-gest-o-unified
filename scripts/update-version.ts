import { execSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

try {
  const commitFull = execSync('git rev-parse HEAD').toString().trim();
  const commit = commitFull.substring(0, 8);
  const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  const buildDate = new Date().toISOString();
  
  const versionPath = join(process.cwd(), 'public', 'version.json');
  let currentData: any = {};
  
  try {
    let content = readFileSync(versionPath, 'utf8');
    // Remove BOM if present
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.slice(1);
    }
    currentData = JSON.parse(content);
  } catch (e) {
    console.log('Aviso: version.json não pôde ser lido, usando valores padrão.');
    // Se falhar, tentamos manter os valores que sabemos que existiam (baseado no estado anterior)
    currentData = {
      appVersion: "0.4.0",
      environment: "teste",
      supabaseProjectRef: "wiwvpokdbklathfkjmzl"
    };
  }
  
  const newData = {
    ...currentData,
    branch,
    commit,
    commitFull,
    buildDate,
  };
  
  writeFileSync(versionPath, JSON.stringify(newData, null, 2));
  console.log(`✅ version.json atualizado: ${commit} (${branch})`);
} catch (error) {
  console.error('❌ Erro ao atualizar version.json:', error);
  process.exit(1);
}
