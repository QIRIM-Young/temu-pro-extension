const CURRENCY_API = 'https://open.er-api.com/v6/latest/USD';
const CACHE_KEY = 'currencyCache';
const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 годин

async function getExchangeRate() {
    return new Promise((resolve) => {
        chrome.storage.local.get([CACHE_KEY], (res) => {
            const cache = res[CACHE_KEY];
            const now = Date.now();

            if (cache && (now - cache.timestamp < CACHE_DURATION)) {
                resolve(cache.rate);
            } else {
                fetch(CURRENCY_API)
                    .then(r => r.json())
                    .then(data => {
                        const rate = data?.rates?.UAH || 41.0;
                        chrome.storage.local.set({
                            [CACHE_KEY]: { rate, timestamp: now },
                            'exchangeRate': rate
                        });
                        resolve(rate);
                    })
                    .catch(() => {
                        const rate = cache?.rate || 41.0;
                        resolve(rate);
                    });
            }
        });
    });
}

// Початкове завантаження курсу при старті бекграунду
getExchangeRate();

// Оновлення курсу кожні 12 годин (інтервал живе поки активний сервіс-воркер, 
// але краще використовувати alarms для надійності в MV3)
chrome.alarms.create('updateCurrency', { periodInMinutes: 12 * 60 });
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'updateCurrency') {
        getExchangeRate();
    }
});

// Налаштування Side Panel для Temu
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => { });

function updateSidePanelAction(tabId, url) {
    if (!url || !url.includes('http')) return;
    const enabled = url.includes('temu.com');
    chrome.sidePanel.setOptions({
        tabId,
        path: enabled ? 'sidepanel.html' : undefined,
        enabled: true // Дозволяємо panel everywhere щоб працював action
    }).catch(() => { });
}

// F5: Global Icon OnClick
chrome.action.onClicked.addListener((tab) => {
    if (tab.url && tab.url.includes('temu.com')) {
        chrome.storage.local.get(['isSidePanelOpen'], (res) => {
            if (res.isSidePanelOpen) {
                // Workaround to close side panel programmatically in MV3
                chrome.sidePanel.setOptions({ tabId: tab.id, enabled: false }).then(() => {
                    setTimeout(() => { chrome.sidePanel.setOptions({ tabId: tab.id, path: 'sidepanel.html', enabled: true }); }, 100);
                });
            } else {
                chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => { });
            }
        });
    } else {
        chrome.tabs.create({ url: 'https://www.temu.com' }, (newTab) => {
            // Give tab a moment to register before opening panel
            setTimeout(() => {
                chrome.sidePanel.open({ tabId: newTab.id, windowId: newTab.windowId }).catch(() => { });
            }, 500);
        });
    }
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
    updateSidePanelAction(tabId, tab.url);
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
    try {
        const tab = await chrome.tabs.get(tabId);
        updateSidePanelAction(tabId, tab.url);
    } catch (ignore) { }
});

// Надійне відслідковування стану Side Panel через long-lived connection
chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'sidepanel') {
        chrome.storage.local.set({ isSidePanelOpen: true });
        port.onDisconnect.addListener(() => {
            chrome.storage.local.set({ isSidePanelOpen: false });
        });
    }
});

// Слухачі повідомлень
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'fetchRate') {
        getExchangeRate().then(rate => sendResponse({ rate }));
        return true;
    }

    // Відкриття Side Panel з content script
    if (msg.action === 'openSidePanel' && sender.tab) {
        chrome.sidePanel.open({ windowId: sender.tab.windowId }).catch(() => { });
    }
});
