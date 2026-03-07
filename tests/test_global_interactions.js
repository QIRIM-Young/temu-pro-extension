const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const DEBUG_PORT = 9223;
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots_global');

if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR);
}

const delay = ms => new Promise(res => setTimeout(res, ms));

async function runGlobalTest() {
    let browser;
    try {
        console.log(`Підключення до Chrome (порт ${DEBUG_PORT})...`);
        browser = await puppeteer.connect({
            browserURL: `http://127.0.0.1:${DEBUG_PORT}`,
            defaultViewport: null
        });

        const pages = await browser.pages();
        const page = pages.find(p => p.url().includes('temu.com')) || pages[0];
        
        // Перезавантажуємо розширення
        const extPage = await browser.newPage();
        await extPage.goto('chrome://extensions/');
        await extPage.evaluate(() => {
            const extManager = document.querySelector('extensions-manager');
            const itemList = extManager.shadowRoot.querySelector('extensions-item-list');
            const items = itemList.shadowRoot.querySelectorAll('extensions-item');
            for(let item of items) {
                if(item.shadowRoot.textContent.includes('Temu Smart Score')) {
                    const reloadBtn = item.shadowRoot.querySelector('#dev-reload-button');
                    if(reloadBtn) { reloadBtn.click(); return true; }
                }
            }
            return false;
        });
        await extPage.close();
        console.log("Розширення оновлено.");

        console.log("Перехід на Temu...");
        await page.goto('https://www.temu.com', { waitUntil: 'load', timeout: 60000 });
        console.log("Очікую 8 секунд на завантаження сторінки та розширення...");
        await delay(8000);

        // 1. Пошук карток
        const cardsCount = await page.evaluate(() => document.querySelectorAll('div[data-tooltip-html]').length);
        if (cardsCount === 0) {
            console.log("Карток не знайдено! Тест неможливий.");
            return;
        }
        console.log(`Знайдено ${cardsCount} карток.`);

        await page.evaluate(() => {
            const c = document.querySelectorAll('div[data-tooltip-html]')[0];
            if(c) {
                c.scrollIntoView({behavior: 'smooth', block: 'center'});
                c.setAttribute('id', 'test-card-target');
            }
        });
        await delay(2000);

        // 2. Отримуємо оцінку ДО налаштувань
        const initialHtml = await page.evaluate(() => {
            const el = document.getElementById('test-card-target');
            return el ? el.getAttribute('data-tooltip-html') : null;
        });

        // Парсимо базовий бал
        const extractScore = (html) => {
            if(!html) return null;
            const match = html.match(/font-size:18px[^>]*>\s*(\d+)/);
            return match ? parseInt(match[1]) : null;
        };
        const initialScore = extractScore(initialHtml);

        console.log(`[Тест 1] Початковий бал: ${initialScore}`);
        
        // Dump the actual product card HTML to understand why priceEl, etc. are null
        const cardOuterHtml = await page.evaluate(() => {
            const el = document.getElementById('test-card-target');
            return el && el.parentElement ? el.parentElement.innerHTML : 'null';
        });
        console.log(`CARD OUTER HTML START:\n${cardOuterHtml.substring(0, 4000)}\n...CARD OUTER HTML END`);

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '1_initial_score.png') });

        // Емулюємо hover
        await page.evaluate(() => {
            const el = document.getElementById('test-card-target');
            if(el) {
                const rect = el.getBoundingClientRect();
                el.dispatchEvent(new MouseEvent('mouseover', {
                    bubbles: true, cancelable: true,
                    clientX: rect.left + rect.width / 2,
                    clientY: rect.top + rect.height / 2
                }));
            }
        });
        await delay(1000);
        console.log("Hover подія відправлена.");

        // Шукаємо iframe
        const iframeHandle = await page.$('iframe#tpw-iframe');
        if (!iframeHandle) {
            console.log("Помилка: Не знайдено iframe розширення.");
            return;
        }
        const frame = await iframeHandle.contentFrame();
        
        // Відкриваємо акордеон Налаштування алгоритму
        await frame.click('#tpw-alg-accordion-btn');
        await delay(1000);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '2_accordion_open.png') });

        // Міняємо вагу знижки на 0%
        console.log("Встановлюємо Знижка = 0%...");
        await frame.evaluate(() => {
            const input = document.getElementById('wn-disc');
            const slider = document.getElementById('ws-disc');
            if(input) {
                input.value = 0;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
            if(slider) {
                slider.value = 0;
                slider.dispatchEvent(new Event('input', { bubbles: true }));
                slider.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        await delay(2000); // Чекаємо debounce та IPC

        // 4. Перевіряємо бал ПІСЛЯ налаштувань
        const updatedHtml = await page.evaluate(() => {
            const el = document.getElementById('test-card-target');
            return el ? el.getAttribute('data-tooltip-html') : null;
        });
        const updatedScore = extractScore(updatedHtml);
        console.log(`[Тест 2] Бал після зміни алгоритму (Знижка=0%): ${updatedScore}`);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '3_score_updated.png') });
        
        if (updatedScore !== null && initialScore !== null && initialScore !== updatedScore) {
            console.log("✅ IPC оновлення налаштувань ПРАЦЮЄ у реальному часі.");
        } else {
            console.error("❌ ПОМИЛКА: Бал не змінився. Налаштування не діють.");
        }

        // 5. Тест вимкнення скрипта
        console.log("Вимикаємо розширення (cb-main-toggle)...");
        await frame.evaluate(() => {
            const toggle = document.getElementById('cb-main-toggle');
            if (toggle) toggle.click();
        });
        await delay(1500);
        
        const hasTooltip = await page.evaluate(() => {
            const el = document.getElementById('test-card-target');
            return el ? el.hasAttribute('data-tooltip-html') : false;
        });
        console.log(`[Тест 3] Tooltip атрибут після вимкнення є: ${hasTooltip}`);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '4_script_disabled.png') });
        
        if (!hasTooltip) {
            console.log("✅ Вимкнення скрипта ПРАЦЮЄ.");
        } else {
            console.error("❌ ПОМИЛКА: Tooltips залишились після вимикання.");
        }

        // 6. Увімкнення скрипта назад
        console.log("Вмикаємо розширення назад...");
        await frame.evaluate(() => {
            const toggle = document.getElementById('cb-main-toggle');
            if (toggle) toggle.click();
        });
        await delay(2500);

        // 7. Тест Скидання налаштувань
        console.log("Натискаємо Скинути налаштування...");
        await frame.evaluate(() => {
            const btn = document.getElementById('btn-reset-alg');
            if (btn) btn.click();
        });
        await delay(2000);
        
        const finalHtml = await page.evaluate(() => {
            const el = document.getElementById('test-card-target');
            return el ? el.getAttribute('data-tooltip-html') : null;
        });
        const finalScore = extractScore(finalHtml);
        console.log(`[Тест 4] Бал після скидання (має дорівнювати початковому): ${finalScore}`);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '5_score_reset.png') });
        
        if (finalScore === initialScore) {
             console.log("✅ Скидання налаштувань ПРАЦЮЄ.");
        } else {
             console.error("❌ ПОМИЛКА: Скидання не повернуло бал до оригіналу.");
        }

        console.log("Глобальне тестування успішно завершено.");

    } catch (err) {
        console.error("Critical Test Error:", err);
    } finally {
        if (browser) await browser.disconnect();
    }
}

runGlobalTest();
