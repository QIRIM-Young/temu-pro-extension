// --- Temu Pro v14 — Service Worker (background) ---

// Side panel доступний тільки на Temu
chrome.sidePanel.setOptions({ enabled: false }).catch(() => { });

// Трекінг стану sidepanel
let sidePanelWasOpen = false;
let sidePanelPorts = new Set();

// Запам'ятати стан з попереднього сеансу
chrome.storage.local.get({ sidePanelWasOpen: false }, (s) => {
    sidePanelWasOpen = s.sidePanelWasOpen;
});

// При переключенні вкладок
chrome.tabs.onActivated.addListener(async (info) => {
    try {
        const tab = await chrome.tabs.get(info.tabId);
        const isTemu = tab.url && tab.url.includes('temu.com');
        await chrome.sidePanel.setOptions({ tabId: info.tabId, enabled: isTemu });

        // Авто-відкриття якщо було відкрито раніше
        if (isTemu && sidePanelWasOpen) {
            chrome.sidePanel.open({ tabId: info.tabId }).catch(() => { });
        }
    } catch (e) { }
});

// При оновленні URL
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.url) {
        const isTemu = changeInfo.url.includes('temu.com');
        await chrome.sidePanel.setOptions({ tabId, enabled: isTemu }).catch(() => { });

        if (isTemu && sidePanelWasOpen) {
            chrome.sidePanel.open({ tabId }).catch(() => { });
        }
    }
});

// Відкрити Side Panel при кліку на іконку
chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ tabId: tab.id });
});

// Port-based tracking sidepanel open/close
chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'sidepanel') {
        sidePanelPorts.add(port);
        sidePanelWasOpen = true;
        chrome.storage.local.set({ sidePanelWasOpen: true });
        notifyContentScripts('sidePanelOpened');

        port.onDisconnect.addListener(() => {
            sidePanelPorts.delete(port);
            if (sidePanelPorts.size === 0) {
                sidePanelWasOpen = false;
                chrome.storage.local.set({ sidePanelWasOpen: false });
                notifyContentScripts('sidePanelClosed');
            }
        });
    }
});

function notifyContentScripts(action) {
    chrome.tabs.query({ url: 'https://www.temu.com/*' }, (tabs) => {
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, { action }).catch(() => { });
        });
    });
}

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
        return true;
    }

    // Пересилка до sidepanel
    if (msg.action === 'statsUpdate' || msg.action === 'productHover') {
        chrome.runtime.sendMessage(msg).catch(() => { });
    }
});
