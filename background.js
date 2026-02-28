// --- Temu Pro v14 — Service Worker (background) ---

// Відкрити Side Panel при кліку на іконку
chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ tabId: tab.id });
});

// Обробка повідомлень від content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'fetchRate') {
        fetch('https://open.er-api.com/v6/latest/USD')
            .then(r => r.json())
            .then(data => {
                if (data && data.rates && data.rates.UAH) {
                    sendResponse({ rate: data.rates.UAH });
                } else {
                    sendResponse({ rate: 41.0 });
                }
            })
            .catch(() => sendResponse({ rate: 41.0 }));
        return true; // async response
    }

    // Пересилає statsUpdate та productHover до sidepanel
    if (msg.action === 'statsUpdate' || msg.action === 'productHover') {
        chrome.runtime.sendMessage(msg).catch(() => { });
    }
});
