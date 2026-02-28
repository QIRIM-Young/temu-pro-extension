# Temu Pro — Chrome з Remote Debugging
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Temu Pro - Chrome з Remote Debugging" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Запускаю Chrome з --remote-debugging-port=9222" -ForegroundColor Yellow
Write-Host ""

$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"

if (!(Test-Path $chromePath)) {
    Write-Host "Chrome не знайдено за шляхом: $chromePath" -ForegroundColor Red
    exit 1
}

Start-Process $chromePath -ArgumentList "--remote-debugging-port=9222"

Write-Host "Chrome запущено!" -ForegroundColor Green
Write-Host ""
Write-Host "1. Відкрийте temu.com в Chrome" -ForegroundColor White
Write-Host "2. Запустіть тест: node puppeteer-test.js" -ForegroundColor White
Write-Host ""
