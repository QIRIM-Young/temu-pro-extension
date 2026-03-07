# Temu Smart Score & Bar (UA) — Pro 🛒✨

[![Version 15.4](https://img.shields.io/badge/version-15.4-blue.svg?style=for-the-badge)](https://github.com/QIRIM-Young/temu-pro-extension)
[![Manifest V3](https://img.shields.io/badge/manifest-V3-success.svg?style=for-the-badge)](https://developer.chrome.com/docs/extensions/mv3/)
[![Platform](https://img.shields.io/badge/platform-Chrome_Extension-orange.svg?style=for-the-badge)](https://chrome.google.com/webstore)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

**Temu Pro UA** — це потужне та візуально довершене Chrome-розширення, створене для розумного аналізу товарів на маркетплейсі Temu.com. Воно автоматично розраховує унікальний "Smart Score" для кожного товару, допомагаючи покупцям миттєво знаходити найвигідніші пропозиції на основі реальних даних (знижки, рейтинг, продажі та відгуки). 

Все це запаковано у надсучасний інтерфейс з ефектом скла (Glassmorphism), який не заважає перегляду сторінки.

---

## 🚀 Відмінні риси та можливості

### 🧠 Алгоритм Smart Score (0-100)
Більше ніяких здогадок! Розширення динамічно аналізує ключові показники товару:
*   **Знижка (40%)**
*   **Рейтинг (20%)**
*   **Кількість продажів (30%)**
*   **Відгуки (10%)**
*   *Бонус:* Користувач може самостійно налаштовувати ці вагові коефіцієнти в реальному часі через зручні повзунки!

### 💱 Конвертер Валют
Автоматично переводить ціни з USD, EUR та інших валют у **Гривню (UAH)**. 
Використовує свіжий світовий курс через ExchangeRate-API з "розумним кешуванням" на 12 годин задля економії трафіку та миттєвої конвертації.

### 🎨 Сучасний Glassmorphism Інтерфейс
*   **Ізольований Iframe:** Панель керування ізольована від стилів сайту Temu, гарантуючи, що інтерфейс ніколи не "зламається" після оновлення верстки маркетплейсу.
*   **Ефект Скла:** Використання напівпрозорих екранів, `backdrop-filter: blur(24px)` та кастомних тіней для глибокого, сучасного та "преміального" вигляду (в стилі Apple visionOS/macOS).
*   **Smart-Адаптивність:** Вікно вміє самостійно перераховувати і змінювати свою висоту без жодних скачків при відкритті вкладок або акордеонів (`ResizeObserver` + `postMessage` IPC).

### ⚡ Швидкодія та Оптимізація
*   Використовує `MutationObserver` для миттєвої реакції на "Infinite Scroll" (динамічне дозавантаження товарів).
*   Відсутність важких фреймворків — чистий Vanilla JavaScript для мінімального впливу на пам'ять вашого браузера.

---

## 🛠 Технологічний Стек

*   **Мова:** JavaScript (Vanilla, ES6+).
*   **Chrome API:** `chrome.storage`, `chrome.runtime`, `chrome.sidePanel`, `chrome.alarms`.
*   **Архітектура MV3:** 
    *   **Service Worker (`background.js`):** Бекграунд-задачі, фонові оновлення курсу валют.
    *   **Content Script (`content.js`):** Парсинг DOM Temu, ін'єкція ізольованого iframe-контейнеру (вікна).
    *   **Iframe Sidepanel (`sidepanel.html/js`):** Логіка інтерфейсу користувача та налаштувань.
*   **Стилізація:** CSS Custom Properties, Flexbox, Glassmorphism CSS.

---

## ⚙️ Встановлення для Розробників (Developer Mode)

Для того, щоб перевірити розширення на власному комп'ютері:

1.  Клонуйте цей репозиторій:
    ```bash
    git clone https://github.com/QIRIM-Young/temu-pro-extension.git
    ```
2.  Відкрийте браузер Chrome і перейдіть за адресою `chrome://extensions/`.
3.  У верхньому правому куті увімкніть тумблер **"Режим розробника"** (Developer mode).
4.  Натисніть кнопку **"Завантажити розпаковане розширення"** (Load unpacked).
5.  Виберіть папку `extension/` всередині щойно клонованого проєкту.
6.  Перейдіть на сайт [temu.com](https://www.temu.com) — розширення запуститься автоматично!

---

## 📂 Структура Проєкту

```text
temu-pro-extension/
├── extension/                 # Головна папка розширення (Manifest, JS, CSS)
│   ├── manifest.json          # Конфігурація Manifest V3
│   ├── background.js          # Service Worker
│   ├── content.js             # Content Script (парсинг DOM, IPC)
│   ├── sidepanel.html         # UI панелі
│   ├── sidepanel.js           # Логіка та графіка панелі (всередині iframe)
│   └── icons/                 # Логотипи розширення
├── tests/                     # Скрипти Node.js/Puppeteer для автоматизації (CDP)
├── .github/                   # Стандартизовані шаблони PR та Issue для GitHub
├── README.md                  # Головна сторінка проєкту
├── CONTRIBUTING.md            # Інструкції та правила для контриб'юторів
├── SECURITY.md                # Політика безпеки розширення
├── LICENSE                    # Ліцензія проєкту
├── AGENTS.md                  # Спеціальні інструкції для AI агенцій/асистентів
└── GEMINI.md                  # Базові правила кодової бази
```

---

## 🤝 Внесок (Contributing)

Ми відкриті до Pull Requests! Бажаєте додати нову фічу чи виправити баг? Чудово!
Будь ласка, спочатку ознайомтесь із нашим [Посібником Контриб'ютора (CONTRIBUTING.md)](CONTRIBUTING.md) та стандартами проєкту (наприклад, [AGENTS.md](AGENTS.md) для AI).

**Основна філософія проєкту:** Максимальний мінімалізм, відмова від монструозних сторонніх бібліотек там, де це можливо (лише Vanilla JS), і використання виключно української мови у візуальних компонентах (UI) та коментарях.

---

## 📜 Ліцензія

Цей проєкт поширюється за ліцензією **MIT**. Детальніше читайте у файлі [LICENSE](LICENSE).

---
*Розроблено з турботою про зручний та смарт-шопінг для українців! 🇺🇦*
