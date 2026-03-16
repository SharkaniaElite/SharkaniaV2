# fix-flags.ps1
# Ejecutar desde la raíz del proyecto: .\fix-flags.ps1

$files = Get-ChildItem -Path "./src" -Recurse -Include "*.tsx" |
  Select-String "getFlag" |
  Select-Object -ExpandProperty Path -Unique

foreach ($file in $files) {
    $content = Get-Content $file -Raw -Encoding UTF8

    # 1. Agregar import de FlagIcon si no existe
    if ($content -notmatch "import.*FlagIcon") {
        # Detectar profundidad relativa para el import
        $rel = $file.Replace((Resolve-Path ./src).Path, "").Replace("\", "/")
        $depth = ($rel.Split("/").Count - 2)
        $prefix = "../" * $depth
        if ($depth -le 0) { $prefix = "./" }

        $flagImport = "import { FlagIcon } from `"${prefix}components/ui/flag-icon`";"

        # Insertar después de la última línea de import
        $content = $content -replace "(^import[^\n]+\n)(?!import)", "`$1$flagImport`n"
    }

    # 2. Reemplazar patrones comunes de getFlag
    # {getFlag(x.country_code)} -> <FlagIcon countryCode={x.country_code} />
    $content = $content -replace '\{getFlag\(([^)]+)\)\}', '<FlagIcon countryCode={$1} />'

    # 3. Remover getFlag de imports si ya no se usa
    if ($content -notmatch 'getFlag\(') {
        $content = $content -replace ',\s*getFlag', ''
        $content = $content -replace 'getFlag,\s*', ''
        $content = $content -replace ',\s*getFlag\s*}', ' }'
    }

    Set-Content $file $content -Encoding UTF8
    Write-Host "Procesado: $file"
}

Write-Host ""
Write-Host "--- Operacion finalizada con exito ---"
