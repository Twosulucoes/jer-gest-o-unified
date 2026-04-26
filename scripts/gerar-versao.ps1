param(
  [string]$Ambiente = "local"
)

$version = Get-Content VERSION -Raw
$version = $version.Trim()

$branch = git branch --show-current
$commit = git rev-parse --short HEAD
$commitFull = git rev-parse HEAD
$buildDate = Get-Date -Format "yyyy-MM-ddTHH:mm:sszzz"

$supabaseRef = ""
if (Test-Path "supabase\.temp\project-ref") {
  $supabaseRef = Get-Content "supabase\.temp\project-ref" -Raw
  $supabaseRef = $supabaseRef.Trim()
}

$json = @"
{
  "appVersion": "$version",
  "environment": "$Ambiente",
  "branch": "$branch",
  "commit": "$commit",
  "commitFull": "$commitFull",
  "buildDate": "$buildDate",
  "supabaseProjectRef": "$supabaseRef"
}
"@

if (!(Test-Path "public")) {
  New-Item -ItemType Directory -Path "public" | Out-Null
}

Set-Content -Path "public\version.json" -Value $json -Encoding UTF8

Write-Host "[OK] Versao gerada em public/version.json"
Write-Host $json