# ============================================================
#  BrewLite - Auto zip du an (bo node_modules, build, .git...)
#  Dung boi scripts\zip-project.bat
# ============================================================

# Tat progress bar: tranh crash tien trinh khi chay khong co console day du
$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Stop'

# Thu muc goc du an = thu muc cha cua scripts\
$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$projectName = Split-Path $root -Leaf
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'

$outDir = Join-Path $root 'outputs'
[IO.Directory]::CreateDirectory($outDir) | Out-Null
$zip = Join-Path $outDir "$projectName-$stamp-with-secrets.zip"

Write-Host ''
Write-Host '============================================================'
Write-Host " Dong goi du an: $projectName"
Write-Host " Thu muc goc   : $root"
Write-Host " File zip      : $zip"
Write-Host '============================================================'
Write-Host ''

# Thu muc loai bo (khop o bat ky cap nao) - cat nhanh truoc khi di vao
$excludeDirs = @(
    'node_modules', '.git', '.worktrees', '.next', 'dist', 'build', 'coverage',
    '.tmp', 'tmp', '.pnpm-store', '.turbo', '.cache', '.vercel',
    'playwright-report', 'test-results', '.idea', '.vscode', '.agents'
)
$excludePaths = @(
    'outputs', 'logs', 'BrewLite-Report', 'apps/api/src/generated/prisma', 'apps/web/out'
)

# File loai bo theo pattern. Giu lai .env va cac file khoa.
$excludeFiles = @(
    '.git', '*.log', '*.tsbuildinfo',
    '*.db', '*.db-*', '*.sqlite', '*.sqlite-*', '*.sqlite3', '*.sqlite3-*',
    '*.zip', '*.7z', '*.rar', '*.tar', '*.tar.gz', '*.tgz', '.DS_Store', 'Thumbs.db'
)

Write-Host ' Dang quet file (bo qua thu muc nang)...'

# Duyet thu cong theo kieu prune: khong di vao $excludeDirs
$files = New-Object System.Collections.Generic.List[string]
$stack = New-Object System.Collections.Generic.Stack[string]
$stack.Push($root)
$rootPrefixLength = $root.Length + 1

while ($stack.Count -gt 0) {
    $dir = $stack.Pop()
    $children = Get-ChildItem -LiteralPath $dir -Force
    foreach ($c in $children) {
        if ($c.PSIsContainer) {
            if ($excludeDirs -contains $c.Name) { continue }
            $relativePath = $c.FullName.Substring($rootPrefixLength).Replace('\', '/')
            if ($excludePaths -contains $relativePath) { continue }
            # Bo qua reparse point (symlink/junction) de tranh vong lap
            if ($c.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
            $stack.Push($c.FullName)
        }
        else {
            if ($c.LinkType -eq 'SymbolicLink') { continue }
            $name = $c.Name
            $skip = $false
            foreach ($pat in $excludeFiles) {
                if ($name -like $pat) { $skip = $true; break }
            }
            if (-not $skip) { $files.Add($c.FullName) }
        }
    }
}

Write-Host (" So file se dong goi: " + $files.Count)

if ($files.Count -eq 0) {
    Write-Host ' [LOI] Khong tim thay file nao de dong goi.'
    exit 1
}

Write-Host ' Dang nen...'

# Nen truc tiep bang .NET ZipFile - khong can copy sang thu muc tam
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$tempZip = Join-Path $outDir ([IO.Path]::GetRandomFileName())
$archive = [System.IO.Compression.ZipFile]::Open($tempZip, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    try {
        foreach ($full in $files) {
            $entryName = $full.Substring($rootPrefixLength).Replace('\', '/')
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $archive, $full, $entryName,
                [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
        }
    }
    finally {
        $archive.Dispose()
    }
    [IO.File]::Move($tempZip, $zip)
}
catch {
    Remove-Item -LiteralPath $tempZip -Force -ErrorAction SilentlyContinue
    throw
}

$size = [math]::Round((Get-Item -LiteralPath $zip).Length / 1MB, 2)

Write-Host ''
Write-Host '============================================================'
Write-Host " XONG! Kich thuoc: $size MB"
Write-Host " File: $zip"
Write-Host '============================================================'
