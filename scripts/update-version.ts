import { execSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

try {
  const commitFull = execSync('git rev-parse HEAD').toString().trim();
  const commit = commitFull.substring(0, 8);
  const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  const buildDate = new Date().toISOString();
  
  const versionPath = join(process.cwd(), 'public', 'version.json');
  let currentData = {};
  
  try {
    currentData = JSON.parse(readFileSync(versionPath, 'utf8'));
  } catch (e) {
    console.log('Arquivo version.json não encontrado ou inválido, criando novo...');
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
