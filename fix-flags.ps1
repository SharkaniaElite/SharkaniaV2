# fix-flags.ps1
# Ejecutar desde la raiz del proyecto: .\fix-flags.ps1

$ErrorActionPreference = "Stop"

$files = @(
  "src/components/calendar/tournament-card.tsx",
  "src/components/calendar/tournament-detail-modal.tsx",
  "src/components/clubs/club-header.tsx",
  "src/components/leagues/league-standings-table.tsx",
  "src/components/search/global-search.tsx",
  "src/pages/clubs.tsx",
  "src/pages/compare.tsx",
  "src/pages/league-detail.tsx",
  "src/pages/leagues.tsx",
  "src/pages/player-dashboard.tsx",
  "src/pages/player-profile.tsx",
  "src/pages/ranking.tsx",
  "src/pages/super-admin.tsx"
)

foreach ($file in $files) {
  if (-not (Test-Path $file)) {
    Write-Host "SKIP (no existe): $file"
    continue
  }

  $content = Get-Content $file -Raw -Encoding UTF8

  # 1. Agregar import FlagIcon si no existe ya
  if ($content -notmatch 'import.*FlagIcon') {
    # Calcular prefijo relativo segun profundidad
    $depth = ($file.Split("/").Count - 1)
    $prefix = "../" * ($depth - 1)
    $flagImport = "import { FlagIcon } from `"${prefix}components/ui/flag-icon`";"

    # Insertar despues del ultimo import existente
    $content = [regex]::Replace(
      $content,
      '((?:import[^\n]+\n)+)',
      { param($m) $m.Value + $flagImport + "`n" },
      [System.Text.RegularExpressions.RegexOptions]::RightToLeft
    )
    # Fallback: insertar al inicio si no se encontro bloque de imports
    if ($content -notmatch 'FlagIcon') {
      $content = $flagImport + "`n" + $content
    }
  }

  # 2. Reemplazar {getFlag(x)} por <FlagIcon countryCode={x} />
  $content = $content -replace '\{getFlag\(([^)]+)\)\}', '<FlagIcon countryCode={$1} />'

  # 3. Reemplazar getFlag(x) (sin llaves, en JSX atributos o concatenaciones)
  $content = $content -replace '(?<![{])getFlag\(([^)]+)\)(?![}])', '<FlagIcon countryCode={$1} />'

  # 4. Limpiar getFlag del import de countries si ya no se usa
  if ($content -notmatch 'getFlag\(') {
    $content = $content -replace ',\s*getFlag\b', ''
    $content = $content -replace '\bgetFlag\s*,\s*', ''
  }

  Set-Content $file $content -Encoding UTF8 -NoNewline
  Write-Host "OK: $file"
}

Write-Host ""
Write-Host "Listo. Revisa el proyecto con: npm run dev"
