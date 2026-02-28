# Temu Pro Extension — Проєктна інструкція

## Про проєкт
**Temu Smart Score & Bar (UA) — Pro** — Chrome розширення (Manifest V3) для аналізу та фільтрації товарів на temu.com. Розраховує "розумний бал" (Smart Score 0-100) для кожного товару на основі знижки, рейтингу, продажів та відгуків.

## Архітектура
- `extension/manifest.json` — Manifest V3, service_worker background 
- `extension/background.js` — Service worker: fetch курсу валют, sidepanel management
- `extension/content.js` — Content script: парсинг DOM товарів, розрахунок балів, UI панель
- `extension/sidepanel.html` + `extension/sidepanel.js` — Бічна панель аналітики
- `tests/puppeteer-test.js` — Тестування через Chrome Remote Debugging

## Технологічний стек
- **Мова**: JavaScript (vanilla, без фреймворків)
- **API**: chrome.storage, chrome.runtime, chrome.sidePanel, exchangerate API  
- **Тестування**: Puppeteer (puppeteer-core) через Chrome Remote Debugging (CDP)
- **Manifest**: V3 (service workers, NOT background pages)

## Конвенції
- Коментарі та UI — **українською мовою**
- Імена змінних — camelCase (англійська)
- CSS класи — з префіксом `temu-` або `tpw-` (Temu Pro Window)
- Налаштування зберігаються в `chrome.storage.local`

## Важливі правила
1. НЕ використовувати `eval()` або remotely hosted code (MV3 заборона)
2. Service worker живе до 30 секунд без активності — зберігати стан в `chrome.storage`
3. Content script працює в ISOLATED world — не має доступу до JS сторінки
4. Запитувати мінімум permissions — тільки `storage`, `sidePanel`, `tabs`

## Структура файлів
```
temu_pro_extension/
├── extension/           # Файли розширення (для chrome://extensions)
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   ├── sidepanel.html
│   ├── sidepanel.js
│   └── icons/
├── tests/               # Тестування
│   ├── puppeteer-test.js
│   ├── start-chrome-debug.ps1
│   ├── package.json
│   └── node_modules/
├── .agent/workflows/
├── GEMINI.md
└── .gitignore
```

## Тестування (Chrome Remote Debugging)
1. Закрити Chrome
2. `tests/start-chrome-debug.ps1` або: `chrome.exe --remote-debugging-port=9223`
3. Відкрити temu.com
4. `cd tests && node puppeteer-test.js`
