import { execSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

function safeExec(cmd: string, fallback: string): string {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || fallback;
  } catch {
    return fallback;
  }
}

try {
  const commitFull = safeExec('git rev-parse HEAD', 'unknown');
  const commit = commitFull.substring(0, 8);
  const branch = safeExec('git rev-parse --abbrev-ref HEAD', 'unknown');
  const buildDate = new Date().toISOString();

  const versionPath = join(process.cwd(), 'public', 'version.json');
  let currentData: any = {};

  try {
    let content = readFileSync(versionPath, 'utf8');
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.slice(1);
    }
    currentData = JSON.parse(content);
  } catch (e) {
    console.log('Aviso: version.json não pôde ser lido, usando valores padrão.');
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
  console.error('⚠️ Aviso ao atualizar version.json (continuando build):', error);
  // Não falha o build — apenas registra
}

