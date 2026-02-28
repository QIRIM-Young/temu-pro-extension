// sidepanel.js — Логіка бічної панелі Temu Pro

(function () {
    'use strict';

    const defaultSettings = {
        isScriptEnabled: true,
        isPanelCollapsed: false,
        panelMode: 'sidepanel', // 'sidepanel' або 'floating'
        filtersEnabled: false,
        fMinScore: 0, fMinDiscount: 0, fMinRating: 4.0,
        fMinSales: 100, fMinReviews: 10,
        fMinPrice: 0, fMaxPrice: 5000,
        wDiscount: 25, wRating: 25, wSales: 25, wReviews: 25,
        exchangeRate: 41.0, lastRateFetch: 0
    };

    let settings = {};

    // --- Ініціалізація ---
    async function init() {
        settings = await chrome.storage.local.get(defaultSettings);
        applySettingsToUI();
        bindEvents();
        listenForProductData();
    }

    function applySettingsToUI() {
        document.getElementById('cb-main').checked = settings.isScriptEnabled;
        document.getElementById('cb-filters').checked = settings.filtersEnabled;

        // Фільтри
        setSlider('fs-score', 'fv-score', settings.fMinScore);
        setSlider('fs-disc', 'fv-disc', settings.fMinDiscount, '%');
        setSlider('fs-rat', 'fv-rat', settings.fMinRating);
        setSlider('fs-rev', 'fv-rev', settings.fMinReviews);
        setSlider('fs-sal', 'fv-sal', settings.fMinSales);

        // Ваги
        setWeight('ws-disc', 'wv-disc', 'wb-disc', settings.wDiscount);
        setWeight('ws-rat', 'wv-rat', 'wb-rat', settings.wRating);
        setWeight('ws-sal', 'wv-sal', 'wb-sal', settings.wSales);
        setWeight('ws-rev', 'wv-rev', 'wb-rev', settings.wReviews);

        // Курс
        document.getElementById('exchange-rate').textContent = `1$ ≈ ${Math.round(settings.exchangeRate)}₴`;
    }

    function setSlider(sliderId, valId, value, suffix = '') {
        const s = document.getElementById(sliderId);
        const v = document.getElementById(valId);
        if (s) s.value = value;
        if (v) v.textContent = value + suffix;
    }

    function setWeight(sliderId, valId, barId, value) {
        const s = document.getElementById(sliderId);
        const v = document.getElementById(valId);
        const b = document.getElementById(barId);
        if (s) s.value = value;
        if (v) v.textContent = value;
        if (b) b.style.width = value + '%';
    }

    // --- Прив'язка подій ---
    function bindEvents() {
        // Головний перемикач
        document.getElementById('cb-main').addEventListener('change', (e) => {
            settings.isScriptEnabled = e.target.checked;
            saveAndNotify();
        });

        // Фільтри
        document.getElementById('cb-filters').addEventListener('change', (e) => {
            settings.filtersEnabled = e.target.checked;
            saveAndNotify();
        });

        // Слайдери фільтрів
        bindSlider('fs-score', 'fv-score', 'fMinScore');
        bindSlider('fs-disc', 'fv-disc', 'fMinDiscount', '%');
        bindSlider('fs-rat', 'fv-rat', 'fMinRating');
        bindSlider('fs-rev', 'fv-rev', 'fMinReviews');
        bindSlider('fs-sal', 'fv-sal', 'fMinSales');

        // Слайдери ваг
        bindWeight('ws-disc', 'wv-disc', 'wb-disc', 'wDiscount');
        bindWeight('ws-rat', 'wv-rat', 'wb-rat', 'wRating');
        bindWeight('ws-sal', 'wv-sal', 'wb-sal', 'wSales');
        bindWeight('ws-rev', 'wv-rev', 'wb-rev', 'wReviews');

        // Кнопка перемикання режиму
        document.getElementById('btn-toggle-mode').addEventListener('click', () => {
            settings.panelMode = settings.panelMode === 'sidepanel' ? 'floating' : 'sidepanel';
            saveAndNotify();
            // Повідомити content script
            chrome.runtime.sendMessage({ action: 'togglePanelMode', mode: settings.panelMode });
        });
    }

    function bindSlider(sliderId, valId, settingKey, suffix = '') {
        const s = document.getElementById(sliderId);
        if (!s) return;
        s.addEventListener('input', () => {
            const v = document.getElementById(valId);
            settings[settingKey] = parseFloat(s.value);
            if (v) v.textContent = s.value + suffix;
            saveAndNotify();
        });
    }

    function bindWeight(sliderId, valId, barId, settingKey) {
        const s = document.getElementById(sliderId);
        if (!s) return;
        s.addEventListener('input', () => {
            const v = document.getElementById(valId);
            const b = document.getElementById(barId);
            settings[settingKey] = parseFloat(s.value);
            if (v) v.textContent = s.value;
            if (b) b.style.width = s.value + '%';
            saveAndNotify();
        });
    }

    // --- Спілкування з content script ---
    function saveAndNotify() {
        chrome.storage.local.set(settings);
        // Надіслати повідомлення content script щоб перерахувати
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'settingsChanged', settings });
            }
        });
    }

    function listenForProductData() {
        // Отримувати дані товару від content script при наведенні
        chrome.runtime.onMessage.addListener((msg) => {
            if (msg.action === 'productHover' && msg.html) {
                const infoEl = document.getElementById('product-info');
                if (infoEl) infoEl.innerHTML = msg.html;
            }
            if (msg.action === 'statsUpdate') {
                document.getElementById('stat-processed').textContent = msg.processed || 0;
                document.getElementById('stat-avg-score').textContent = msg.avgScore || '—';
            }
        });
    }

    init();
})();
