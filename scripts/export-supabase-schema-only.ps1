#Requires -Version 5.1
<#
  Sharkania: safe schema-only export from the linked production project.
  Run only on a trusted Windows PC. This script is READ-ONLY against Supabase:
    - No passwords or access tokens are accepted as script parameters
    - Supabase CLI uses interactive local login / link, if needed
    - No row/data export flags
    - SQL files are written OUTSIDE the Git repository by default
    - No migrations or production schemas are changed

  Requires Supabase CLI and Docker Desktop (for Supabase db dump).
  Official CLI reference: https://supabase.com/docs/reference/cli/supabase-db-dump
#>
param(
  [string] $OutputDirectory = "",
  [switch] $IncludePrivateSchema
)

$ErrorActionPreference = "Stop"
$ProjectRef = "nhpjzywfzljtlqaigzed"

if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
  throw "Supabase CLI not found. Install it locally, then run supabase --version."
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker was not found. Supabase db dump runs pg_dump in Docker."
}
try {
  docker info --format "{{.ServerVersion}}" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Docker is not started." }
} catch { throw "Start Docker Desktop before exporting the schema." }

# Keep outputs separate from code, Preview, and git history.
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
  $OutputDirectory = Join-Path ([Environment]::GetFolderPath("MyDocuments")) "SharkaniaSchemaOnly"
}
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
$Root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$inGit = $OutputDirectory.TrimEnd('\').StartsWith($Root.TrimEnd('\') + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)
if ($inGit -or ($OutputDirectory -eq $Root)) {
  throw "Export outside the Git repository, not to a source-controlled path."
}
New-Item -Path $OutputDirectory -ItemType Directory -Force | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$PublicFile = Join-Path $OutputDirectory "sharkania-public-schema-$stamp.sql"
$PrivateFile = Join-Path $OutputDirectory "sharkania-private-schema-$stamp.sql"

Write-Host "Project ref: $ProjectRef"
Write-Host "Output: $OutputDirectory (NOT inside Git)"
Write-Host "This captures DDL, NOT account rows, passwords, or purchase data."
Write-Host "If login or database authentication is required, complete it ONLY in the local CLI/browser."
Write-Host "Checking Supabase dump command..."
& supabase db dump --help | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Supabase db dump --help failed." }

Push-Location $Root
try {
  & supabase link --project-ref $ProjectRef
  if ($LASTEXITCODE -ne 0) { throw "Could not link Supabase CLI. No files were uploaded." }

  # No --data-only or --role-only; schema DDL only. No remote writes.
  & supabase db dump --schema public --file $PublicFile
  if ($LASTEXITCODE -ne 0) { throw "Public schema export failed." }

  if ($IncludePrivateSchema) {
    & supabase db dump --schema private --file $PrivateFile
    if ($LASTEXITCODE -ne 0) { throw "Private custom schema export failed." }
  }
} finally {
  Pop-Location
}

$produced = @($PublicFile)
if ($IncludePrivateSchema) { $produced += $PrivateFile }
foreach ($file in $produced) {
  $info = Get-Item -LiteralPath $file -ErrorAction Stop
  if ($info.Length -lt 1024) { throw "Schema file seems incomplete: $file" }
  $hash = Get-FileHash -LiteralPath $file -Algorithm SHA256
  Write-Host ("Exported {0}: {1} bytes; SHA256 {2}" -f $info.Name, $info.Length, $hash.Hash)
}
Write-Host "DONE. Keep these SQL files PRIVATE. They represent the CURRENT schema, not the pre-migration baseline."
Write-Host "Do not apply them as migrations or upload them to public GitHub automatically."
Write-Host "Provide a reviewed, sanitized schema-only export to the project when the baseline reconstruction can be validated offline."
