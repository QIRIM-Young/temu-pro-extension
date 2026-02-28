// background.js — Service Worker для Temu Pro Extension v14.0

// --- Відкриття Side Panel при кліку на іконку ---
chrome.action.onClicked.addListener(async (tab) => {
    await chrome.sidePanel.open({ tabId: tab.id });
});

// Встановити Side Panel доступним для Temu
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => { });

// --- Обробка повідомлень ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Запит курсу валют
    if (request.action === 'fetchExchangeRate') {
        fetch('https://open.er-api.com/v6/latest/USD')
            .then(res => res.json())
            .then(data => sendResponse({ success: true, data }))
            .catch(err => sendResponse({
                success: false,
                error: err.message,
                fallback: 41.5
            }));
        return true; // async response
    }

    // Перемикання режиму панелі
    if (request.action === 'togglePanelMode') {
        chrome.storage.local.set({ panelMode: request.mode });
        // Переслати content script
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'panelModeChanged',
                    mode: request.mode
                });
            }
        });
    }

    // Переслати дані товару в sidepanel
    if (request.action === 'productHover' || request.action === 'statsUpdate') {
        // Просто переслати — sidepanel має свій listener
    }
});
