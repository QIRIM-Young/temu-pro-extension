// Temu Pro — Side Panel logic (окремий файл для CSP)

// Отримувати оновлення від content script
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'statsUpdate') {
        const proc = document.getElementById('stat-processed');
        const avg = document.getElementById('stat-avg-score');
        if (proc) proc.textContent = msg.processed || 0;
        if (avg) avg.textContent = msg.avgScore || '\u2014';
    }
    if (msg.action === 'productHover' && msg.html) {
        const info = document.getElementById('product-info');
        if (info) info.innerHTML = msg.html;
    }
});

// Курс
chrome.storage.local.get({ exchangeRate: 41.0 }, (s) => {
    const el = document.getElementById('exchange-rate');
    if (el) el.textContent = '1$ \u2248 ' + Math.round(s.exchangeRate) + '\u20B4';
});
