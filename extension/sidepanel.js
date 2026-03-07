document.addEventListener('DOMContentLoaded', () => {
    // --- IFRAME MODE DETECTION ---
    const isInIframe = window.self !== window.top;
    const urlParams = new URLSearchParams(window.location.search);
    const isIframeMode = isInIframe || urlParams.get('mode') === 'iframe';

    // Активуємо iframe-mode стилі
    if (isIframeMode) {
        document.body.classList.add('iframe-mode');
    }

    // Вкладки
    document.querySelectorAll('.tpw-tab').forEach(t => {
        t.addEventListener('click', () => {
            const targetId = 'tpw-' + t.dataset.tab;
            document.querySelectorAll('.tpw-tab').forEach(x => x.classList.remove('active'));
            t.classList.add('active');

            document.querySelectorAll('.tpw-content').forEach(x => {
                x.classList.remove('active');
            });
            const targetEl = document.getElementById(targetId);
            if (targetEl) targetEl.classList.add('active');
        });
    });

    // Акордеон Налаштування алгоритму
    const algBtn = document.getElementById('tpw-alg-accordion-btn');
    if (algBtn) {
        algBtn.addEventListener('click', (e) => {
            if (e.target.closest('#btn-reset-alg')) return;
            const body = document.getElementById('tpw-alg-accordion-body');
            const icon = algBtn.querySelector('.tpw-accordion-icon');
            if (body && icon) {
                body.classList.toggle('open');
                icon.classList.toggle('open');
            }
        });
    }

    // Кнопки скидання
    const btnResetAlg = document.getElementById('btn-reset-alg');
    if (btnResetAlg) {
        btnResetAlg.addEventListener('click', (e) => {
            e.stopPropagation();
            chrome.storage.local.set({ wDiscount: 20, wRating: 20, wSales: 20, wReviews: 20 });
            ['wn-disc', 'wn-rat', 'wn-sal', 'wn-rev'].forEach(id => { const el = document.getElementById(id); if (el) el.value = 20; });
            updateSliderFills();
            updateSegmentedBarUI();
        });
    }

    const btnResetFilters = document.getElementById('btn-reset-filters');
    if (btnResetFilters) {
        btnResetFilters.addEventListener('click', (e) => {
            e.stopPropagation();
            const pMaxVal = parseFloat(document.getElementById('fs-pmax')?.max) || 10000;
            const defaults = {
                fMinScore: 0, fMinDiscount: 0, fMinRating: 0, fMinSales: 0, fMinReviews: 0,
                fMinPrice: 0, fMaxPrice: pMaxVal,
                filtersEnabled: false
            };
            chrome.storage.local.set(defaults);
            // Update UI inputs directly
            ['fn-score', 'fn-disc', 'fn-rat', 'fn-sal', 'fn-rev'].forEach(id => { const el = document.getElementById(id); if (el) el.value = 0; });
            ['fs-score', 'fs-disc', 'fs-rat', 'fs-sal', 'fs-rev'].forEach(id => { const el = document.getElementById(id); if (el) el.value = 0; });
            const pmin = document.getElementById('fs-pmin'); if (pmin) pmin.value = 0;
            const pmax = document.getElementById('fs-pmax'); if (pmax) pmax.value = pmax.max;
            const fMinP = document.getElementById('f-min-price'); if (fMinP) fMinP.value = 0;
            const fMaxP = document.getElementById('f-max-price'); if (fMaxP) fMaxP.value = pMaxVal;
            const cbF = document.getElementById('cb-filters'); if (cbF) cbF.checked = false;
            updateSliderFills();
        });
    }

    // Локалізація
    const i18n = {
        'en': {
            analytics: 'Analytics',
            filters: 'Filters',
            hoverHint: 'Hover over any product<br>to see its detailed score',
            algSettings: 'Algorithm Settings',
            discount: 'Discount:',
            rating: 'Rating:',
            sales: 'Sales:',
            reviews: 'Reviews:',
            active: 'Active',
            priceRange: 'Prices:',
            minScore: 'Score:',
            minDiscount: 'Discount %:',
            minRating: 'Rating:',
            minReviews: 'Reviews:',
            minSales: 'Sales:'
        }
    };

    chrome.storage.local.get(['extensionLang'], (res) => {
        const lang = res.extensionLang === 'en' ? 'en' : 'uk';
        if (lang === 'en') {
            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                if (i18n['en'][key]) {
                    if (key === 'hoverHint') {
                        el.innerHTML = i18n['en'][key];
                    } else {
                        el.textContent = i18n['en'][key];
                    }
                }
            });
        }
    });

    // Надійний конект з background для відслідковування onDisconnect (відкриття/закриття)
    // В iframe-режимі не підключаємось як sidepanel (це floating window)
    if (!isIframeMode) {
        chrome.runtime.connect({ name: 'sidepanel' });
    }

    // Слухаємо повідомлення з content.js та background.js
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'hoverInfo' && request.html) {
            const infoInject = document.getElementById('tpw-info-inject');
            if (infoInject) infoInject.innerHTML = request.html;

            // Автоматичне перемикання на вкладку Аналітика
            const infoTabBtn = document.querySelector('.tpw-tab[data-tab="info"]');
            if (infoTabBtn && !infoTabBtn.classList.contains('active')) {
                infoTabBtn.click();
            }
        }
        // Відповідаємо на ping від content.js — підтверджуємо що Side Panel живий
        if (request.action === 'pingSidePanel') {
            sendResponse({ alive: true });
        }
    });

    // --- IFRAME POSTMESSAGE LISTENER (від content.js) ---
    if (isIframeMode) {
        window.addEventListener('message', (e) => {
            if (!e.data || typeof e.data.type !== 'string') return;

            if (e.data.type === 'TPW_HOVER_INFO') {
                const infoInject = document.getElementById('tpw-info-inject');
                if (infoInject && e.data.html) {
                    infoInject.innerHTML = e.data.html;
                    infoInject.classList.remove('tpw-info-inject-empty');
                }
                // Автоматичне перемикання на вкладку Аналітика
                const infoTabBtn = document.querySelector('.tpw-tab[data-tab="info"]');
                if (infoTabBtn && !infoTabBtn.classList.contains('active')) {
                    infoTabBtn.click();
                }
            }
            else if (e.data.type === 'TPW_SWITCH_TAB') {
                const tabBtn = document.querySelector(`.tpw-tab[data-tab="${e.data.tab}"]`);
                if (tabBtn && !tabBtn.classList.contains('active')) {
                    tabBtn.click();
                }
            }
        });

        // --- DRAG FORWARDING: mousedown на header надсилає координати до parent ---
        const dragHandle = document.getElementById('tpw-drag-handle');
        if (dragHandle) {
            dragHandle.style.cursor = 'move';
            dragHandle.addEventListener('mousedown', (e) => {
                if (e.target.closest('button, input, label, .st-toggle-wrap, .st-segmented-control')) return;
                e.preventDefault();
                window.parent.postMessage({
                    type: 'TPW_DRAG_START',
                    x: e.screenX,
                    y: e.screenY
                }, '*');
            });
        }

        // --- COLLAPSE BUTTON: Forward to parent ---
        const btnCollapse = document.getElementById('btn-collapse');
        if (btnCollapse) {
            btnCollapse.addEventListener('click', () => {
                const tabsEl = document.getElementById('tpw-tabs');
                const bodyEl = document.getElementById('tpw-body');
                const isCollapsed = bodyEl && bodyEl.classList.contains('collapsed');
                const newState = !isCollapsed;
                if (tabsEl) tabsEl.classList.toggle('collapsed', newState);
                if (bodyEl) bodyEl.classList.toggle('collapsed', newState);
                btnCollapse.textContent = newState ? '+' : '—';
                window.parent.postMessage({
                    type: 'TPW_COLLAPSE_TOGGLE',
                    collapsed: newState
                }, '*');
            });
        }

        // --- SIDEPANEL BUTTON: Open real sidepanel + hide floating window ---
        const btnSidepanel = document.getElementById('btn-sidepanel');
        if (btnSidepanel) {
            btnSidepanel.addEventListener('click', () => {
                window.parent.postMessage({ type: 'TPW_OPEN_SIDEPANEL' }, '*');
            });
        }

        // --- DYNAMIC HEIGHT OBSERVER ---
        const resizeObserver = new ResizeObserver(() => {
            // Даємо невеличку затримку, щоб всі CSS транзиції висоти встигли відпрацювати
            setTimeout(() => {
                if (window.parent) {
                    window.parent.postMessage({
                        type: 'TPW_RESIZE',
                        height: document.documentElement.scrollHeight
                    }, '*');
                }
            }, 10);
        });
        resizeObserver.observe(document.body);
    }

    // Керовання контролами
    const cbMain = document.getElementById('cb-main-toggle');
    const cbFilters = document.getElementById('cb-filters');

    const btnReload = document.getElementById('btn-reload-sp');
    if (btnReload) {
        btnReload.addEventListener('click', () => {
            location.reload();
        });
    }

    const pMinSlide = document.getElementById('fs-pmin'), pMaxSlide = document.getElementById('fs-pmax');
    const pMinNum = document.getElementById('f-min-price'), pMaxNum = document.getElementById('f-max-price');

    function updateSliderFills() {
        let maxLimit = parseFloat(pMaxSlide.max) || 10000;
        let v1 = parseFloat(pMinSlide.value) || 0, v2 = parseFloat(pMaxSlide.value) || 0;
        let p1 = (Math.min(v1, v2) / maxLimit) * 100, p2 = (Math.max(v1, v2) / maxLimit) * 100;

        const dualTrack = document.querySelector('.dual-slider-track');
        const dualHighlight = document.querySelector('.dual-slider-highlight');
        if (dualTrack) dualTrack.style.background = '#e0e4e8';
        if (dualHighlight) {
            dualHighlight.style.left = `${p1}%`;
            dualHighlight.style.width = `${p2 - p1}%`;
        }

        // Per-category colors matching donut chart
        const sliderColorMap = {
            'fs-disc': '#9b59b6', 'fn-disc': '#9b59b6', // Discount (purple)
            'fs-rat': '#f39c12', 'fn-rat': '#f39c12',   // Rating (gold)
            'fs-sal': '#e74c3c', 'fn-sal': '#e74c3c',   // Sales (red)
            'fs-rev': '#3498db', 'fn-rev': '#3498db',   // Reviews (blue)
            // fs-score is handled specially
        };

        let wD = parseFloat(document.getElementById('wn-disc')?.value || 25) * 0.8;
        let wR = parseFloat(document.getElementById('wn-rat')?.value || 25) * 0.8;
        let wS = parseFloat(document.getElementById('wn-sal')?.value || 25) * 0.8;
        let wV = parseFloat(document.getElementById('wn-rev')?.value || 25) * 0.8;
        let c1 = wD, c2 = c1 + wR, c3 = c2 + wS, c4 = c3 + wV;
        const multiColorGradient = `linear-gradient(to right, #9b59b6 0 ${c1}%, #f1c40f ${c1}% ${c2}%, #e74c3c ${c2}% ${c3}%, #3498db ${c3}% ${c4}%, #27ae60 ${c4}% 100%)`;

        document.querySelectorAll('.single-range').forEach(input => {
            let max = parseFloat(input.max) || 100;
            let min = parseFloat(input.min) || 0;
            let val = parseFloat(input.value) || 0;
            let p = ((val - min) / (max - min)) * 100;
            const color = sliderColorMap[input.id] || '#0b7bff';

            if (input.id === 'fs-score') {
                input.style.setProperty('--track-bg', `linear-gradient(to right, #e0e4e8 ${p}%, transparent ${p}%), ${multiColorGradient}`, 'important');
            } else if (input.id.startsWith('fs-')) {
                // Фільтри
                input.style.setProperty('--track-bg', `linear-gradient(to right, #e0e4e8 ${p}%, ${color} ${p}%)`, 'important');
            }
        });
    }

    // F3: 80-Point Algorithm Auto-Balance (via Segmented Bar)
    const numIds = ['wn-disc', 'wn-rat', 'wn-sal', 'wn-rev'];
    const segIds = ['seg-disc', 'seg-rat', 'seg-sal', 'seg-rev'];

    function updateSegmentedBarUI() {
        let vals = numIds.map(id => {
            let v = parseFloat(document.getElementById(id).value);
            return isNaN(v) ? 0 : v;
        });
        let sum = vals.reduce((a, b) => a + b, 0);
        if (sum !== 80) {
            if (sum === 0) { vals = [20, 20, 20, 20]; }
            else { vals = vals.map(v => (v / sum) * 80); }
        }
        vals.forEach((v, i) => {
            const pct = (v / 80) * 100;
            const seg = document.getElementById(segIds[i]);
            if (seg) {
                seg.style.width = `${pct}%`;
                seg.textContent = Math.round(v) > 0 ? Math.round(v) : '';
            }
        });
    }

    function syncNumsToBar() {
        updateSegmentedBarUI();
        updateSliderFills();
        triggerUpdate();

        // T3.5 Send previewWeights instantly for real-time 60fps analytics hovering feedback
        let wD = parseFloat(document.getElementById('wn-disc')?.value || 0);
        let wR = parseFloat(document.getElementById('wn-rat')?.value || 0);
        let wS = parseFloat(document.getElementById('wn-sal')?.value || 0);
        let wV = parseFloat(document.getElementById('wn-rev')?.value || 0);
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs[0] && tabs[0].id) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "previewWeights",
                    weights: { wDiscount: wD, wRating: wR, wSales: wS, wReviews: wV }
                }).catch(() => {});
            }
        });
    }

    // Initialize drags
    document.querySelectorAll('.tpw-weight-divider').forEach(divider => {
        let isDragging = false;
        let startX, startVals, idx;

        divider.addEventListener('mousedown', (e) => {
            isDragging = true;
            idx = parseInt(divider.getAttribute('data-idx'));
            startX = e.clientX;
            startVals = numIds.map(id => parseFloat(document.getElementById(id).value) || 0);
            e.preventDefault(); 
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const bar = document.getElementById('tpw-weights-bar');
            if(!bar) return;
            const barWidth = bar.getBoundingClientRect().width;
            const deltaX = e.clientX - startX;
            const deltaVal = (deltaX / barWidth) * 80;

            let vals = [...startVals];
            if (deltaVal > 0) {
                let availRight = vals[idx + 1];
                let shift = Math.min(deltaVal, availRight);
                vals[idx] += shift;
                vals[idx + 1] -= shift;
            } else {
                let availLeft = vals[idx];
                let shift = Math.min(-deltaVal, availLeft);
                vals[idx] -= shift;
                vals[idx + 1] += shift;
            }

            vals[idx] = Math.round(Math.max(0, Math.min(80, vals[idx])) / 5) * 5;
            vals[idx+1] = Math.round(Math.max(0, Math.min(80, vals[idx+1])) / 5) * 5;

            let currentDiff = (vals[idx] + vals[idx+1]) - (startVals[idx] + startVals[idx+1]);
            vals[idx] -= currentDiff; 

            numIds.forEach((id, i) => document.getElementById(id).value = vals[i]);
            syncNumsToBar();
        });

        window.addEventListener('mouseup', () => { if (isDragging) isDragging = false; });
    });

    numIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => {
                let v = parseFloat(el.value);
                if (isNaN(v)) v = 0;
                v = Math.max(0, Math.min(80, v));
                el.value = v;

                let vals = numIds.map(i => parseFloat(document.getElementById(i).value) || 0);
                let sum = vals.reduce((a,b)=>a+b,0);
                if(sum !== 80) {
                    let diff = 80 - sum;
                    let targetIdx = numIds.indexOf(id) === 3 ? 2 : 3;
                    vals[targetIdx] = Math.max(0, vals[targetIdx] + diff);
                    numIds.forEach((iId, i) => document.getElementById(iId).value = vals[i]);
                }
                syncNumsToBar();
            });
        }
    });

    function updateDualSlider() {
        let val1 = parseInt(pMinSlide.value) || 0, val2 = parseInt(pMaxSlide.value) || 0;
        pMinNum.value = Math.min(val1, val2); pMaxNum.value = Math.max(val1, val2);
        updateSliderFills(); triggerUpdate();
    }
    function updateDualNum() {
        let val1 = parseFloat(pMinNum.value) || 0, val2 = parseFloat(pMaxNum.value) || 0;
        pMinSlide.value = Math.min(val1, val2); pMaxSlide.value = Math.max(val1, val2);
        updateSliderFills(); triggerUpdate();
    }
    function snapDualNum() {
        let step = parseFloat(pMinSlide.step) || 1;
        let val1 = parseFloat(pMinNum.value) || 0;
        let val2 = parseFloat(pMaxNum.value) || 0;
        pMinNum.value = Math.round(val1 / step) * step;
        pMaxNum.value = Math.round(val2 / step) * step;
        updateDualNum();
    }

    pMinSlide.addEventListener('input', updateDualSlider); pMaxSlide.addEventListener('input', updateDualSlider);
    pMinNum.addEventListener('input', updateDualNum); pMaxNum.addEventListener('input', updateDualNum);
    pMinNum.addEventListener('change', snapDualNum); pMinNum.addEventListener('blur', snapDualNum);
    pMaxNum.addEventListener('change', snapDualNum); pMaxNum.addEventListener('blur', snapDualNum);

    const bindSync = (slideId, numId) => {
        const slide = document.getElementById(slideId), num = document.getElementById(numId);
        slide.addEventListener('input', () => { num.value = slide.value; updateSliderFills(); triggerUpdate(); });
        num.addEventListener('input', () => { slide.value = num.value; updateSliderFills(); triggerUpdate(); });

        const snapNum = () => {
            let val = parseFloat(num.value) || 0;
            let step = parseFloat(slide.step) || 1;
            let snapped = Math.round(val / step) * step;
            // Handle floating point precision issues
            num.value = Number.isInteger(step) ? snapped : parseFloat(snapped.toFixed(2));
            slide.value = num.value;
            updateSliderFills();
            triggerUpdate();
        };
        num.addEventListener('change', snapNum);
        num.addEventListener('blur', snapNum);
    };

    bindSync('fs-score', 'fn-score'); bindSync('fs-disc', 'fn-disc'); bindSync('fs-rat', 'fn-rat'); bindSync('fs-rev', 'fn-rev'); bindSync('fs-sal', 'fn-sal');



    cbMain.addEventListener('change', triggerUpdate);
    cbFilters.addEventListener('change', triggerUpdate);

    // F1 Currency Segmented Control
    const currencyToggle = document.getElementById('tpw-currency-toggle');
    const currencyButtons = currencyToggle ? currencyToggle.querySelectorAll('.st-segment-btn') : [];
    const currencyActiveBg = document.getElementById('currency-active-bg');

    const updateCurrencyUI = (isSwapped) => {
        if (!currencyToggle || !currencyActiveBg) return;
        currencyButtons.forEach(btn => btn.classList.remove('st-active'));
        const activeBtn = isSwapped
            ? currencyToggle.querySelector('[data-currency="usd"]')
            : currencyToggle.querySelector('[data-currency="uah"]');
        if (activeBtn) {
            activeBtn.classList.add('st-active');
            currencyActiveBg.style.transform = `translateX(${activeBtn.offsetLeft - 2}px)`;
            currencyActiveBg.style.width = `${activeBtn.offsetWidth}px`;
        }
    };

    if (currencyToggle) {
        currencyToggle.addEventListener('click', () => {
            chrome.storage.local.get(['isSiteCurrencySwapped'], (res) => {
                const isSwapped = !res.isSiteCurrencySwapped;
                chrome.storage.local.set({ isSiteCurrencySwapped: isSwapped });
                updateCurrencyUI(isSwapped);
            });
        });
    }

    function triggerUpdate() {
        const state = {
            isScriptEnabled: cbMain.checked,
            filtersEnabled: cbFilters.checked,
            fMinPrice: parseFloat(pMinNum.value) || 0,
            fMaxPrice: parseFloat(pMaxNum.value) || 99999,
            fMinScore: parseFloat(document.getElementById('fn-score').value),
            fMinDiscount: parseFloat(document.getElementById('fn-disc').value),
            fMinRating: parseFloat(document.getElementById('fn-rat').value),
            fMinReviews: parseInt(document.getElementById('fn-rev').value),
            fMinSales: parseInt(document.getElementById('fn-sal').value),
            wDiscount: parseFloat(document.getElementById('wn-disc').value),
            wRating: parseFloat(document.getElementById('wn-rat').value),
            wSales: parseFloat(document.getElementById('wn-sal').value),
            wReviews: parseFloat(document.getElementById('wn-rev').value)
        };
        chrome.storage.local.set(state);
    }

    // Завантаження стану при старті
    chrome.storage.local.get(null, (res) => {
        if (res.isScriptEnabled !== undefined) cbMain.checked = res.isScriptEnabled;
        if (res.filtersEnabled !== undefined) cbFilters.checked = res.filtersEnabled;
        if (res.isSiteCurrencySwapped !== undefined) updateCurrencyUI(res.isSiteCurrencySwapped);

        if (res.currentCurrencyMax !== undefined) {
            pMinSlide.max = res.currentCurrencyMax;
            pMaxSlide.max = res.currentCurrencyMax;
        }
        if (res.currentCurrencyStep !== undefined) {
            pMinSlide.step = res.currentCurrencyStep;
            pMaxSlide.step = res.currentCurrencyStep;
        }

        if (res.fMinPrice !== undefined) { pMinSlide.value = res.fMinPrice; pMinNum.value = res.fMinPrice; }
        if (res.fMaxPrice !== undefined) { pMaxSlide.value = res.fMaxPrice; pMaxNum.value = res.fMaxPrice; }

        if (res.fMinScore !== undefined) { document.getElementById('fs-score').value = res.fMinScore; document.getElementById('fn-score').value = res.fMinScore; }
        if (res.fMinDiscount !== undefined) { document.getElementById('fs-disc').value = res.fMinDiscount; document.getElementById('fn-disc').value = res.fMinDiscount; }
        if (res.fMinRating !== undefined) { document.getElementById('fs-rat').value = res.fMinRating; document.getElementById('fn-rat').value = res.fMinRating; }
        if (res.fMinReviews !== undefined) { document.getElementById('fs-rev').value = res.fMinReviews; document.getElementById('fn-rev').value = res.fMinReviews; }
        if (res.fMinSales !== undefined) { document.getElementById('fs-sal').value = res.fMinSales; document.getElementById('fn-sal').value = res.fMinSales; }

        if (res.wDiscount !== undefined) { document.getElementById('wn-disc').value = res.wDiscount; }
        if (res.wRating !== undefined) { document.getElementById('wn-rat').value = res.wRating; }
        if (res.wSales !== undefined) { document.getElementById('wn-sal').value = res.wSales; }
        if (res.wReviews !== undefined) { document.getElementById('wn-rev').value = res.wReviews; }

        updateSliderFills();
        updateSegmentedBarUI();
    });

    // Слухаємо зміни зі сторінки, щоб синхронізувати UI
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            if (changes.isScriptEnabled !== undefined) cbMain.checked = changes.isScriptEnabled.newValue;
            if (changes.filtersEnabled !== undefined) cbFilters.checked = changes.filtersEnabled.newValue;
            if (changes.isSiteCurrencySwapped !== undefined) updateCurrencyUI(changes.isSiteCurrencySwapped.newValue);

            if (changes.currentCurrencyMax !== undefined) {
                pMinSlide.max = changes.currentCurrencyMax.newValue;
                pMaxSlide.max = changes.currentCurrencyMax.newValue;
            }
            if (changes.currentCurrencyStep !== undefined) {
                pMinSlide.step = changes.currentCurrencyStep.newValue;
                pMaxSlide.step = changes.currentCurrencyStep.newValue;
            }

            if (changes.fMinPrice !== undefined) {
                if (document.activeElement !== pMinSlide && document.activeElement !== pMinNum) {
                    pMinSlide.value = changes.fMinPrice.newValue; pMinNum.value = changes.fMinPrice.newValue;
                }
            }
            if (changes.fMaxPrice !== undefined) {
                if (document.activeElement !== pMaxSlide && document.activeElement !== pMaxNum) {
                    pMaxSlide.value = changes.fMaxPrice.newValue; pMaxNum.value = changes.fMaxPrice.newValue;
                }
            }

            const updText = (k, idS, idN) => {
                if (changes[k] !== undefined) {
                    document.getElementById(idS).value = changes[k].newValue;
                    document.getElementById(idN).value = changes[k].newValue;
                }
            };

            updText('fMinScore', 'fs-score', 'fn-score');
            updText('fMinDiscount', 'fs-disc', 'fn-disc');
            updText('fMinRating', 'fs-rat', 'fn-rat');
            updText('fMinReviews', 'fs-rev', 'fn-rev');
            updText('fMinSales', 'fs-sal', 'fn-sal');

            // Set raw numbers directly for weights now that WS sliders are gone
            if (changes['wDiscount']) document.getElementById('wn-disc').value = changes['wDiscount'].newValue;
            if (changes['wRating']) document.getElementById('wn-rat').value = changes['wRating'].newValue;
            if (changes['wSales']) document.getElementById('wn-sal').value = changes['wSales'].newValue;
            if (changes['wReviews']) document.getElementById('wn-rev').value = changes['wReviews'].newValue;

            updateSliderFills();
            updateSegmentedBarUI();
            syncEditableDisplays();

            // --- IFRAME HOVER IPC: отримуємо hover HTML через chrome.storage ---
            if (changes._iframeHoverHtml || changes._iframeHoverTs) {
                chrome.storage.local.get(['_iframeHoverHtml'], (res) => {
                    const html = res._iframeHoverHtml;
                    if (html) {
                        const infoInject = document.getElementById('tpw-info-inject');
                        if (infoInject) {
                            infoInject.innerHTML = html;
                            infoInject.classList.remove('tpw-info-inject-empty');
                        }
                        // Автоматичне перемикання на вкладку Аналітика
                        const infoTabBtn = document.querySelector('.tpw-tab[data-tab="info"]');
                        if (infoTabBtn && !infoTabBtn.classList.contains('active')) {
                            infoTabBtn.click();
                        }
                    }
                });
            }
            if (changes._iframeActiveTab) {
                const tabBtn = document.querySelector(`.tpw-tab[data-tab="${changes._iframeActiveTab.newValue}"]`);
                if (tabBtn && !tabBtn.classList.contains('active')) {
                    tabBtn.click();
                }
            }
        }
    });

    // Pencil-icon wrapping for number inputs
    function syncEditableDisplays() {
        document.querySelectorAll('.st-num-editable').forEach(wrapper => {
            const input = wrapper.querySelector('.st-num-input');
            const display = wrapper.querySelector('.st-num-display');
            if (input && display) display.textContent = input.value;
        });
    }

    (function wrapNumInputsWithPencil() {
        const pencilSvg = '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>';
        document.querySelectorAll('.st-num-input').forEach(input => {
            if (input.parentElement.classList.contains('st-num-editable')) return;

            const wrapper = document.createElement('div');
            wrapper.className = `st-num-editable ${input.id || ''}`;

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

            wrapper.addEventListener('click', () => {
                if (wrapper.classList.contains('editing')) return;
                wrapper.classList.add('editing');
                input.focus();
                input.select();
            });
            input.addEventListener('input', () => { display.textContent = input.value; });
            input.addEventListener('blur', () => { wrapper.classList.remove('editing'); display.textContent = input.value; });
            input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
        });
    })();

});
