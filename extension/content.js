(function () {
    'use strict';

    // --- НАЛАШТУВАННЯ ТА КЕШ ---
    let isScriptEnabled = true;
    let isPanelCollapsed = false;
    let filtersEnabled = false;

    let fMinScore = 0;
    let fMinDiscount = 0;
    let fMinRating = 4.0;
    let fMinSales = 100;
    let fMinReviews = 10;
    let fMinPrice = 0;
    let fMaxPrice = 5000;

    let wDiscount = 25;
    let wRating = 25;
    let wSales = 25;
    let wReviews = 25;

    let exchangeRate = 41.0;
    let windowScale = 1.0; // Масштаб плаваючого вікна (0.7 - 1.3)

    // Стан бічної панелі
    let isSidePanelOpen = false;

    // Стан глобального перемикання валюти
    let isSiteCurrencySwapped = false;

    // Кеш для головного товару
    let cachedMainProductHtml = null;
    let lastHoveredHtml = null; // Останній HTML товара (для панелі)
    let _lastHoveredCardId = null; // Останній ID товара (для утримання підсвітки при оновленні DOM)

    let pageCurrencyDetected = false;
    let currentCurrencyMax = 10000;
    let currentCurrencyStep = 10;

    // Throttle stats for 429 error prevention
    let filterStats = { hiddenCount: 0, lastReset: Date.now() };

    // --- SVG ІКОНКИ (Inline, стиль Temu) ---
    const BUILD_TIME = '07.03 01:55';

    // --- ВИЗНАЧЕННЯ МОВИ ІНТЕРФЕЙСУ ---
    // Стратегія: 1) URL містить '-en' → English, 2) html.lang → 'uk'→Ukrainian, 3) URL /ua → Ukrainian, 4) fallback → English
    function detectLang() {
        const p = window.location.pathname.toLowerCase();
        // Явний English в URL (ua-en, -en)
        if (p.includes('-en/') || p.includes('-en?') || p.endsWith('-en') || /\/[a-z]{2}-en(\/|$|\?)/.test(p)) return 'en';
        // html lang attribute
        const htmlLang = (document.documentElement.lang || '').toLowerCase();
        if (htmlLang.startsWith('en')) return 'en'; // Strict check for user selecting English
        if (htmlLang === 'uk' || htmlLang === 'uk-ua' || htmlLang === 'ua') return 'uk';
        // URL contains /ua (з або без trailing slash)
        if (/\/ua(\/|$|\?)/.test(p)) return 'uk';
        // DOM content check — якщо є українські елементи (продано, знижка)
        const bodyText = document.body?.textContent?.substring(0, 2000) || '';
        if (/продано|знижка|безкоштовн|рейтинг|відгук/i.test(bodyText)) return 'uk';
        return 'en';
    }
    const LANG = detectLang();
    chrome.storage.local.set({ extensionLang: LANG });
    const L = {
        score: LANG === 'uk' ? 'Загальний бал' : 'Total Score',
        formula: LANG === 'uk' ? 'Формула (100б): Топ-база(80б) + Плюшки(20б).' : 'Formula (100p): Base(80p) + Bonus(20p).',
        oldPrice: LANG === 'uk' ? 'Стара ціна' : 'Old Price',
        curPrice: LANG === 'uk' ? 'Поточна ціна' : 'Current Price',
        discount: LANG === 'uk' ? 'Знижка' : 'Discount',
        rating: LANG === 'uk' ? 'Рейтинг' : 'Rating',
        sales: LANG === 'uk' ? 'Продажі' : 'Sales',
        reviews: LANG === 'uk' ? 'Відгуки' : 'Reviews',
        enabled: LANG === 'uk' ? 'Увімк.' : 'On',
        analytics: LANG === 'uk' ? 'Аналітика' : 'Analytics',
        settingsTab: LANG === 'uk' ? 'Налаштування' : 'Settings',
        hoverHint: LANG === 'uk' ? 'Наведіть курсор на будь-який товар,<br>щоб побачити його розгорнуту оцінку' : 'Hover over any product<br>to see its detailed score',
        filters: LANG === 'uk' ? 'Фільтри' : 'Filters',
        filtersActive: LANG === 'uk' ? 'Активні' : 'Active',
        priceRange: LANG === 'uk' ? 'Ціни:' : 'Prices:',
        minScore: LANG === 'uk' ? 'Балів:' : 'Score:',
        minDiscount: LANG === 'uk' ? 'Знижка %:' : 'Discount %:',
        minRating: LANG === 'uk' ? 'Рейтинг:' : 'Rating:',
        minReviews: LANG === 'uk' ? 'Відгуків:' : 'Reviews:',
        minSales: LANG === 'uk' ? 'Продажів:' : 'Sales:',
        reset: LANG === 'uk' ? 'Скинути налаштування' : 'Reset settings',
        algSettings: LANG === 'uk' ? 'Налаштування алгоритму' : 'Algorithm Settings',
        algWeight: LANG === 'uk' ? 'Вага в алгоритмі (%)' : 'Algorithm Weight (%)',
        bonusGained: LANG === 'uk' ? 'Отримані плюшки (Напряму в балах):' : 'Bonus Points (Direct):',
        bonusPossible: LANG === 'uk' ? 'Можливі бонуси (наразі не знайдено):' : 'Possible bonuses (none found):',
        bonusNone: LANG === 'uk' ? 'Немає додаткових плюшок' : 'No bonus points',
        sumBonus: LANG === 'uk' ? 'Сума плюшок' : 'Bonus sum',
        roundedFinal: LANG === 'uk' ? 'Округлено до фінальних' : 'Rounded to final',
        capped: LANG === 'uk' ? 'Суму зрізано до ліміту' : 'Capped at limit',
        hover: LANG === 'uk' ? 'наведіть' : 'hover',
        upto: LANG === 'uk' ? 'до' : 'up to',
        extraDiscount: LANG === 'uk' ? 'Екстра знижка' : 'Extra discount',
        bestseller: LANG === 'uk' ? 'Бестселер' : 'Bestseller',
        topRating: LANG === 'uk' ? 'Топ рейтинг' : 'Top rated',
        starSeller: LANG === 'uk' ? 'Зірковий продавець' : 'Star seller',
        brand: LANG === 'uk' ? 'Бренд' : 'Brand',
        localWH: LANG === 'uk' ? 'Місцевий склад' : 'Local warehouse',
        fastDel: LANG === 'uk' ? 'Швидка доставка' : 'Fast delivery',
        specOffer: LANG === 'uk' ? 'Спец. Пропозиція' : 'Special offer',
        openSP: LANG === 'uk' ? 'Відкрити бічну панель' : 'Open side panel',
        base: LANG === 'uk' ? 'База' : 'Base',
        fix: LANG === 'uk' ? 'Фікс' : 'Fixed',
        pts: LANG === 'uk' ? 'б' : 'p',
        curProduct: LANG === 'uk' ? 'Поточний товар' : 'Current Product',
        bonuses: LANG === 'uk' ? 'Плюшки' : 'Bonus',
        posTimeCoeff: LANG === 'uk' ? 'Позиція × часовий коеф.' : 'Position × time coeff.',
        sidePanelMode: LANG === 'uk' ? 'Режим бічної панелі' : 'Side Panel Mode',
    };

    const VERSION = '15.3';

    const _svgCache = {};
    function svgIcon(name, color, size) {
        const key = `${name}_${color || ''}_${size || 14}`;
        if (_svgCache[key]) return _svgCache[key];
        const s = size || 14;
        const icons = {
            discount: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${color || '#9b59b6'}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="9" r="2"/><circle cx="15" cy="15" r="2"/><line x1="19" y1="5" x2="5" y2="19"/></svg>`,
            star: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="${color || '#f1c40f'}" opacity="0.9"/></svg>`,
            sales: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none"><path d="M3 17L9 11L13 15L21 7" stroke="${color || '#e74c3c'}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 7H21V13" stroke="${color || '#e74c3c'}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
            reviews: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="${color || '#3498db'}" opacity="0.85"/></svg>`,
            bonus: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none"><path d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20.02L12 16.77L7.09 20.02L8.45 13.97L4 9.27L9.91 8.26L12 2Z" fill="${color || '#27ae60'}" opacity="0.9"/><circle cx="12" cy="12" r="4" fill="#fff" opacity="0.5"/></svg>`,
            settings: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="${color || '#666'}" stroke-width="2"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="${color || '#666'}" stroke-width="1.5"/></svg>`,
            filter: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" fill="${color || '#e74c3c'}" opacity="0.85"/></svg>`,
            search: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="${color || '#aaa'}" stroke-width="2"/><path d="M21 21L16.65 16.65" stroke="${color || '#aaa'}" stroke-width="2" stroke-linecap="round"/></svg>`,
            chart: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none"><rect x="3" y="12" width="4" height="9" rx="1" fill="${color || '#3498db'}" opacity="0.7"/><rect x="10" y="7" width="4" height="14" rx="1" fill="${color || '#3498db'}" opacity="0.85"/><rect x="17" y="3" width="4" height="18" rx="1" fill="${color || '#3498db'}"/></svg>`,
            logo: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" fill="${color || '#ff6c00'}" opacity="0.9"/><line x1="3" y1="6" x2="21" y2="6" stroke="#fff" stroke-width="1.5"/><path d="M16 10a4 4 0 0 1-8 0" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>`,
            list: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="${color || '#333'}" stroke-width="2" stroke-linecap="round"/></svg>`,
            sidepanel: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="${color || '#0097e6'}" stroke-width="2"/><line x1="15" y1="3" x2="15" y2="21" stroke="${color || '#0097e6'}" stroke-width="2"/></svg>`,
            swap: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${color || '#888'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 8 16 13"></polyline><line x1="21" y1="8" x2="9" y2="8"></line><polyline points="8 21 3 16 8 11"></polyline><line x1="3" y1="16" x2="15" y2="16"></line></svg>`,
            pencil: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${color || '#aaa'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`
        };
        const result = `<span style="display:inline-flex;align-items:center;vertical-align:middle;margin-right:3px;">${icons[name] || ''}</span>`;
        _svgCache[key] = result;
        return _svgCache[key];
    }

    // --- ІНІЦІАЛІЗАЦІЯ НАЛАШТУВАНЬ ---
    function loadSettings(callback) {
        chrome.storage.local.get([
            'isScriptEnabled', 'isPanelCollapsed', 'filtersEnabled',
            'fMinScore', 'fMinDiscount', 'fMinRating', 'fMinSales', 'fMinReviews', 'fMinPrice', 'fMaxPrice',
            'wDiscount', 'wRating', 'wSales', 'wReviews', 'exchangeRate', 'isSidePanelOpen',
            'currentCurrencyMax', 'currentCurrencyStep'
        ], (res) => {
            const validNum = (v, defaultVal) => (v !== undefined && !Number.isNaN(v) && v !== null) ? v : defaultVal;

            if (res.isScriptEnabled !== undefined) isScriptEnabled = res.isScriptEnabled;
            if (res.isPanelCollapsed !== undefined) isPanelCollapsed = res.isPanelCollapsed;
            if (res.filtersEnabled !== undefined) filtersEnabled = res.filtersEnabled;

            fMinScore = validNum(res.fMinScore, 0);
            fMinDiscount = validNum(res.fMinDiscount, 0);
            fMinRating = validNum(res.fMinRating, 4.0);
            fMinSales = validNum(res.fMinSales, 100);
            fMinReviews = validNum(res.fMinReviews, 10);
            fMinPrice = validNum(res.fMinPrice, 0);
            fMaxPrice = validNum(res.fMaxPrice, 10000); // Оновлений дефолт

            if (res.currentCurrencyMax !== undefined) currentCurrencyMax = res.currentCurrencyMax;
            if (res.currentCurrencyStep !== undefined) currentCurrencyStep = res.currentCurrencyStep;

            wDiscount = validNum(res.wDiscount, 25);
            wRating = validNum(res.wRating, 25);
            wSales = validNum(res.wSales, 25);
            wReviews = validNum(res.wReviews, 25);

            exchangeRate = validNum(res.exchangeRate, 41.0);
            // isSidePanelOpen не зберігається між сесіями — Side Panel сам повідомить при відкритті
            isSidePanelOpen = false;

            if (callback) callback();
        });
    }

    // --- СТВОРЕННЯ SVG ДОНУТА ---
    function createDonutChart(total, pD, pR, pS, pV, pB) {
        const radius = 26;
        const circ = 2 * Math.PI * radius;

        let curr = 0;
        const makeCircle = (pts, color) => {
            if (pts <= 0) return '';
            const len = (pts / 100) * circ;
            // Gap = stroke-width (6) so round linecaps exactly touch
            const drawLen = Math.max(0, len - 6);
            const off = -curr;
            curr += len;
            return `<circle cx="32" cy="32" r="${radius}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" 
                    stroke-dasharray="${drawLen} ${circ}" stroke-dashoffset="${off}" 
                    style="transition: all 0.8s ease-out;"></circle>`;
        };

        const totalColor = getColor(Math.min(100, Math.max(0, total)));

        return `
            <div style="position:relative; width:64px; height:64px; margin: 0 auto; display:flex; align-items:center; justify-content:center;">
                <svg width="64" height="64" viewBox="0 0 64 64" style="transform: rotate(-90deg); filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));">
                    <circle cx="32" cy="32" r="${radius}" fill="none" stroke="#e0e4e8" stroke-width="6" />
                    ${makeCircle(pD, '#9b59b6')}
                    ${makeCircle(pR, '#f1c40f')}
                    ${makeCircle(pS, '#e74c3c')}
                    ${makeCircle(pV, '#3498db')}
                    ${makeCircle(pB, '#27ae60')}
                </svg>
                <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-family:'Inter', sans-serif; font-size:18px; font-weight:900; color:${totalColor}; margin:0;">${total}</div>
            </div>
        `;
    }

    // Оновлення UI плаваючого вікна при зміні налаштувань (щоб синхронізувати з Side Panel)
    function updateFloatingWindowUI() {
        if (!document.getElementById('temu-pro-window')) return;

        const el = (id) => document.getElementById(id);
        const safeSet = (id, prop, val) => { const e = el(id); if (e) e[prop] = val; };

        safeSet('cb-main-toggle', 'checked', isScriptEnabled);
        safeSet('cb-filters', 'checked', filtersEnabled);

        safeSet('btn-collapse', 'innerText', isPanelCollapsed ? '+' : '—');
        const tabs = el('tpw-tabs'); if (tabs) tabs.classList.toggle('collapsed', isPanelCollapsed);
        const body = el('tpw-body'); if (body) body.classList.toggle('collapsed', isPanelCollapsed);

        const setIfNotFocused = (idS, idN, val) => {
            const elS = el(idS), elN = el(idN);
            if (document.activeElement !== elS && document.activeElement !== elN) {
                if (elS) elS.value = val;
                if (elN) elN.value = val;
            }
        };

        setIfNotFocused('fs-pmin', 'f-min-price', fMinPrice);
        setIfNotFocused('fs-pmax', 'f-max-price', fMaxPrice);

        safeSet('fs-score', 'value', fMinScore); safeSet('fn-score', 'value', fMinScore);
        safeSet('fs-disc', 'value', fMinDiscount); safeSet('fn-disc', 'value', fMinDiscount);
        safeSet('fs-rat', 'value', fMinRating); safeSet('fn-rat', 'value', fMinRating);
        safeSet('fs-rev', 'value', fMinReviews); safeSet('fn-rev', 'value', fMinReviews);
        safeSet('fs-sal', 'value', fMinSales); safeSet('fn-sal', 'value', fMinSales);

        safeSet('ws-disc', 'value', wDiscount); safeSet('wn-disc', 'value', wDiscount);
        safeSet('ws-rat', 'value', wRating); safeSet('wn-rat', 'value', wRating);
        safeSet('ws-sal', 'value', wSales); safeSet('wn-sal', 'value', wSales);
        safeSet('ws-rev', 'value', wReviews); safeSet('wn-rev', 'value', wReviews);

        updateSliderFills();

        // Sync pencil-icon display text
        const panel = document.getElementById('temu-pro-window');
        if (panel) {
            panel.querySelectorAll('.st-num-editable').forEach(wrapper => {
                const input = wrapper.querySelector('.st-num-input');
                const display = wrapper.querySelector('.st-num-display');
                if (input && display) display.textContent = input.value;
            });
        }
    }

    // --- ГЛОБАЛЬНЕ ОНОВЛЕННЯ СЛАЙДЕРІВ ---
    function updateSliderFills() {
        const panel = document.getElementById('temu-pro-window');
        if (!panel) return;

        const pMinSlide = panel.querySelector('#fs-pmin'), pMaxSlide = panel.querySelector('#fs-pmax');
        if (pMinSlide && pMaxSlide) {
            let maxLimit = parseFloat(pMaxSlide.max) || 10000;
            let v1 = parseFloat(pMinSlide.value) || 0, v2 = parseFloat(pMaxSlide.value) || 0;
            let p1 = (Math.min(v1, v2) / maxLimit) * 100, p2 = (Math.max(v1, v2) / maxLimit) * 100;

            const dualTrack = panel.querySelector('.dual-slider-track');
            const dualHighlight = panel.querySelector('.dual-slider-highlight');
            if (dualTrack) dualTrack.style.background = '#e0e4e8';
            if (dualHighlight) {
                dualHighlight.style.left = `${p1}%`;
                dualHighlight.style.width = `${p2 - p1}%`;
            }
        }

        // Single slides — per-category colors matching donut chart
        const sliderColorMap = {
            'fs-disc': '#9b59b6', 'fn-disc': '#9b59b6', 'ws-disc': '#9b59b6', 'wn-disc': '#9b59b6', // Discount (purple)
            'fs-rat': '#f39c12', 'fn-rat': '#f39c12', 'ws-rat': '#f39c12', 'wn-rat': '#f39c12',   // Rating (gold)
            'fs-sal': '#e74c3c', 'fn-sal': '#e74c3c', 'ws-sal': '#e74c3c', 'wn-sal': '#e74c3c',   // Sales (red)
            'fs-rev': '#3498db', 'fn-rev': '#3498db', 'ws-rev': '#3498db', 'wn-rev': '#3498db',   // Reviews (blue)
            // fs-score is handled specially
        };

        let wD = parseFloat(document.getElementById('wn-disc')?.value || wDiscount || 25) * 0.8;
        let wR = parseFloat(document.getElementById('wn-rat')?.value || wRating || 25) * 0.8;
        let wS = parseFloat(document.getElementById('wn-sal')?.value || wSales || 25) * 0.8;
        let wV = parseFloat(document.getElementById('wn-rev')?.value || wReviews || 25) * 0.8;
        let c1 = wD, c2 = c1 + wR, c3 = c2 + wS, c4 = c3 + wV;

        const multiColorGradient = `linear-gradient(to right, #9b59b6 0 ${c1}%, #f1c40f ${c1}% ${c2}%, #e74c3c ${c2}% ${c3}%, #3498db ${c3}% ${c4}%, #27ae60 ${c4}% 100%)`;

        panel.querySelectorAll('.single-range').forEach(slider => {
            const val = parseFloat(slider.value) || 0;
            const min = parseFloat(slider.min) || 0;
            const max = parseFloat(slider.max) || 100;
            const pct = ((val - min) / (max - min)) * 100;
            const color = sliderColorMap[slider.id] || '#0b7bff';

            if (slider.id === 'fs-score') {
                slider.style.setProperty('--track-bg', `linear-gradient(to right, #e0e4e8 ${pct}%, transparent ${pct}%), ${multiColorGradient}`, 'important');
            } else if (slider.id.startsWith('fs-')) {
                // Фільтри мінімуму - заповнено справа від повзунка
                slider.style.setProperty('--track-bg', `linear-gradient(to right, #e0e4e8 ${pct}%, ${color} ${pct}%)`, 'important');
            } else {
                // Ваги алгоритму - заповнено зліва від повзунка
                slider.style.setProperty('--track-bg', `linear-gradient(to right, ${color} ${pct}%, #e0e4e8 ${pct}%)`, 'important');
            }
        });
    }

    // --- СИНХРОНІЗАЦІЯ НАЛАШТУВАНЬ ---
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            let needsReprocess = false;
            let needsUIUpdate = false;

            for (let key in changes) {
                let val = changes[key].newValue;
                if (val === undefined) continue;

                if (key === 'isScriptEnabled') { isScriptEnabled = val; needsReprocess = true; needsUIUpdate = true; }
                else if (key === 'isPanelCollapsed') { isPanelCollapsed = val; needsUIUpdate = true; }
                else if (key === 'filtersEnabled') { filtersEnabled = val; needsReprocess = true; needsUIUpdate = true; }
                else if (key === 'fMinScore') { fMinScore = val; needsReprocess = true; needsUIUpdate = true; }
                else if (key === 'fMinDiscount') { fMinDiscount = val; needsReprocess = true; needsUIUpdate = true; }
                else if (key === 'fMinRating') { fMinRating = val; needsReprocess = true; needsUIUpdate = true; }
                else if (key === 'fMinSales') { fMinSales = val; needsReprocess = true; needsUIUpdate = true; }
                else if (key === 'fMinReviews') { fMinReviews = val; needsReprocess = true; needsUIUpdate = true; }
                else if (key === 'fMinPrice') { fMinPrice = val; needsReprocess = true; needsUIUpdate = true; }
                else if (key === 'fMaxPrice') { fMaxPrice = val; needsReprocess = true; needsUIUpdate = true; }
                else if (key === 'currentCurrencyMax') {
                    currentCurrencyMax = val;
                    const pmin = document.getElementById('fs-pmin'); if (pmin) pmin.max = val;
                    const pmax = document.getElementById('fs-pmax'); if (pmax) pmax.max = val;
                }
                else if (key === 'currentCurrencyStep') {
                    currentCurrencyStep = val;
                    const pmin = document.getElementById('fs-pmin'); if (pmin) pmin.step = val;
                    const pmax = document.getElementById('fs-pmax'); if (pmax) pmax.step = val;
                }
                else if (key === 'wDiscount') { wDiscount = val; needsReprocess = true; needsUIUpdate = true; }
                else if (key === 'wRating') { wRating = val; needsReprocess = true; needsUIUpdate = true; }
                else if (key === 'wSales') { wSales = val; needsReprocess = true; needsUIUpdate = true; }
                else if (key === 'wReviews') { wReviews = val; needsReprocess = true; needsUIUpdate = true; }
                else if (key === 'exchangeRate') { exchangeRate = val; needsReprocess = true; }
                else if (key === 'isSiteCurrencySwapped') {
                    isSiteCurrencySwapped = val;
                    let isNativeUAH = true;
                    let pEls = document.querySelectorAll('[data-raw-text]');
                    if (pEls.length > 0) {
                        let rPt = pEls[0].getAttribute('data-raw-text');
                        isNativeUAH = rPt.includes('₴') || rPt.toLowerCase().includes('грн');
                    }
                    
                    let dynMaxUAH = Math.round(100 * exchangeRate);
                    let newMax = isSiteCurrencySwapped ? (isNativeUAH ? 100 : dynMaxUAH) : (isNativeUAH ? dynMaxUAH : 100);
                    let newStep = isSiteCurrencySwapped ? (isNativeUAH ? 1 : 10) : (isNativeUAH ? 10 : 1);
                    
                    if (currentCurrencyMax !== newMax && pageCurrencyDetected) {
                        let pctMin = currentCurrencyMax > 0 ? (fMinPrice / currentCurrencyMax) : 0;
                        let pctMax = currentCurrencyMax > 0 ? (fMaxPrice / currentCurrencyMax) : 1;

                        let nMin = Math.round((pctMin * newMax) / newStep) * newStep;
                        let nMax = Math.round((pctMax * newMax) / newStep) * newStep;
                        
                        nMin = Math.max(0, Math.min(nMin, newMax));
                        nMax = Math.max(0, Math.min(nMax, newMax));
                        
                        currentCurrencyMax = newMax;
                        fMinPrice = nMin;
                        fMaxPrice = nMax;

                        try {
                            chrome.storage.local.set({ currentCurrencyMax: newMax, currentCurrencyStep: newStep, fMinPrice: nMin, fMaxPrice: nMax });
                        } catch (e) { }
                    }
                    applyCurrencySwap();
                }
                else if (key === 'isSidePanelOpen') {
                    // Ігноруємо, якщо вікно ще не створено (щоб уникнути race condition при старті)
                    if (!booted) continue;
                    isSidePanelOpen = val;
                    const panel = document.getElementById('temu-pro-window');
                    if (panel) {
                        panel.style.display = isSidePanelOpen ? 'none' : 'flex';
                    }
                }
            }
            if (needsUIUpdate) updateFloatingWindowUI();
            if (needsReprocess) {
                clearTimeout(window._reprocessTimer);
                window._reprocessTimer = setTimeout(() => {
                    // Очищаємо прапорець обробки, щоб картки перерахувалися з новими налаштуваннями ЖИВО
                    document.querySelectorAll('[data-processed="true"]').forEach(el => {
                        el.removeAttribute('data-processed');
                    });
                    
                    processCards();

                    // Миттєво оновлюємо інфопанелі зміненими даними для активного товару
                    setTimeout(() => {
                        if (_lastCardEl) {
                            const cardWrap = _lastCardEl.closest('.EKDT7a3v, ._1WdJJSDo, .splide__slide, ._1c9F-t-E') || _lastCardEl;
                            if (cardWrap) {
                                let html = cardWrap.getAttribute('data-tooltip-html');
                                if (html) { sendToIframe({type: 'TPW_HOVER_INFO', html: html}); }
                                try { chrome.runtime.sendMessage({ action: 'hoverInfo', html: html }); } catch (e) { }
                            }
                        } else {
                            if (cachedMainProductHtml) {
                                sendToIframe({type: 'TPW_HOVER_INFO', html: cachedMainProductHtml});
                                try { chrome.runtime.sendMessage({ action: 'hoverInfo', html: cachedMainProductHtml }); } catch (e) { }
                            }
                        }
                    }, 50);
                }, 150);
            }
        }
    });

    // --- CSS СТИЛІ ---
    function injectStyles() {
        // Додаємо Google Fonts (Inter) для сучасного вигляду
        const fontLink = document.createElement('link');
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&subset=cyrillic,latin&display=swap';
        document.head.appendChild(fontLink);

        const style = document.createElement('style');
        style.textContent = `
            /* Панель 10 капсул на товарі */
            .tpw-score-container {
                position: absolute; top: 0; left: 0; width: 100%; height: 22px;
                background: rgba(255,255,255,0.92);
                -webkit-backdrop-filter: blur(6px);
                backdrop-filter: blur(6px);
                z-index: 50; border-radius: 0;
                display: flex; align-items: center; justify-content: space-between;
                padding: 0 8px; box-sizing: border-box; pointer-events: none;
                transition: opacity 0.25s ease;
                overflow: hidden;
            }
            .tpw-pills-wrapper { display: flex; gap: 3px; flex: 1; margin-right: 8px; }
            .tpw-pill { height: 7px; flex: 1; border-radius: 4px; background: #e8ecef; overflow: hidden; position: relative; }
            .tpw-pill-fill { height: 100%; position: absolute; left: 0; top: 0; transition: width 0.4s cubic-bezier(0.4,0,0.2,1); border-radius: 4px; }
            .tpw-score-number { font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif; font-size: 13px; font-weight: 900; letter-spacing: -0.3px; }

            /* Троттлінг скролу (запобіжник Error 429) */
            .tpw-filtered-ghost {
                opacity: 0.15 !important;
                pointer-events: none !important;
                filter: grayscale(100%) !important;
                transition: opacity 0.3s ease;
            }

            /* Єдине вікно (Панель) */
            #temu-pro-window {
                position: fixed; background: rgba(255, 255, 255, 0.85);
                -webkit-backdrop-filter: blur(20px);
                backdrop-filter: blur(20px);
                border: 1px solid rgba(0,0,0,0.08);
                border-radius: 16px; z-index: 9999999;
                box-shadow: 0 10px 40px rgba(0,0,0,0.1);
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                width: 340px; min-width: 240px; max-width: 500px;
                max-height: 90vh;
                color: #222; display: flex; flex-direction: column;
                transition: box-shadow 0.3s ease;
                overflow: visible;
                --tpw-bg: rgba(255,255,255,0.85);
                container-type: inline-size;
                container-name: tpw-panel;
                --tpw-border: rgba(0,0,0,0.08);
                --tpw-track-bg: #e5e5ea;
            }
            #temu-pro-window:hover {
                box-shadow: 0 12px 48px rgba(0,0,0,0.16), 0 4px 12px rgba(0,0,0,0.08);
            }
            #tpw-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 10px 14px;
                background-color: var(--tpw-bg);
                border-bottom: 1px solid var(--tpw-border);
                user-select: none;
            }
            #tpw-drag-handle {
                display: flex;
                align-items: center;
                gap: 6px;
                cursor: move;
                flex-grow: 1;
                font-weight: 600;
                font-size: 14px;
                color: #111;
            }
            .tpw-logo-wrap {
                display: flex;
                align-items: center;
                justify-content: center;
                color: #ff6e26;
            }
            .tpw-header-controls {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .tpw-icon-btn {
                background: none;
                border: none;
                padding: 4px;
                cursor: pointer;
                color: #666;
                transition: color 0.2s, transform 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 6px;
            }
            .tpw-icon-btn:hover {
                color: #333;
                transform: translateY(-1px);
            }
            #tpw-tabs { display: flex; padding: 8px 12px; margin: 0; background: transparent; }
            #tpw-tabs.collapsed { display: none; }
            .tpw-segmented-control { background: #e5e5ea; border-radius: 8px; display: flex; width: 100%; position: relative; padding: 2px; }
            .tpw-tab {
                flex: 1; text-align: center; padding: 6px 0; font-size: 12px; font-weight: 600;
                color: #8b95a5; cursor: pointer; border-radius: 6px; z-index: 2; position: relative;
                transition: color 0.2s ease;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            }
            .tpw-tab.active { color: #000; }
            .tpw-tab-bg {
                position: absolute; top: 2px; bottom: 2px; width: calc(50% - 2px); 
                background: #fff; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                transition: transform 0.25s cubic-bezier(0.4, 0.0, 0.2, 1); z-index: 1;
            }
            .tpw-tab[data-tab="info"].active ~ .tpw-tab-bg { transform: translateX(0); }
            .tpw-tab[data-tab="settings"].active ~ .tpw-tab-bg { transform: translateX(100%); width: calc(50% - 2px); }

            #tpw-body { flex: 1; min-height: 0; overflow-y: auto; }
            #tpw-body.collapsed { display: none; }
            #temu-pro-window.is-collapsed-mode,
            #temu-pro-window.tpw-maximized-y.is-collapsed-mode { height: auto !important; min-height: 40px !important; max-height: none !important; transition: height 0.3s ease, min-height 0.3s ease; }
            #temu-pro-window.is-collapsed-mode .tpw-resize { display: none !important; }

            .tpw-content {
                display: none; padding: 12px; background: transparent;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                border-radius: 0 0 16px 16px;
                scrollbar-width: thin; scrollbar-color: rgba(0,0,0,0.15) transparent;
            }
            .tpw-content::-webkit-scrollbar { width: 4px; }
            .tpw-content::-webkit-scrollbar-track { background: transparent; }
            .tpw-content::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 4px; }
            .tpw-content.active {
                display: block;
                overflow-y: auto;
                max-height: calc(90vh - 110px);
                scrollbar-width: thin;
                scrollbar-color: rgba(0,0,0,0.15) transparent;
            }

            /* Стилі для контенту Аналітики */
            .tt-row { margin-bottom: 8px; }
            .tt-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px; font-size: 12px; }
            .tt-pts { color: #d35400; font-weight: 600; font-size: 11px; }
            .tt-bars { display: flex; gap: 2px; height: 6px; }
            .tt-bar { flex: 1; background: #edf0f3; border-radius: 3px; overflow: hidden; position: relative; }
            .tt-bar-fill { height: 100%; border-radius: 3px; background: linear-gradient(90deg, #3498db, #2980b9); transition: width 0.3s ease; }
            .tt-div { border-top: 1px dashed #e0e4e8; margin: 10px 0; }
            .tt-bonus { color: #27ae60; font-size: 11px; text-align: right; font-weight: 600; margin-bottom: 2px; }
            .tt-icon { display: inline-block; width: 14px; height: 14px; text-align: center; font-size: 11px; font-weight: 700; line-height: 14px; border-radius: 3px; margin-right: 4px; vertical-align: middle; }

            /* CSS Toggle Pill */
            .st-toggle-wrap { display: flex; align-items: center; gap: 6px; cursor: pointer; }
            .st-toggle-wrap input { display: none; }
            .st-toggle { width: 38px; height: 22px; background: #e9e9ea; border-radius: 11px; position: relative; transition: background 0.3s ease; flex-shrink: 0; box-sizing: border-box; border: 1px solid transparent; }
            .st-toggle::after { content: ''; position: absolute; top: 1px; left: 1px; width: 18px; height: 18px; background: #ffffff; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.2), 0 0.5px 1px rgba(0,0,0,0.1); transition: transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0.0, 0.2, 1); }
            .st-toggle-wrap input:active + .st-toggle::after { width: 22px; }
            .st-toggle-wrap input:checked + .st-toggle { background: #34c759; }
            .st-toggle-wrap input:checked + .st-toggle::after { transform: translateX(16px); }
            .st-toggle-wrap input:checked:active + .st-toggle::after { transform: translateX(12px); }
            .st-toggle-label { font-size: 11px; color: #444; font-weight: 500; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }

            /* Стилі для Налаштувань */
            .st-section { background: rgba(255,255,255,0.6); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border-radius: 10px; padding: 8px 10px; margin-bottom: 6px; border: 1px solid rgba(255,255,255,0.8); box-shadow: 0 2px 10px rgba(0,0,0,0.02); }
            .st-title { font-size: 10px; font-weight: 700; color: #8b95a5; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; display: flex; justify-content: space-between; align-items: center; }
            .st-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px; gap: 8px; }
            .st-label { width: 95px; font-size: 11px; flex-shrink: 0; color: #444; font-weight: 500; }
            .st-row input[type="range"].single-range { flex: 1; min-width: 80px; cursor: pointer; -webkit-appearance: none; background: transparent; }
            .st-row input[type="range"].single-range::-webkit-slider-runnable-track { width: 100%; height: 4px; background: var(--track-bg, #e5e5ea) !important; border-radius: 2px; }
            .st-row input[type="range"].single-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 0px; height: 0px; background: #ffffff; border-radius: 50%; cursor: pointer; box-shadow: none; opacity: 0; transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); border: none; margin-top: 0px; }
            .st-row:hover input[type="range"].single-range::-webkit-slider-thumb { width: 14px; height: 14px; margin-top: -5px; opacity: 1; box-shadow: 0 1px 4px rgba(0,0,0,0.15), 0 2px 6px rgba(0,0,0,0.1); }
            .st-row input[type="range"].single-range::-webkit-slider-thumb:hover { transform: scale(1.2); }
            .st-row input[type="range"].single-range:active::-webkit-slider-thumb { transform: scale(1.0); box-shadow: 0 1px 6px rgba(0,0,0,0.3); }
            .st-num-input {
                width: 50px; height: 20px; box-sizing: border-box; padding: 2px 4px; font-size: 11px; border: 1px solid #dde1e6; border-radius: 6px; background: rgba(255,255,255,0.8);
                text-align: center; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                transition: border-color 0.2s ease, box-shadow 0.2s ease;
            }
            .st-num-input:focus { border-color: #34c759; outline: none; box-shadow: 0 0 0 2px rgba(52,199,89,0.15); }
            
            .tpw-info-inject-empty { text-align:center; padding: 30px 10px; color: #888; font-size: 12px; line-height: 1.5; }
            .flex-row-gap6 { display: flex; align-items: center; gap: 6px; }
            .st-section.st-section-nobg { margin-bottom: 0; box-shadow: none; border: none; background: transparent; padding: 0; }
            #seg-disc { background: #9b59b6; }
            #seg-rat { background: #f1c40f; }
            #seg-sal { background: #e74c3c; }
            #seg-rev { background: #3498db; }
            .st-label-disc { color: #9b59b6; }
            .st-label-rat { color: #f1c40f; }
            .st-label-sal { color: #e74c3c; }
            .st-label-rev { color: #3498db; }
            .dual-slider-inputs-col { display: flex; flex-direction: column; gap: 4px; width: 50px; align-items: flex-end; }
            .dual-slider-inputs-col .st-num-input { width: 100%; height: 18px; font-size: 10px; }
            .dual-slider-inputs-col .st-num-editable { width: 100%; height: 18px; font-size: 10px; }

            .st-num-editable {
                position: relative; display: inline-flex; align-items: center; justify-content: flex-end;
                width: 50px; height: 20px; border-radius: 6px; cursor: pointer;
                background: transparent; border: 1px solid transparent;
                transition: border-color 0.2s, background 0.2s;
                padding-right: 18px; box-sizing: border-box;
            }
            .st-num-editable:hover { border-color: #dde1e6; background: rgba(255,255,255,0.95); }
            .st-num-editable .st-num-display {
                font-size: 11px; font-weight: 600; color: #333;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            }
            .st-num-editable .st-num-pencil {
                position: absolute; right: 4px; top: 50%; transform: translateY(-50%);
                opacity: 0; transition: opacity 0.15s;
                pointer-events: none;
                width: 14px; height: 14px;
            }
            .st-num-editable:hover .st-num-pencil { opacity: 0.6; }
            .st-num-editable.editing { border-color: #34c759; background: #fff; padding-right: 4px; justify-content: center; }
            .st-num-editable.editing .st-num-pencil { display: none; }
            .st-num-editable.editing .st-num-display { display: none; }
            .st-num-editable .st-num-input { display: none; }
            .st-num-editable.editing .st-num-input { display: block; border: none; outline: none; background: transparent; box-shadow: none; width: 100%; height: 100%; text-align: center; }

            /* Подвійний слайдер */
            .dual-slider-container { position: relative; flex: 1; height: 20px; margin: 0; padding: 0; box-sizing: border-box; }
            .dual-slider-container input[type="range"] {
                position: absolute; left: 0; top: 0; width: 100%; pointer-events: none;
                -webkit-appearance: none; appearance: none; background: transparent; height: 4px; margin-top: 8px;
            }
            .dual-slider-container input[type="range"]::-webkit-slider-runnable-track { width: 100%; height: 4px; background: transparent; border-radius: 2px; }
            .dual-slider-container input[type="range"]::-webkit-slider-thumb {
                pointer-events: auto; -webkit-appearance: none; appearance: none;
                width: 0px; height: 0px; background: #ffffff; border-radius: 50%; border: none; cursor: pointer;
                box-shadow: none; opacity: 0; transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); margin-top: 0px;
            }
            .st-row:hover .dual-slider-container input[type="range"]::-webkit-slider-thumb {
                width: 14px; height: 14px; margin-top: -5px; opacity: 1;
                box-shadow: 0 1px 4px rgba(0,0,0,0.15), 0 2px 6px rgba(0,0,0,0.1);
            }
            .dual-slider-container input[type="range"]::-webkit-slider-thumb:hover { transform: scale(1.2); }
            .dual-slider-container input[type="range"]:active::-webkit-slider-thumb { transform: scale(1.0); box-shadow: 0 1px 6px rgba(0,0,0,0.3); }
            .dual-slider-track { position: absolute; top: 8px; left: 0; right: 0; height: 4px; background: var(--track-bg, #e5e5ea) !important; border-radius: 2px; z-index: 0; }
            .dual-slider-highlight { position: absolute; top: 8px; left: 0; height: 4px; background: #34c759; border-radius: 2px; z-index: 0; pointer-events: none; }
            
            /* Segmented Weights Bar */
            .tpw-weights-bar { position: relative; width: 100%; height: 20px; border-radius: 10px; display: flex; overflow: visible; margin: 6px 0; user-select: none; }
            .tpw-weights-bar-wrap { position: relative; margin-bottom: 8px; }
            .tpw-weights-ticks { position: absolute; top: 0; left: 0; right: 0; height: 20px; pointer-events: none; z-index: 0; }
            .tpw-weights-tick { position: absolute; top: 2px; width: 1px; height: 16px; background: rgba(0,0,0,0.08); border-radius: 1px; }
            .tpw-weights-tick-label { display: none; }
            .tpw-weight-segment { height: 100%; transition: width 0.1s; display: flex; align-items: center; justify-content: center; font-size: 9px; color: white; font-weight: 700; overflow: hidden; text-shadow: 0 1px 1px rgba(0,0,0,0.2); letter-spacing: -0.3px; position: relative; z-index: 1; }
            .tpw-weight-segment:first-child { border-radius: 10px 0 0 10px; }
            .tpw-weight-segment:last-child { border-radius: 0 10px 10px 0; }
            .tpw-weight-divider { position: relative; width: 14px; margin-left: -7px; margin-right: -7px; height: 100%; cursor: col-resize; z-index: 2; display: flex; align-items: center; justify-content: center; }
            .tpw-weight-divider::after { content: ''; display: block; width: 3px; height: 0px; background: rgba(255,255,255,0.9); border-radius: 2px; box-shadow: 0 0 4px rgba(0,0,0,0.15); transition: height 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s; opacity: 0; }
            .tpw-algorithm-settings:hover .tpw-weight-divider::after { height: 14px; opacity: 1; }
            .tpw-weight-divider:hover::after { background: #fff; height: 16px !important; box-shadow: 0 0 6px rgba(0,0,0,0.25); }
            .tpw-weights-inputs { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; overflow: hidden; }
            .tpw-weights-inputs .st-row { margin-bottom: 0; padding: 3px 4px; border-radius: 6px; background: transparent; min-width: 0; overflow: hidden; transition: background 0.2s; }
            .tpw-weights-inputs .st-row:hover { background: rgba(0,0,0,0.03); }
            .tpw-weights-inputs .st-label { font-size: 10px; flex: 1; display: flex; align-items: center; gap: 3px; }
            
            /* Акордеон Налаштування алгоритму */
            .tpw-accordion-header {
                display: flex; justify-content: space-between; align-items: center; cursor: pointer;
                padding: 8px; background: rgba(255,255,255,0.6); border-radius: 8px; margin-top: 6px; font-weight: 600; font-size: 11px;
                border: 1px solid rgba(255,255,255,0.8); transition: background 0.2s;
            }
            .tpw-accordion-header:hover { background: rgba(255,255,255,0.9); }
            .tpw-accordion-body { display: none; padding: 6px 4px 2px 4px; }
            .tpw-accordion-body.open { display: block; }
            .tpw-accordion-icon { transition: transform 0.3s ease; font-size: 10px; }
            .tpw-accordion-icon.open { transform: rotate(180deg); }
            
            /* Кнопка Side Panel */
            .btn-sp {
                cursor:pointer; border:none; border-radius:6px; padding:3px 8px;
                background: linear-gradient(135deg, #0b7bff, #0056b3); color:#fff;
                font-size:10px; margin-right:5px; font-weight:700;
                font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
                transition: all 0.2s ease; letter-spacing: 0.3px;
            }
            .btn-sp:hover { background: linear-gradient(135deg, #0056b3, #003d80); transform: translateY(-1px); box-shadow: 0 2px 8px rgba(11,123,255,0.3); }

            /* Легенда бонусів (popup) */
            .tpw-bonus-legend-wrap { position: relative; }
            .tpw-bonus-legend {
                display: none; position: absolute; bottom: 100%; left: 0; right: 0;
                background: rgba(255,255,255,0.98); backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                border: 1px solid rgba(0,0,0,0.1); border-radius: 10px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.15);
                padding: 10px 12px; z-index: 10; font-size: 10.5px;
                max-height: 280px; overflow-y: auto;
                scrollbar-width: thin;
            }
            .tpw-bonus-legend-wrap:hover .tpw-bonus-legend { display: block; }
            .tpw-legend-item {
                display: flex; justify-content: space-between; align-items: center;
                padding: 3px 0; border-bottom: 1px solid rgba(0,0,0,0.04);
            }
            .tpw-legend-item:last-child { border-bottom: none; }
            .tpw-legend-item.active { color: #27ae60; font-weight: 600; }
            .tpw-legend-item.inactive { color: #bbb; }

            /* Reset Button */
            .tpw-reset-btn {
                display: inline-flex; align-items: center; justify-content: center;
                width: 22px; height: 22px; min-width: 22px; min-height: 22px;
                flex-shrink: 0; cursor: pointer; border-radius: 50%;
                background: rgba(11, 123, 255, 0.08); transition: all 0.2s ease;
                opacity: 0.6; box-sizing: border-box;
            }
            .tpw-reset-btn:hover { background: rgba(11, 123, 255, 0.18); opacity: 1; transform: rotate(-45deg); }
            .tpw-reset-btn svg { pointer-events: none; }

            /* Maximize window class */
            #temu-pro-window.tpw-maximized-y {
                top: 0 !important;
                height: 100vh !important;
                max-height: 100vh !important;
                border-radius: 0 !important;
            }
            #temu-pro-window.tpw-maximized-y #tpw-body {
                max-height: none !important;
            }

            /* Resize handles */
            .tpw-resize { position: absolute; z-index: 10; }
            .tpw-resize-n { top: -3px; left: 10px; right: 10px; height: 6px; cursor: n-resize; }
            .tpw-resize-s { bottom: -3px; left: 10px; right: 10px; height: 6px; cursor: s-resize; }
            .tpw-resize-e { top: 10px; right: -3px; bottom: 10px; width: 6px; cursor: e-resize; }
            .tpw-resize-w { top: 10px; left: -3px; bottom: 10px; width: 6px; cursor: w-resize; }
            .tpw-resize-ne { top: -3px; right: -3px; width: 12px; height: 12px; cursor: ne-resize; }
            .tpw-resize-nw { top: -3px; left: -3px; width: 12px; height: 12px; cursor: nw-resize; }
            .tpw-resize-se { bottom: -3px; right: -3px; width: 12px; height: 12px; cursor: se-resize; }
            .tpw-resize-sw { bottom: -3px; left: -3px; width: 12px; height: 12px; cursor: sw-resize; }

            /* Adaptive Design Classes */
            .tpw-compact .tpw-bonus-legend-wrap { display: none !important; }
            .tpw-compact .tt-div { margin: 4px 0 !important; }
            .tpw-compact .tt-row { margin-bottom: 2px !important; }
            
            /* V16: tpw-tall combined view removed — tabs work separately */

            /* New Segmented Control Styles */
            .st-segmented-control {
                display: inline-flex;
                background-color: var(--tpw-track-bg);
                border-radius: 8px;
                padding: 2px;
                position: relative;
                align-items: center;
            }
            .st-segment-btn {
                background: none;
                border: none;
                cursor: pointer;
                padding: 4px 12px;
                font-size: 13px;
                font-weight: 500;
                color: #555;
                position: relative;
                z-index: 1;
                transition: color 0.2s;
                border-radius: 6px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
            }
            .st-segment-btn.st-active {
                color: #111;
                font-weight: 600;
            }
            .st-segment-active-bg {
                position: absolute;
                top: 2px;
                bottom: 2px;
                left: 2px;
                width: calc(50% - 2px);
                pointer-events: none;
                background-color: #fff;
                border-radius: 6px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
                transition: transform 0.25s cubic-bezier(0.2, 0, 0, 1);
                z-index: 0;
            }
            /* Специфічні стилі для міні-валют контролера у шапці */
            .tpw-currency-segmented {
                padding: 2px;
            }
            .tpw-currency-segmented .st-segment-btn {
                padding: 2px 8px;
                font-size: 12px;
                line-height: 1;
            }


            .tpw-version-stamp {
                text-align: center;
                font-size: 10px;
                color: #aaa;
                padding: 6px 0 2px 0;
                margin-top: auto;
                border-top: 1px solid var(--tpw-border);
                user-select: none;
            }

            /* --- Адаптивний дизайн (Container Queries) --- */
            @container tpw-panel (max-width: 310px) {
                #tpw-header { padding: 8px 10px; font-size: 12px; }
                .tpw-header-text-container > span:last-child { display: none; }
                .st-label { width: 75px; font-size: 10px; }
                .st-num-input { padding: 2px; }
                .tpw-content { padding: 8px; }
                #tpw-tabs { padding: 4px 8px; }
                .flex-row-gap6 { gap: 4px; }
                .st-toggle-label { display: none; }
                .tpw-weights-inputs .st-row { width: 100%; }
                .dual-slider-inputs-col { width: 40px; }
            }

            @container tpw-panel (min-width: 420px) {
                #tpw-header { padding: 12px 20px; font-size: 14px; }
                .st-label { width: 110px; font-size: 12px; }
                .tpw-content { padding: 16px; }
                #tpw-tabs { padding: 10px 16px; }
            }
        `;
        document.head.appendChild(style);
    }

    // --- ДОПОМІЖНА ФУНКЦІЯ: Надіслати повідомлення в iframe (через chrome.storage) ---
    // postMessage не працює cross-origin (chrome-extension:// ↔ temu.com)
    // chrome.storage.onChanged працює для всіх extension pages (iframe + sidepanel)
    let _hoverWriteTimer = null;
    function sendToIframe(msg) {
        if (msg.type === 'TPW_HOVER_INFO') {
            // Debounce записів в storage (макс 1 раз на 100ms)
            clearTimeout(_hoverWriteTimer);
            _hoverWriteTimer = setTimeout(() => {
                try {
                    chrome.storage.local.set({ _iframeHoverHtml: msg.html, _iframeHoverTs: Date.now() });
                } catch(e) {
                    // Ignore Extension context invalidated errors from reloads
                }
            }, 50);
        } else if (msg.type === 'TPW_SWITCH_TAB') {
            chrome.storage.local.set({ _iframeActiveTab: msg.tab });
        }
        // Також пробуємо runtime message (для side panel)
        try { chrome.runtime.sendMessage({ action: 'hoverInfo', html: msg.html || '' }); } catch(ignore) {}
    }

    // --- СТВОРЕННЯ ЄДИНОГО ВІКНА ---
    function createMainWindow() {
        if (document.getElementById('temu-pro-window')) return;
        const panel = document.createElement('div');
        panel.id = 'temu-pro-window';
        if (isPanelCollapsed) panel.classList.add('is-collapsed-mode');

        panel.style.top = '20px';
        panel.style.right = '20px';
        panel.style.display = 'flex'; // Side Panel приховає через onChanged listener

        const iframeUrl = chrome.runtime.getURL('sidepanel.html') + '?mode=iframe';

        const PANEL_HTML = `
            <iframe src="${iframeUrl}" id="tpw-iframe"
                style="width:100%; height:100%; border:none; flex:1; border-radius:inherit; background:transparent; display:block; min-height:0;"
                allow="clipboard-write"></iframe>
            <div class="tpw-resize tpw-resize-n" data-dir="n"></div>
            <div class="tpw-resize tpw-resize-s" data-dir="s"></div>
            <div class="tpw-resize tpw-resize-e" data-dir="e"></div>
            <div class="tpw-resize tpw-resize-w" data-dir="w"></div>
            <div class="tpw-resize tpw-resize-nw" data-dir="nw"></div>
            <div class="tpw-resize tpw-resize-ne" data-dir="ne"></div>
            <div class="tpw-resize tpw-resize-se" data-dir="se"></div>
            <div class="tpw-resize tpw-resize-sw" data-dir="sw"></div>
        `;
        panel.innerHTML = PANEL_HTML;
        document.body.appendChild(panel);

        // --- ДРАГ (ПРИЙОМ ПОВІДОМЛЕНЬ ВІД IFRAME) ---
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        let isDragging = false;

        window.addEventListener('message', (e) => {
            if (!e.data || typeof e.data.type !== 'string') return;

            if (e.data.type === 'TPW_DRAG_START') {
                isDragging = true;
                pos3 = e.data.x;
                pos4 = e.data.y;
                let rect = panel.getBoundingClientRect();
                panel.style.bottom = 'auto'; panel.style.right = 'auto';
                panel.style.top = rect.top + 'px'; panel.style.left = rect.left + 'px';

                // Overlay запобігає крадіжці mousemove iframe'ом
                let overlay = document.getElementById('tpw-drag-overlay');
                if (!overlay) {
                    overlay = document.createElement('div');
                    overlay.id = 'tpw-drag-overlay';
                    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2147483647;cursor:move;background:transparent;';
                    document.body.appendChild(overlay);
                }

                const onMove = (ev) => {
                    ev.preventDefault();
                    if (!isDragging) return;
                    pos1 = pos3 - ev.screenX; pos2 = pos4 - ev.screenY;
                    pos3 = ev.screenX; pos4 = ev.screenY;
                    let newTop = panel.offsetTop - pos2, newLeft = panel.offsetLeft - pos1;
                    newTop = Math.max(0, Math.min(newTop, window.innerHeight - panel.offsetHeight));
                    newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - panel.offsetWidth));
                    panel.style.top = newTop + 'px'; panel.style.left = newLeft + 'px';
                };

                const onUp = () => {
                    isDragging = false;
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                    const ov = document.getElementById('tpw-drag-overlay');
                    if (ov) ov.remove();
                };

                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            }
            else if (e.data.type === 'TPW_COLLAPSE_TOGGLE') {
                isPanelCollapsed = e.data.collapsed;
                chrome.storage.local.set({ isPanelCollapsed: isPanelCollapsed });
                panel.classList.toggle('is-collapsed-mode', isPanelCollapsed);
            }
            else if (e.data.type === 'TPW_HIDE_PANEL') {
                panel.style.display = 'none';
            }
            else if (e.data.type === 'TPW_OPEN_SIDEPANEL') {
                panel.style.display = 'none';
                try { chrome.runtime.sendMessage({ action: 'openSidePanel' }); } catch(ignore) {}
            }
        });



        let savedGeometry = null;

        // --- RESIZE HANDLES (8 напрямків) ---
        panel.querySelectorAll('.tpw-resize').forEach(handle => {
            const dir = handle.dataset.dir;

            if (dir === 'n' || dir === 's') {
                handle.addEventListener('dblclick', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    isManuallyResized = true;
                    if (panel.classList.contains('tpw-maximized-y')) {
                        panel.classList.remove('tpw-maximized-y');
                        if (savedGeometry) {
                            panel.style.top = savedGeometry.top;
                            panel.style.height = savedGeometry.height;
                            savedGeometry = null;
                        }
                    } else {
                        savedGeometry = { top: panel.style.top, height: panel.style.height };
                        panel.classList.add('tpw-maximized-y');
                    }
                });
            }

            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                // Якщо тягнемо за вертикальний край при максимізації — виходимо з максимізації
                if (panel.classList.contains('tpw-maximized-y') && (dir.includes('n') || dir.includes('s'))) {
                    panel.classList.remove('tpw-maximized-y');
                    const curRect = panel.getBoundingClientRect();
                    panel.style.top = curRect.top + 'px';
                    panel.style.height = curRect.height + 'px';
                    savedGeometry = null;
                }
                isManuallyResized = true; // Фіксуємо ручний розмір (баг B1)

                const startX = e.clientX, startY = e.clientY;
                const rect = panel.getBoundingClientRect();
                const startW = rect.width, startH = rect.height;
                const startT = rect.top, startL = rect.left;
                // Фіксуємо позицію для ресайзу
                panel.style.bottom = 'auto'; panel.style.right = 'auto';
                panel.style.top = startT + 'px'; panel.style.left = startL + 'px';

                const onMove = (ev) => {
                    const dx = ev.clientX - startX, dy = ev.clientY - startY;
                    let newW = startW, newH = startH, newT = startT, newL = startL;
                    if (dir.includes('e')) newW = Math.max(240, Math.min(600, startW + dx));
                    if (dir.includes('w')) { newW = Math.max(240, Math.min(600, startW - dx)); newL = startL + (startW - newW); }
                    if (dir.includes('s')) newH = Math.max(150, Math.min(window.innerHeight - startT - 10, startH + dy));
                    if (dir.includes('n')) { newH = Math.max(150, Math.min(startT + startH - 10, startH - dy)); newT = startT + (startH - newH); }
                    panel.style.width = newW + 'px';
                    panel.style.height = newH + 'px';
                    panel.style.top = newT + 'px';
                    panel.style.left = newL + 'px';
                };
                const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
        });
    }

    // --- АВТО-ПІДГОНКА ВИСОТИ ВІКНА ДО КОНТЕНТУ ---
    function autoFitPanel() {
        if (isManuallyResized) return; // Вирішення B1: не змінюємо розмір, якщо його змінив юзер

        const panel = document.getElementById('temu-pro-window');
        if (!panel) return;
        // Замість поступових JavaScript розрахунків дозволяємо вікну миттєво підлаштуватись під зміст
        panel.style.height = 'auto';
        panel.style.minHeight = '150px';
    }

    // --- ОНОВЛЕННЯ ДАНИХ ПРИ НАВЕДЕННІ (з debounce) ---
    let _lastCardEl = null;
    let _hoverTimer = null;
    let _panelHovered = false;
    let _resetTimer = null;
    let isManuallyResized = false; // Змінна для відслідковування (ручний розмір зберігає стан)

    // Важливий функціонал: подвійний клік на панель скидає ручний розмір (повертає авто)
    document.addEventListener('dblclick', (e) => {
        const header = e.target.closest('#temu-pro-window');
        if (header) {
            isManuallyResized = false;
            const panel = document.getElementById('temu-pro-window');
            if (panel) {
                panel.style.height = 'auto';
                panel.style.width = '340px';
                autoFitPanel();
            }
        }
    });

    // Коли курсор на панелі — не змінюємо контент + скасовуємо pending таймери
    const _attachPanelHoverListeners = () => {
        const panel = document.getElementById('temu-pro-window');
        if (!panel || panel.hasAttribute('data-hover-attached')) return;
        panel.setAttribute('data-hover-attached', 'true');
        panel.addEventListener('mouseenter', () => {
            _panelHovered = true;
            clearTimeout(_hoverTimer);
            clearTimeout(_resetTimer);
        });
        panel.addEventListener('mouseleave', () => {
            _panelHovered = false;
        });
    };
    requestAnimationFrame(_attachPanelHoverListeners);

    document.addEventListener('mouseover', (e) => {
        if (!isScriptEnabled || _panelHovered) return;
        const card = e.target.closest('[data-tooltip-html]');

        if (card) {
            if (card === _lastCardEl) return;
            // Debounce: чекаємо 300ms (F2) щоб переконатися що курсор залишився на картці
            clearTimeout(_hoverTimer);
            clearTimeout(_resetTimer);
            _hoverTimer = setTimeout(() => {
                if (_panelHovered) return; // Курсор вже на панелі — не перемикаємо
                _lastCardEl = card;
                const html = card.getAttribute('data-tooltip-html');

                // F2: Hover highlight - using inset shadow and applying to card itself to fix carousel clipping
                document.querySelectorAll('.tpw-active-card-highlight').forEach(el => el.classList.remove('tpw-active-card-highlight'));
                if (card) {
                    card.classList.add('tpw-active-card-highlight');
                    _lastHoveredCardId = card.getAttribute('data-tpw-id');
                }

                // infoInject тепер в iframe — використовуємо sendToIframe
                if (html && isScriptEnabled) {
                    sendToIframe({type: 'TPW_HOVER_INFO', html: html});
                }
                lastHoveredHtml = html;
                try { chrome.runtime.sendMessage({ action: 'hoverInfo', html: html }); } catch (ignore) { }

                // Автоматичне перемикання на вкладку Аналітика при наведенні
                sendToIframe({type: 'TPW_SWITCH_TAB', tab: 'info'});
            }, 300);
        } else {
            // Мишка не на картці — скасовуємо pending hover
            clearTimeout(_hoverTimer);
            // Скидаємо контент лише через 500ms (дає час дістатись до панелі)
            clearTimeout(_resetTimer);
            _resetTimer = setTimeout(() => {
                if (_panelHovered) return;
                // Якщо є lastHoveredHtml — тримаємо підсвітку і контент
                if (lastHoveredHtml) return;
                _lastCardEl = null;
                _lastHoveredCardId = null;
                const defaultHtml = cachedMainProductHtml || `
                    <div style="text-align:center; padding: 40px 10px; color: #888; font-size: 12px; line-height: 1.5;">
                        ${svgIcon('search', '#bbb', 28)}
                        <div style="margin-top: 8px;">${L.hoverHint}</div>
                    </div>`;
                sendToIframe({type: 'TPW_HOVER_INFO', html: defaultHtml});
                document.querySelectorAll('.tpw-active-card-highlight').forEach(el => el.classList.remove('tpw-active-card-highlight'));
                try { chrome.runtime.sendMessage({ action: 'hoverInfo', html: defaultHtml }); } catch (ignore) { }
            }, 500);
        }
    });

    // --- МАТЕМАТИКА ТА ПАРСИНГ ---
    function getColor(score) {
        if (score >= 80) return '#34c759'; // Green (spec: >=80)
        if (score >= 40) return '#ff9500'; // Orange (spec: >=40)
        return '#ff3b30'; // Red (spec: <40)
    }

    function renderMiniBars(pts, maxPts, color) {
        const totalBars = 10;
        let percent = maxPts > 0 ? (pts / maxPts) * 100 : 0;
        let html = '<div class="tt-bars">';
        for (let i = 0; i < totalBars; i++) {
            let barStart = i * (100 / totalBars);
            let fillPct = 0;
            if (percent >= barStart + (100 / totalBars)) fillPct = 100;
            else if (percent > barStart) fillPct = ((percent - barStart) / (100 / totalBars)) * 100;
            html += `<div class="tt-bar"><div class="tt-bar-fill" style="width:${Math.round(fillPct)}%; background: ${color}"></div></div>`;
        }
        return html + '</div>';
    }

    function updateMainProductInfo() {
        // Перевіряємо чи це сторінка товару (URL містить -g- паттерн)
        const isProductPage = /\-g\-\d+\.html/.test(window.location.href);
        if (!isProductPage) {
            cachedMainProductHtml = null;
            return;
        }

        const h1 = document.querySelector('h1');
        const title = h1 ? h1.textContent.trim() : L.curProduct;

        // Знайти контейнер головного товару, щоб не парсити блок рекомендацій
        // #rightContent - це права колонка на Temu з ціною, назвою та кнопкою купити
        const rightContent = document.querySelector('#rightContent');
        const mainContainer = rightContent || document.querySelector('main') || document.querySelector('#main_content') || document.querySelector('.goods-main-container') || document.body;

        // Звужуємо зону пошуку для "плюшок"
        let scopeElement = rightContent || mainContainer;
        if (!rightContent && h1) {
            let p = h1;
            for (let i = 0; i < 6; i++) {
                if (p.parentElement && p.parentElement.tagName !== 'BODY' && p.parentElement.tagName !== 'HTML') {
                    p = p.parentElement;
                }
            }
            scopeElement = p;
        }

        let text = scopeElement.textContent.toLowerCase();

        // price and discount
        const parseNum = (str) => parseFloat(str.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
        // Безпечний парсинг ціни: витягує ПЕРШЕ число з форматом $X.XX або X.XX$
        const parsePriceSafe = (str) => {
            if (!str) return 0;
            // Варіант 1: $1.90 або $41.37
            let m = str.match(/\$\s*(\d+[.,]?\d*)/);
            if (m) return parseFloat(m[1].replace(',', '.')) || 0;
            // Варіант 2: 1.90$ або 41.37$
            m = str.match(/(\d+[.,]?\d*)\s*\$/);
            if (m) return parseFloat(m[1].replace(',', '.')) || 0;
            // Варіант 3: ₴ або грн
            m = str.match(/[₴]\s*(\d[\d\s.,]*)/) || str.match(/(\d[\d\s.,]*)\s*(?:₴|грн)/);
            if (m) return parseFloat(m[1].replace(/\s/g, '').replace(',', '.')) || 0;
            return parseNum(str);
        };

        // Пріоритетні селектори ціни для #rightContent
        const priceEl = scopeElement.querySelector('#goods_price ._1vkz0rqG span._14At0Pe5, ._2myxWHLi, ._3D8vQd_w, [aria-label*="ціна"]');
        const rrpEl = scopeElement.querySelector('#goods_price ._1lS1CJSS span._14At0Pe5, ._3TAPHDOX, ._2mE_o3v_');
        const extraSaveEl = scopeElement.querySelector('._1LLbpUTn');

        // T4.3: Якщо валюту на сайті свагнуто, читаємо ОРИГІНАЛЬНУ ціну з data-raw-text
        let rawPriceText = '';
        if (priceEl) {
            if (isSiteCurrencySwapped && priceEl.hasAttribute('data-raw-text')) {
                rawPriceText = priceEl.getAttribute('data-raw-text');
            } else {
                rawPriceText = priceEl.textContent;
            }
        }
        let price = parsePriceSafe(rawPriceText);

        // Fallback: шукаємо "Прибл." ціну якщо основний селектор дав занадто мале значення
        if (price < 0.5) {
            const priblEls = Array.from(scopeElement.querySelectorAll('div, span, p')).filter(el =>
                el.textContent.includes('Прибл') && el.textContent.trim().length < 60
            );
            for (const pEl of priblEls) {
                let pM = pEl.textContent.match(/(\d+[.,]?\d*)\s*\$/) || pEl.textContent.match(/\$\s*(\d+[.,]?\d*)/);
                if (pM) { price = parseFloat(pM[1].replace(',', '.')) || 0; rawPriceText = pEl.textContent; break; }
            }
        }
        // Fallback 2: шукаємо по всьому scopeElement будь-який елемент з $ та числом
        if (price < 0.5) {
            const priceLeafs = Array.from(scopeElement.querySelectorAll('div, span')).filter(el =>
                el.children.length === 0 && el.textContent.includes('$') && el.textContent.trim().length < 20
            );
            for (const pEl of priceLeafs) {
                let pM = pEl.textContent.match(/(\d+[.,]?\d*)/);
                if (pM) { let v = parseFloat(pM[1].replace(',', '.')); if (v >= 0.5) { price = v; rawPriceText = pEl.textContent; break; } }
            }
        }

        let rrp = rrpEl ? parsePriceSafe(rrpEl.innerText || rrpEl.textContent) : 0;
        let extraSave = extraSaveEl ? parseNum(extraSaveEl.innerText) : 0;

        let isUAH = rawPriceText.includes('₴') || rawPriceText.toLowerCase().includes('грн');
        let isUSD = rawPriceText.includes('$');
        let currencySymbol = isUAH ? '₴' : (isUSD ? '$' : '');
        const formatPrice = (val) => isUAH ? Math.round(val).toLocaleString('uk-UA') : val.toFixed(2);

        let convertedStr = '';
        if (exchangeRate > 0 && price > 0) {
            if (isUAH) convertedStr = `(≈ $${(price / exchangeRate).toFixed(2)})`;
            else if (isUSD) convertedStr = `(≈ ₴${Math.round(price * exchangeRate).toLocaleString('uk-UA')})`;
        }

        let discountPercent = 0;
        const discountEls = Array.from(mainContainer.querySelectorAll('div, span')).filter(el => {
            let t = el.textContent.trim().toLowerCase();
            return (t.startsWith('знижка') || t.includes('% off') || t.includes('off')) && t.length < 50;
        });
        if (discountEls.length > 0) {
            let dMatch = discountEls[0].textContent.match(/знижка\s*(\d+)%/i) || discountEls[0].textContent.match(/(\d+)%\s*off/i);
            if (dMatch) discountPercent = parseInt(dMatch[1]);
        }
        if (discountPercent === 0 && rrp > 0 && price > 0 && price < rrp) {
            discountPercent = Math.floor(((rrp - (price - extraSave)) / rrp) * 100);
        }

        // Helper: листові елементи для пошуку (ТІЛЬКИ в scopeElement, щоб не захопити рекомендації)
        const scopedLeafs = Array.from(scopeElement.querySelectorAll('div, span, a')).filter(el => el.children.length === 0 && el.textContent.trim().length > 0 && el.textContent.trim().length < 50);

        // rating (шукаємо тільки в scopeElement)
        let rating = 0;
        let rateEl = scopedLeafs.find(el => el.textContent.includes("з п'яти зірок"));
        if (!rateEl) {
            rateEl = scopedLeafs.find(el => el.textContent.match(/^\d\.\d$/));
        }
        if (!rateEl) {
            const withRate = Array.from(scopeElement.querySelectorAll('div, span, a')).filter(el => el.textContent.length < 50 && el.textContent.match(/(\d\.\d)/));
            if (withRate.length > 0) rateEl = withRate[0];
        }

        if (rateEl) {
            let rMatch = rateEl.textContent.match(/([1-5]\.\d)/);
            if (rMatch) rating = parseFloat(rMatch[1]);
        }

        // reviews — пріоритет: "відгуків" (реальна кількість), ВИКЛЮЧАЄМО елементи з "%" (задоволеність)
        let reviews = 0;
        const parseReviewCount = (el) => {
            // Прибираємо пробіли та парсимо число
            let t = el.textContent.replace(/\s+/g, '');
            let m = t.match(/(\d[\d.,]*)(\s*тис|\s*k)?/i);
            if (m) {
                let n = parseFloat(m[1].replace(',', '.'));
                if (m[2] && (m[2].includes('тис') || m[2].toLowerCase().includes('k'))) n *= 1000;
                return n;
            }
            return 0;
        };

        // Крок 1: шукаємо "відгук" (НЕ "оцінк%") — це кількість відгуків
        const findReviewEl = (container) => {
            const leafs = Array.from(container.querySelectorAll('div, span, a, p')).filter(el =>
                el.children.length === 0 && el.textContent.trim().length > 0 && el.textContent.trim().length < 60
            );
            // Пріоритет 1: елемент що містить "N,NNN reviews" або "N NNN відгуків" (повний текст з числом)
            let found = leafs.find(el => {
                let t = el.textContent.trim().toLowerCase();
                return (/\d[\d\s.,]*\s*(reviews|відгук)/i.test(t)) && !t.includes('%');
            });
            if (found) return found;
            // Пріоритет 2: елемент з "відгук" без "%" (може не мати числа — число в сусідньому елементі)
            found = leafs.find(el => {
                let t = el.textContent.toLowerCase();
                return t.includes('відгук') && !t.includes('%');
            });
            if (found) return found;
            // Пріоритет 3: елемент з "review" без "%"
            found = leafs.find(el => {
                let t = el.textContent.toLowerCase();
                return (t.includes('review') || t.includes('rating')) && !t.includes('%');
            });
            return found || null;
        };

        let revEl = findReviewEl(scopeElement);
        if (revEl) reviews = parseReviewCount(revEl);

        // B2: Специфічний пошук відгуків на сторінці самого товару
        if (reviews < 1 && isProductPage) {
            const heading = document.querySelector('h1');
            if (heading && heading.parentElement) {
                // Відгуки зазвичай знаходяться в блоці рейтингу під назвою товару
                const reviewTexts = Array.from(heading.parentElement.querySelectorAll('*')).filter(el =>
                    el.children.length === 0 && el.textContent.match(/\d/) && !el.textContent.includes('%') && el.textContent.length < 30
                );
                for (let el of reviewTexts) {
                    let text = el.textContent.replace(/\s+/g, '').toLowerCase();
                    // Шукаємо патерни "(121reviews)" або "121відгук", "12.3kвідгуків"
                    let rm = text.match(/\(?([\d.,]+)(k|тис)?(reviews|review|відгук)/i);
                    if (rm) {
                        let n = parseFloat(rm[1].replace(',', '.'));
                        if (rm[2] && (rm[2] === 'k' || rm[2] === 'тис')) n *= 1000;
                        if (n > reviews) { reviews = n; break; }
                    }
                }
            }
        }

        // sales
        let sales = 0;
        // Шукаємо "продано", "продажі", "sold" — ВИКЛЮЧАЄМО елементи з валютою
        const saleElements = Array.from(scopeElement.querySelectorAll('div, span, p')).filter(el => {
            if (el.children.length > 2) return false;
            let t = el.textContent.toLowerCase().replace(/\s+/g, '');
            // Виключаємо елементи, які містять символи валют (щоб не зловити ціну)
            if (t.includes('$') || t.includes('₴') || t.includes('грн') || t.includes('ррц')) return false;
            let isSale = t.includes('продано') || t.includes('продаж') || t.includes('sold');
            return isSale && !t.includes('найпродаваніший') && t.trim().length < 50;
        });

        if (saleElements.length > 0) {
            let sText = saleElements[0].textContent.replace(/\s+/g, '').toLowerCase();
            let sMatch = sText.match(/([\d.,]+)(тис|k|млн|m)?\+?(продано|продаж|sold)/i);
            if (sMatch) {
                sales = parseFloat(sMatch[1].replace(',', '.'));
                if (sMatch[2]) {
                    if (sMatch[2].includes('тис') || sMatch[2].includes('k')) sales *= 1000;
                    if (sMatch[2].includes('млн') || sMatch[2].includes('m')) sales *= 1000000;
                }
            } else {
                let anyNum = sText.match(/([\d.,]+)(тис|k|млн|m)?\+?/i);
                if (anyNum) {
                    sales = parseFloat(anyNum[1].replace(',', '.'));
                    if (anyNum[2]) {
                        if (anyNum[2].includes('тис') || anyNum[2].includes('k')) sales *= 1000;
                        if (anyNum[2].includes('млн') || anyNum[2].includes('m')) sales *= 1000000;
                    }
                }
            }
        }

        // bonuses logic
        let bonusPointsFinal = 0;
        let bonusLines = [];

        // Бонус "Екстра знижка" (відсутній раніше — баг parity з processCards)
        if (extraSave > 0 && rrp > 0) {
            let extraPerc = (extraSave / rrp) * 100;
            let extraBonus = Math.min(7.0, extraPerc * 0.15);
            if (extraBonus > 0) {
                bonusPointsFinal += extraBonus;
                bonusLines.push({ name: `${L.extraDiscount} ${Math.round(extraPerc)}% <span style="color:#95a5a6;font-size:9px;">(0.15${L.pts} / 1%)</span>`, pts: extraBonus, max: 7 });
            }
        }

        let isBestseller = text.includes('найпродаваніший') || text.includes('топ продажів') || text.includes('найкращі продажі') || text.includes('найкращий за рейтингом') || text.includes('best-selling') || text.includes('best selling') || text.includes('top selling');
        if (isBestseller) {
            let rankMatch = text.match(/#(\d+)/);
            let rank = rankMatch ? parseInt(rankMatch[1]) : 50;
            let is6Months = text.includes('6 міс') || text.includes('6 month') || text.includes('last 6');
            let is14Days = text.includes('14 дн') || text.includes('14 day');
            let rankBasePoints = Math.max(1.0, ((51 - rank) / 50) * 8.5);
            let timeMulti = is6Months ? 1.5 : (is14Days ? 0.8 : 1.0);
            let rankBonus = rankBasePoints * timeMulti;
            bonusPointsFinal += rankBonus;
            let rankTxt = rankMatch ? `Топ #${rank}` : `${L.bestseller} (#50)`;
            let durTxt = is6Months ? ' (6 міс.)' : (is14Days ? ' (14 дн.)' : '');
            let multiTxt = is6Months ? '×1.5' : (is14Days ? '×0.8' : '×1.0');
            bonusLines.push({ name: `${rankTxt}${durTxt} <span style="color:#95a5a6;font-size:9px;">(${L.base} ${rankBasePoints.toFixed(1)} ${multiTxt})</span>`, pts: rankBonus, max: 13 });
        }

        if (text.includes('найвищий рейтинг') || text.includes('top rated') || text.includes('highest rated')) { bonusPointsFinal += 3.5; bonusLines.push({ name: `${L.topRating} <span style="color:#95a5a6;font-size:9px;">(${L.fix})</span>`, pts: 3.5, max: 3.5 }); }
        if (text.includes('зірковий продавець') || text.includes('star seller')) { bonusPointsFinal += 5.0; bonusLines.push({ name: `${L.starSeller} <span style="color:#95a5a6;font-size:9px;">(${L.fix})</span>`, pts: 5.0, max: 5.0 }); }
        if (text.includes('бренд') || text.includes('brand')) { bonusPointsFinal += 3.5; bonusLines.push({ name: `${L.brand} <span style="color:#95a5a6;font-size:9px;">(${L.fix})</span>`, pts: 3.5, max: 3.5 }); }
        if (text.includes('місцевий склад') || text.includes('local warehouse')) { bonusPointsFinal += 3.5; bonusLines.push({ name: `${L.localWH} <span style="color:#95a5a6;font-size:9px;">(${L.fix})</span>`, pts: 3.5, max: 3.5 }); }
        else if (text.includes('швидка доставка') || text.includes('fast delivery') || text.includes('express')) { bonusPointsFinal += 1.5; bonusLines.push({ name: `${L.fastDel} <span style="color:#95a5a6;font-size:9px;">(${L.fix})</span>`, pts: 1.5, max: 1.5 }); }
        if (text.includes('пропозиція') || text.includes('special offer') || text.includes('lightning deal') || text.includes('deal')) { bonusPointsFinal += 3.5; bonusLines.push({ name: `${L.specOffer} <span style="color:#95a5a6;font-size:9px;">(${L.fix})</span>`, pts: 3.5, max: 3.5 }); }

        // --- ВАГОВА МОДЕЛЬ ---
        let nDisc = isNaN(discountPercent) ? 0 : Math.min(100, Math.max(0, discountPercent));
        let nRat = isNaN(rating) ? 0 : (rating / 5) * 100;
        let nSal = isNaN(sales) ? 0 : Math.min(100, (sales / 5000) * 100);
        let nRev = isNaN(reviews) ? 0 : Math.min(100, (reviews / 1000) * 100);

        let totalWeight = (Number(wDiscount) || 0) + (Number(wRating) || 0) + (Number(wSales) || 0) + (Number(wReviews) || 0);
        if (totalWeight <= 0 || isNaN(totalWeight)) totalWeight = 1;

        let ptsDisc100 = (nDisc * wDiscount) / totalWeight;
        let ptsRat100 = (nRat * wRating) / totalWeight;
        let ptsSal100 = (nSal * wSales) / totalWeight;
        let ptsRev100 = (nRev * wReviews) / totalWeight;

        let maxPtsDiscInt = Math.round(((wDiscount / totalWeight) * 100) * 0.80);
        let maxPtsRatInt = Math.round(((wRating / totalWeight) * 100) * 0.80);
        let maxPtsSalInt = Math.round(((wSales / totalWeight) * 100) * 0.80);
        let maxPtsRevInt = Math.round(((wReviews / totalWeight) * 100) * 0.80);

        let ptsDiscInt = Math.round(ptsDisc100 * 0.80) || 0;
        let ptsRatInt = Math.round(ptsRat100 * 0.80) || 0;
        let ptsSalInt = Math.round(ptsSal100 * 0.80) || 0;
        let ptsRevInt = Math.round(ptsRev100 * 0.80) || 0;

        let baseScoreInt = ptsDiscInt + ptsRatInt + ptsSalInt + ptsRevInt;

        const MAX_BONUS = 20;
        let bonusContributionInt = Math.round(Math.min(bonusPointsFinal, MAX_BONUS));
        let finalScore = baseScoreInt + bonusContributionInt;
        finalScore = Math.min(100, Math.max(0, finalScore));
        let color = getColor(finalScore);

        let bonusHtml = `<div class="tt-div"></div>`;
        if (bonusLines.length > 0) {
            bonusHtml += `<div class="tpw-bonus-legend-wrap">`;
            bonusHtml += `<div class="tpw-bonus-legend">
                <div style="font-weight:700; margin-bottom:6px; color:#333; font-size:11px;">${svgIcon('list', '#333', 12)} ${L.bonusGained} <span style="font-size:9px;color:#999">ⓘ ${L.hover}</span></div>`;
            // Список УСІХ бонусів з позначкою які активні
            const allBonusTypes = [
                { key: 'extraDiscount', label: L.extraDiscount, max: 7, desc: `0.15${L.pts} / 1%` },
                { key: 'bestseller', label: `${L.bestseller} / ${LANG === 'uk' ? 'Топ' : 'Top'}`, max: 13, desc: L.posTimeCoeff },
                { key: 'topRating', label: L.topRating, max: 3.5, desc: L.fix },
                { key: 'starSeller', label: L.starSeller, max: 5, desc: L.fix },
                { key: 'brand', label: L.brand, max: 3.5, desc: L.fix },
                { key: 'localWarehouse', label: L.localWH, max: 3.5, desc: L.fix },
                { key: 'fastDelivery', label: L.fastDel, max: 1.5, desc: L.fix },
                { key: 'specialOffer', label: L.specOffer, max: 3.5, desc: L.fix },
            ];
            const activeNames = bonusLines.map(b => b.name.toLowerCase());
            allBonusTypes.forEach(bt => {
                let isActive = activeNames.some(n => n.includes(bt.label.toLowerCase().substring(0, 6)));
                let activeLine = bonusLines.find(b => b.name.toLowerCase().includes(bt.label.toLowerCase().substring(0, 6)));
                let pts = activeLine ? `+${(Math.round(activeLine.pts * 10) / 10).toFixed(1)}` : '—';
                const checkSvg = isActive
                    ? `<span style="display:inline-flex;align-items:center;vertical-align:middle;margin-right:2px;"><svg width="12" height="12" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="4" fill="#27ae60"/><path d="M7 13l3 3 7-7" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`
                    : `<span style="display:inline-flex;align-items:center;vertical-align:middle;margin-right:2px;"><svg width="12" height="12" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="4" fill="none" stroke="#ccc" stroke-width="2"/></svg></span>`;
                bonusHtml += `<div class="tpw-legend-item ${isActive ? 'active' : 'inactive'}">
                    <span>${checkSvg} ${bt.label} <span style="font-size:9px;color:#999;">(${bt.desc})</span></span>
                    <span>${pts} / ${bt.max}</span>
                </div>`;
            });
            bonusHtml += `</div>`; // close legend popup
            bonusHtml += `<div style="font-size: 11px; font-weight: bold; color: #27ae60; margin-bottom: 6px; cursor: help;">${svgIcon('bonus', '#27ae60')} ${L.bonusGained} <span style="font-size:9px; color:#999;">ⓘ ${L.hover}</span></div>`;
            bonusLines.forEach(b => {
                let displayPts = (Math.round(b.pts * 10) / 10).toFixed(1);
                let displayMax = Number.isInteger(b.max) ? b.max : b.max.toFixed(1);
                bonusHtml += `<div style="display: flex; justify-content: space-between; font-size: 11px; color: #555; margin-bottom: 3px;">
                    <span>• ${b.name}</span>
                    <span style="color: #27ae60; font-weight: bold; white-space: nowrap; margin-left: 10px;">+${displayPts} / ${displayMax}</span>
                </div>`;
            });
            bonusHtml += `</div>`; // close legend-wrap
            let limitTxt = bonusPointsFinal > MAX_BONUS ? `<br><span style="color:#e67e22">(${L.capped} ${MAX_BONUS} ${L.pts}.)</span>` : '';
            let displaySum = (Math.round(bonusPointsFinal * 10) / 10).toFixed(1);
            bonusHtml += `<div style="margin-top: 8px; padding-top: 6px; border-top: 1px dotted #ccc; font-size: 10.5px; color: #7f8c8d; text-align: right; line-height: 1.5;">
                ${L.sumBonus}: <b>${displaySum} ${L.pts}.</b>${limitTxt}<br>
                ${L.roundedFinal}: <b style="color:#27ae60; font-size:12px;">${bonusContributionInt} / 20 ${L.pts}.</b>
            </div>`;
        } else {
            const emptySvg = `<span style="display:inline-flex;align-items:center;vertical-align:middle;margin-right:2px;"><svg width="12" height="12" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="4" fill="none" stroke="#ccc" stroke-width="2"/></svg></span>`;
            bonusHtml += `<div class="tpw-bonus-legend-wrap">`;
            bonusHtml += `<div class="tpw-bonus-legend">
                <div style="font-weight:700; margin-bottom:6px; color:#333; font-size:11px;">${svgIcon('list', '#333', 12)} ${L.bonusPossible}</div>
                <div class="tpw-legend-item inactive"><span>${emptySvg} ${L.extraDiscount}</span><span>${L.upto} 7${L.pts}</span></div>
                <div class="tpw-legend-item inactive"><span>${emptySvg} ${L.bestseller} / ${LANG === 'uk' ? 'Топ' : 'Top'}</span><span>${L.upto} 13${L.pts}</span></div>
                <div class="tpw-legend-item inactive"><span>${emptySvg} ${L.topRating}</span><span>3.5${L.pts}</span></div>
                <div class="tpw-legend-item inactive"><span>${emptySvg} ${L.starSeller}</span><span>5${L.pts}</span></div>
                <div class="tpw-legend-item inactive"><span>${emptySvg} ${L.brand}</span><span>3.5${L.pts}</span></div>
                <div class="tpw-legend-item inactive"><span>${emptySvg} ${L.localWH}</span><span>3.5${L.pts}</span></div>
                <div class="tpw-legend-item inactive"><span>${emptySvg} ${L.fastDel}</span><span>1.5${L.pts}</span></div>
                <div class="tpw-legend-item inactive"><span>${emptySvg} ${L.specOffer}</span><span>3.5${L.pts}</span></div>
            </div>`;
            bonusHtml += `<div style="font-size: 11px; color: #999; text-align: center; font-style: italic; cursor: help;">${L.bonusNone} — 0 / 20 ${L.pts}. <span style="font-size:9px;">ⓘ ${L.hover}</span></div>`;
            bonusHtml += `</div>`; // close legend-wrap
        }

        let titleHtml = title ? `<div style="font-size: 11px; color: #555; margin-bottom: 8px; text-align: center; font-weight: bold;">${title.substring(0, 60)}${title.length > 60 ? '…' : ''}</div>` : '';

        // F1: Tooltip ONLY shows opposite of the site currency 
        let priceHtml = '';
        let rrpStr = '';

        let isNativeUAH = true;
        let globalRawPriceEls = document.querySelectorAll('[data-raw-text]');
        if (globalRawPriceEls.length > 0) {
            let rp = globalRawPriceEls[0].getAttribute('data-raw-text');
            isNativeUAH = rp.includes('₴') || rp.toLowerCase().includes('грн');
        }

        let currentSiteCurrencyIsUSD = (isNativeUAH && isSiteCurrencySwapped) || (!isNativeUAH && !isSiteCurrencySwapped);
        let targetTooltipCurrency = currentSiteCurrencyIsUSD ? 'UAH' : 'USD';

        if (targetTooltipCurrency === 'USD') {
            let tooltipPriceUSD = isUAH ? (price / exchangeRate) : price;
            let tooltipRrpUSD = isUAH ? (rrp / exchangeRate) : rrp;
            priceHtml = `<b style="color:#27ae60; font-size: 16px;">$${tooltipPriceUSD.toFixed(2)}</b>`;
            rrpStr = `$${tooltipRrpUSD.toFixed(2)}`;
        } else {
            let tooltipPriceUAH = isUSD ? (price * exchangeRate) : price;
            let tooltipRrpUAH = isUSD ? (rrp * exchangeRate) : rrp;
            priceHtml = `<b style="color:#27ae60; font-size: 16px;">${Math.round(tooltipPriceUAH).toLocaleString('uk-UA')} ₴</b>`;
            rrpStr = `${Math.round(tooltipRrpUAH).toLocaleString('uk-UA')} ₴`;
        }

        cachedMainProductHtml = `
            ${titleHtml}
            <div style="margin-bottom: 6px;">${createDonutChart(finalScore, ptsDiscInt, ptsRatInt, ptsSalInt, ptsRevInt, bonusContributionInt)}</div>
            <div style="text-align:center; font-size:10px; color:#7f8c8d; margin-bottom: 12px; font-style: italic;">
                ${L.formula}
            </div>

            ${discountPercent > 0 && rrp > 0 ? `<div class="tt-header"><span style="color:#7f8c8d">${L.oldPrice}:</span> <span style="text-decoration:line-through">${rrpStr}</span></div>` : ''}
            <div class="tt-header" style="margin-bottom: 12px; justify-content: center;">
                <span style="color:#27ae60; font-weight: bold; margin-right: 8px;">${L.curPrice}:</span>
                ${priceHtml}
            </div>
            <div class="tt-div"></div>
            <div class="tt-row"><div class="tt-header"><span>${svgIcon('discount', '#e67e22')}${L.discount}: <b>${Math.floor(discountPercent)}%</b></span> <span class="tt-pts" style="color:#e67e22">${ptsDiscInt} / ${maxPtsDiscInt} ${L.pts}.</span></div>${renderMiniBars(ptsDiscInt, maxPtsDiscInt, '#e67e22')}</div>
            <div class="tt-row"><div class="tt-header"><span>${svgIcon('star', '#f39c12')}${L.rating}: <b>${rating.toFixed(1)}</b>/5.0</span> <span class="tt-pts" style="color:#f39c12">${ptsRatInt} / ${maxPtsRatInt} ${L.pts}.</span></div>${renderMiniBars(ptsRatInt, maxPtsRatInt, '#f39c12')}</div>
            <div class="tt-row"><div class="tt-header"><span>${svgIcon('sales', '#e74c3c')}${L.sales}: <b>${sales.toLocaleString('uk-UA')}</b></span> <span class="tt-pts" style="color:#e74c3c">${ptsSalInt} / ${maxPtsSalInt} ${L.pts}.</span></div>${renderMiniBars(ptsSalInt, maxPtsSalInt, '#e74c3c')}</div>
            <div class="tt-row"><div class="tt-header"><span>${svgIcon('reviews', '#3498db')}${L.reviews}: <b>${reviews.toLocaleString('uk-UA')}</b></span> <span class="tt-pts" style="color:#3498db">${ptsRevInt} / ${maxPtsRevInt} ${L.pts}.</span></div>${renderMiniBars(ptsRevInt, maxPtsRevInt, '#3498db')}</div>

            ${bonusHtml}
        `;
    }

    // --- ФУНКЦІЯ ГЛОБАЛЬНОГО ПЕРЕМИКАННЯ ВАЛЮТИ ---
    function applyCurrencySwap() {
        let isNativeUAH = true;
        let pEls = document.querySelectorAll('[data-raw-text]');
        if (pEls.length > 0) {
            let rPt = pEls[0].getAttribute('data-raw-text');
            isNativeUAH = rPt.includes('₴') || rPt.toLowerCase().includes('грн');
        }
        let isUAH = isNativeUAH;
        let isUSD = !isNativeUAH;


        document.querySelectorAll('[data-raw-text]').forEach(el => {
            if (!isSiteCurrencySwapped) {
                if (el.hasAttribute('data-swapped')) {
                    el.innerHTML = el.getAttribute('data-raw-html');
                    el.removeAttribute('data-swapped');
                }
                return;
            }
            if (el.hasAttribute('data-swapped')) return; // Already swapped

            const rawText = el.getAttribute('data-raw-text');
            const isUAH = rawText.includes('₴') || rawText.toLowerCase().includes('грн');
            const isUSD = rawText.includes('$');
            let val = parseFloat(rawText.replace(/[^0-9.,]/g, '').replace(',', '.'));
            if (isNaN(val)) return;

            if (isUAH || isUSD) {
                let convertedVal, html;
                if (isUAH) {
                    // UAH → USD
                    convertedVal = val / exchangeRate;
                    let parts = convertedVal.toFixed(2).split('.');
                    html = `<span style="display:inline-flex; align-items:baseline; font-weight:bold; color:inherit;"><span style="font-size: 0.75em; margin-right: 1px;">$</span><span style="font-size: 1em;">${parts[0]}</span><span style="font-size: 0.75em;">.${parts[1]}</span></span>`;
                } else {
                    // USD → UAH
                    convertedVal = val * exchangeRate;
                    let parts = convertedVal.toFixed(2).split('.');
                    let intPart = parseInt(parts[0], 10).toLocaleString('uk-UA').replace(/,/g, ' ');
                    html = `<span style="display:inline-flex; align-items:baseline; font-weight:bold; color:inherit;"><span style="font-size: 1em;">${intPart}</span><span style="font-size: 0.75em;">.${parts[1]}</span><span style="font-size: 0.75em; margin-left: 2px;">₴</span></span>`;
                }

                // Зберігаємо оригінальний HTML для відновлення
                if (!el.hasAttribute('data-raw-html')) {
                    el.setAttribute('data-raw-html', el.innerHTML);
                }

                // Замінюємо весь вміст на конвертовану ціну зі стилями
                el.innerHTML = html;

                // T3.1 Converted Currency Indicator
                const tooltipText = LANG === 'uk' ? 'Сконвертовано\n(оригінальна валюта прихована)' : 'Converted\n(original currency hidden)';
                el.insertAdjacentHTML('beforeend', `<span class="tpw-currency-swap-icon" title="${tooltipText}" style="display:inline-flex; margin-left:5px; vertical-align:middle; opacity:0.6; cursor:help;">${svgIcon('swap', '#95a5a6', 11)}</span>`);

                el.setAttribute('data-swapped', 'true');
            }
        });
    }

    function processCards(force) {
        if (!isScriptEnabled) {
            removeAllTooltips();
            return;
        }

        // Якщо force=true (зміна ваг/налаштувань), очищаємо всі мітки обробки для перерахунку
        if (force) {
            document.querySelectorAll('[data-processed="true"]').forEach(el => {
                el.removeAttribute('data-processed');
                el.removeAttribute('data-raw-text');
                el.removeAttribute('data-raw-html');
                const bar = el.querySelector(':scope > .tpw-score-container');
                if (bar) bar.remove();
            });
        }

        // Видаляємо сліди старого Tampermonkey скрипта
        document.querySelectorAll('.temu-score-container').forEach(el => el.remove());

        // Оновлюємо дані головного товару (якщо ми на сторінці товару)
        updateMainProductInfo();

        // C3: Авто-показ аналітики товару відразу після завантаження (без потреби hover)
        if (cachedMainProductHtml) {
            sendToIframe({type: 'TPW_HOVER_INFO', html: cachedMainProductHtml});
            try { chrome.runtime.sendMessage({ action: 'hoverInfo', html: cachedMainProductHtml }); } catch (ignore) { }
        }

        const productSelectors = '._3qGJLBpe, ._2gR7cTnt, ._2vD2xV0y, .EKDT7a3v, [data-trace-id], a[href*="/g-"]';
        let products = Array.from(document.querySelectorAll(productSelectors));

        // Другий прохід: евристичний пошук карток у recommended-секціях
        // Оптимізація: мінімізуємо виклики getBoundingClientRect, оскільки вони спричиняють layout thrashing
        document.querySelectorAll('div').forEach(div => {
            if (div.hasAttribute('data-processed')) return;

            // 1. Швидкі перевірки DOM без Layout Calculation
            if (div.children.length === 0) return;

            const imgs = div.querySelectorAll('img');
            if (imgs.length === 0 || imgs.length >= 5) return; // Має бути хоча б одне фото, але не більше 4 (інакше це контейнер-список)

            if (div.closest('#temu-pro-window')) return;
            if (div.closest('[data-processed="true"]')) return;
            if (products.includes(div)) return;

            // 2. Перевірка тексту на наявність ціни ($, ₴, грн) - швидше ніж regex спочатку
            const t = div.textContent;
            if (!t.includes('$') && !t.replaceAll(/\s/g, '').includes('₴') && !t.includes('грн')) return;

            const hasPriceText = /\$\d+[\.,]\d{2}/.test(t) || /\d+[\.,]\d{2}\s*₴/.test(t) || /₴\s*\d+[\.,]\d{2}/.test(t) || /\d+[\.,]\d{2}\s*грн/.test(t);
            if (!hasPriceText) return;

            // 3. Layout перевірка ТІЛЬКИ для тих елементів (їх буде кілька штук), які пройшли всі фільтри вище
            const rect = div.getBoundingClientRect();
            if (rect.width < 100 || rect.width > 400 || rect.height < 150 || rect.height > 800) return;

            products.push(div);
        });

        function removeAllTooltips() {
            document.querySelectorAll('[data-tooltip-html]').forEach(el => {
                el.removeAttribute('data-tooltip-html');
            });
            document.querySelectorAll('[data-processed="true"]').forEach(el => {
                el.removeAttribute('data-processed');
                el.classList.remove('tpw-active-card-highlight', 'tpw-filtered-ghost');
                el.style.display = '';
                delete el.dataset.ghostArmed;
                
                const bar = el.querySelector(':scope > .tpw-score-container');
                if (bar) bar.remove();
            });
            
            // Сховати iframe, якщо відкритий
            const iframe = document.getElementById('tpw-iframe');
            if (iframe) {
                iframe.style.opacity = '0';
                iframe.style.pointerEvents = 'none';
            }

            const disabledHtml = `<div style="text-align:center; padding: 40px 10px; color: #888; font-size: 12px; line-height: 1.5;"><span style="font-size: 20px; display:block; margin-bottom: 6px;">🚫</span>Розширення вимкнено</div>`;
            sendToIframe({type: 'TPW_HOVER_INFO', html: disabledHtml});
            try { chrome.runtime.sendMessage({ action: 'hoverInfo', html: disabledHtml }); } catch (ignore) { }
        }

        products.forEach(product => {
            if (product.hasAttribute('data-processed')) return;
            if (product.closest('[data-processed="true"]')) {
                // Якщо якийсь батьківський елемент вже оброблено, ставимо мітку цьому дочірньому і пропускаємо
                product.setAttribute('data-processed', 'true');
                return;
            }
            try {
                // Заборонити подвійну обробку вкладених карток
                const children = product.querySelectorAll(productSelectors);
                children.forEach(child => child.setAttribute('data-processed', 'true'));

                const parent = product.closest('.EKDT7a3v, ._1WdJJSDo, .splide__slide, ._1c9F-t-E') || product;

                product.setAttribute('data-processed', 'true');

                let cardId = parent.getAttribute('data-tpw-id');
                if (!cardId) {
                    cardId = `rnd-${Math.random().toString(36).substr(2, 6)}`;
                    parent.setAttribute('data-tpw-id', cardId);
                }

                const parseNum = (str) => parseFloat(str.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;

                // --- ЦІНА: Каскадний пошук з fallback ---
                let priceEl = product.querySelector('._2myxWHLi, ._3D8vQd_w, ._3QZ0ZQdo, [aria-label*="ціна"]');
                let rrpEl = product.querySelector('._3TAPHDOX, ._2mE_o3v_');
                const extraSaveEl = product.querySelector('._1LLbpUTn');

                // Fallback: текстовий пошук ціни, якщо CSS-селектори не спрацювали
                if (!priceEl) {
                    const priceContainer = Array.from(product.querySelectorAll('div, span')).find(el => {
                        if (el.children.length > 4) return false;
                        const t = el.textContent.trim();
                        if (t.length > 30) return false;
                        // Шукаємо числа з валютою (₴, $, грн)
                        return (/\d+[.,]\d{2}\s*₴/.test(t) || /₴\s*\d+[.,]\d{2}/.test(t) ||
                                /\$\s*\d+[.,]\d{2}/.test(t) || /\d+[.,]\d{2}\s*грн/.test(t));
                    });
                    if (priceContainer) priceEl = priceContainer;
                }

                // Fallback RRP: шукаємо закреслений текст як стару ціну
                if (!rrpEl) {
                    rrpEl = product.querySelector('span[style*="line-through"], del, s');
                    if (!rrpEl) {
                        const strikeEl = Array.from(product.querySelectorAll('span, div')).find(el => {
                            const s = getComputedStyle(el);
                            return s.textDecoration.includes('line-through') && /\d+[.,]\d{2}/.test(el.textContent);
                        });
                        if (strikeEl) rrpEl = strikeEl;
                    }
                }

                const pEls = [priceEl, rrpEl, extraSaveEl].filter(Boolean);
                pEls.forEach(el => {
                    if (!el.hasAttribute('data-raw-text')) {
                        el.setAttribute('data-raw-html', el.innerHTML);
                        el.setAttribute('data-raw-text', el.textContent);
                    }
                });

                let rawPriceText = priceEl ? priceEl.getAttribute('data-raw-text') : '';
                let price = parseNum(rawPriceText);
                let rrp = rrpEl ? parseNum(rrpEl.getAttribute('data-raw-text')) : 0;
                let extraSave = extraSaveEl ? parseNum(extraSaveEl.getAttribute('data-raw-text')) : 0;

                // Якщо ціна все ще 0, спробуємо витягти з усього тексту картки
                if (price === 0) {
                    const fullText = product.textContent;
                    const priceMatch = fullText.match(/(\d+[.,]\d{2})\s*₴/) || fullText.match(/\$\s*(\d+[.,]\d{2})/) || fullText.match(/(\d+[.,]\d{2})\s*грн/);
                    if (priceMatch) {
                        price = parseFloat(priceMatch[1].replace(',', '.')) || 0;
                        rawPriceText = priceMatch[0];
                    }
                }

                let isUAH = rawPriceText.includes('₴') || rawPriceText.toLowerCase().includes('грн');
                let isUSD = rawPriceText.includes('$');
                let currencySymbol = isUAH ? '₴' : (isUSD ? '$' : '');

                // Якщо валюту не знайдено в rawPriceText, перевіряємо весь текст картки
                if (!isUAH && !isUSD) {
                    const ft = product.textContent;
                    isUAH = ft.includes('₴') || ft.toLowerCase().includes('грн');
                    isUSD = ft.includes('$');
                    currencySymbol = isUAH ? '₴' : (isUSD ? '$' : '');
                }

                // Автоматичне підлаштування лімітів повзунка ціни під валюту сторінки
                if (!pageCurrencyDetected && price > 0) {
                    pageCurrencyDetected = true;
                    // Для гривні ліміт $100 по курсу (заокруглено до 100)
                    let maxUahEquivalent = Math.round((100 * exchangeRate) / 100) * 100; // e.g., 4100
                    let maxLimit = isUAH ? maxUahEquivalent : (isUSD ? 100 : maxUahEquivalent);
                    let stepLimit = isUAH ? 10 : (isUSD ? 1 : 10);

                    if (currentCurrencyMax !== maxLimit || currentCurrencyStep !== stepLimit) {
                        chrome.storage.local.get(['fMaxPrice'], (res) => {
                            let currMax = res.fMaxPrice;
                            let updates = { currentCurrencyMax: maxLimit, currentCurrencyStep: stepLimit };

                            // Якщо поточний максимум дорівнює старому ліміту іншої валюти - оновлюємо і сам фільтр
                            if ([10000, 5000, 1000, 100, currentCurrencyMax].includes(currMax) || !currMax) {
                                updates.fMaxPrice = maxLimit;
                            }
                            chrome.storage.local.set(updates);
                        });
                    }
                }

                const formatPrice = (val) => isUAH ? Math.round(val).toLocaleString('uk-UA') : val.toFixed(2);

                let convertedStr = '';
                if (exchangeRate > 0 && price > 0) {
                    if (isUAH) convertedStr = `(≈ $${(price / exchangeRate).toFixed(2)})`;
                    else if (isUSD) convertedStr = `(≈ ₴${Math.round(price * exchangeRate).toLocaleString('uk-UA')})`;
                }

                let discountPercent = 0;
                if (rrp > 0 && price > 0 && price < rrp) discountPercent = Math.floor(((rrp - (price - extraSave)) / rrp) * 100);

                // --- РЕЙТИНГ ТА ВІДГУКИ (підтримка формату "★ 4.8(334)") ---
                let rating = 0;
                let reviews = 0;

                // Крок 1: шукаємо комбінований формат "★ 4.8(334)" або "4.8(8 255)"
                const combinedRatingEl = Array.from(product.querySelectorAll('span, div, a')).find(el => {
                    if (el.children.length > 2) return false;
                    let t = el.textContent.trim();
                    // Шукаємо патерн: число(число) — наприклад "★ 4.8(334)", "5(1)", "4.7(8 255)"
                    return /[★⭐]?\s*\d\.?\d?\s*\([\d\s.,]+\)/.test(t);
                });

                if (combinedRatingEl) {
                    let t = combinedRatingEl.textContent.trim();
                    // Витягуємо рейтинг: X.X або X перед дужкою
                    let rMatch = t.match(/(\d\.?\d?)\s*\(/);
                    if (rMatch) rating = parseFloat(rMatch[1]) || 0;
                    // Витягуємо відгуки: число в дужках (з пробілами)
                    let revMatch = t.match(/\(([\d\s.,]+)\)/);
                    if (revMatch) reviews = parseInt(revMatch[1].replace(/[\s.,]/g, '')) || 0;
                } else {
                    // Крок 2: окремий пошук рейтингу
                    const exactRatingEl = product.querySelector('._1YSbMhX8, ._2bZfXn9L, [aria-label*="зір"]');
                    const ratingWidthEl = product.querySelector('.WCDudEtm');
                    if (exactRatingEl) {
                        let match = exactRatingEl.textContent.match(/[0-9.,]+/);
                        if (match) rating = parseFloat(match[0].replace(',', '.')) || 0;
                    } else if (ratingWidthEl && ratingWidthEl.style.width) {
                        rating = (parseFloat(ratingWidthEl.style.width) / 100) * 5;
                    }

                    // Крок 3: окремий пошук відгуків
                    const reviewRegex = /\d{1,3}(?:[ .,]\d{3})*|\d+/;
                    const oldReviewsEl = product.querySelector('._3CizNywp') || Array.from(product.querySelectorAll('span, div')).find(e => e.textContent.toLowerCase().includes('відгук'));
                    const newReviewsContainer = product.querySelector('._1tQwi67L, ._2L9-00Q-');

                    if (oldReviewsEl) {
                        let match = oldReviewsEl.textContent.match(reviewRegex);
                        if (match) reviews = parseInt(match[0].replace(/[ .,]/g, ''));
                    } else if (newReviewsContainer) {
                        let match = newReviewsContainer.textContent.match(reviewRegex);
                        if (match) reviews = parseInt(match[0].replace(/[ .,]/g, ''));
                    } else {
                        const fallbackRevEl = Array.from(product.querySelectorAll('*')).find(el => {
                            let t = el.textContent.trim();
                            return el.children.length === 0 && t.length > 0 && t.length < 15 && /^\d{1,3}(?:[ .,]\d{3})*$/.test(t);
                        });
                        if (fallbackRevEl) {
                            reviews = parseInt(fallbackRevEl.textContent.replace(/[ .,]/g, ''));
                        }
                    }
                }

                let sales = 0;
                // Парсимо продажі — ВИКЛЮЧАЄМО елементи з валютою ($, ₴, грн)
                const salesEls = Array.from(product.querySelectorAll('div, span, p')).filter(el => {
                    if (el.children.length > 2) return false;
                    let t = el.textContent.toLowerCase().replace(/\s+/g, '');
                    // Виключаємо ціни, щоб не зловити число з долару
                    if (t.includes('$') || t.includes('₴') || t.includes('грн') || t.includes('ррц')) return false;
                    return (t.includes('продано') || t.includes('sold') || t.includes('продаж')) && !t.includes('найпродаваніший') && t.trim().length < 50 || /^\d+[.,]?\d*[kmтис]+\+?$/.test(t);
                });

                if (salesEls.length > 0) {
                    let sText = salesEls[0].textContent.toLowerCase().replace(/\s+/g, '');
                    let match = sText.match(/[\d.,]+/);
                    if (match) {
                        sales = parseFloat(match[0].replace(',', '.'));
                        if (sText.includes('тис') || sText.includes('k')) sales *= 1000;
                        if (sText.includes('млн') || sText.includes('m')) sales *= 1000000;
                    }
                }

                // --- БОНУСИ (ДИНАМІЧНІ) ПРЯМО В ФІНАЛЬНИХ БАЛАХ (Макс 20) ---
                let allText = product.textContent.toLowerCase();
                let bonusPointsFinal = 0;
                let bonusLines = [];

                if (extraSave > 0 && rrp > 0) {
                    let extraPerc = (extraSave / rrp) * 100;
                    let extraBonus = Math.min(7.0, extraPerc * 0.15); // макс 7 балів
                    if (extraBonus > 0) {
                        bonusPointsFinal += extraBonus;
                        bonusLines.push({ name: `${L.extraDiscount} ${Math.round(extraPerc)}% <span style="color:#95a5a6;font-size:9px;">(0.15${L.pts} / 1%)</span>`, pts: extraBonus, max: 7 });
                    }
                }

                let isBestseller = allText.includes('найпродаваніший') || allText.includes('топ продажів') || allText.includes('найкращі продажі') || allText.includes('best-selling') || allText.includes('best selling') || allText.includes('top selling');
                if (isBestseller) {
                    let rankMatch = allText.match(/#(\d+)/);
                    let rank = rankMatch ? parseInt(rankMatch[1]) : 50;

                    let is6Months = allText.includes('6 міс') || allText.includes('6 month') || allText.includes('last 6');
                    let is14Days = allText.includes('14 дн') || allText.includes('14 day');

                    // База 8.5 балів за Топ-1, мінімум 1.0 бал навіть для #50
                    let rankBasePoints = Math.max(1.0, ((51 - rank) / 50) * 8.5);
                    let timeMulti = is6Months ? 1.5 : (is14Days ? 0.8 : 1.0);
                    let rankBonus = rankBasePoints * timeMulti;

                    bonusPointsFinal += rankBonus;
                    let rankTxt = rankMatch ? `${LANG === 'uk' ? 'Топ' : 'Top'} #${rank}` : `${L.bestseller} (#50)`;
                    let durTxt = is6Months ? ' (6 міс.)' : (is14Days ? ' (14 дн.)' : '');
                    let multiTxt = is6Months ? '×1.5' : (is14Days ? '×0.8' : '×1.0');

                    bonusLines.push({ name: `${rankTxt}${durTxt} <span style="color:#95a5a6;font-size:9px;">(${L.base} ${rankBasePoints.toFixed(1)} ${multiTxt})</span>`, pts: rankBonus, max: 13 });
                }

                if (allText.includes('найвищий рейтинг') || allText.includes('highest rated') || allText.includes('top rated')) { bonusPointsFinal += 3.5; bonusLines.push({ name: `${L.topRating} <span style="color:#95a5a6;font-size:9px;">(${L.fix})</span>`, pts: 3.5, max: 3.5 }); }
                if (allText.includes('зірковий продавець') || allText.includes('star seller')) { bonusPointsFinal += 5.0; bonusLines.push({ name: `${L.starSeller} <span style="color:#95a5a6;font-size:9px;">(${L.fix})</span>`, pts: 5.0, max: 5.0 }); }
                if (allText.includes('бренд') || allText.includes('brand')) { bonusPointsFinal += 3.5; bonusLines.push({ name: `${L.brand} <span style="color:#95a5a6;font-size:9px;">(${L.fix})</span>`, pts: 3.5, max: 3.5 }); }
                if (allText.includes('місцевий склад') || allText.includes('local warehouse')) { bonusPointsFinal += 3.5; bonusLines.push({ name: `${L.localWH} <span style="color:#95a5a6;font-size:9px;">(${L.fix})</span>`, pts: 3.5, max: 3.5 }); }
                else if (allText.includes('швидка доставка') || allText.includes('fast delivery') || allText.includes('express')) { bonusPointsFinal += 1.5; bonusLines.push({ name: `${L.fastDel} <span style="color:#95a5a6;font-size:9px;">(${L.fix})</span>`, pts: 1.5, max: 1.5 }); }
                if (allText.includes('пропозиція') || allText.includes('special offer') || allText.includes('lightning deal')) { bonusPointsFinal += 3.5; bonusLines.push({ name: `${L.specOffer} <span style="color:#95a5a6;font-size:9px;">(${L.fix})</span>`, pts: 3.5, max: 3.5 }); }

                // --- ВІДНОВЛЕНА ВАГОВА МОДЕЛЬ З ІДЕАЛЬНИМ ОКРУГЛЕННЯМ ---
                let nDisc = isNaN(discountPercent) ? 0 : Math.min(100, Math.max(0, discountPercent));
                let nRat = isNaN(rating) ? 0 : (rating / 5) * 100;
                let nSal = isNaN(sales) ? 0 : Math.min(100, (sales / 5000) * 100);
                let nRev = isNaN(reviews) ? 0 : Math.min(100, (reviews / 1000) * 100);

                let totalWeight = (Number(wDiscount) || 0) + (Number(wRating) || 0) + (Number(wSales) || 0) + (Number(wReviews) || 0);
                if (totalWeight <= 0 || isNaN(totalWeight)) totalWeight = 1;

                // Бали у 100-бальній системі
                let ptsDisc100 = (nDisc * wDiscount) / totalWeight;
                let ptsRat100 = (nRat * wRating) / totalWeight;
                let ptsSal100 = (nSal * wSales) / totalWeight;
                let ptsRev100 = (nRev * wReviews) / totalWeight;

                let maxPtsDiscInt = Math.round(((wDiscount / totalWeight) * 100) * 0.80);
                let maxPtsRatInt = Math.round(((wRating / totalWeight) * 100) * 0.80);
                let maxPtsSalInt = Math.round(((wSales / totalWeight) * 100) * 0.80);
                let maxPtsRevInt = Math.round(((wReviews / totalWeight) * 100) * 0.80);

                let ptsDiscInt = Math.round(ptsDisc100 * 0.80) || 0;
                let ptsRatInt = Math.round(ptsRat100 * 0.80) || 0;
                let ptsSalInt = Math.round(ptsSal100 * 0.80) || 0;
                let ptsRevInt = Math.round(ptsRev100 * 0.80) || 0;

                let baseScoreInt = ptsDiscInt + ptsRatInt + ptsSalInt + ptsRevInt;

                // Бонуси (Ліміт чітко 20 балів)
                const MAX_BONUS = 20;
                let bonusContributionInt = Math.round(Math.min(bonusPointsFinal, MAX_BONUS));

                // Фінальний бал (макс 100)
                let finalScore = baseScoreInt + bonusContributionInt;
                finalScore = Math.min(100, Math.max(0, finalScore));
                let color = getColor(finalScore);

                // Фільтрація: використовуємо поточну відображену валюту
                let filterPrice = price;
                let currentSiteCurrencyIsUSD = (isUAH && isSiteCurrencySwapped) || (isUSD && !isSiteCurrencySwapped);
                if (currentSiteCurrencyIsUSD) {
                    filterPrice = isUAH ? (price / exchangeRate) : price;
                } else {
                    filterPrice = isUSD ? (price * exchangeRate) : price;
                }

                if (filtersEnabled) {
                    if (finalScore < fMinScore || discountPercent < fMinDiscount ||
                        rating < fMinRating || reviews < fMinReviews || sales < fMinSales ||
                        filterPrice < fMinPrice || filterPrice > fMaxPrice) {

                        // T3.4: Приховуємо товари, але тротлимо щоб уникнути Error 429
                        // Якщо ми приховали забагато товарів різко (знищили висоту сторінки), нескінченний скролл Temu 
                        // почне надсилати 100+ запитів за секунду, бо вважатиме що юзер докрутив до кінця.
                        if (Date.now() - filterStats.lastReset > 2000) {
                            filterStats.hiddenCount = 0;
                            filterStats.lastReset = Date.now();
                        }

                        if (filterStats.hiddenCount < 30) {
                            parent.style.display = 'none';
                            parent.classList.remove('tpw-filtered-ghost');
                            filterStats.hiddenCount++;
                        } else {
                            // Квота вичерпана - робимо привидів щоб зберегти висоту DOM 
                            parent.style.display = '';
                            parent.classList.add('tpw-filtered-ghost');

                            // Запускаємо відкладене приховування, щоб коли юзер проскролив — вони зникали
                            if (!parent.dataset.ghostArmed) {
                                parent.dataset.ghostArmed = 'true';
                                setTimeout(() => {
                                    if (parent.classList.contains('tpw-filtered-ghost')) {
                                        parent.style.display = 'none';
                                        parent.classList.remove('tpw-filtered-ghost');
                                    }
                                    parent.removeAttribute('data-ghost-armed');
                                }, 3000); // 3 секунди на візуальне проходження блоку
                            }
                        }
                    } else {
                        parent.style.display = '';
                        parent.classList.remove('tpw-filtered-ghost');
                        delete parent.dataset.ghostArmed;
                    }
                } else {
                    parent.style.display = '';
                    parent.classList.remove('tpw-filtered-ghost');
                    delete parent.dataset.ghostArmed;
                }

                // Запобігання подвоюванню: якщо product — це wrapper, і всередині вже є оброблена дочірня картка з баром, пропускаємо
                const nestedProcessedWithBar = product.querySelector('[data-processed="true"] .tpw-score-container');
                if (nestedProcessedWithBar) return; // Пропускаємо цей wrapper — дочірня картка вже має бар

                // Далі, якщо parent вже містить інший товар (попередження 2 балів у 1 списку)
                const siblingWithBar = parent.querySelector(':scope > .tpw-score-container');
                if (siblingWithBar && product !== parent) return; // parent уже отримав бар для іншої картки

                let bar = product.querySelector(':scope > .tpw-score-container');
                if (!bar) { bar = document.createElement('div'); bar.className = 'tpw-score-container'; product.prepend(bar); }
                // Забезпечуємо position:relative для коректного absolute-позиціонування бару
                if (getComputedStyle(product).position === 'static') product.style.position = 'relative';

                let pillsHtml = '';
                for (let i = 1; i <= 10; i++) {
                    let threshold = i * 10, fillWidth = 0;
                    if (finalScore >= threshold) fillWidth = 100;
                    else if (finalScore > threshold - 10) fillWidth = Math.max(0, (finalScore % 10) * 10);
                    pillsHtml += `<div class="tpw-pill"><div class="tpw-pill-fill" style="width: ${isNaN(fillWidth) ? 0 : fillWidth}%; background: ${color};"></div></div>`;
                }
                let displayScore = isNaN(finalScore) ? 0 : finalScore;
                bar.innerHTML = `<div class="tpw-pills-wrapper">${pillsHtml}</div><div class="tpw-score-number" style="color: ${color}">${displayScore}</div>`;

                // Додаємо обробник кліку для розгортання панелі (як просив користувач - "панель має появлятися при натисканні на барі")
                bar.style.pointerEvents = 'auto'; // Відновлюємо події миші для бару, хоча він був pointer-events: none раніше
                bar.style.cursor = 'pointer';
                bar.onclick = function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (isPanelCollapsed) {
                        isPanelCollapsed = false;
                        chrome.storage.local.set({ isPanelCollapsed: false });
                    }
                };

                // ВІДОБРАЖЕННЯ БОНУСІВ БЕЗ КОНВЕРТАЦІЇ (НАПРЯМУ В БАЛАХ)
                let bonusHtml = `<div class="tt-div"></div>`;
                if (bonusLines.length > 0) {
                    bonusHtml += `<div style="font-size: 11px; font-weight: bold; color: #27ae60; margin-bottom: 6px;">${svgIcon('bonus', '#27ae60')} ${L.bonusGained}</div>`;

                    bonusLines.forEach(b => {
                        let displayPts = (Math.round(b.pts * 10) / 10).toFixed(1);
                        let displayMax = Number.isInteger(b.max) ? b.max : b.max.toFixed(1);

                        bonusHtml += `<div style="display: flex; justify-content: space-between; font-size: 11px; color: #555; margin-bottom: 3px;">
                            <span>• ${b.name}</span>
                            <span style="color: #27ae60; font-weight: bold; white-space: nowrap; margin-left: 10px;">+${displayPts} / ${displayMax}</span>
                        </div>`;
                    });

                    let limitTxt = bonusPointsFinal > MAX_BONUS ? `<br><span style="color:#e67e22">(${L.capped} ${MAX_BONUS} ${L.pts}.)</span>` : '';
                    let displaySum = (Math.round(bonusPointsFinal * 10) / 10).toFixed(1);

                    bonusHtml += `<div style="margin-top: 8px; padding-top: 6px; border-top: 1px dotted #ccc; font-size: 10.5px; color: #7f8c8d; text-align: right; line-height: 1.5;">
                        ${L.sumBonus}: <b>${displaySum} ${L.pts}.</b>${limitTxt}<br>
                        ${L.roundedFinal}: <b style="color:#27ae60; font-size:12px;">${bonusContributionInt} / 20 ${L.pts}.</b>
                    </div>`;
                } else {
                    bonusHtml += `<div style="font-size: 11px; color: #999; text-align: center; font-style: italic;">${L.bonusNone} — 0 / 20 ${L.pts}.</div>`;
                }

                currentSiteCurrencyIsUSD = (isUAH && isSiteCurrencySwapped) || (isUSD && !isSiteCurrencySwapped);
                let targetTooltipCurrency = currentSiteCurrencyIsUSD ? 'UAH' : 'USD';
                let priceHtml = '';
                let rrpStr = '';

                if (targetTooltipCurrency === 'USD') {
                    let tooltipPriceUSD = isUAH ? (price / exchangeRate) : price;
                    let tooltipRrpUSD = isUAH ? (rrp / exchangeRate) : rrp;
                    priceHtml = `<b style="color:#27ae60; font-size: 16px;">$${tooltipPriceUSD.toFixed(2)}</b>`;
                    rrpStr = `$${tooltipRrpUSD.toFixed(2)}`;
                } else {
                    let tooltipPriceUAH = isUSD ? (price * exchangeRate) : price;
                    let tooltipRrpUAH = isUSD ? (rrp * exchangeRate) : rrp;
                    priceHtml = `<b style="color:#27ae60; font-size: 16px;">${Math.round(tooltipPriceUAH).toLocaleString('uk-UA')} ₴</b>`;
                    rrpStr = `${Math.round(tooltipRrpUAH).toLocaleString('uk-UA')} ₴`;
                }

                parent.setAttribute('data-tooltip-html', `
                    <div style="margin-bottom: 6px;">${createDonutChart(finalScore, ptsDiscInt, ptsRatInt, ptsSalInt, ptsRevInt, bonusContributionInt)}</div>
                    <div style="text-align:center; font-size:10px; color:#7f8c8d; margin-bottom: 12px; font-style: italic;">
                        (${L.base}: ${baseScoreInt} / 80 ${L.pts}. + ${L.bonuses}: ${bonusContributionInt} / 20 ${L.pts}.)
                    </div>

                    ${discountPercent > 0 && rrp > 0 ? `<div class="tt-header"><span style="color:#7f8c8d">${L.oldPrice}:</span> <span style="text-decoration:line-through">${rrpStr}</span></div>` : ''}
                    <div class="tt-header" style="margin-bottom: 12px; justify-content: center;">
                        <span style="color:#27ae60; font-weight: bold; margin-right: 8px;">${L.curPrice}:</span>
                        ${priceHtml}
                    </div>
                    <div class="tt-div"></div>

                    <div class="tt-row"><div class="tt-header"><span>${svgIcon('discount', '#9b59b6')}${L.discount}: <b>${Math.floor(discountPercent)}%</b></span> <span class="tt-pts" style="color:#9b59b6">${ptsDiscInt} / ${maxPtsDiscInt} ${L.pts}.</span></div>${renderMiniBars(ptsDiscInt, maxPtsDiscInt, '#9b59b6')}</div>
                    <div class="tt-row"><div class="tt-header"><span>${svgIcon('star', '#f1c40f')}${L.rating}: <b>${rating.toFixed(1)}</b>/5.0</span> <span class="tt-pts" style="color:#f1c40f">${ptsRatInt} / ${maxPtsRatInt} ${L.pts}.</span></div>${renderMiniBars(ptsRatInt, maxPtsRatInt, '#f1c40f')}</div>
                    <div class="tt-row"><div class="tt-header"><span>${svgIcon('sales', '#e74c3c')}${L.sales}: <b>${sales.toLocaleString('uk-UA')}+</b></span> <span class="tt-pts" style="color:#e74c3c">${ptsSalInt} / ${maxPtsSalInt} ${L.pts}.</span></div>${renderMiniBars(ptsSalInt, maxPtsSalInt, '#e74c3c')}</div>
                    <div class="tt-row"><div class="tt-header"><span>${svgIcon('reviews', '#3498db')}${L.reviews}: <b>${reviews.toLocaleString('uk-UA')}</b></span> <span class="tt-pts" style="color:#3498db">${ptsRevInt} / ${maxPtsRevInt} ${L.pts}.</span></div>${renderMiniBars(ptsRevInt, maxPtsRevInt, '#3498db')}</div>

                    ${bonusHtml}
                `);

            } catch (err) { console.error("Помилка обробки:", err); }
        });

        // Після обробки всіх карток викликаємо свап валюти
        applyCurrencySwap();

        // Відновлюємо підсвітку картки та оновлюємо панель для активного товару
        if (_lastHoveredCardId) {
            document.querySelectorAll(`[data-tpw-id="${_lastHoveredCardId}"]`).forEach(el => {
                el.classList.add('tpw-active-card-highlight');
                _lastCardEl = el;
                // Оновлюємо інформацію в панелі, оскільки HTML міг змінитися через ваги
                const html = el.getAttribute('data-tooltip-html');
                if (html) {
                    lastHoveredHtml = html;
                    if (isScriptEnabled) {
                        sendToIframe({type: 'TPW_HOVER_INFO', html: html});
                    }
                    try { chrome.runtime.sendMessage({ action: 'hoverInfo', html: html }); } catch (ignore) { }
                }
            });
        }
    }

    chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
        if (req.action === 'previewWeights') {
            wDiscount = req.weights.wDiscount;
            wRating = req.weights.wRating;
            wSales = req.weights.wSales;
            wReviews = req.weights.wReviews;
            processCards(true); // force recalculate
        }
    });

    // Оновлення параметрів із sidepanel.js
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace !== 'local') return;
        
        let needsUpdate = false;
        
        const updateVar = (key, callback) => {
            if (changes[key] !== undefined) {
                callback(changes[key].newValue);
                needsUpdate = true;
            }
        };

        updateVar('isScriptEnabled', v => isScriptEnabled = v);
        updateVar('isPanelCollapsed', v => isPanelCollapsed = v);
        updateVar('filtersEnabled', v => filtersEnabled = v);
        updateVar('fMinScore', v => fMinScore = v);
        updateVar('fMinDiscount', v => fMinDiscount = v);
        updateVar('fMinRating', v => fMinRating = v);
        updateVar('fMinSales', v => fMinSales = v);
        updateVar('fMinReviews', v => fMinReviews = v);
        updateVar('fMinPrice', v => fMinPrice = v);
        updateVar('fMaxPrice', v => fMaxPrice = v);
        updateVar('wDiscount', v => wDiscount = v);
        updateVar('wRating', v => wRating = v);
        updateVar('wSales', v => wSales = v);
        updateVar('wReviews', v => wReviews = v);
        updateVar('isSiteCurrencySwapped', v => isSiteCurrencySwapped = v);

        // Якщо виключили скрипт - прибираємо тултіпи
        if (changes.isScriptEnabled && !changes.isScriptEnabled.newValue) {
            removeAllTooltips();
            return;
        }

        if (needsUpdate && isScriptEnabled) {
            processCards(true);
        }
    });

    let _bootStarted = false;
    let booted = false;
    function boot() {
        if (_bootStarted) return;
        _bootStarted = true;
        injectStyles();

        const f2Style = document.createElement('style');
        f2Style.innerHTML = `
            .tpw-active-card-highlight {
                outline: 2px solid #ff9500 !important;
                outline-offset: -2px !important;
            }
            .tpw-active-card-highlight .tpw-score-container {
                top: 2px !important;
                left: 2px !important;
                width: calc(100% - 4px) !important;
                border-radius: 0 0 6px 6px !important;
            }
        `;
        document.head.appendChild(f2Style);

        loadSettings(() => {
            createMainWindow();
            booted = true; // Тільки після створення вікна починаємо слухати isSidePanelOpen

            // Wrap number inputs with click-to-edit pencil icon
            (function wrapNumInputsWithPencil() {
                const panel = document.getElementById('temu-pro-window');
                if (!panel) return;
                const pencilSvg = '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>';
                panel.querySelectorAll('.st-num-input').forEach(input => {
                    if (input.parentElement.classList.contains('st-num-editable')) return;

                    const wrapper = document.createElement('div');
                    wrapper.className = 'st-num-editable';

                    const display = document.createElement('span');
                    display.className = 'st-num-display';
                    display.textContent = input.value;

                    const pencil = document.createElement('span');
                    pencil.className = 'st-num-pencil';
                    pencil.innerHTML = pencilSvg;

                    input.parentNode.insertBefore(wrapper, input);
                    wrapper.appendChild(display);
                    wrapper.appendChild(pencil);
                    wrapper.appendChild(input);

                    // Click to edit
                    wrapper.addEventListener('click', (e) => {
                        if (wrapper.classList.contains('editing')) return;
                        wrapper.classList.add('editing');
                        input.focus();
                        input.select();
                    });

                    // Update display on input change
                    input.addEventListener('input', () => {
                        display.textContent = input.value;
                    });

                    // Exit edit mode on blur
                    input.addEventListener('blur', () => {
                        wrapper.classList.remove('editing');
                        display.textContent = input.value;
                    });

                    // Exit edit mode on Enter
                    input.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            input.blur();
                        }
                    });
                });
            })();

            // BUILD_TIME визначено як константу, fetch не потрібен (MV3 CSP обмеження)

            // Перевіряємо чи Side Panel вже відкритий (взаємовиключність)
            try {
                chrome.runtime.sendMessage({ action: 'pingSidePanel' }, (response) => {
                    if (chrome.runtime.lastError) {
                        // Side Panel не відкритий. Якщо storage каже що відкритий — виправляємо баг синхронізації
                        if (isSidePanelOpen) {
                            isSidePanelOpen = false;
                            chrome.storage.local.set({ isSidePanelOpen: false });
                            const panel = document.getElementById('temu-pro-window');
                            if (panel) panel.style.display = 'flex';
                        }
                        return;
                    }
                    if (response && response.alive) {
                        // Side Panel відкритий — ховаємо плаваюче вікно
                        isSidePanelOpen = true;
                        const panel = document.getElementById('temu-pro-window');
                        if (panel) panel.style.display = 'none';
                    }
                });
            } catch (ignore) {
                // Ігноруємо помилки
            }

            setInterval(processCards, 800);

            // T3.4: MutationObserver для динамічно завантажених товарів (infinite scroll)
            const mutationOb = new MutationObserver((mutations) => {
                if (!isSiteCurrencySwapped) return;
                let hasNewNodes = false;
                for (const m of mutations) {
                    if (m.addedNodes.length > 0) { hasNewNodes = true; break; }
                }
                if (hasNewNodes) {
                    setTimeout(() => applyCurrencySwap(), 500);
                }
            });
            mutationOb.observe(document.body, { childList: true, subtree: true });
        });
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        boot();
    } else {
        window.addEventListener('load', boot, { once: true });
    }
})();
