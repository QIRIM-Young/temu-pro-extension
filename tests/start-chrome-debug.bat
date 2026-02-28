@echo off
echo ============================================
echo  Temu Pro - Chrome з Remote Debugging
echo ============================================
echo.
echo Запускаю Chrome з --remote-debugging-port=9222
echo Після запуску Chrome відкрийте temu.com
echo Потім запустіть: node puppeteer-test.js
echo.

start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222

echo Chrome запущено. Можете запускати тест.
pause
