# Temu Pro Extension — Проєктна інструкція

## Про проєкт
**Temu Smart Score & Bar (UA) — Pro** — Chrome розширення (Manifest V3) для аналізу та фільтрації товарів на temu.com. Розраховує "розумний бал" (Smart Score 0-100) для кожного товару на основі знижки, рейтингу, продажів та відгуків.

## Архітектура
- `manifest.json` — Manifest V3, service_worker background 
- `background.js` — Service worker: fetch курсу валют через API
- `content.js` — Content script: парсинг DOM товарів, розрахунок балів, UI панель

## Технологічний стек
- **Мова**: JavaScript (vanilla, без фреймворків)
- **API**: chrome.storage, chrome.runtime, exchangerate API  
- **Тестування**: Puppeteer (puppeteer-core) з локальним Chrome
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
4. Запитувати мінімум permissions — тільки `storage` + потрібні `host_permissions`

## Команди
- `node puppeteer-test.js` — запуск розширення в Chrome для тестування

## Структура файлів
```
temu_pro_extension/
├── manifest.json        # Маніфест розширення
├── background.js        # Service worker
├── content.js           # Content script (головна логіка)
├── puppeteer-test.js    # Автоматизоване тестування
├── icons/               # Іконки розширення (16, 48, 128)
├── GEMINI.md            # Цей файл (контекст для AI)
└── .agent/workflows/    # Автоматизовані workflow команди
```
