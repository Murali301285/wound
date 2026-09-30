@echo off
echo Creating WoundCare Deployment Package...
powershell -ExecutionPolicy Bypass -Command "& {
    if (Test-Path 'staging_deploy') { Remove-Item 'staging_deploy' -Recurse -Force }
    if (Test-Path 'WoundCare_Deploy_Package.zip') { Remove-Item 'WoundCare_Deploy_Package.zip' -Force }
    New-Item -ItemType Directory -Path 'staging_deploy\backend\app' -Force | Out-Null
    New-Item -ItemType Directory -Path 'staging_deploy\backend\data' -Force | Out-Null
    New-Item -ItemType Directory -Path 'staging_deploy\frontend' -Force | Out-Null
    Copy-Item 'backend\app\*' 'staging_deploy\backend\app\' -Recurse -Force
    Copy-Item 'backend\requirements.txt' 'staging_deploy\backend\' -Force
    Copy-Item 'backend\model_weights_augmented.pth' 'staging_deploy\backend\' -Force
    if (Test-Path 'backend\.env') { Copy-Item 'backend\.env' 'staging_deploy\backend\' -Force }
    Copy-Item 'frontend\src' 'staging_deploy\frontend\src' -Recurse -Force
    Copy-Item 'frontend\public' 'staging_deploy\frontend\public' -Recurse -Force -ErrorAction SilentlyContinue
    Copy-Item 'frontend\dist' 'staging_deploy\frontend\dist' -Recurse -Force
    Copy-Item 'frontend\package.json' 'staging_deploy\frontend\' -Force
    Copy-Item 'frontend\package-lock.json' 'staging_deploy\frontend\' -Force
    Copy-Item 'frontend\server.js' 'staging_deploy\frontend\' -Force
    Copy-Item 'frontend\vite.config.js' 'staging_deploy\frontend\' -Force
    Copy-Item 'frontend\tailwind.config.js' 'staging_deploy\frontend\' -Force
    Copy-Item 'frontend\postcss.config.js' 'staging_deploy\frontend\' -Force
    Copy-Item 'frontend\index.html' 'staging_deploy\frontend\' -Force
    Copy-Item 'ecosystem.config.js' 'staging_deploy\' -Force
    Copy-Item 'deploy.bat' 'staging_deploy\' -Force
    Copy-Item 'stop.bat' 'staging_deploy\' -Force
    Copy-Item 'DEPLOYMENT_GUIDE.md' 'staging_deploy\' -Force
    Compress-Archive -Path 'staging_deploy\*' -DestinationPath 'WoundCare_Deploy_Package.zip' -Force
    Remove-Item 'staging_deploy' -Recurse -Force
    Write-Host 'Package Created: WoundCare_Deploy_Package.zip'
}"
pause
