$taskWebsite = Join-Path $PSScriptRoot 'website'
$taskNodeCommand = Get-Command node -ErrorAction SilentlyContinue
$taskNode = if ($taskNodeCommand) { $taskNodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' }
if (-not (Test-Path -LiteralPath $taskNode)) { throw 'Node.js is required to run the preview.' }
Push-Location -LiteralPath $taskWebsite
try { & $taskNode node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173 --strictPort } finally { Pop-Location }
