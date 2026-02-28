(async function () {
    'use strict';

    // --- НАЛАШТУВАННЯ ТА КЕШ ---
    const defaultSettings = {
        isScriptEnabled: true,
        panelMode: 'sidepanel', // 'sidepanel' або 'floating'
        filtersEnabled: false,
        fMinScore: 0, fMinDiscount: 0, fMinRating: 4.0,
        fMinSales: 100, fMinReviews: 10,
        fMinPrice: 0, fMaxPrice: 5000,
        wDiscount: 25, wRating: 25, wSales: 25, wReviews: 25,
        exchangeRate: 41.0, lastRateFetch: 0
    };

    let settings = await chrome.storage.local.get(defaultSettings);
    let totalProcessed = 0;
    let totalScore = 0;

    function updateSetting(key, value) {
        settings[key] = value;
        chrome.storage.local.set({ [key]: value });
    }

    // --- СЛУХАЄМО ЗМІНИ НАЛАШТУВАНЬ (від sidepanel.js) ---
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.action === 'settingsChanged' && msg.settings) {
            Object.assign(settings, msg.settings);
            reprocessAllCards();
        }
        if (msg.action === 'panelModeChanged') {
            settings.panelMode = msg.mode;
            toggleFloatingWindow(msg.mode === 'floating');
        }
    });

    // --- ОНОВЛЕННЯ КУРСУ ВАЛЮТ (API) ---
    async function fetchExchangeRate() {
        const now = Date.now();
        if (now - settings.lastRateFetch < 3600000 && settings.exchangeRate > 0) return;
        try {
            const response = await chrome.runtime.sendMessage({ action: 'fetchExchangeRate' });
            if (response?.success && response.data?.rates?.UAH) {
                updateSetting('exchangeRate', response.data.rates.UAH);
                updateSetting('lastRateFetch', now);
            }
        } catch (e) { console.warn('[Temu Pro] Не вдалось оновити курс:', e); }
    }
    fetchExchangeRate();

    // --- CSS СТИЛІ ---
    function addStyle(css) {
        const style = document.createElement('style');
        style.textContent = css;
        document.head.append(style);
    }

    addStyle(`
        /* Панель балів на товарі */
        .temu-score-container {
            position: absolute; top: 0; left: 0; width: 100%; height: 22px;
            background: rgba(15,15,26,0.92); z-index: 50; border-radius: 8px 8px 0 0;
            display: flex; align-items: center; justify-content: space-between;
            padding: 0 8px; box-sizing: border-box; pointer-events: none;
            backdrop-filter: blur(4px);
        }
        .temu-pills-wrapper { display: flex; gap: 2px; flex: 1; margin-right: 8px; }
        .temu-pill { height: 5px; flex: 1; border-radius: 10px; background: rgba(255,255,255,0.15); overflow: hidden; position: relative; }
        .temu-pill-fill { height: 100%; position: absolute; left: 0; top: 0; transition: width 0.3s ease; }
        .temu-score-number { font-size: 13px; font-weight: 900; text-shadow: 0 0 6px rgba(0,0,0,0.5); }

        /* Позиціонування для обробленої картки */
        [data-temu-processed="true"] { position: relative; padding-top: 24px !important; }

        /* Tooltip при наведенні */
        .temu-tooltip-card {
            position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
            z-index: 99999; background: #0f0f1a; color: #e0e0e0; border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px; padding: 16px; width: 320px; font-family: 'Segoe UI', system-ui, sans-serif;
            box-shadow: 0 20px 60px rgba(0,0,0,0.7); backdrop-filter: blur(10px);
            pointer-events: none; opacity: 0; transition: opacity 0.2s; font-size: 12px;
        }
        [data-temu-processed="true"]:hover .temu-tooltip-card { opacity: 1; pointer-events: auto; }

        .tt-row { margin-bottom: 8px; }
        .tt-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px; font-size: 12px; }
        .tt-pts { color: #ff6b00; font-weight: bold; font-size: 11px; }
        .tt-bars { display: flex; gap: 2px; height: 4px; }
        .tt-bar { flex: 1; background: rgba(255,255,255,0.1); border-radius: 2px; }
        .tt-bar.filled { background: #3498db; }
        .tt-div { border-top: 1px solid rgba(255,255,255,0.08); margin: 10px 0; }

        /* Плаваюче міні-вікно (режим floating) */
        #temu-pro-floating {
            position: fixed; bottom: 20px; right: 20px; z-index: 9999999;
            background: #0f0f1a; color: #e0e0e0; border: 1px solid rgba(255,255,255,0.1);
            border-radius: 14px; padding: 12px 16px; width: 220px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.5); font-family: 'Segoe UI', system-ui, sans-serif;
            cursor: move; display: none; backdrop-filter: blur(10px);
        }
        #temu-pro-floating.visible { display: block; }
        #temu-pro-floating h3 { font-size: 13px; margin: 0 0 8px; color: #ff6b00; }
        #temu-pro-floating .mini-stat { font-size: 11px; color: #888; margin-bottom: 4px; }
        #temu-pro-floating .mini-stat b { color: #ff6b00; }
    `);

    // --- СТІЙКИЙ ПОШУК ТОВАРНИХ КАРТОК ---
    // Замість хардкодних класів Temu, шукаємо за структурними ознаками:
    // 1. Посилання на товар (a[href*="/goods-"]) — стабільний паттерн
    // 2. Елементи з цінами (₴, $)
    // 3. Картки з зображеннями товарів
    // Тему URL паттерн: /ua/[title]--g-601100135939404.html

    function findProductCards() {
        const found = new Set();

        // Стратегія 1: Посилання на товари (основний паттерн --g-[ID].html)
        document.querySelectorAll('a[href*="--g-"]:not([data-temu-link-scanned])').forEach(link => {
            link.setAttribute('data-temu-link-scanned', 'true');
            // Підніматись до батьківського контейнера картки (зазвичай 3-5 рівнів)
            let card = link.parentElement;
            for (let i = 0; i < 5 && card; i++) {
                if (card.tagName === 'DIV' && card.querySelector('img') && hasPrice(card)) break;
                card = card.parentElement;
            }
            if (card && !card.hasAttribute('data-temu-processed') && hasPrice(card)) {
                found.add(card);
            }
        });

        // Стратегія 2: Посилання з числовим ID (15+ цифр) в URL
        if (found.size === 0) {
            document.querySelectorAll('a[href$=".html"]:not([data-temu-link-scanned])').forEach(link => {
                link.setAttribute('data-temu-link-scanned', 'true');
                if (/\d{10,}\.html/.test(link.href)) {
                    let card = link.parentElement;
                    for (let i = 0; i < 5 && card; i++) {
                        if (card.tagName === 'DIV' && card.querySelector('img') && hasPrice(card)) break;
                        card = card.parentElement;
                    }
                    if (card && !card.hasAttribute('data-temu-processed') && hasPrice(card)) {
                        found.add(card);
                    }
                }
            });
        }

        // Стратегія 3: Елементи з числовим ID (як id="601101964097506")
        if (found.size === 0) {
            document.querySelectorAll('div[id]').forEach(div => {
                if (/^\d{10,}$/.test(div.id) && !div.hasAttribute('data-temu-processed') && hasPrice(div)) {
                    found.add(div);
                }
            });
        }

        return [...found];
    }

    function hasPrice(el) {
        const text = el.textContent;
        return text.includes('₴') || text.includes('$') || /\d+[.,]\d{2}/.test(text);
    }

    // --- СТІЙКИЙ ПАРСИНГ ДАНИХ З КАРТКИ ---
    function extractPrice(card) {
        const text = card.textContent;
        const isUAH = text.includes('₴') || text.toLowerCase().includes('грн');
        const isUSD = text.includes('$');

        // Шукаємо ціновий елемент: найменший контейнер з ціною
        let price = 0, rrp = 0;
        const allNums = [];

        // Знайти всі елементи з числами + валютою
        card.querySelectorAll('span, div, p').forEach(el => {
            const t = el.textContent.trim();
            if (t.length > 30 || t.length < 1) return; // фільтр сміття
            if (el.children.length > 3) return; // не контейнер

            const match = t.match(/[\d\s,.]+/);
            if (match && (t.includes('₴') || t.includes('$') || /^\d/.test(t.trim()))) {
                const val = parseFloat(match[0].replace(/\s/g, '').replace(',', '.')) || 0;
                if (val > 0 && val < 100000) {
                    const isStrikethrough = el.closest('del, s') !== null ||
                        window.getComputedStyle(el).textDecoration.includes('line-through');
                    allNums.push({ val, isStrikethrough, el });
                }
            }
        });

        // Сортуємо: перше — основна ціна (не закреслена), друге — стара
        const current = allNums.filter(n => !n.isStrikethrough).sort((a, b) => a.val - b.val);
        const old = allNums.filter(n => n.isStrikethrough);

        if (current.length > 0) price = current[0].val;
        if (old.length > 0) rrp = old[0].val;
        if (rrp === 0 && current.length > 1) rrp = current[current.length - 1].val;

        return { price, rrp, isUAH, isUSD, currencySymbol: isUAH ? '₴' : (isUSD ? '$' : '') };
    }

    function extractRating(card) {
        // Стратегія 1: aria-label з рейтингом
        const ariaEl = card.querySelector('[aria-label*="зір"], [aria-label*="star"], [aria-label*="rating"]');
        if (ariaEl) {
            const match = ariaEl.getAttribute('aria-label').match(/[\d.,]+/);
            if (match) return parseFloat(match[0].replace(',', '.')) || 0;
        }

        // Стратегія 2: Елемент з шириною (зірки як CSS width)
        const widthEl = card.querySelector('[style*="width"]');
        if (widthEl) {
            const w = parseFloat(widthEl.style.width);
            if (w > 0 && w <= 100) return (w / 100) * 5;
        }

        // Стратегія 3: Текст з числом 1-5 біля зірки
        const text = card.textContent;
        const match = text.match(/(\d[.,]\d)\s*(?:⭐|★|зір)/i) || text.match(/(?:⭐|★)\s*(\d[.,]\d)/i);
        if (match) return parseFloat(match[1].replace(',', '.')) || 0;

        return 0;
    }

    function extractSales(card) {
        const text = card.textContent.toLowerCase();
        // "10тис+ продано", "5k+ sold", "1.2к прод"
        const match = text.match(/(\d[\d\s.,]*)\s*(?:тис|k|к|млн|m)?\+?\s*(?:продан|sold|куплен|прод)/i);
        if (match) {
            let val = parseFloat(match[1].replace(/[\s,]/g, '').replace(',', '.'));
            if (text.includes('тис') || text.includes('k') || text.includes('к')) val *= 1000;
            if (text.includes('млн') || text.includes('m')) val *= 1000000;
            return Math.round(val);
        }
        return 0;
    }

    function extractReviews(card) {
        const text = card.textContent;
        // "1234 відгук" "500+ reviews"
        const match = text.match(/([\d\s.,]+)\s*(?:відгук|review|отзыв)/i);
        if (match) return parseInt(match[1].replace(/[\s.,]/g, '')) || 0;

        // Число в дужках після рейтингу: "4.8 (1234)"
        const parenMatch = text.match(/\d[.,]\d\s*\((\d[\d\s.,]*)\)/);
        if (parenMatch) return parseInt(parenMatch[1].replace(/[\s.,]/g, '')) || 0;

        return 0;
    }

    // --- МАТЕМАТИКА БАЛІВ ---
    function getColor(score) {
        if (score >= 80) return '#27ae60';
        if (score >= 60) return '#f39c12';
        if (score >= 40) return '#e67e22';
        return '#e74c3c';
    }

    function renderMiniBars(pts, maxPts) {
        let bars = '';
        for (let i = 0; i < 10; i++) {
            bars += `<div class="tt-bar${i < Math.round((pts / Math.max(maxPts, 1)) * 10) ? ' filled' : ''}"></div>`;
        }
        return `<div class="tt-bars">${bars}</div>`;
    }

    // --- ГОЛОВНА ФУНКЦІЯ ОБРОБКИ ---
    function processCards() {
        if (!settings.isScriptEnabled) return;

        const cards = findProductCards();
        cards.forEach(card => {
            try {
                card.setAttribute('data-temu-processed', 'true');

                // Парсинг
                const { price, rrp, isUAH, isUSD, currencySymbol } = extractPrice(card);
                const rating = extractRating(card);
                const sales = extractSales(card);
                const reviews = extractReviews(card);

                const formatPrice = (val) => isUAH ? Math.round(val).toLocaleString('uk-UA') : val.toFixed(2);

                // Конвертація
                let convertedStr = '';
                if (settings.exchangeRate > 0 && price > 0) {
                    if (isUAH) convertedStr = `(≈ $${(price / settings.exchangeRate).toFixed(2)})`;
                    else if (isUSD) convertedStr = `(≈ ₴${Math.round(price * settings.exchangeRate).toLocaleString('uk-UA')})`;
                }

                // Знижка
                let discountPercent = 0;
                if (rrp > 0 && price > 0 && price < rrp) discountPercent = ((rrp - price) / rrp) * 100;

                // --- БОНУСИ ---
                let allText = card.textContent.toLowerCase();
                let bonusPointsFinal = 0;
                let bonusLines = [];

                let isBestseller = allText.includes('найпродаваніший') || allText.includes('топ продажів') || allText.includes('найкращі продажі') || allText.includes('best seller');
                if (isBestseller) {
                    let rankMatch = allText.match(/#(\d+)/);
                    let rank = rankMatch ? parseInt(rankMatch[1]) : 50;
                    let rankBasePoints = Math.max(0, ((50 - rank) / 50) * 8.5);
                    bonusPointsFinal += rankBasePoints;
                    bonusLines.push({ name: `Бестселер #${rank}`, pts: rankBasePoints, max: 8.5 });
                }

                if (allText.includes('найвищий рейтинг') || allText.includes('top rated')) { bonusPointsFinal += 3.5; bonusLines.push({ name: 'Топ рейтинг', pts: 3.5, max: 3.5 }); }
                if (allText.includes('зірковий продавець') || allText.includes('star seller')) { bonusPointsFinal += 5.0; bonusLines.push({ name: 'Зірковий продавець', pts: 5.0, max: 5.0 }); }
                if (allText.includes('бренд') || allText.includes('brand')) { bonusPointsFinal += 3.5; bonusLines.push({ name: 'Бренд', pts: 3.5, max: 3.5 }); }
                if (allText.includes('місцевий склад') || allText.includes('local warehouse')) { bonusPointsFinal += 3.5; bonusLines.push({ name: 'Місцевий склад', pts: 3.5, max: 3.5 }); }
                else if (allText.includes('швидка доставка') || allText.includes('fast delivery')) { bonusPointsFinal += 1.5; bonusLines.push({ name: 'Швидка доставка', pts: 1.5, max: 1.5 }); }

                // --- ВАГОВА МОДЕЛЬ ---
                let nDisc = Math.min(100, Math.max(0, discountPercent));
                let nRat = (rating / 5) * 100;
                let nSal = Math.min(100, (sales / 5000) * 100);
                let nRev = Math.min(100, (reviews / 1000) * 100);

                let totalWeight = settings.wDiscount + settings.wRating + settings.wSales + settings.wReviews || 1;

                let ptsDiscInt = Math.round((nDisc * settings.wDiscount / totalWeight) * 0.80);
                let ptsRatInt = Math.round((nRat * settings.wRating / totalWeight) * 0.80);
                let ptsSalInt = Math.round((nSal * settings.wSales / totalWeight) * 0.80);
                let ptsRevInt = Math.round((nRev * settings.wReviews / totalWeight) * 0.80);

                let maxPtsDiscInt = Math.round(((settings.wDiscount / totalWeight) * 100) * 0.80);
                let maxPtsRatInt = Math.round(((settings.wRating / totalWeight) * 100) * 0.80);
                let maxPtsSalInt = Math.round(((settings.wSales / totalWeight) * 100) * 0.80);
                let maxPtsRevInt = Math.round(((settings.wReviews / totalWeight) * 100) * 0.80);

                let baseScoreInt = ptsDiscInt + ptsRatInt + ptsSalInt + ptsRevInt;

                const MAX_BONUS = 20;
                let bonusContributionInt = Math.round(Math.min(bonusPointsFinal, MAX_BONUS));
                let finalScore = Math.min(100, Math.max(0, baseScoreInt + bonusContributionInt));
                let color = getColor(finalScore);

                // --- ФІЛЬТРАЦІЯ ---
                if (settings.filtersEnabled) {
                    if (finalScore < settings.fMinScore || discountPercent < settings.fMinDiscount ||
                        rating < settings.fMinRating || reviews < settings.fMinReviews || sales < settings.fMinSales ||
                        price < settings.fMinPrice || price > settings.fMaxPrice) {
                        card.style.display = 'none'; return;
                    } else { card.style.display = ''; }
                } else { card.style.display = ''; }

                // --- SCORE BAR (на товарі) ---
                let bar = card.querySelector('.temu-score-container');
                if (!bar) { bar = document.createElement('div'); bar.className = 'temu-score-container'; card.prepend(bar); }

                let pillsHtml = '';
                for (let i = 1; i <= 10; i++) {
                    let threshold = i * 10, fillWidth = 0;
                    if (finalScore >= threshold) fillWidth = 100;
                    else if (finalScore > threshold - 10) fillWidth = (finalScore % 10) * 10;
                    pillsHtml += `<div class="temu-pill"><div class="temu-pill-fill" style="width: ${fillWidth}%; background: ${color};"></div></div>`;
                }
                bar.innerHTML = `<div class="temu-pills-wrapper">${pillsHtml}</div><div class="temu-score-number" style="color: ${color}">${finalScore}</div>`;

                // --- TOOLTIP (при наведенні) ---
                let tooltip = card.querySelector('.temu-tooltip-card');
                if (!tooltip) { tooltip = document.createElement('div'); tooltip.className = 'temu-tooltip-card'; card.appendChild(tooltip); }

                let bonusHtml = '';
                if (bonusLines.length > 0) {
                    bonusHtml = `<div style="margin-top:4px;font-size:11px;color:#27ae60;font-weight:700;">🎁 Бонуси:</div>`;
                    bonusLines.forEach(b => {
                        bonusHtml += `<div style="display:flex;justify-content:space-between;font-size:11px;color:#888;margin:2px 0;"><span>• ${b.name}</span><span style="color:#27ae60;font-weight:700;">+${b.pts.toFixed(1)}</span></div>`;
                    });
                }

                tooltip.innerHTML = `
                    <div style="text-align:center;font-size:24px;font-weight:900;color:${color};margin-bottom:4px;">Бал: ${finalScore}/100</div>
                    <div style="text-align:center;font-size:10px;color:#555;margin-bottom:10px;">База: ${baseScoreInt}/80 + Бонуси: ${bonusContributionInt}/20</div>
                    <div class="tt-div"></div>
                    <div class="tt-row"><div class="tt-header"><span>💰 ${currencySymbol}${formatPrice(price)} ${convertedStr}</span></div></div>
                    ${rrp > 0 ? `<div class="tt-row"><div class="tt-header"><span style="text-decoration:line-through;color:#666;">Стара: ${currencySymbol}${formatPrice(rrp)}</span></div></div>` : ''}
                    <div class="tt-div"></div>
                    <div class="tt-row"><div class="tt-header"><span>🏷️ Знижка: <b>${Math.round(discountPercent)}%</b></span><span class="tt-pts">${ptsDiscInt}/${maxPtsDiscInt}</span></div>${renderMiniBars(ptsDiscInt, maxPtsDiscInt)}</div>
                    <div class="tt-row"><div class="tt-header"><span>⭐ Рейтинг: <b>${rating.toFixed(1)}</b></span><span class="tt-pts">${ptsRatInt}/${maxPtsRatInt}</span></div>${renderMiniBars(ptsRatInt, maxPtsRatInt)}</div>
                    <div class="tt-row"><div class="tt-header"><span>🛒 Продажі: <b>${sales.toLocaleString('uk-UA')}+</b></span><span class="tt-pts">${ptsSalInt}/${maxPtsSalInt}</span></div>${renderMiniBars(ptsSalInt, maxPtsSalInt)}</div>
                    <div class="tt-row"><div class="tt-header"><span>📝 Відгуки: <b>${reviews.toLocaleString('uk-UA')}</b></span><span class="tt-pts">${ptsRevInt}/${maxPtsRevInt}</span></div>${renderMiniBars(ptsRevInt, maxPtsRevInt)}</div>
                    ${bonusHtml}
                `;

                // Лічильник
                totalProcessed++;
                totalScore += finalScore;

            } catch (err) { console.error("[Temu Pro] Помилка обробки:", err); }
        });

        // Надіслати статистику в sidepanel
        if (totalProcessed > 0) {
            chrome.runtime.sendMessage({
                action: 'statsUpdate',
                processed: totalProcessed,
                avgScore: Math.round(totalScore / totalProcessed)
            }).catch(() => { });
        }
    }

    function reprocessAllCards() {
        document.querySelectorAll('[data-temu-processed]').forEach(el => {
            el.removeAttribute('data-temu-processed');
            const bar = el.querySelector('.temu-score-container');
            if (bar) bar.remove();
            const tip = el.querySelector('.temu-tooltip-card');
            if (tip) tip.remove();
        });
        totalProcessed = 0; totalScore = 0;
        processCards();
    }

    // --- ПЛАВАЮЧЕ МІНІ-ВІКНО (режим floating) ---
    function createFloatingWindow() {
        if (document.getElementById('temu-pro-floating')) return;
        const win = document.createElement('div');
        win.id = 'temu-pro-floating';
        win.innerHTML = `
            <h3>🛒 Temu Pro</h3>
            <div class="mini-stat">Оброблено: <b id="float-processed">0</b></div>
            <div class="mini-stat">Сер. бал: <b id="float-avg">—</b></div>
            <div style="text-align:right;margin-top:8px;">
                <button id="btn-to-sidepanel" style="background:#ff6b00;color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:10px;cursor:pointer;">📌 Side Panel</button>
            </div>
        `;
        document.body.appendChild(win);

        // Drag
        let isDrag = false, dx = 0, dy = 0;
        win.addEventListener('mousedown', e => {
            if (e.target.tagName === 'BUTTON') return;
            isDrag = true; dx = e.clientX - win.offsetLeft; dy = e.clientY - win.offsetTop;
        });
        document.addEventListener('mousemove', e => { if (isDrag) { win.style.left = (e.clientX - dx) + 'px'; win.style.right = 'auto'; win.style.top = (e.clientY - dy) + 'px'; win.style.bottom = 'auto'; } });
        document.addEventListener('mouseup', () => isDrag = false);

        win.querySelector('#btn-to-sidepanel').addEventListener('click', () => {
            settings.panelMode = 'sidepanel';
            chrome.storage.local.set({ panelMode: 'sidepanel' });
            toggleFloatingWindow(false);
        });
    }

    function toggleFloatingWindow(show) {
        const win = document.getElementById('temu-pro-floating');
        if (show) {
            createFloatingWindow();
            document.getElementById('temu-pro-floating')?.classList.add('visible');
        } else {
            win?.classList.remove('visible');
        }
    }

    function updateFloatingStats() {
        const p = document.getElementById('float-processed');
        const a = document.getElementById('float-avg');
        if (p) p.textContent = totalProcessed;
        if (a) a.textContent = totalProcessed > 0 ? Math.round(totalScore / totalProcessed) : '—';
    }

    // --- ЗАПУСК ---
    window.addEventListener('load', () => {
        if (settings.panelMode === 'floating') toggleFloatingWindow(true);

        setInterval(() => {
            processCards();
            updateFloatingStats();
        }, 800);
    });
})();
