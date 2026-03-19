document.addEventListener('DOMContentLoaded', () => {
    // --- ВЕРСІЯ ТА ДАТА БІЛДУ (оновлювати тут, не в HTML) ---
    const SP_VERSION = '16.0';
    const SP_BUILD   = '14.03.2026';
    const buildStamp = document.getElementById('tpw-build-time');
    if (buildStamp) buildStamp.textContent = `v${SP_VERSION} • ${SP_BUILD}`;

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

    let currentWeights = [20, 20, 20, 20, 20];
    let isEditingMaxScore = false; // B12 flag

    // B10 logic: Proportional weight scaling
    function applyProportionalWeightChange(key, newVal) {
        const keysMap = { 'wDiscount': 0, 'wRating': 1, 'wSales': 2, 'wReviews': 3, 'wBonuses': 4 };
        const changedIdx = keysMap[key];
        if (changedIdx === undefined) return;
        
        let curVal = currentWeights[changedIdx];
        let delta = newVal - curVal;
        if (delta === 0) return;

        let othersSum = 0;
        for (let i = 0; i < 5; i++) {
            if (i !== changedIdx) othersSum += currentWeights[i];
        }

        let newWeightsData = { [key]: newVal };
        let tempWeights = [...currentWeights];
        tempWeights[changedIdx] = newVal;
        
        if (othersSum > 0) {
            let remainDelta = -delta;
            for (let i = 0; i < 5; i++) {
                if (i !== changedIdx) {
                    let share = othersSum > 0 ? Math.round((-delta) * (currentWeights[i] / othersSum)) : 0;
                    tempWeights[i] = Math.max(0, currentWeights[i] + share);
                    remainDelta -= share;
                }
            }
            // Add any left over remainder due to rounding to the largest element
            let error = 100 - tempWeights.reduce((a, b) => a + b, 0);
            if (error !== 0) {
                let maxIdx = -1, maxVal = -1;
                for (let i=0; i<5; i++) {
                    if (i !== changedIdx && tempWeights[i] > maxVal) {
                        maxVal = tempWeights[i]; maxIdx = i;
                    }
                }
                if (maxIdx !== -1) tempWeights[maxIdx] += error;
            }
            
            const revKeys = ['wDiscount', 'wRating', 'wSales', 'wReviews', 'wBonuses'];
            for (let i = 0; i < 5; i++) {
                if (i !== changedIdx) newWeightsData[revKeys[i]] = tempWeights[i];
            }
        }
        chrome.storage.local.set(newWeightsData);
    }

    // Кнопки скидання
    const btnResetAlg = document.getElementById('btn-reset-alg');
    if (btnResetAlg) {
        btnResetAlg.addEventListener('click', (e) => {
            e.stopPropagation();
            chrome.storage.local.set({ wDiscount: 20, wRating: 20, wSales: 20, wReviews: 20, wBonuses: 20 });
            currentWeights = [20, 20, 20, 20, 20];
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
                fMinScore: 0, fMinDiscount: 0, fMinRating: 0, fMinSales: 0, fMinReviews: 0, fQuantity: 1,
                fMinPrice: 0, fMaxPrice: pMaxVal,
                filtersEnabled: false,
                fBonusExtraDiscount: false, fBonusTopRating: false, fBonusStarSeller: false, fBonusImported: false
            };
            chrome.storage.local.set(defaults);
            // Update UI inputs directly
            ['fn-score', 'fn-disc', 'fn-rat', 'fn-sal', 'fn-rev'].forEach(id => { const el = document.getElementById(id); if (el) el.value = 0; });
            ['fs-score', 'fs-disc', 'fs-rat', 'fs-sal', 'fs-rev'].forEach(id => { const el = document.getElementById(id); if (el) el.value = 0; });
            const fnQty = document.getElementById('fn-qty'); if (fnQty) fnQty.value = 1;
            const fsQty = document.getElementById('fs-qty'); if (fsQty) fsQty.value = 1;
            const pmin = document.getElementById('fs-pmin'); if (pmin) pmin.value = 0;
            const pmax = document.getElementById('fs-pmax'); if (pmax) pmax.value = pmax.max;
            const fMinP = document.getElementById('f-min-price'); if (fMinP) fMinP.value = 0;
            const fMaxP = document.getElementById('f-max-price'); if (fMaxP) fMaxP.value = pMaxVal;
            const cbF = document.getElementById('cb-filters'); if (cbF) cbF.checked = false;
            ['cb-bonus-extra-discount', 'cb-bonus-top-rating', 'cb-bonus-star-seller', 'cb-bonus-imported'].forEach(id => {
                const el = document.getElementById(id); if (el) el.checked = false;
            });
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
            // Ігноруємо повідомлення від неактивних вкладок — це запобігає мерехтінню
            // коли кілька вкладок Temu відкриті одночасно
            if (sender.tab && !sender.tab.active) return;
            if (isEditingMaxScore) return; // B12 FIX

            const infoInject = document.getElementById('tpw-info-inject');
            if (infoInject) {
                infoInject.innerHTML = request.html;
                infoInject.classList.remove('tpw-info-inject-empty');
                // Прикріплюємо обробник редагування до .tt-max-editable (як в isIframeMode)
                infoInject.querySelectorAll('.tt-max-editable').forEach(span => {
                    if (span.dataset.editAttached) return;
                    span.dataset.editAttached = 'true';
                    span.title = 'Клікніть для зміни ваги';
                    span.style.cssText = 'cursor:pointer; border-bottom:1px dashed transparent; display:inline-flex; align-items:center; gap:3px; padding:0 2px;';
                    
                    if (!span.querySelector('svg')) {
                        span.insertAdjacentHTML('beforeend', '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>');
                    }

                    span.addEventListener('click', function(ev) {
                        ev.stopPropagation();
                        const key = this.dataset.key;
                        const cur = parseInt(this.textContent) || 20;
                        const inp = document.createElement('input');
                        inp.type = 'number'; inp.value = cur; inp.min = 1; inp.max = 80;
                        inp.style.cssText = 'width:32px; border:1px solid #34c759; border-radius:3px; font-size:11px; font-weight:700; text-align:center; outline:none; padding:0; background:#fff; margin-left:2px;';
                        isEditingMaxScore = true;
                        this.replaceWith(inp); inp.focus(); inp.select();
                        const save = () => {
                            let val = Math.max(1, Math.min(100, parseInt(inp.value) || cur));
                            const newSpan = document.createElement('span');
                            newSpan.className = 'tt-max-editable'; newSpan.dataset.key = key;
                            newSpan.innerHTML = `${val}<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`;
                            inp.replaceWith(newSpan);
                            if (typeof applyProportionalWeightChange === 'function') {
                                applyProportionalWeightChange(key, val);
                            } else {
                                chrome.storage.local.set({ [key]: val });
                            }
                            setTimeout(() => { isEditingMaxScore = false; }, 200);
                        };
                        inp.addEventListener('blur', save);
                        inp.addEventListener('keydown', e => { if (e.key==='Enter') inp.blur(); if (e.key==='Escape') { inp.value=cur; inp.blur(); } });
                    });
                });
            }
            // Removed automatic tab switching here to prevent constant jumping
        }
        if (request.action === 'switchTab') {
            const tabBtn = document.querySelector(`.tpw-tab[data-tab="${request.tab}"]`);
            if (tabBtn && !tabBtn.classList.contains('active')) {
                tabBtn.click();
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
                if (isEditingMaxScore) return; // B12 FIX

                const infoInject = document.getElementById('tpw-info-inject');
                if (infoInject && e.data.html) {
                    infoInject.innerHTML = e.data.html;
                    infoInject.classList.remove('tpw-info-inject-empty');
                    
                    // Bug 6 FIX: порівнюємо cardId (не HTML!) — автоперемикання ТІЛЬКИ якщо змінився товар
                    const incomingCardId = e.data.cardId || '';
                    const isNewProduct = incomingCardId !== '' && incomingCardId !== window._lastHoverCardId;
                    window._lastHoverCardId = incomingCardId;
                    
                    if (isNewProduct) {
                        // Відновлено авто-світч на вкладку "Аналітика" за проханням юзера
                        const infoTabBtn = document.querySelector('.tpw-tab[data-tab="info"]');
                        if (infoTabBtn && !infoTabBtn.classList.contains('active')) {
                            infoTabBtn.click();
                        }
                    }
                    // Pencil-edit delegation: на нові елементи .tt-max-editable додаємо редагування
                    infoInject.querySelectorAll('.tt-max-editable').forEach(span => {
                        if (span.dataset.editAttached) return;
                        span.dataset.editAttached = 'true';
                        span.title = 'Клікніть для зміни ваги';
                        span.style.cssText = 'cursor:pointer; border-bottom:1px dashed transparent; display:inline-flex; align-items:center; gap:3px; padding:0 2px;';
                        
                        if (!span.querySelector('svg')) {
                            span.insertAdjacentHTML('beforeend', '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>');
                        }

                        span.addEventListener('click', function(ev) {
                            ev.stopPropagation();
                            const key = this.dataset.key;
                            const cur = parseInt(this.textContent) || 20;
                            const inp = document.createElement('input');
                            inp.type = 'number'; inp.value = cur; inp.min = 1; inp.max = 80;
                            inp.style.cssText = 'width:32px; border:1px solid #34c759; border-radius:3px; font-size:11px; font-weight:700; text-align:center; outline:none; padding:0; background:#fff; margin-left:2px;';
                            isEditingMaxScore = true;
                            this.replaceWith(inp); inp.focus(); inp.select();
                            const save = () => {
                                let val = Math.max(1, Math.min(100, parseInt(inp.value) || cur));
                                const newSpan = document.createElement('span');
                                newSpan.className = 'tt-max-editable'; newSpan.dataset.key = key;
                                newSpan.innerHTML = `${val}<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`;
                                inp.replaceWith(newSpan);
                                if (typeof applyProportionalWeightChange === 'function') {
                                    applyProportionalWeightChange(key, val);
                                } else {
                                    chrome.storage.local.set({ [key]: val });
                                }
                                setTimeout(() => { isEditingMaxScore = false; }, 200);
                            };
                            inp.addEventListener('blur', save);
                            inp.addEventListener('keydown', e => { if (e.key==='Enter') inp.blur(); if (e.key==='Escape') { inp.value=cur; inp.blur(); } });
                        });
                    });
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
        let _isCollapsed = false; // Відслідковуємо стан локально
        if (btnCollapse) {
            btnCollapse.addEventListener('click', () => {
                const tabsEl = document.getElementById('tpw-tabs');
                const bodyEl = document.getElementById('tpw-body');
                _isCollapsed = !_isCollapsed;
                if (tabsEl) tabsEl.classList.toggle('collapsed', _isCollapsed);
                if (bodyEl) bodyEl.classList.toggle('collapsed', _isCollapsed);
                
                if (_isCollapsed) {
                    btnCollapse.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
                    btnCollapse.title = "Розгорнути";
                } else {
                    btnCollapse.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" class="tpw-icon-collapse" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
                    btnCollapse.title = "Згорнути";
                }

                window.parent.postMessage({
                    type: 'TPW_COLLAPSE_TOGGLE',
                    collapsed: _isCollapsed
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
                    let totalHeight = document.getElementById('tpw-header').offsetHeight;
                    let isCollapsed = document.getElementById('tpw-tabs').classList.contains('collapsed');
                    
                    if (!isCollapsed) {
                        totalHeight += document.getElementById('tpw-tabs').scrollHeight;
                        totalHeight += document.getElementById('tpw-body').scrollHeight;
                        // додаємо padding, який є на tpw-content
                        totalHeight += 40;
                    }
                    
                    // Додатково беремо гарантований scrollHeight тільки якщо не згорнуто
                    let bestHeight = isCollapsed ? totalHeight : Math.max(totalHeight, document.documentElement.scrollHeight);
                    
                    if (bestHeight < 400 && !isCollapsed) {
                        bestHeight = 400; // мінімальна нормальна висота панелі
                    }
                    if (bestHeight < 48) bestHeight = 48; // мінімальна висота header
                    
                    window.parent.postMessage({
                        type: 'TPW_RESIZE',
                        height: bestHeight
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

        let wD = currentWeights[0];
        let wR = currentWeights[1];
        let wS = currentWeights[2];
        let wV = currentWeights[3];
        let wB = currentWeights[4];
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

    // F3: 100-Point Algorithm Auto-Balance (via Segmented Bar)
    const segIds = ['seg-disc', 'seg-rat', 'seg-sal', 'seg-rev', 'seg-bonuses'];

    function updateSegmentedBarUI() {
        let sum = currentWeights.reduce((a, b) => a + b, 0);
        if (sum !== 100) {
            if (sum === 0) { currentWeights = [20, 20, 20, 20, 20]; }
            else { currentWeights = currentWeights.map(v => (v / sum) * 100); }
        }
        currentWeights.forEach((v, i) => {
            const seg = document.getElementById(segIds[i]);
            if (seg) {
                seg.style.width = `${v}%`;
                seg.textContent = Math.round(v) > 0 ? Math.round(v) : '';
            }
        });
    }

    function syncNumsToBar() {
        updateSegmentedBarUI();
        updateSliderFills();
        triggerUpdate();

        // T3.5 Send previewWeights instantly for real-time 60fps analytics hovering feedback
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs[0] && tabs[0].id) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "previewWeights",
                    weights: { wDiscount: currentWeights[0], wRating: currentWeights[1], wSales: currentWeights[2], wReviews: currentWeights[3], wBonuses: currentWeights[4] }
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
            startVals = [...currentWeights];
            e.preventDefault(); 
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const bar = document.getElementById('tpw-weights-bar');
            if(!bar) return;
            const barWidth = bar.getBoundingClientRect().width;
            const deltaX = e.clientX - startX;
            const deltaVal = (deltaX / barWidth) * 100;

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

            vals[idx] = Math.round(Math.max(0, Math.min(100, vals[idx])) / 5) * 5;
            vals[idx+1] = Math.round(Math.max(0, Math.min(100, vals[idx+1])) / 5) * 5;

            let currentDiff = (vals[idx] + vals[idx+1]) - (startVals[idx] + startVals[idx+1]);
            vals[idx] -= currentDiff; 

            currentWeights = vals;
            syncNumsToBar();
        });

        window.addEventListener('mouseup', () => { if (isDragging) isDragging = false; });
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
    // B11: fn-qty оновлюється прі пресет-кнопках (fs-qty видалено з Фільтрів)
    const fnQtyEl = document.getElementById('fn-qty');
    if (fnQtyEl) {
        fnQtyEl.addEventListener('input', () => { triggerUpdate(); updateActivePreset(parseInt(fnQtyEl.value)||1); });
        fnQtyEl.addEventListener('change', () => { triggerUpdate(); });
    }

    // B11: Preset-кнопки комплекту
    function updateActivePreset(val) {
        document.querySelectorAll('.qty-preset').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.val) === val);
        });
    }
    document.querySelectorAll('.qty-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            const val = parseInt(btn.dataset.val);
            if (fnQtyEl) fnQtyEl.value = val;
            updateActivePreset(val);
            triggerUpdate();
        });
    });



    cbMain.addEventListener('change', triggerUpdate);
    cbFilters.addEventListener('change', triggerUpdate);

    ['cb-bonus-extra-discount', 'cb-bonus-top-rating', 'cb-bonus-star-seller', 'cb-bonus-imported'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', triggerUpdate);
    });

    // F1 Currency Segmented Control
    const currencyToggle = document.getElementById('tpw-currency-toggle');
    const currencyButtons = currencyToggle ? currencyToggle.querySelectorAll('.st-segment-btn') : [];
    const currencyActiveBg = document.getElementById('currency-active-bg');
    
    let localPageNativeCurrency = 'UAH';

    const updateCurrencyUI = (isSwapped) => {
        if (!currencyToggle) return;
        
        // Визначаємо, яка вкладка має бути активною
        let targetCurrency;
        if (localPageNativeCurrency === 'USD') {
            targetCurrency = isSwapped ? 'UAH' : 'USD';
        } else {
            targetCurrency = isSwapped ? 'USD' : 'UAH';
        }

        currencyButtons.forEach(btn => btn.classList.remove('st-active'));
        const activeBtn = currencyToggle.querySelector(`[data-currency="${targetCurrency.toLowerCase()}"]`);
        if (activeBtn) {
            activeBtn.classList.add('st-active');
        }

        // is-usd клас відповідає за позицію повзунка
        if (targetCurrency === 'USD') {
            currencyToggle.classList.add('is-usd');
        } else {
            currencyToggle.classList.remove('is-usd');
        }
    };

    if (currencyToggle) {
        currencyToggle.addEventListener('click', (e) => {
            // Незалежно від того, куди саме нажав користувач (на сам тогл, фон, чи конкретну вкладку),
            // завжди просто інвертуємо поточний стан. Це перетворить обидві вкладки на "перемикач туди-сюди"
            chrome.storage.local.get(['isSiteCurrencySwapped'], (res) => {
                let nextSwapped = !res.isSiteCurrencySwapped;
                chrome.storage.local.set({ isSiteCurrencySwapped: nextSwapped });
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
            fQuantity: parseInt(document.getElementById('fn-qty').value) || 1,
            fBonusExtraDiscount: document.getElementById('cb-bonus-extra-discount')?.checked || false,
            fBonusTopRating: document.getElementById('cb-bonus-top-rating')?.checked || false,
            fBonusStarSeller: document.getElementById('cb-bonus-star-seller')?.checked || false,
            fBonusImported: document.getElementById('cb-bonus-imported')?.checked || false,
            wDiscount: currentWeights[0],
            wRating: currentWeights[1],
            wSales: currentWeights[2],
            wReviews: currentWeights[3],
            wBonuses: currentWeights[4]
        };
        chrome.storage.local.set(state);
    }

    // Завантаження стану при старті
    chrome.storage.local.get(null, (res) => {
        if (res.isScriptEnabled !== undefined) cbMain.checked = res.isScriptEnabled;
        if (res.filtersEnabled !== undefined) cbFilters.checked = res.filtersEnabled;
        if (res.fBonusExtraDiscount !== undefined) { const cb = document.getElementById('cb-bonus-extra-discount'); if (cb) cb.checked = res.fBonusExtraDiscount; }
        if (res.fBonusTopRating !== undefined) { const cb = document.getElementById('cb-bonus-top-rating'); if (cb) cb.checked = res.fBonusTopRating; }
        if (res.fBonusStarSeller !== undefined) { const cb = document.getElementById('cb-bonus-star-seller'); if (cb) cb.checked = res.fBonusStarSeller; }
        if (res.fBonusImported !== undefined) { const cb = document.getElementById('cb-bonus-imported'); if (cb) cb.checked = res.fBonusImported; }
        if (res.pageNativeCurrency !== undefined) {
            localPageNativeCurrency = res.pageNativeCurrency;
        }
        
        // Встановлюємо початковий стан currency ПІСЛЯ зчитування pageNativeCurrency
        updateCurrencyUI(!!res.isSiteCurrencySwapped);

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
        if (res.fQuantity !== undefined) {
            const fnQty = document.getElementById('fn-qty');
            if (fnQty) { fnQty.value = res.fQuantity; updateActivePreset(res.fQuantity); }
        }

        if (res.wDiscount !== undefined) currentWeights[0] = res.wDiscount;
        if (res.wRating !== undefined) currentWeights[1] = res.wRating;
        if (res.wSales !== undefined) currentWeights[2] = res.wSales;
        if (res.wReviews !== undefined) currentWeights[3] = res.wReviews;
        if (res.wBonuses !== undefined) currentWeights[4] = res.wBonuses;

        updateSliderFills();
        updateSegmentedBarUI();
    });

    // Слухаємо зміни зі сторінки, щоб синхронізувати UI
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            if (changes.isScriptEnabled !== undefined) cbMain.checked = changes.isScriptEnabled.newValue;
            if (changes.filtersEnabled !== undefined) cbFilters.checked = changes.filtersEnabled.newValue;
            if (changes.fBonusExtraDiscount !== undefined) { const cb = document.getElementById('cb-bonus-extra-discount'); if (cb) cb.checked = changes.fBonusExtraDiscount.newValue; }
            if (changes.fBonusTopRating !== undefined) { const cb = document.getElementById('cb-bonus-top-rating'); if (cb) cb.checked = changes.fBonusTopRating.newValue; }
            if (changes.fBonusStarSeller !== undefined) { const cb = document.getElementById('cb-bonus-star-seller'); if (cb) cb.checked = changes.fBonusStarSeller.newValue; }
            if (changes.fBonusImported !== undefined) { const cb = document.getElementById('cb-bonus-imported'); if (cb) cb.checked = changes.fBonusImported.newValue; }
            
            if (changes.pageNativeCurrency !== undefined) {
                localPageNativeCurrency = changes.pageNativeCurrency.newValue;
                chrome.storage.local.get(['isSiteCurrencySwapped'], (res) => {
                    updateCurrencyUI(!!res.isSiteCurrencySwapped);
                });
            }

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
            // B11: qty без fs-qty
            if (changes['fQuantity'] !== undefined) {
                const fnQ = document.getElementById('fn-qty');
                if (fnQ) { fnQ.value = changes['fQuantity'].newValue; updateActivePreset(changes['fQuantity'].newValue); }
            }

            // Update internal weights from external storage changes
            if (changes['wDiscount']) currentWeights[0] = changes['wDiscount'].newValue;
            if (changes['wRating']) currentWeights[1] = changes['wRating'].newValue;
            if (changes['wSales']) currentWeights[2] = changes['wSales'].newValue;
            if (changes['wReviews']) currentWeights[3] = changes['wReviews'].newValue;
            if (changes['wBonuses']) currentWeights[4] = changes['wBonuses'].newValue;

            updateSliderFills();
            updateSegmentedBarUI();
            syncEditableDisplays();

            // В iframe-режимі hover-дані надходять через window.postMessage напряму від
            // content.js тієї ж вкладки (рядки 155-200). Storage-шлях ВИМКНЕНО,
            // бо він розповсюджує дані між усіма вкладками → мерехтіння.
            // Не-iframe sidepanel використовує chrome.runtime.onMessage (рядок 132)
            // який вже має перевірку sender.tab.active.

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
            // fn-qty — виключаємо: має власну qty-presets-row обгортку
            if (input.id === 'fn-qty') return;
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
