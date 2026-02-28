---
description: Запуск тесту розширення через Chrome Remote Debugging
---

# Тестування через Chrome Remote Debugging

## Підготовка (один раз)
1. Закрийте звичайний Chrome повністю
2. Запустіть `start-chrome-debug.bat` в папці розширення, або вручну:
```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```
3. Відкрийте https://www.temu.com/ua в Chrome
4. Прокрутіть сторінку до товарів

## Запуск тесту
// turbo
```
node puppeteer-test.js
```

## Що тестується
- Плаваюча панель (#temu-pro-window)
- CSS стилі розширення
- Score Bars на товарних картках
- Оброблені картки (data-temu-processed)
- Tooltip data (data-tooltip-html)
- Курс валют (chrome.storage)
