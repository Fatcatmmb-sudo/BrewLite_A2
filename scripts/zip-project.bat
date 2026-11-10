@echo off
setlocal
REM ============================================================
REM  BrewLite - Dong goi ma nguon thanh file .zip
REM  - Giu lai: toan bo source + file .env (secrets)
REM  - Bo di  : node_modules, .git, dist, build, .next, cache...
REM  - Xuat ra: outputs\<ten-du-an>-<timestamp>-with-secrets.zip
REM  Cach dung:
REM    scripts\zip-project.bat              (nhay doi chuot - co pause)
REM    scripts\zip-project.bat --no-pause   (chay tu terminal/CI)
REM ============================================================

powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command ^
 "$ErrorActionPreference='Stop';" ^
 "$ProgressPreference='SilentlyContinue';" ^
 "$root=(Resolve-Path (Join-Path '%~dp0' '..')).Path;" ^
 "$projectName=Split-Path $root -Leaf;" ^
 "$stamp=Get-Date -Format 'yyyyMMdd-HHmmss-fff';" ^
 "$outDir=Join-Path $root 'outputs';" ^
 "[IO.Directory]::CreateDirectory($outDir) | Out-Null;" ^
 "$zip=Join-Path $outDir \"$projectName-$stamp-with-secrets.zip\";" ^
 "Write-Host '';" ^
 "Write-Host '============================================================';" ^
 "Write-Host (' Dong goi du an: ' + $projectName);" ^
 "Write-Host (' Thu muc goc   : ' + $root);" ^
 "Write-Host (' File zip      : ' + $zip);" ^
 "Write-Host '============================================================';" ^
 "Write-Host '';" ^
 "$excludeDirs=@('node_modules','.git','.worktrees','.next','dist','build','coverage','.tmp','tmp','.pnpm-store','.turbo','.cache','.vercel','playwright-report','test-results','.idea','.vscode','.agents');" ^
 "$excludePaths=@('outputs','logs','BrewLite-Report','apps/api/src/generated/prisma','apps/web/out');" ^
 "$excludeFiles=@('*.log','*.tsbuildinfo','*.db','*.db-*','*.sqlite','*.sqlite-*','*.sqlite3','*.sqlite3-*','*.zip','*.7z','*.rar','*.tar','*.tar.gz','*.tgz','.DS_Store','Thumbs.db');" ^
 "Write-Host ' Dang quet file (giu lai .env, bo qua thu muc nang)...';" ^
 "$files=New-Object System.Collections.Generic.List[string];" ^
 "$stack=New-Object System.Collections.Generic.Stack[string];" ^
 "$stack.Push($root);" ^
 "$prefix=$root.Length+1;" ^
 "while($stack.Count -gt 0){" ^
 "  $dir=$stack.Pop();" ^
 "  foreach($c in (Get-ChildItem -LiteralPath $dir -Force)){" ^
 "    if($c.PSIsContainer){" ^
 "      if($excludeDirs -contains $c.Name){continue};" ^
 "      $rel=$c.FullName.Substring($prefix).Replace('\','/');" ^
 "      if($excludePaths -contains $rel){continue};" ^
 "      if($c.Attributes -band [IO.FileAttributes]::ReparsePoint){continue};" ^
 "      $stack.Push($c.FullName);" ^
 "    } else {" ^
 "      if($c.LinkType -eq 'SymbolicLink'){continue};" ^
 "      $skip=$false;" ^
 "      foreach($pat in $excludeFiles){ if($c.Name -like $pat){$skip=$true;break} };" ^
 "      if(-not $skip){ $files.Add($c.FullName) };" ^
 "    }" ^
 "  }" ^
 "};" ^
 "Write-Host (' So file se dong goi: ' + $files.Count);" ^
 "if($files.Count -eq 0){ Write-Host ' [LOI] Khong tim thay file nao de dong goi.'; exit 1 };" ^
 "Write-Host ' Dang nen...';" ^
 "Add-Type -AssemblyName System.IO.Compression;" ^
 "Add-Type -AssemblyName System.IO.Compression.FileSystem;" ^
 "$tmp=Join-Path $outDir ([IO.Path]::GetRandomFileName());" ^
 "$ar=[System.IO.Compression.ZipFile]::Open($tmp,[System.IO.Compression.ZipArchiveMode]::Create);" ^
 "try{" ^
 "  try{" ^
 "    foreach($full in $files){" ^
 "      $entry=$full.Substring($prefix).Replace('\','/');" ^
 "      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($ar,$full,$entry,[System.IO.Compression.CompressionLevel]::Optimal) | Out-Null;" ^
 "    }" ^
 "  } finally { $ar.Dispose() };" ^
 "  [IO.File]::Move($tmp,$zip);" ^
 "} catch { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue; throw };" ^
 "$size=[math]::Round((Get-Item -LiteralPath $zip).Length/1MB,2);" ^
 "Write-Host '';" ^
 "Write-Host '============================================================';" ^
 "Write-Host (' XONG! Kich thuoc: ' + $size + ' MB');" ^
 "Write-Host (' File: ' + $zip);" ^
 "Write-Host '============================================================';"

set "zipExitCode=%errorlevel%"

if not "%zipExitCode%"=="0" (
  echo.
  echo  [LOI] Dong goi that bai. Xem thong bao o tren.
)

if /I not "%~1"=="--no-pause" pause
exit /b %zipExitCode%
