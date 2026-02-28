// --- Temu Pro v14 — Service Worker ---

// Side panel доступний тільки на Temu
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => { });

// Показувати sidepanel тільки на Temu вкладках
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
    if (!tab.url) return;
    const enabled = tab.url.includes('temu.com');
    chrome.sidePanel.setOptions({ tabId, enabled }).catch(() => { });
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
    try {
        const tab = await chrome.tabs.get(tabId);
        const enabled = tab.url && tab.url.includes('temu.com');
        chrome.sidePanel.setOptions({ tabId, enabled }).catch(() => { });
    } catch (e) { }
});

// Port tracking — ховати плаваючу панель коли sidepanel відкрито
let ports = new Set();

chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'sidepanel') return;
    ports.add(port);
    notifyTemu('sidePanelOpened');
    port.onDisconnect.addListener(() => {
        ports.delete(port);
        if (ports.size === 0) notifyTemu('sidePanelClosed');
    });
});

function notifyTemu(action) {
    chrome.tabs.query({ url: 'https://www.temu.com/*' }, (tabs) => {
        for (const tab of tabs) {
            chrome.tabs.sendMessage(tab.id, { action }).catch(() => { });
        }
    });
}

// Обробка повідомлень
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'fetchRate') {
        fetch('https://open.er-api.com/v6/latest/USD')
            .then(r => r.json())
            .then(d => sendResponse({ rate: d?.rates?.UAH || 41.0 }))
            .catch(() => sendResponse({ rate: 41.0 }));
        return true;
    }
    if (msg.action === 'statsUpdate' || msg.action === 'productHover') {
        chrome.runtime.sendMessage(msg).catch(() => { });
    }
});
