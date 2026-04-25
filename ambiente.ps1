param(
  [ValidateSet("status", "teste", "build", "supabase", "envs", "help")]
  [string]$Acao = "status"
)

$SupabaseTesteRef = "wiwvpokdbklathfkjmzl"

function Titulo($texto) {
  Write-Host ""
  Write-Host "=== $texto ===" -ForegroundColor Cyan
}

function Ok($texto) {
  Write-Host "[OK] $texto" -ForegroundColor Green
}

function Aviso($texto) {
  Write-Host "[AVISO] $texto" -ForegroundColor Yellow
}

function Erro($texto) {
  Write-Host "[ERRO] $texto" -ForegroundColor Red
}

function VerificaGit {
  if (-not (Test-Path ".git")) {
    Erro "Você não está na raiz do projeto Git."
    exit 1
  }
}

function MostrarBranch {
  Titulo "Branch atual"
  git branch --show-current
}

function MostrarGitStatus {
  Titulo "Git status"
  git status --short
  $clean = git status --porcelain
  if (-not $clean) {
    Ok "Working tree clean"
  } else {
    Aviso "Existem alterações locais"
  }
}

function MostrarSupabase {
  Titulo "Supabase vinculado"

  $refPath = "supabase\.temp\project-ref"

  if (-not (Test-Path $refPath)) {
    Aviso "Arquivo supabase\.temp\project-ref não encontrado."
    Aviso "Talvez você ainda não tenha rodado: npx supabase link --project-ref ..."
    return
  }

  $ref = Get-Content $refPath

  Write-Host "Project ref atual: $ref"

  if ($ref -eq $SupabaseTesteRef) {
    Ok "Este é o Supabase de TESTE"
  } else {
    Aviso "Este NÃO é o Supabase de teste conhecido."
    Aviso "Antes de rodar db push, confirme se este projeto está correto."
  }
}

function MostrarEnvs {
  Titulo "Arquivos de ambiente"

  Get-ChildItem -Force .env* -ErrorAction SilentlyContinue | Select-Object Name,Length,LastWriteTime | Format-Table

  if (Test-Path ".env.teste.local") {
    Ok ".env.teste.local existe"
  } else {
    Aviso ".env.teste.local não encontrado"
  }

  if (Test-Path ".env.production.local") {
    Ok ".env.production.local existe"
  } else {
    Aviso ".env.production.local não encontrado"
  }

  if (Test-Path ".env.teste.local") {
    Titulo "Variáveis do teste"
    Get-Content ".env.teste.local" |
      Where-Object { $_ -match "^\s*[^#].*=" } |
      ForEach-Object {
        $key = ($_ -split "=", 2)[0]
        Write-Host "$key=***"
      }
  }
}

function RodarStatus {
  VerificaGit
  MostrarBranch
  MostrarGitStatus
  MostrarSupabase
  MostrarEnvs
}

function RodarTeste {
  VerificaGit

  Titulo "Preparando ambiente local de TESTE"

  $branch = git branch --show-current

  if ($branch -ne "teste") {
    Aviso "Você está na branch '$branch'. Mudando para 'teste'..."
    git switch teste
    if ($LASTEXITCODE -ne 0) {
      Erro "Não consegui mudar para a branch teste."
      exit 1
    }
  }

  Titulo "Atualizando branch teste"
  git pull

  Titulo "Rodando app em teste"
  npm run dev:teste
}

function RodarBuild {
  VerificaGit

  Titulo "Conferindo branch"
  $branch = git branch --show-current
  Write-Host "Branch atual: $branch"

  if ($branch -ne "teste") {
    Aviso "Você não está na branch teste."
    Aviso "Para build de teste, o recomendado é: git switch teste"
  }

  MostrarSupabase

  Titulo "Build de teste"
  npm run build:teste

  if ($LASTEXITCODE -eq 0) {
    Ok "Build de teste passou"
  } else {
    Erro "Build de teste falhou"
    exit 1
  }
}

function MostrarHelp {
  Write-Host ""
  Write-Host "Uso:" -ForegroundColor Cyan
  Write-Host "  .\ambiente.ps1 status"
  Write-Host "  .\ambiente.ps1 teste"
  Write-Host "  .\ambiente.ps1 build"
  Write-Host "  .\ambiente.ps1 supabase"
  Write-Host "  .\ambiente.ps1 envs"
  Write-Host ""
  Write-Host "Comandos:" -ForegroundColor Cyan
  Write-Host "  status    Mostra branch, Git, Supabase e arquivos .env"
  Write-Host "  teste     Vai para branch teste, faz pull e roda npm run dev:teste"
  Write-Host "  build     Roda npm run build:teste"
  Write-Host "  supabase  Mostra qual Supabase está vinculado"
  Write-Host "  envs      Mostra arquivos .env sem mostrar chaves"
  Write-Host ""
}

switch ($Acao) {
  "status"   { RodarStatus }
  "teste"    { RodarTeste }
  "build"    { RodarBuild }
  "supabase" { MostrarSupabase }
  "envs"     { MostrarEnvs }
  "help"     { MostrarHelp }
}
