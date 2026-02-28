(async function () {
    'use strict';

    // --- НАЛАШТУВАННЯ ТА КЕШ ---
    const defaultSettings = {
        isScriptEnabled: true,
        isPanelCollapsed: false,
        filtersEnabled: false,
        fMinScore: 0, fMinDiscount: 0, fMinRating: 4.0,
        fMinSales: 100, fMinReviews: 10,
        fMinPrice: 0, fMaxPrice: 5000,
        wDiscount: 25, wRating: 25, wSales: 25, wReviews: 25,
        exchangeRate: 41.0, lastRateFetch: 0
    };

    let settings = await chrome.storage.local.get(defaultSettings);

    function updateSetting(key, value) {
        settings[key] = value;
        chrome.storage.local.set({ [key]: value });
    }

    // --- ОНОВЛЕННЯ КУРСУ ВАЛЮТ (API) ---
    async function fetchExchangeRate() {
        const now = Date.now();
        if (now - settings.lastRateFetch < 12 * 60 * 60 * 1000 && settings.exchangeRate > 0) return;
        try {
            const resp = await fetch('https://open.er-api.com/v6/latest/USD');
            const data = await resp.json();
            if (data && data.rates && data.rates.UAH) {
                updateSetting('exchangeRate', data.rates.UAH);
                updateSetting('lastRateFetch', now);
            }
        } catch (e) { console.warn('[Temu Pro] Курс валют: помилка мережі, використовую кеш', settings.exchangeRate); }
    }
    fetchExchangeRate();

    // --- CSS СТИЛІ ---
    function addStyle(css) {
        const style = document.createElement('style');
        style.textContent = css;
        document.head.append(style);
    }

    addStyle(`
        /* === АВТО ТЕМА (light / dark) === */
        :root {
            --tpw-bg: #fff; --tpw-text: #222; --tpw-header-bg: #f8f9fa;
            --tpw-border: #ddd; --tpw-tabs-bg: #f1f2f6; --tpw-tab-text: #7f8fa6;
            --tpw-tab-active: #0097e6; --tpw-section-bg: #f9f9f9; --tpw-section-border: #eaeaea;
            --tpw-label: #333; --tpw-subtle: #777; --tpw-score-bg: rgba(255,255,255,0.95);
            --tpw-bar-bg: #dfe6e9; --tpw-input-bg: #fff; --tpw-input-border: #ccc;
        }
        @media (prefers-color-scheme: dark) {
            :root {
                --tpw-bg: #1a1a2e; --tpw-text: #e0e0e0; --tpw-header-bg: #16213e;
                --tpw-border: #2a2a4a; --tpw-tabs-bg: #0f0f1a; --tpw-tab-text: #888;
                --tpw-tab-active: #ff6b00; --tpw-section-bg: rgba(255,255,255,0.04); --tpw-section-border: rgba(255,255,255,0.08);
                --tpw-label: #ccc; --tpw-subtle: #888; --tpw-score-bg: rgba(15,15,26,0.92);
                --tpw-bar-bg: rgba(255,255,255,0.15); --tpw-input-bg: #222; --tpw-input-border: #444;
            }
        }

        /* Панель 10 капсул на товарі */
        .temu-score-container {
            position: absolute; top: 0; left: 0; width: 100%; height: 20px;
            background: var(--tpw-score-bg); z-index: 50; border-radius: 8px 8px 0 0;
            display: flex; align-items: center; justify-content: space-between;
            padding: 0 6px; box-sizing: border-box; pointer-events: none;
        }
        .temu-pills-wrapper { display: flex; gap: 3px; flex: 1; margin-right: 8px; }
        .temu-pill { height: 6px; flex: 1; border-radius: 10px; background: var(--tpw-bar-bg); overflow: hidden; position: relative; }
        .temu-pill-fill { height: 100%; position: absolute; left: 0; top: 0; transition: width 0.3s ease; }
        .temu-score-number { font-size: 12px; font-weight: 900; }

        [data-temu-card="true"] { position: relative; padding-top: 22px !important; }

        /* Єдине вікно (Панель) */
        #temu-pro-window {
            position: fixed; background: var(--tpw-bg); border: 1px solid var(--tpw-border);
            border-radius: 10px; z-index: 9999999; box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            font-family: sans-serif; width: 340px; color: var(--tpw-text); display: flex; flex-direction: column;
        }
        #tpw-header {
            cursor: move; font-weight: bold; font-size: 13px; padding: 10px 15px;
            background: var(--tpw-header-bg); border-radius: 10px 10px 0 0; border-bottom: 1px solid var(--tpw-border);
            display: flex; justify-content: space-between; align-items: center; user-select: none;
        }
        #tpw-tabs { display: flex; background: var(--tpw-tabs-bg); border-bottom: 1px solid var(--tpw-border); }
        #tpw-tabs.collapsed { display: none; }
        .tpw-tab {
            flex: 1; text-align: center; padding: 10px 0; font-size: 12px; font-weight: bold;
            color: var(--tpw-tab-text); cursor: pointer; border-bottom: 3px solid transparent; transition: 0.2s;
        }
        .tpw-tab:hover { opacity: 0.8; }
        .tpw-tab.active { color: var(--tpw-tab-active); border-bottom-color: var(--tpw-tab-active); background: var(--tpw-bg); }

        #tpw-body { overflow: hidden; }
        #tpw-body.collapsed { display: none; }
        .tpw-content { display: none; padding: 15px; max-height: 70vh; overflow-y: auto; background: var(--tpw-bg); }
        .tpw-content.active { display: block; }

        /* Стилі для контенту Аналітики */
        .tt-row { margin-bottom: 8px; }
        .tt-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px; font-size: 12px;}
        .tt-pts { color: #d35400; font-weight: bold; font-size: 11px; }
        .tt-bars { display: flex; gap: 2px; height: 5px; }
        .tt-bar { flex: 1; background: var(--tpw-bar-bg); border-radius: 2px; }
        .tt-bar.filled { background: #3498db; }
        .tt-div { border-top: 1px dashed var(--tpw-border); margin: 10px 0; }
        .tt-bonus { color: #27ae60; font-size: 11px; text-align: right; font-weight: bold; margin-bottom: 2px;}

        /* Стилі для Налаштувань */
        .st-section { background: var(--tpw-section-bg); border-radius: 6px; padding: 10px; margin-bottom: 10px; border: 1px solid var(--tpw-section-border); }
        .st-title { font-size: 11px; font-weight: bold; color: var(--tpw-subtle); margin-bottom: 10px; text-transform: uppercase; display: flex; justify-content: space-between; align-items: center;}
        .st-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; gap: 8px; }
        .st-label { width: 95px; font-size: 11px; flex-shrink: 0; color: var(--tpw-label); }
        .st-row input[type="range"].single-range { flex: 1; min-width: 80px; cursor: pointer; }
        .st-num-input { width: 45px; padding: 3px; font-size: 11px; border: 1px solid var(--tpw-input-border); border-radius: 4px; text-align: center; background: var(--tpw-input-bg); color: var(--tpw-text); }

        /* Подвійний слайдер */
        .dual-slider-container { position: relative; flex: 1; height: 20px; margin: 0 10px; }
        .dual-slider-container input[type="range"] { position: absolute; left: 0; top: 0; width: 100%; pointer-events: none; -webkit-appearance: none; appearance: none; background: transparent; height: 4px; margin-top: 8px; }
        .dual-slider-container input[type="range"]::-webkit-slider-thumb { pointer-events: auto; -webkit-appearance: none; appearance: none; width: 14px; height: 14px; background: #0b7bff; border-radius: 50%; cursor: pointer; }
        .dual-slider-track { position: absolute; top: 8px; left: 0; width: 100%; height: 4px; background: var(--tpw-bar-bg); border-radius: 2px; z-index: -1; }
    `);

    // --- СТВОРЕННЯ ЄДИНОГО ВІКНА ---
    function createMainWindow() {
        if (document.getElementById('temu-pro-window')) return;
        const panel = document.createElement('div');
        panel.id = 'temu-pro-window';
        panel.style.top = '20px';
        panel.style.right = '20px';

        panel.innerHTML = `
            <div id="tpw-header">
                <span>🛒 Temu Pro v14</span>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <label style="font-size:11px; cursor:pointer;"><input type="checkbox" id="cb-main-toggle" ${settings.isScriptEnabled ? 'checked' : ''}> Увімк.</label>
                    <button id="btn-collapse" style="cursor:pointer; border:none; border-radius:4px; padding:2px 6px; background:var(--tpw-tabs-bg); color:var(--tpw-text);">${settings.isPanelCollapsed ? '+' : '—'}</button>
                </div>
            </div>

            <div id="tpw-tabs" class="${settings.isPanelCollapsed ? 'collapsed' : ''}">
                <div class="tpw-tab active" data-tab="info">📊 Аналітика</div>
                <div class="tpw-tab" data-tab="settings">⚙️ Налаштування</div>
            </div>

            <div id="tpw-body" class="${settings.isPanelCollapsed ? 'collapsed' : ''}">
                <!-- Вкладка: Аналітика -->
                <div id="tpw-info" class="tpw-content active">
                    <div style="text-align:center; padding: 40px 10px; color: var(--tpw-subtle); font-size: 12px; line-height: 1.5;">
                        <span style="font-size: 24px; display:block; margin-bottom: 10px;">🔍</span>
                        Наведіть курсор на будь-який товар,<br>щоб побачити його розгорнуту оцінку
                    </div>
                </div>

                <!-- Вкладка: Налаштування -->
                <div id="tpw-settings" class="tpw-content">
                    <div class="st-section">
                        <div class="st-title">
                            <span>🛑 Фільтри (Приховувати)</span>
                            <label style="cursor:pointer; color:#0b7bff;"><input type="checkbox" id="cb-filters" ${settings.filtersEnabled ? 'checked' : ''}> Активні</label>
                        </div>
                        <div style="font-size: 11px; color: var(--tpw-label); margin-bottom: 4px;">Діапазон ціни (Min - Max):</div>
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                            <input type="number" id="f-min-price" class="st-num-input" value="${settings.fMinPrice}">
                            <div class="dual-slider-container">
                                <div class="dual-slider-track"></div>
                                <input type="range" id="fs-pmin" min="0" max="10000" step="10" value="${settings.fMinPrice}">
                                <input type="range" id="fs-pmax" min="0" max="10000" step="10" value="${settings.fMaxPrice}">
                            </div>
                            <input type="number" id="f-max-price" class="st-num-input" value="${settings.fMaxPrice}">
                        </div>
                        <div class="st-row"><span class="st-label">Мін. Балів:</span> <input type="range" id="fs-score" class="single-range" min="0" max="100" value="${settings.fMinScore}"> <input type="number" id="fn-score" class="st-num-input" value="${settings.fMinScore}"></div>
                        <div class="st-row"><span class="st-label">Мін. Знижка %:</span> <input type="range" id="fs-disc" class="single-range" min="0" max="90" step="5" value="${settings.fMinDiscount}"> <input type="number" id="fn-disc" class="st-num-input" value="${settings.fMinDiscount}"></div>
                        <div class="st-row"><span class="st-label">Мін. Рейтинг:</span> <input type="range" id="fs-rat" class="single-range" min="0" max="5" step="0.1" value="${settings.fMinRating}"> <input type="number" id="fn-rat" class="st-num-input" step="0.1" value="${settings.fMinRating}"></div>
                        <div class="st-row"><span class="st-label">Мін. Відгуків:</span> <input type="range" id="fs-rev" class="single-range" min="0" max="500" step="10" value="${settings.fMinReviews}"> <input type="number" id="fn-rev" class="st-num-input" value="${settings.fMinReviews}"></div>
                        <div class="st-row"><span class="st-label">Мін. Продажів:</span> <input type="range" id="fs-sal" class="single-range" min="0" max="10000" step="100" value="${settings.fMinSales}"> <input type="number" id="fn-sal" class="st-num-input" value="${settings.fMinSales}"></div>
                    </div>

                    <div class="st-section">
                        <div class="st-title">⚖️ Вага в алгоритмі (%)</div>
                        <div class="st-row"><span class="st-label">Знижка:</span> <input type="range" id="ws-disc" class="single-range" min="0" max="100" value="${settings.wDiscount}"> <input type="number" id="wn-disc" class="st-num-input" value="${settings.wDiscount}"></div>
                        <div class="st-row"><span class="st-label">Рейтинг:</span> <input type="range" id="ws-rat" class="single-range" min="0" max="100" value="${settings.wRating}"> <input type="number" id="wn-rat" class="st-num-input" value="${settings.wRating}"></div>
                        <div class="st-row"><span class="st-label">Продажі:</span> <input type="range" id="ws-sal" class="single-range" min="0" max="100" value="${settings.wSales}"> <input type="number" id="wn-sal" class="st-num-input" value="${settings.wSales}"></div>
                        <div class="st-row"><span class="st-label">Відгуки:</span> <input type="range" id="ws-rev" class="single-range" min="0" max="100" value="${settings.wReviews}"> <input type="number" id="wn-rev" class="st-num-input" value="${settings.wReviews}"></div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(panel);

        // Перемикання вкладок
        document.querySelectorAll('.tpw-tab').forEach(t => {
            t.addEventListener('click', () => {
                document.querySelectorAll('.tpw-tab').forEach(x => x.classList.remove('active'));
                document.querySelectorAll('.tpw-content').forEach(x => x.classList.remove('active'));
                t.classList.add('active');
                document.getElementById('tpw-' + t.dataset.tab).classList.add('active');
            });
        });

        const tabsEl = document.getElementById('tpw-tabs');
        const bodyEl = document.getElementById('tpw-body');

        document.getElementById('btn-collapse').addEventListener('click', (e) => {
            settings.isPanelCollapsed = !settings.isPanelCollapsed;
            updateSetting('isPanelCollapsed', settings.isPanelCollapsed);
            tabsEl.classList.toggle('collapsed', settings.isPanelCollapsed);
            bodyEl.classList.toggle('collapsed', settings.isPanelCollapsed);
            e.target.innerText = settings.isPanelCollapsed ? '+' : '—';
        });

        // Подвійний слайдер ціни
        const pMinSlide = document.getElementById('fs-pmin'), pMaxSlide = document.getElementById('fs-pmax');
        const pMinNum = document.getElementById('f-min-price'), pMaxNum = document.getElementById('f-max-price');

        function updateDualSlider() {
            let minVal = parseInt(pMinSlide.value), maxVal = parseInt(pMaxSlide.value);
            if (minVal >= maxVal - 10) {
                if (this === pMinSlide) { pMinSlide.value = maxVal - 10; minVal = maxVal - 10; }
                else { pMaxSlide.value = minVal + 10; maxVal = minVal + 10; }
            }
            pMinNum.value = minVal; pMaxNum.value = maxVal; triggerUpdate();
        }
        function updateDualNum() { pMinSlide.value = pMinNum.value; pMaxSlide.value = pMaxNum.value; triggerUpdate(); }

        pMinSlide.addEventListener('input', updateDualSlider);
        pMaxSlide.addEventListener('input', updateDualSlider);
        pMinNum.addEventListener('input', updateDualNum);
        pMaxNum.addEventListener('input', updateDualNum);

        const bindSync = (slideId, numId) => {
            const slide = document.getElementById(slideId), num = document.getElementById(numId);
            slide.addEventListener('input', () => { num.value = slide.value; triggerUpdate(); });
            num.addEventListener('input', () => { slide.value = num.value; triggerUpdate(); });
        };
        bindSync('fs-score', 'fn-score'); bindSync('fs-disc', 'fn-disc'); bindSync('fs-rat', 'fn-rat');
        bindSync('fs-rev', 'fn-rev'); bindSync('fs-sal', 'fn-sal');
        bindSync('ws-disc', 'wn-disc'); bindSync('ws-rat', 'wn-rat'); bindSync('ws-sal', 'wn-sal'); bindSync('ws-rev', 'wn-rev');

        document.getElementById('cb-main-toggle').addEventListener('change', triggerUpdate);
        document.getElementById('cb-filters').addEventListener('change', triggerUpdate);

        function triggerUpdate() {
            settings.isScriptEnabled = document.getElementById('cb-main-toggle').checked;
            settings.filtersEnabled = document.getElementById('cb-filters').checked;
            settings.fMinPrice = parseFloat(pMinNum.value) || 0;
            settings.fMaxPrice = parseFloat(pMaxNum.value) || 99999;
            settings.fMinScore = parseFloat(document.getElementById('fn-score').value);
            settings.fMinDiscount = parseFloat(document.getElementById('fn-disc').value);
            settings.fMinRating = parseFloat(document.getElementById('fn-rat').value);
            settings.fMinReviews = parseInt(document.getElementById('fn-rev').value);
            settings.fMinSales = parseInt(document.getElementById('fn-sal').value);
            settings.wDiscount = parseFloat(document.getElementById('wn-disc').value);
            settings.wRating = parseFloat(document.getElementById('wn-rat').value);
            settings.wSales = parseFloat(document.getElementById('wn-sal').value);
            settings.wReviews = parseFloat(document.getElementById('wn-rev').value);

            chrome.storage.local.set(settings);

            // Переобробити всі картки
            document.querySelectorAll('[data-temu-processed="true"]').forEach(el => el.removeAttribute('data-temu-processed'));
            processCards();
        }

        // Перетягування вікна
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        document.getElementById("tpw-header").onmousedown = (e) => {
            if (['INPUT', 'BUTTON', 'LABEL'].includes(e.target.tagName)) return;
            e.preventDefault(); pos3 = e.clientX; pos4 = e.clientY;
            let rect = panel.getBoundingClientRect();
            panel.style.bottom = 'auto'; panel.style.right = 'auto';
            panel.style.top = rect.top + 'px'; panel.style.left = rect.left + 'px';
            document.onmouseup = () => { document.onmouseup = null; document.onmousemove = null; };
            document.onmousemove = (e) => {
                e.preventDefault();
                pos1 = pos3 - e.clientX; pos2 = pos4 - e.clientY; pos3 = e.clientX; pos4 = e.clientY;
                let newTop = panel.offsetTop - pos2, newLeft = panel.offsetLeft - pos1;
                newTop = Math.max(0, Math.min(newTop, window.innerHeight - panel.offsetHeight));
                newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - panel.offsetWidth));
                panel.style.top = newTop + "px"; panel.style.left = newLeft + "px";
            };
        };
    }

    // --- ОНОВЛЕННЯ ДАНИХ ПРИ НАВЕДЕННІ ---
    document.addEventListener('mouseover', (e) => {
        if (!settings.isScriptEnabled) return;
        const card = e.target.closest('[data-tooltip-html]');
        const infoTab = document.getElementById('tpw-info');
        if (card && infoTab) {
            infoTab.innerHTML = card.getAttribute('data-tooltip-html');
        }
    });

    // --- МАТЕМАТИКА ТА ПАРСИНГ ---
    function getColor(score) {
        if (score >= 80) return '#2ecc71'; if (score >= 60) return '#f1c40f';
        if (score >= 40) return '#e67e22'; return '#e74c3c';
    }

    function renderMiniBars(pts, maxPts) {
        let percent = maxPts > 0 ? (pts / maxPts) * 100 : 0;
        let activeBars = Math.round((percent / 100) * 5);
        let html = '<div class="tt-bars">';
        for (let i = 0; i < 5; i++) html += `<div class="tt-bar ${i < activeBars ? 'filled' : ''}"></div>`;
        return html + '</div>';
    }

    // --- СТІЙКИЙ ПОШУК ТОВАРНИХ КАРТОК ---
    // Temu URL паттерн: /ua/[title]--g-601100135939404.html
    function findProductCards() {
        const found = new Set();

        // Стратегія 1: Посилання з паттерном --g-[ID].html
        document.querySelectorAll('a[href*="--g-"]:not([data-temu-scanned])').forEach(link => {
            link.setAttribute('data-temu-scanned', '1');
            let card = link.parentElement;
            for (let i = 0; i < 6 && card; i++) {
                if (card.tagName === 'DIV' && card.querySelector('img') && card.textContent.match(/₴|\$/)) break;
                card = card.parentElement;
            }
            if (card && !card.hasAttribute('data-temu-processed')) found.add(card);
        });

        // Стратегія 2: Посилання з числовим ID (15+ цифр) / товарні посилання
        if (found.size === 0) {
            document.querySelectorAll('a[href$=".html"]:not([data-temu-scanned])').forEach(link => {
                link.setAttribute('data-temu-scanned', '1');
                if (/\d{10,}\.html/.test(link.href)) {
                    let card = link.parentElement;
                    for (let i = 0; i < 6 && card; i++) {
                        if (card.tagName === 'DIV' && card.querySelector('img') && card.textContent.match(/₴|\$/)) break;
                        card = card.parentElement;
                    }
                    if (card && !card.hasAttribute('data-temu-processed')) found.add(card);
                }
            });
        }

        // Стратегія 3: div з числовим ID
        if (found.size === 0) {
            document.querySelectorAll('div[id]:not([data-temu-processed])').forEach(div => {
                if (/^\d{10,}$/.test(div.id) && div.textContent.match(/₴|\$/)) found.add(div);
            });
        }

        return [...found];
    }

    function processCards() {
        if (!settings.isScriptEnabled) return;

        const products = findProductCards();

        products.forEach(product => {
            try {
                product.setAttribute('data-temu-processed', 'true');
                product.setAttribute('data-temu-card', 'true');

                const parseNum = (str) => parseFloat(str.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;

                // --- ПАРСИНГ ЦІН ---
                // Шукаємо всі текстові елементи з цінами
                let price = 0, rrp = 0, extraSave = 0;
                let rawPriceText = '';

                // Знайти ціну: шукаємо елементи з ₴ або $
                const priceElements = [];
                product.querySelectorAll('span, div, p').forEach(el => {
                    const t = el.textContent.trim();
                    if (t.length > 40 || t.length < 1 || el.children.length > 5) return;
                    if (t.includes('₴') || t.includes('$')) {
                        const val = parseNum(t);
                        if (val > 0 && val < 100000) {
                            const isOld = el.closest('del, s') !== null ||
                                window.getComputedStyle(el).textDecoration.includes('line-through') ||
                                t.includes('РРЦ');
                            priceElements.push({ val, isOld, text: t });
                        }
                    }
                });

                // Сортуємо: поточна ціна — найменша не-стара, стара — перша закреслена
                const currentPrices = priceElements.filter(p => !p.isOld).sort((a, b) => a.val - b.val);
                const oldPrices = priceElements.filter(p => p.isOld);

                if (currentPrices.length > 0) { price = currentPrices[0].val; rawPriceText = currentPrices[0].text; }
                if (oldPrices.length > 0) rrp = oldPrices[0].val;
                if (rrp === 0 && currentPrices.length > 1) rrp = currentPrices[currentPrices.length - 1].val;

                let isUAH = rawPriceText.includes('₴') || rawPriceText.toLowerCase().includes('грн');
                let isUSD = rawPriceText.includes('$');
                let currencySymbol = isUAH ? '₴' : (isUSD ? '$' : '');

                const formatPrice = (val) => isUAH ? Math.round(val).toLocaleString('uk-UA') : val.toFixed(2);

                let convertedStr = '';
                if (settings.exchangeRate > 0 && price > 0) {
                    if (isUAH) convertedStr = `(≈ $${(price / settings.exchangeRate).toFixed(2)})`;
                    else if (isUSD) convertedStr = `(≈ ₴${Math.round(price * settings.exchangeRate).toLocaleString('uk-UA')})`;
                }

                let discountPercent = 0;
                if (rrp > 0 && price > 0 && price < rrp) discountPercent = ((rrp - (price - extraSave)) / rrp) * 100;

                // --- ПАРСИНГ РЕЙТИНГУ ---
                let rating = 0;
                // aria-label
                const ariaEl = product.querySelector('[aria-label*="зір"], [aria-label*="star"], [aria-label*="rating"]');
                if (ariaEl) {
                    let m = ariaEl.getAttribute('aria-label').match(/[\d.,]+/);
                    if (m) rating = parseFloat(m[0].replace(',', '.')) || 0;
                }
                // width-based stars
                if (rating === 0) {
                    product.querySelectorAll('[style*="width"]').forEach(el => {
                        if (el.className && el.className.toString().toLowerCase().includes('star')) {
                            const w = parseFloat(el.style.width);
                            if (w > 0 && w <= 100) rating = (w / 100) * 5;
                        }
                    });
                }
                // Текстовий рейтинг: "4.8" біля зірочки
                if (rating === 0) {
                    const text = product.textContent;
                    const m = text.match(/(\d\.\d)\s*[\(⭐★]/);
                    if (m) rating = parseFloat(m[1]) || 0;
                }

                // --- ПАРСИНГ ВІДГУКІВ ---
                let reviews = 0;
                const reviewMatch = product.textContent.match(/\((\d[\d\s.,]*)\)/);
                if (reviewMatch) reviews = parseInt(reviewMatch[1].replace(/[\s.,]/g, '')) || 0;

                // --- ПАРСИНГ ПРОДАЖІВ ---
                let sales = 0;
                const allText = product.textContent.toLowerCase();
                const salesMatch = allText.match(/([\d\s.,]+)\s*(?:тис|k|к)?\+?\s*(?:продан|sold|куплен)/i);
                if (salesMatch) {
                    sales = parseFloat(salesMatch[1].replace(/[\s,]/g, '').replace(',', '.'));
                    if (allText.includes('тис') || allText.includes('k') || allText.includes('к')) sales *= 1000;
                    if (allText.includes('млн') || allText.includes('m')) sales *= 1000000;
                }

                // --- БОНУСИ (ДИНАМІЧНІ) ПРЯМО В ФІНАЛЬНИХ БАЛАХ (Макс 20) ---
                let bonusPointsFinal = 0;
                let bonusLines = [];

                if (extraSave > 0 && rrp > 0) {
                    let extraPerc = (extraSave / rrp) * 100;
                    let extraBonus = Math.min(7.0, extraPerc * 0.15);
                    if (extraBonus > 0) {
                        bonusPointsFinal += extraBonus;
                        bonusLines.push({ name: `Екстра знижка ${Math.round(extraPerc)}% <span style="color:#95a5a6;font-size:9px;">(0.15б за 1%)</span>`, pts: extraBonus, max: 7 });
                    }
                }

                let isBestseller = allText.includes('найпродаваніший') || allText.includes('топ продажів') || allText.includes('найкращі продажі');
                if (isBestseller) {
                    let rankMatch = allText.match(/#(\d+)/);
                    let rank = rankMatch ? parseInt(rankMatch[1]) : 50;
                    let is6Months = allText.includes('6 міс');
                    let is14Days = allText.includes('14 дн');
                    let rankBasePoints = Math.max(0, ((50 - rank) / 50) * 8.5);
                    let timeMulti = is6Months ? 1.5 : (is14Days ? 0.8 : 1.0);
                    let rankBonus = rankBasePoints * timeMulti;
                    bonusPointsFinal += rankBonus;
                    let rankTxt = rankMatch ? `Топ #${rank}` : 'Бестселер (#50)';
                    let durTxt = is6Months ? ' (6 міс.)' : (is14Days ? ' (14 дн.)' : '');
                    let multiTxt = is6Months ? '×1.5' : (is14Days ? '×0.8' : '×1.0');
                    bonusLines.push({ name: `${rankTxt}${durTxt} <span style="color:#95a5a6;font-size:9px;">(База ${rankBasePoints.toFixed(1)} ${multiTxt})</span>`, pts: rankBonus, max: 13 });
                }

                if (allText.includes('найвищий рейтинг')) { bonusPointsFinal += 3.5; bonusLines.push({ name: 'Топ рейтинг <span style="color:#95a5a6;font-size:9px;">(Фікс)</span>', pts: 3.5, max: 3.5 }); }
                if (allText.includes('зірковий продавець')) { bonusPointsFinal += 5.0; bonusLines.push({ name: 'Зірковий продавець <span style="color:#95a5a6;font-size:9px;">(Фікс)</span>', pts: 5.0, max: 5.0 }); }
                if (allText.includes('бренд')) { bonusPointsFinal += 3.5; bonusLines.push({ name: 'Бренд <span style="color:#95a5a6;font-size:9px;">(Фікс)</span>', pts: 3.5, max: 3.5 }); }
                if (allText.includes('місцевий склад')) { bonusPointsFinal += 3.5; bonusLines.push({ name: 'Місцевий склад <span style="color:#95a5a6;font-size:9px;">(Фікс)</span>', pts: 3.5, max: 3.5 }); }
                else if (allText.includes('швидка доставка')) { bonusPointsFinal += 1.5; bonusLines.push({ name: 'Швидка доставка <span style="color:#95a5a6;font-size:9px;">(Фікс)</span>', pts: 1.5, max: 1.5 }); }

                // --- ВІДНОВЛЕНА ВАГОВА МОДЕЛЬ З ІДЕАЛЬНИМ ОКРУГЛЕННЯМ ---
                let nDisc = Math.min(100, Math.max(0, discountPercent)), nRat = (rating / 5) * 100;
                let nSal = Math.min(100, (sales / 5000) * 100), nRev = Math.min(100, (reviews / 1000) * 100);

                let totalWeight = settings.wDiscount + settings.wRating + settings.wSales + settings.wReviews || 1;

                let maxPtsDiscInt = Math.round(((settings.wDiscount / totalWeight) * 100) * 0.80);
                let maxPtsRatInt = Math.round(((settings.wRating / totalWeight) * 100) * 0.80);
                let maxPtsSalInt = Math.round(((settings.wSales / totalWeight) * 100) * 0.80);
                let maxPtsRevInt = Math.round(((settings.wReviews / totalWeight) * 100) * 0.80);

                let ptsDiscInt = Math.round((nDisc * settings.wDiscount / totalWeight) * 0.80);
                let ptsRatInt = Math.round((nRat * settings.wRating / totalWeight) * 0.80);
                let ptsSalInt = Math.round((nSal * settings.wSales / totalWeight) * 0.80);
                let ptsRevInt = Math.round((nRev * settings.wReviews / totalWeight) * 0.80);

                let baseScoreInt = ptsDiscInt + ptsRatInt + ptsSalInt + ptsRevInt;

                const MAX_BONUS = 20;
                let bonusContributionInt = Math.round(Math.min(bonusPointsFinal, MAX_BONUS));

                let finalScore = Math.min(100, Math.max(0, baseScoreInt + bonusContributionInt));
                let color = getColor(finalScore);

                // --- ФІЛЬТРИ ---
                if (settings.filtersEnabled) {
                    if (finalScore < settings.fMinScore || discountPercent < settings.fMinDiscount ||
                        rating < settings.fMinRating || reviews < settings.fMinReviews || sales < settings.fMinSales ||
                        price < settings.fMinPrice || price > settings.fMaxPrice) {
                        product.style.display = 'none'; return;
                    } else { product.style.display = ''; }
                } else { product.style.display = ''; }

                // --- SCORE BAR ---
                let bar = product.querySelector('.temu-score-container');
                if (!bar) { bar = document.createElement('div'); bar.className = 'temu-score-container'; product.prepend(bar); }

                let pillsHtml = '';
                for (let i = 1; i <= 10; i++) {
                    let threshold = i * 10, fillWidth = 0;
                    if (finalScore >= threshold) fillWidth = 100;
                    else if (finalScore > threshold - 10) fillWidth = (finalScore % 10) * 10;
                    pillsHtml += `<div class="temu-pill"><div class="temu-pill-fill" style="width: ${fillWidth}%; background: ${color};"></div></div>`;
                }
                bar.innerHTML = `<div class="temu-pills-wrapper">${pillsHtml}</div><div class="temu-score-number" style="color: ${color}">${finalScore}</div>`;

                // --- TOOLTIP HTML ---
                let bonusHtml = `<div class="tt-div"></div>`;
                if (bonusLines.length > 0) {
                    bonusHtml += `<div style="font-size: 11px; font-weight: bold; color: #27ae60; margin-bottom: 6px;">🎁 Отримані плюшки (Напряму в балах):</div>`;
                    bonusLines.forEach(b => {
                        let displayPts = (Math.round(b.pts * 10) / 10).toFixed(1);
                        let displayMax = Number.isInteger(b.max) ? b.max : b.max.toFixed(1);
                        bonusHtml += `<div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--tpw-subtle); margin-bottom: 3px;">
                            <span>• ${b.name}</span>
                            <span style="color: #27ae60; font-weight: bold; white-space: nowrap; margin-left: 10px;">+${displayPts} / ${displayMax}</span>
                        </div>`;
                    });
                    let limitTxt = bonusPointsFinal > MAX_BONUS ? `<br><span style="color:#e67e22">(Суму зрізано до ліміту ${MAX_BONUS} б.)</span>` : '';
                    let displaySum = (Math.round(bonusPointsFinal * 10) / 10).toFixed(1);
                    bonusHtml += `<div style="margin-top: 8px; padding-top: 6px; border-top: 1px dotted var(--tpw-border); font-size: 10.5px; color: #7f8c8d; text-align: right; line-height: 1.5;">
                        Сума плюшок: <b>${displaySum} б.</b>${limitTxt}<br>
                        Округлено до фінальних: <b style="color:#27ae60; font-size:12px;">${bonusContributionInt} / 20 б.</b>
                    </div>`;
                } else {
                    bonusHtml += `<div style="font-size: 11px; color: #999; text-align: center; font-style: italic;">Немає додаткових плюшок ➔ 0 / 20 б.</div>`;
                }

                product.setAttribute('data-tooltip-html', `
                    <div style="text-align:center; font-size:22px; font-weight:900; color:${color}; margin-bottom: 2px;">Загальний бал: ${finalScore} / 100</div>
                    <div style="text-align:center; font-size:10px; color:#7f8c8d; margin-bottom: 12px; font-style: italic;">
                        (База: ${baseScoreInt} / 80 б. + Плюшки: ${bonusContributionInt} / 20 б.)
                    </div>

                    <div class="tt-header"><span style="color:#7f8c8d">Стара ціна:</span> <span style="text-decoration:line-through">${currencySymbol}${formatPrice(rrp)}</span></div>
                    <div class="tt-header" style="margin-bottom: 12px;">
                        <span style="color:#27ae60; font-weight: bold;">Поточна ціна:</span>
                        <div>
                            <span style="color:#95a5a6; font-size: 11px; margin-right: 5px;">${convertedStr}</span>
                            <b style="color:#27ae60; font-size: 16px;">${currencySymbol}${formatPrice(price)}</b>
                        </div>
                    </div>
                    <div class="tt-div"></div>

                    <div class="tt-row"><div class="tt-header"><span>🏷️ Знижка: <b>${Math.round(discountPercent)}%</b></span> <span class="tt-pts">${ptsDiscInt} / ${maxPtsDiscInt} б.</span></div>${renderMiniBars(ptsDiscInt, maxPtsDiscInt)}</div>
                    <div class="tt-row"><div class="tt-header"><span>⭐ Рейтинг: <b>${rating.toFixed(1)}</b></span> <span class="tt-pts">${ptsRatInt} / ${maxPtsRatInt} б.</span></div>${renderMiniBars(ptsRatInt, maxPtsRatInt)}</div>
                    <div class="tt-row"><div class="tt-header"><span>🛒 Продажі: <b>${sales.toLocaleString('uk-UA')}+</b></span> <span class="tt-pts">${ptsSalInt} / ${maxPtsSalInt} б.</span></div>${renderMiniBars(ptsSalInt, maxPtsSalInt)}</div>
                    <div class="tt-row"><div class="tt-header"><span>📝 Відгуки: <b>${reviews.toLocaleString('uk-UA')}</b></span> <span class="tt-pts">${ptsRevInt} / ${maxPtsRevInt} б.</span></div>${renderMiniBars(ptsRevInt, maxPtsRevInt)}</div>

                    ${bonusHtml}
                `);

            } catch (err) { console.error("[Temu Pro] Помилка обробки:", err); }
        });
    }

    window.addEventListener('load', () => {
        createMainWindow();
        setInterval(processCards, 800);
    });
})();
