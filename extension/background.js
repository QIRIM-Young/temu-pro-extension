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
                        chrome.storage.local.set({ [CACHE_KEY]: { rate, timestamp: now }, 'exchangeRate': rate });
                        resolve(rate);
                    })
                    .catch(() => { resolve(cache?.rate || 41.0); });
            }
        });
    });
}

getExchangeRate();
chrome.alarms.create('updateCurrency', { periodInMinutes: 12 * 60 });
chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === 'updateCurrency') getExchangeRate(); });

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});

// --- СТАН PER-TAB: 'sidebar' | 'floating' (зберігається між сесіями) ---
// tabSidePanelMode[tabId] = 'sidebar' | 'floating'
// Зберігаємо в пам'яті сервіс-воркера (не в storage, бо це транзитивний стан)
const tabMode = {}; // tabId → 'sidebar' | 'floating'
let _tabSwitchMs = 0; // час останнього перемикання вкладки (для розрізнення tab-switch vs X)

// --- ІКОНКА: toggle floating ↔ sidebar ---
chrome.action.onClicked.addListener((tab) => {
    if (!tab.url || !tab.url.includes('temu.com')) {
        chrome.tabs.create({ url: 'https://www.temu.com/ua' });
        return;
    }
    chrome.storage.local.get(['isSidePanelOpen'], (res) => {
        if (res.isSidePanelOpen) {
            // Sidebar відкritий → перейти на floating window
            closeSidebar(tab.id);
            chrome.storage.local.set({ isSidePanelOpen: false });
            tabMode[tab.id] = 'floating';
        } else {
            // Floating window → відкрити sidebar
            chrome.storage.local.set({ isSidePanelOpen: true });
            chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
            tabMode[tab.id] = 'sidebar';
        }
    });
});

// Закрити sidebar для вкладки (disable→re-enable workaround для MV3)
// Перевіряємо URL щоб не викликати setOptions на chrome:// (заборонено API)
async function closeSidebar(tabId) {
    try {
        const tab = await chrome.tabs.get(tabId);
        const url = tab.url || '';
        // chrome:// і інші не-http сторінки — не можемо управляти sidepanel API для них
        // але їхні sidebar автоматично закриваються Chrome; просто знімаємо стан
        if (!url.startsWith('http')) {
            chrome.storage.local.set({ isSidePanelOpen: false });
            return;
        }
        // Для http/https — стандартний workaround disable→re-enable
        chrome.sidePanel.setOptions({ tabId, enabled: false }).then(() => {
            setTimeout(() => {
                chrome.sidePanel.setOptions({ tabId, path: 'sidepanel.html', enabled: true }).catch(() => {});
            }, 150);
        }).catch(() => {});
    } catch (ignore) {
        // таб міг вже закритися
    }
}

// --- ПЕРЕМИКАННЯ ВКЛАДОК ---
chrome.tabs.onActivated.addListener(async ({ tabId, previousTabId }) => {
    // 1. Якщо йдемо ГЕТЬ з Temu вкладки → закрити sidebar
    if (previousTabId) {
        try {
            const prevTab = await chrome.tabs.get(previousTabId);
            if (prevTab.url && prevTab.url.includes('temu.com')) {
                _tabSwitchMs = Date.now(); // Позначаємо TAB SWITCH CLOSE
                closeSidebar(previousTabId);
                // isSidePanelOpen=false (sidebar закрився) — але НЕ змінюємо tabMode[previousTabId]
                // завдяки цьому при поверненні знаємо, чи треба відкрити знову
            }
        } catch (ignore) {}
    }

    // 2. Якщо ПОВЕРТАЄМОСЬ на Temu вкладку
    try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.url && tab.url.includes('temu.com')) {
            const mode = tabMode[tabId] || 'floating'; // default = floating window
            if (mode === 'sidebar') {
                // Був sidebar → відновити sidebar
                setTimeout(() => {
                    chrome.storage.local.set({ isSidePanelOpen: true });
                    chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
                }, 300);
            } else {
                // Був floating → просто показати floating window
                chrome.storage.local.set({ isSidePanelOpen: false });
            }
        } else {
            // non-Temu tab: закрити sidebar якщо був відкritий
            closeSidebar(tabId);
        }
    } catch (ignore) {}
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
    if (info.status === 'complete' && tab.url && !tab.url.includes('temu.com')) {
        closeSidebar(tabId);
    }
});

// --- ВІДСТЕЖЕННЯ СТАНУ SIDEBAR через long-lived port ---
chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'sidepanel') return;

    // Sidebar відкрився
    const portTabId = port.sender?.tab?.id;
    chrome.storage.local.set({ isSidePanelOpen: true });

    port.onDisconnect.addListener(() => {
        chrome.storage.local.set({ isSidePanelOpen: false });

        // Якщо disconnect стався < 900ms після tab switch → це tab-switch-close (не X)
        // НЕ змінюємо tabMode → при поверненні sidebar відкриється знову
        const msSinceSwitch = Date.now() - _tabSwitchMs;
        if (msSinceSwitch > 900 && portTabId) {
            // Юзер натиснув X → переключаємо на floating
            tabMode[portTabId] = 'floating';
        }
        // Якщо msSinceSwitch <= 900 → tab-switch-close → tabMode[portTabId] залишається 'sidebar'
    });
});

// --- ПОВІДОМЛЕННЯ ---
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'fetchRate') {
        getExchangeRate().then(rate => sendResponse({ rate }));
        return true;
    }
    if (msg.action === 'openSidePanel' && sender.tab) {
        chrome.storage.local.set({ isSidePanelOpen: true });
        tabMode[sender.tab.id] = 'sidebar';
        chrome.sidePanel.open({ windowId: sender.tab.windowId }).catch(() => {});
    }
});
