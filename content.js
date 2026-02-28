(async function () {
    'use strict';

    // --- НАЛАШТУВАННЯ ТА КЕШ ---
    const DEFAULTS = {
        isScriptEnabled: true,
        isPanelCollapsed: false,
        filtersEnabled: false,
        fMinScore: 0, fMinDiscount: 0, fMinRating: 4.0,
        fMinSales: 100, fMinReviews: 10,
        fMinPrice: 0, fMaxPrice: 5000,
        wDiscount: 25, wRating: 25, wSales: 25, wReviews: 25,
        exchangeRate: 41.0, lastRateFetch: 0,
        panelMode: 'float' // 'float' або 'sidepanel'
    };

    let S = {};
    try {
        S = await chrome.storage.local.get(DEFAULTS);
    } catch (e) {
        S = Object.assign({}, DEFAULTS);
    }

    function save(key, val) {
        S[key] = val;
        chrome.storage.local.set({ [key]: val }).catch(() => { });
    }

    // --- КУРС ВАЛЮТ (через background.js) ---
    function fetchRate() {
        chrome.runtime.sendMessage({ action: 'fetchRate' }, (resp) => {
            if (resp && resp.rate) {
                S.exchangeRate = resp.rate;
                save('exchangeRate', resp.rate);
                save('lastRateFetch', Date.now());
            }
        });
    }
    fetchRate();

    // --- CSS СТИЛІ ---
    const css = document.createElement('style');
    css.textContent = `
        :root {
            --tpw-bg: #fff; --tpw-text: #222; --tpw-header: #f8f9fa;
            --tpw-border: #ddd; --tpw-tabs: #f1f2f6; --tpw-tab-c: #7f8fa6;
            --tpw-active: #0097e6; --tpw-sec: #f9f9f9; --tpw-sec-b: #eaeaea;
            --tpw-lbl: #333; --tpw-sub: #777; --tpw-score: rgba(255,255,255,0.95);
            --tpw-bar: #dfe6e9; --tpw-inp: #fff; --tpw-inp-b: #ccc;
        }
        @media (prefers-color-scheme: dark) {
            :root {
                --tpw-bg: #1a1a2e; --tpw-text: #e0e0e0; --tpw-header: #16213e;
                --tpw-border: #2a2a4a; --tpw-tabs: #0f0f1a; --tpw-tab-c: #888;
                --tpw-active: #ff6b00; --tpw-sec: rgba(255,255,255,0.04); --tpw-sec-b: rgba(255,255,255,0.08);
                --tpw-lbl: #ccc; --tpw-sub: #888; --tpw-score: rgba(15,15,26,0.92);
                --tpw-bar: rgba(255,255,255,0.15); --tpw-inp: #222; --tpw-inp-b: #444;
            }
        }
        .temu-score-container {
            position: absolute; top: 0; left: 0; width: 100%; height: 20px;
            background: var(--tpw-score); z-index: 50; border-radius: 8px 8px 0 0;
            display: flex; align-items: center; justify-content: space-between;
            padding: 0 6px; box-sizing: border-box; pointer-events: none;
        }
        .temu-pills-wrapper { display: flex; gap: 3px; flex: 1; margin-right: 8px; }
        .temu-pill { height: 6px; flex: 1; border-radius: 10px; background: var(--tpw-bar); overflow: hidden; position: relative; }
        .temu-pill-fill { height: 100%; position: absolute; left: 0; top: 0; transition: width 0.3s ease; }
        .temu-score-number { font-size: 12px; font-weight: 900; }
        [data-temu-card="true"] { position: relative; padding-top: 22px !important; }
        #temu-pro-window {
            position: fixed; background: var(--tpw-bg); border: 1px solid var(--tpw-border);
            border-radius: 10px; z-index: 9999999; box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            font-family: sans-serif; width: 340px; color: var(--tpw-text); display: flex; flex-direction: column;
        }
        #tpw-header {
            cursor: move; font-weight: bold; font-size: 13px; padding: 10px 15px;
            background: var(--tpw-header); border-radius: 10px 10px 0 0; border-bottom: 1px solid var(--tpw-border);
            display: flex; justify-content: space-between; align-items: center; user-select: none;
        }
        #tpw-tabs { display: flex; background: var(--tpw-tabs); border-bottom: 1px solid var(--tpw-border); }
        #tpw-tabs.collapsed { display: none; }
        .tpw-tab {
            flex: 1; text-align: center; padding: 10px 0; font-size: 12px; font-weight: bold;
            color: var(--tpw-tab-c); cursor: pointer; border-bottom: 3px solid transparent; transition: 0.2s;
        }
        .tpw-tab:hover { opacity: 0.8; }
        .tpw-tab.active { color: var(--tpw-active); border-bottom-color: var(--tpw-active); background: var(--tpw-bg); }
        #tpw-body { overflow: hidden; }
        #tpw-body.collapsed { display: none; }
        .tpw-content { display: none; padding: 15px; max-height: 70vh; overflow-y: auto; background: var(--tpw-bg); }
        .tpw-content.active { display: block; }
        .tt-row { margin-bottom: 8px; }
        .tt-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px; font-size: 12px; }
        .tt-pts { color: #d35400; font-weight: bold; font-size: 11px; }
        .tt-bars { display: flex; gap: 2px; height: 5px; }
        .tt-bar { flex: 1; background: var(--tpw-bar); border-radius: 2px; }
        .tt-bar.filled { background: #3498db; }
        .tt-div { border-top: 1px dashed var(--tpw-border); margin: 10px 0; }
        .st-section { background: var(--tpw-sec); border-radius: 6px; padding: 10px; margin-bottom: 10px; border: 1px solid var(--tpw-sec-b); }
        .st-title { font-size: 11px; font-weight: bold; color: var(--tpw-sub); margin-bottom: 10px; text-transform: uppercase; display: flex; justify-content: space-between; align-items: center; }
        .st-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; gap: 8px; }
        .st-label { width: 95px; font-size: 11px; flex-shrink: 0; color: var(--tpw-lbl); }
        .st-row input[type="range"] { flex: 1; min-width: 80px; cursor: pointer; }
        .st-num-input { width: 45px; padding: 3px; font-size: 11px; border: 1px solid var(--tpw-inp-b); border-radius: 4px; text-align: center; background: var(--tpw-inp); color: var(--tpw-text); }
        .dual-slider-container { position: relative; flex: 1; height: 20px; margin: 0 10px; }
        .dual-slider-container input[type="range"] { position: absolute; left: 0; top: 0; width: 100%; pointer-events: none; -webkit-appearance: none; appearance: none; background: transparent; height: 4px; margin-top: 8px; }
        .dual-slider-container input[type="range"]::-webkit-slider-thumb { pointer-events: auto; -webkit-appearance: none; appearance: none; width: 14px; height: 14px; background: #0b7bff; border-radius: 50%; cursor: pointer; }
        .dual-slider-track { position: absolute; top: 8px; left: 0; width: 100%; height: 4px; background: var(--tpw-bar); border-radius: 2px; z-index: -1; }
    `;
    document.head.append(css);

    // --- СТВОРЕННЯ ПАНЕЛІ ---
    function createMainWindow() {
        if (document.getElementById('temu-pro-window')) return;
        const P = document.createElement('div');
        P.id = 'temu-pro-window';
        P.style.top = '20px';
        P.style.right = '20px';

        // БЕЗ template literal для значень — ставимо програмно
        P.innerHTML = [
            '<div id="tpw-header">',
            '  <span>\u{1F6D2} Temu Pro v14</span>',
            '  <div style="display:flex;gap:10px;align-items:center;">',
            '    <label style="font-size:11px;cursor:pointer;"><input type="checkbox" id="cb-main-toggle"> Увімк.</label>',
            '    <button id="btn-collapse" style="cursor:pointer;border:none;border-radius:4px;padding:2px 6px;background:var(--tpw-tabs);color:var(--tpw-text);">\u2014</button>',
            '  </div>',
            '</div>',
            '<div id="tpw-tabs">',
            '  <div class="tpw-tab active" data-tab="info">\u{1F4CA} Аналітика</div>',
            '  <div class="tpw-tab" data-tab="settings">\u2699\uFE0F Налаштування</div>',
            '</div>',
            '<div id="tpw-body">',
            '  <div id="tpw-info" class="tpw-content active">',
            '    <div style="text-align:center;padding:40px 10px;color:var(--tpw-sub);font-size:12px;line-height:1.5;">',
            '      <span style="font-size:24px;display:block;margin-bottom:10px;">\u{1F50D}</span>',
            '      Наведіть курсор на будь-який товар,<br>щоб побачити його розгорнуту оцінку',
            '    </div>',
            '  </div>',
            '  <div id="tpw-settings" class="tpw-content">',
            '    <div class="st-section">',
            '      <div class="st-title"><span>\u{1F6D1} Фільтри (Приховувати)</span><label style="cursor:pointer;color:#0b7bff;"><input type="checkbox" id="cb-filters"> Активні</label></div>',
            '      <div style="font-size:11px;color:var(--tpw-lbl);margin-bottom:4px;">Діапазон ціни (Min - Max):</div>',
            '      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">',
            '        <input type="number" id="f-min-price" class="st-num-input">',
            '        <div class="dual-slider-container"><div class="dual-slider-track"></div><input type="range" id="fs-pmin" min="0" max="10000" step="10"><input type="range" id="fs-pmax" min="0" max="10000" step="10"></div>',
            '        <input type="number" id="f-max-price" class="st-num-input">',
            '      </div>',
            '      <div class="st-row"><span class="st-label">Мін. Балів:</span><input type="range" id="fs-score" min="0" max="100"><input type="number" id="fn-score" class="st-num-input"></div>',
            '      <div class="st-row"><span class="st-label">Мін. Знижка %:</span><input type="range" id="fs-disc" min="0" max="90" step="5"><input type="number" id="fn-disc" class="st-num-input"></div>',
            '      <div class="st-row"><span class="st-label">Мін. Рейтинг:</span><input type="range" id="fs-rat" min="0" max="5" step="0.1"><input type="number" id="fn-rat" class="st-num-input" step="0.1"></div>',
            '      <div class="st-row"><span class="st-label">Мін. Відгуків:</span><input type="range" id="fs-rev" min="0" max="500" step="10"><input type="number" id="fn-rev" class="st-num-input"></div>',
            '      <div class="st-row"><span class="st-label">Мін. Продажів:</span><input type="range" id="fs-sal" min="0" max="10000" step="100"><input type="number" id="fn-sal" class="st-num-input"></div>',
            '    </div>',
            '    <div class="st-section">',
            '      <div class="st-title">\u2696\uFE0F Вага в алгоритмі (%)</div>',
            '      <div class="st-row"><span class="st-label">Знижка:</span><input type="range" id="ws-disc" min="0" max="100"><input type="number" id="wn-disc" class="st-num-input"></div>',
            '      <div class="st-row"><span class="st-label">Рейтинг:</span><input type="range" id="ws-rat" min="0" max="100"><input type="number" id="wn-rat" class="st-num-input"></div>',
            '      <div class="st-row"><span class="st-label">Продажі:</span><input type="range" id="ws-sal" min="0" max="100"><input type="number" id="wn-sal" class="st-num-input"></div>',
            '      <div class="st-row"><span class="st-label">Відгуки:</span><input type="range" id="ws-rev" min="0" max="100"><input type="number" id="wn-rev" class="st-num-input"></div>',
            '    </div>',
            '  </div>',
            '</div>'
        ].join('\n');
        document.body.appendChild(P);

        // --- ПРОГРАМНЕ ВСТАНОВЛЕННЯ ЗНАЧЕНЬ (без template literals!) ---
        const $ = id => document.getElementById(id);
        $('cb-main-toggle').checked = S.isScriptEnabled;
        $('cb-filters').checked = S.filtersEnabled;
        $('f-min-price').value = S.fMinPrice;
        $('f-max-price').value = S.fMaxPrice;
        $('fs-pmin').value = S.fMinPrice;
        $('fs-pmax').value = S.fMaxPrice;
        $('fs-score').value = S.fMinScore; $('fn-score').value = S.fMinScore;
        $('fs-disc').value = S.fMinDiscount; $('fn-disc').value = S.fMinDiscount;
        $('fs-rat').value = S.fMinRating; $('fn-rat').value = S.fMinRating;
        $('fs-rev').value = S.fMinReviews; $('fn-rev').value = S.fMinReviews;
        $('fs-sal').value = S.fMinSales; $('fn-sal').value = S.fMinSales;
        $('ws-disc').value = S.wDiscount; $('wn-disc').value = S.wDiscount;
        $('ws-rat').value = S.wRating; $('wn-rat').value = S.wRating;
        $('ws-sal').value = S.wSales; $('wn-sal').value = S.wSales;
        $('ws-rev').value = S.wReviews; $('wn-rev').value = S.wReviews;

        if (S.isPanelCollapsed) {
            $('tpw-tabs').classList.add('collapsed');
            $('tpw-body').classList.add('collapsed');
            $('btn-collapse').textContent = '+';
        }

        // Вкладки
        P.querySelectorAll('.tpw-tab').forEach(t => {
            t.addEventListener('click', () => {
                P.querySelectorAll('.tpw-tab').forEach(x => x.classList.remove('active'));
                P.querySelectorAll('.tpw-content').forEach(x => x.classList.remove('active'));
                t.classList.add('active');
                $('tpw-' + t.dataset.tab).classList.add('active');
            });
        });

        $('btn-collapse').addEventListener('click', (e) => {
            S.isPanelCollapsed = !S.isPanelCollapsed;
            save('isPanelCollapsed', S.isPanelCollapsed);
            $('tpw-tabs').classList.toggle('collapsed', S.isPanelCollapsed);
            $('tpw-body').classList.toggle('collapsed', S.isPanelCollapsed);
            e.target.textContent = S.isPanelCollapsed ? '+' : '\u2014';
        });

        // Подвійний слайдер ціни
        const pMinS = $('fs-pmin'), pMaxS = $('fs-pmax'), pMinN = $('f-min-price'), pMaxN = $('f-max-price');
        function updateDual() {
            let lo = parseInt(pMinS.value), hi = parseInt(pMaxS.value);
            if (lo >= hi - 10) { if (this === pMinS) { pMinS.value = hi - 10; lo = hi - 10; } else { pMaxS.value = lo + 10; hi = lo + 10; } }
            pMinN.value = lo; pMaxN.value = hi; triggerUpdate();
        }
        pMinS.addEventListener('input', updateDual);
        pMaxS.addEventListener('input', updateDual);
        pMinN.addEventListener('input', () => { pMinS.value = pMinN.value; triggerUpdate(); });
        pMaxN.addEventListener('input', () => { pMaxS.value = pMaxN.value; triggerUpdate(); });

        const sync = (sId, nId) => {
            const s = $(sId), n = $(nId);
            s.addEventListener('input', () => { n.value = s.value; triggerUpdate(); });
            n.addEventListener('input', () => { s.value = n.value; triggerUpdate(); });
        };
        sync('fs-score', 'fn-score'); sync('fs-disc', 'fn-disc'); sync('fs-rat', 'fn-rat');
        sync('fs-rev', 'fn-rev'); sync('fs-sal', 'fn-sal');
        sync('ws-disc', 'wn-disc'); sync('ws-rat', 'wn-rat'); sync('ws-sal', 'wn-sal'); sync('ws-rev', 'wn-rev');

        $('cb-main-toggle').addEventListener('change', triggerUpdate);
        $('cb-filters').addEventListener('change', triggerUpdate);

        function triggerUpdate() {
            S.isScriptEnabled = $('cb-main-toggle').checked;
            S.filtersEnabled = $('cb-filters').checked;
            S.fMinPrice = parseFloat(pMinN.value) || 0;
            S.fMaxPrice = parseFloat(pMaxN.value) || 99999;
            S.fMinScore = parseFloat($('fn-score').value);
            S.fMinDiscount = parseFloat($('fn-disc').value);
            S.fMinRating = parseFloat($('fn-rat').value);
            S.fMinReviews = parseInt($('fn-rev').value);
            S.fMinSales = parseInt($('fn-sal').value);
            S.wDiscount = parseFloat($('wn-disc').value);
            S.wRating = parseFloat($('wn-rat').value);
            S.wSales = parseFloat($('wn-sal').value);
            S.wReviews = parseFloat($('wn-rev').value);
            chrome.storage.local.set(S).catch(() => { });
            document.querySelectorAll('[data-temu-processed]').forEach(el => el.removeAttribute('data-temu-processed'));
            document.querySelectorAll('[data-temu-scanned]').forEach(el => el.removeAttribute('data-temu-scanned'));
            processCards();
        }

        // Перетягування
        let p1 = 0, p2 = 0, p3 = 0, p4 = 0;
        $('tpw-header').onmousedown = (e) => {
            if (['INPUT', 'BUTTON', 'LABEL'].includes(e.target.tagName)) return;
            e.preventDefault(); p3 = e.clientX; p4 = e.clientY;
            const r = P.getBoundingClientRect();
            P.style.bottom = 'auto'; P.style.right = 'auto';
            P.style.top = r.top + 'px'; P.style.left = r.left + 'px';
            document.onmouseup = () => { document.onmouseup = null; document.onmousemove = null; };
            document.onmousemove = (ev) => {
                ev.preventDefault();
                p1 = p3 - ev.clientX; p2 = p4 - ev.clientY; p3 = ev.clientX; p4 = ev.clientY;
                let t = P.offsetTop - p2, l = P.offsetLeft - p1;
                t = Math.max(0, Math.min(t, window.innerHeight - P.offsetHeight));
                l = Math.max(0, Math.min(l, window.innerWidth - P.offsetWidth));
                P.style.top = t + 'px'; P.style.left = l + 'px';
            };
        };
    }

    // --- HOVER → АНАЛІТИКА ---
    document.addEventListener('mouseover', (e) => {
        if (!S.isScriptEnabled) return;
        const card = e.target.closest('[data-tooltip-html]');
        const info = document.getElementById('tpw-info');
        if (card && info) info.innerHTML = card.getAttribute('data-tooltip-html');
    });

    // --- УТИЛІТИ ---
    function getColor(s) {
        if (s >= 80) return '#2ecc71'; if (s >= 60) return '#f1c40f';
        if (s >= 40) return '#e67e22'; return '#e74c3c';
    }
    function miniBars(pts, max) {
        let pct = max > 0 ? (pts / max) * 100 : 0;
        let act = Math.round((pct / 100) * 5);
        let h = '<div class="tt-bars">';
        for (let i = 0; i < 5; i++) h += '<div class="tt-bar ' + (i < act ? 'filled' : '') + '"></div>';
        return h + '</div>';
    }
    const parseNum = (s) => parseFloat(String(s).replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;

    // --- ПОШУК ТОВАРНИХ КАРТОК (СТІЙКИЙ) ---
    function findCards() {
        const found = new Set();
        // Стратегія 1: Посилання з паттерном -g-[ID].html (ОДИНАРНИЙ дефіс!)
        document.querySelectorAll('a[href*="-g-"]:not([data-temu-scanned])').forEach(link => {
            link.setAttribute('data-temu-scanned', '1');
            // Ігноруємо не-товарні посилання
            if (!/\d{8,}\.html/.test(link.href) && !/\d{8,}/.test(link.href)) return;
            let card = link.parentElement;
            for (let i = 0; i < 7 && card; i++) {
                const txt = card.textContent || '';
                if (card.tagName === 'DIV' && card.querySelector('img') && (txt.includes('$') || txt.includes('₴'))) break;
                card = card.parentElement;
            }
            if (card && !card.hasAttribute('data-temu-processed') && card.querySelector('img')) found.add(card);
        });
        // Стратегія 2: Будь-яке посилання з 10+ цифрами в href
        if (found.size === 0) {
            document.querySelectorAll('a[href*=".html"]:not([data-temu-scanned])').forEach(link => {
                link.setAttribute('data-temu-scanned', '1');
                if (!/\d{10,}/.test(link.href)) return;
                let card = link.parentElement;
                for (let i = 0; i < 7 && card; i++) {
                    const txt = card.textContent || '';
                    if (card.tagName === 'DIV' && card.querySelector('img') && (txt.includes('$') || txt.includes('₴'))) break;
                    card = card.parentElement;
                }
                if (card && !card.hasAttribute('data-temu-processed') && card.querySelector('img')) found.add(card);
            });
        }
        return [...found];
    }

    // --- ОБРОБКА КАРТОК ---
    function processCards() {
        if (!S.isScriptEnabled) return;
        const cards = findCards();
        let totalScore = 0, count = 0;

        cards.forEach(product => {
            try {
                product.setAttribute('data-temu-processed', 'true');
                product.setAttribute('data-temu-card', 'true');

                // --- ПАРСИНГ ЦІН ---
                let price = 0, rrp = 0, extraSave = 0, rawPriceText = '';
                const priceEls = [];
                product.querySelectorAll('span, div, p').forEach(el => {
                    const t = el.textContent.trim();
                    if (t.length > 40 || t.length < 1 || el.children.length > 5) return;
                    if (t.includes('₴') || t.includes('$')) {
                        const v = parseNum(t);
                        if (v > 0 && v < 100000) {
                            const isOld = el.closest('del, s') !== null ||
                                (window.getComputedStyle(el).textDecoration || '').includes('line-through') ||
                                t.includes('РРЦ');
                            priceEls.push({ val: v, isOld, text: t });
                        }
                    }
                });
                const cur = priceEls.filter(p => !p.isOld).sort((a, b) => a.val - b.val);
                const old = priceEls.filter(p => p.isOld);
                if (cur.length > 0) { price = cur[0].val; rawPriceText = cur[0].text; }
                if (old.length > 0) rrp = old[0].val;
                if (rrp === 0 && cur.length > 1) rrp = cur[cur.length - 1].val;

                const isUAH = rawPriceText.includes('₴') || rawPriceText.toLowerCase().includes('грн');
                const isUSD = rawPriceText.includes('$');
                const sym = isUAH ? '₴' : (isUSD ? '$' : '');
                const fmt = (v) => isUAH ? Math.round(v).toLocaleString('uk-UA') : v.toFixed(2);
                let conv = '';
                if (S.exchangeRate > 0 && price > 0) {
                    if (isUAH) conv = '(≈ $' + (price / S.exchangeRate).toFixed(2) + ')';
                    else if (isUSD) conv = '(≈ ₴' + Math.round(price * S.exchangeRate).toLocaleString('uk-UA') + ')';
                }
                let disc = 0;
                if (rrp > 0 && price > 0 && price < rrp) disc = ((rrp - (price - extraSave)) / rrp) * 100;

                // --- ПАРСИНГ РЕЙТИНГУ ---
                let rating = 0;
                const ariaEl = product.querySelector('[aria-label*="зір"], [aria-label*="star"], [aria-label*="rating"]');
                if (ariaEl) {
                    const m = ariaEl.getAttribute('aria-label').match(/[\d.,]+/);
                    if (m) rating = parseFloat(m[0].replace(',', '.')) || 0;
                }
                if (rating === 0) {
                    product.querySelectorAll('[style*="width"]').forEach(el => {
                        if (el.className && String(el.className).toLowerCase().includes('star')) {
                            const w = parseFloat(el.style.width);
                            if (w > 0 && w <= 100) rating = (w / 100) * 5;
                        }
                    });
                }
                if (rating === 0) { const m = product.textContent.match(/(\d\.\d)\s*[\(⭐★]/); if (m) rating = parseFloat(m[1]) || 0; }

                // --- ВІДГУКИ ---
                let reviews = 0;
                const revM = product.textContent.match(/\((\d[\d\s.,]*)\)/);
                if (revM) reviews = parseInt(revM[1].replace(/[\s.,]/g, '')) || 0;

                // --- ПРОДАЖІ ---
                let sales = 0;
                const allText = product.textContent.toLowerCase();
                const salM = allText.match(/([\d\s.,]+)\s*(?:тис|k|к)?\+?\s*(?:продан|sold|куплен)/i);
                if (salM) {
                    sales = parseFloat(salM[1].replace(/[\s,]/g, '').replace(',', '.'));
                    if (/тис|k|к/.test(allText)) sales *= 1000;
                    if (/млн|m/.test(allText)) sales *= 1000000;
                }

                // --- БОНУСИ (Макс 20 б.) ---
                let bonusPts = 0, bonusList = [];
                if (extraSave > 0 && rrp > 0) {
                    const ep = (extraSave / rrp) * 100, eb = Math.min(7, ep * 0.15);
                    if (eb > 0) { bonusPts += eb; bonusList.push({ name: 'Екстра знижка ' + Math.round(ep) + '%', pts: eb, max: 7 }); }
                }
                const isBest = allText.includes('найпродаваніший') || allText.includes('топ продажів') || allText.includes('найкращі продажі');
                if (isBest) {
                    const rm = allText.match(/#(\d+)/);
                    const rank = rm ? parseInt(rm[1]) : 50;
                    const base = Math.max(0, ((50 - rank) / 50) * 8.5);
                    const multi = allText.includes('6 міс') ? 1.5 : (allText.includes('14 дн') ? 0.8 : 1.0);
                    const rb = base * multi;
                    bonusPts += rb;
                    bonusList.push({ name: 'Топ #' + rank, pts: rb, max: 13 });
                }
                if (allText.includes('найвищий рейтинг')) { bonusPts += 3.5; bonusList.push({ name: 'Топ рейтинг', pts: 3.5, max: 3.5 }); }
                if (allText.includes('зірковий продавець')) { bonusPts += 5; bonusList.push({ name: 'Зірковий продавець', pts: 5, max: 5 }); }
                if (allText.includes('бренд')) { bonusPts += 3.5; bonusList.push({ name: 'Бренд', pts: 3.5, max: 3.5 }); }
                if (allText.includes('місцевий склад')) { bonusPts += 3.5; bonusList.push({ name: 'Місцевий склад', pts: 3.5, max: 3.5 }); }
                else if (allText.includes('швидка доставка')) { bonusPts += 1.5; bonusList.push({ name: 'Швидка доставка', pts: 1.5, max: 1.5 }); }

                // --- ВАГОВА МОДЕЛЬ ---
                const nD = Math.min(100, Math.max(0, disc)), nR = (rating / 5) * 100;
                const nS = Math.min(100, (sales / 5000) * 100), nV = Math.min(100, (reviews / 1000) * 100);
                const tw = S.wDiscount + S.wRating + S.wSales + S.wReviews || 1;
                const mxD = Math.round(((S.wDiscount / tw) * 100) * 0.80);
                const mxR = Math.round(((S.wRating / tw) * 100) * 0.80);
                const mxS = Math.round(((S.wSales / tw) * 100) * 0.80);
                const mxV = Math.round(((S.wReviews / tw) * 100) * 0.80);
                const pD = Math.round((nD * S.wDiscount / tw) * 0.80);
                const pR = Math.round((nR * S.wRating / tw) * 0.80);
                const pS = Math.round((nS * S.wSales / tw) * 0.80);
                const pV = Math.round((nV * S.wReviews / tw) * 0.80);
                const base = pD + pR + pS + pV;
                const MAX_BONUS = 20;
                const bonusInt = Math.round(Math.min(bonusPts, MAX_BONUS));
                const score = Math.min(100, Math.max(0, base + bonusInt));
                const color = getColor(score);
                totalScore += score; count++;

                // --- ФІЛЬТРИ ---
                if (S.filtersEnabled) {
                    if (score < S.fMinScore || disc < S.fMinDiscount || rating < S.fMinRating ||
                        reviews < S.fMinReviews || sales < S.fMinSales || price < S.fMinPrice || price > S.fMaxPrice) {
                        product.style.display = 'none'; return;
                    } else { product.style.display = ''; }
                } else { product.style.display = ''; }

                // --- SCORE BAR ---
                let bar = product.querySelector('.temu-score-container');
                if (!bar) { bar = document.createElement('div'); bar.className = 'temu-score-container'; product.prepend(bar); }
                let pills = '';
                for (let i = 1; i <= 10; i++) {
                    let th = i * 10, fw = 0;
                    if (score >= th) fw = 100; else if (score > th - 10) fw = (score % 10) * 10;
                    pills += '<div class="temu-pill"><div class="temu-pill-fill" style="width:' + fw + '%;background:' + color + ';"></div></div>';
                }
                bar.innerHTML = '<div class="temu-pills-wrapper">' + pills + '</div><div class="temu-score-number" style="color:' + color + '">' + score + '</div>';

                // --- БОНУС HTML ---
                let bH = '<div class="tt-div"></div>';
                if (bonusList.length > 0) {
                    bH += '<div style="font-size:11px;font-weight:bold;color:#27ae60;margin-bottom:6px;">\u{1F381} Плюшки:</div>';
                    bonusList.forEach(b => {
                        bH += '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--tpw-sub);margin-bottom:3px;">' +
                            '<span>\u2022 ' + b.name + '</span>' +
                            '<span style="color:#27ae60;font-weight:bold;white-space:nowrap;margin-left:10px;">+' + b.pts.toFixed(1) + ' / ' + b.max + '</span></div>';
                    });
                    bH += '<div style="margin-top:8px;padding-top:6px;border-top:1px dotted var(--tpw-border);font-size:10.5px;color:#7f8c8d;text-align:right;">' +
                        'Разом: <b style="color:#27ae60;">' + bonusInt + ' / 20 б.</b></div>';
                } else {
                    bH += '<div style="font-size:11px;color:#999;text-align:center;font-style:italic;">Немає плюшок \u2794 0 / 20 б.</div>';
                }

                // --- TOOLTIP ---
                product.setAttribute('data-tooltip-html',
                    '<div style="text-align:center;font-size:22px;font-weight:900;color:' + color + ';margin-bottom:2px;">Загальний бал: ' + score + ' / 100</div>' +
                    '<div style="text-align:center;font-size:10px;color:#7f8c8d;margin-bottom:12px;font-style:italic;">(База: ' + base + ' / 80 б. + Плюшки: ' + bonusInt + ' / 20 б.)</div>' +
                    '<div class="tt-header"><span style="color:#7f8c8d">Стара ціна:</span> <span style="text-decoration:line-through">' + sym + fmt(rrp) + '</span></div>' +
                    '<div class="tt-header" style="margin-bottom:12px;"><span style="color:#27ae60;font-weight:bold;">Поточна ціна:</span><div>' +
                    '<span style="color:#95a5a6;font-size:11px;margin-right:5px;">' + conv + '</span>' +
                    '<b style="color:#27ae60;font-size:16px;">' + sym + fmt(price) + '</b></div></div>' +
                    '<div class="tt-div"></div>' +
                    '<div class="tt-row"><div class="tt-header"><span>\u{1F3F7}\uFE0F Знижка: <b>' + Math.round(disc) + '%</b></span><span class="tt-pts">' + pD + ' / ' + mxD + ' б.</span></div>' + miniBars(pD, mxD) + '</div>' +
                    '<div class="tt-row"><div class="tt-header"><span>\u2B50 Рейтинг: <b>' + rating.toFixed(1) + '</b></span><span class="tt-pts">' + pR + ' / ' + mxR + ' б.</span></div>' + miniBars(pR, mxR) + '</div>' +
                    '<div class="tt-row"><div class="tt-header"><span>\u{1F6D2} Продажі: <b>' + sales.toLocaleString('uk-UA') + '+</b></span><span class="tt-pts">' + pS + ' / ' + mxS + ' б.</span></div>' + miniBars(pS, mxS) + '</div>' +
                    '<div class="tt-row"><div class="tt-header"><span>\u{1F4DD} Відгуки: <b>' + reviews.toLocaleString('uk-UA') + '</b></span><span class="tt-pts">' + pV + ' / ' + mxV + ' б.</span></div>' + miniBars(pV, mxV) + '</div>' +
                    bH
                );
            } catch (err) { console.error('[Temu Pro] Помилка:', err); }
        });

        // Відправити статистику в sidepanel
        if (count > 0) {
            try {
                chrome.runtime.sendMessage({
                    action: 'statsUpdate',
                    processed: count,
                    avgScore: Math.round(totalScore / count)
                });
            } catch (e) { }
        }
    }

    window.addEventListener('load', () => {
        createMainWindow();
        setInterval(processCards, 800);
    });

    // Якщо сторінка вже завантажена
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        createMainWindow();
        setInterval(processCards, 800);
    }
})();
