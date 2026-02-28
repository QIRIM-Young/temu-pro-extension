/**
 * Temu Pro — Тестування через Chrome Remote Debugging
 * 
 * КРОК 1: Закрийте звичайний Chrome
 * КРОК 2: Запустіть Chrome з remote debugging:
 *   "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
 * КРОК 3: Відкрийте temu.com в цьому Chrome
 * КРОК 4: Запустіть: node puppeteer-test.js
 */

const puppeteer = require('puppeteer-core');

// Налаштування
const CDP_URL = 'http://127.0.0.1:9222';
const TEMU_URL = 'https://www.temu.com/ua';

async function run() {
    console.log('\n🔌 Підключаюсь до Chrome (Remote Debugging)...\n');

    let browser;
    try {
        browser = await puppeteer.connect({
            browserURL: CDP_URL,
            defaultViewport: null // використовуємо реальний розмір вікна
        });
    } catch (e) {
        console.error('  ✗ Не вдалось підключитись до Chrome!');
        console.error('');
        console.error('  Переконайтесь що Chrome запущено з прапорцем:');
        console.error('  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222');
        console.error('');
        console.error('  ⚠ Звичайний Chrome має бути ЗАКРИТИЙ перед запуском з debugging.');
        process.exit(1);
    }

    console.log('  ✓ Підключено до Chrome\n');

    // Знайти вкладку з Temu або відкрити нову
    const pages = await browser.pages();
    let temuPage = pages.find(p => p.url().includes('temu.com'));

    if (!temuPage) {
        console.log('ℹ Відкриваю Temu...');
        temuPage = await browser.newPage();
        await temuPage.goto(TEMU_URL, { waitUntil: 'networkidle2', timeout: 30000 });
        console.log('  ✓ Temu завантажено\n');
    } else {
        console.log('  ✓ Знайдено вкладку з Temu: ' + temuPage.url() + '\n');
    }

    // Зачекати на DOM
    await new Promise(r => setTimeout(r, 3000));

    // --- ТЕСТ 1: Панель Temu Pro ---
    console.log('📋 Тест 1: Плаваюча панель...');
    const panel = await temuPage.$('#temu-pro-window');
    if (panel) {
        console.log('  ✓ Панель #temu-pro-window знайдена');
        const header = await temuPage.$eval('#tpw-header', el => el.textContent).catch(() => null);
        console.log('  ℹ Header: ' + (header || '(порожній)'));
    } else {
        console.log('  ✗ Панель не знайдена (можливо ін\'єкція ще не відбулась)');
    }

    // --- ТЕСТ 2: CSS стилі ---
    console.log('\n📋 Тест 2: CSS стилі...');
    const styles = await temuPage.evaluate(() => {
        const sheets = document.querySelectorAll('style');
        for (let s of sheets) {
            if (s.textContent.includes('temu-score-container')) return true;
        }
        return false;
    });
    console.log(styles ? '  ✓ CSS стилі розширення завантажені' : '  ✗ CSS стилі не знайдені');

    // --- ТЕСТ 3: Score Bars ---
    console.log('\n📋 Тест 3: Score Bars на товарах...');
    const scoreBars = await temuPage.$$('.temu-score-container');
    console.log('  ℹ Знайдено score bars: ' + scoreBars.length);
    if (scoreBars.length > 0) {
        console.log('  ✓ Score bars відображаються на товарах');
        // Зчитати перший score
        const firstScore = await temuPage.$eval('.temu-score-number', el => el.textContent).catch(() => '?');
        console.log('  ℹ Перший score: ' + firstScore);
    } else {
        console.log('  ⚠ Score bars не знайдені (прокрутіть сторінку до товарів)');
    }

    // --- ТЕСТ 4: Оброблені картки ---
    console.log('\n📋 Тест 4: Оброблені товарні картки...');
    const cards = await temuPage.$$('[data-temu-processed="true"]');
    console.log('  ℹ Оброблено карток: ' + cards.length);
    if (cards.length > 0) {
        console.log('  ✓ Content script обробляє товари');
    } else {
        console.log('  ⚠ Жодна картка не оброблена (прокрутіть сторінку)');
    }

    // --- ТЕСТ 5: Tooltip (hover data) ---
    console.log('\n📋 Тест 5: Tooltip data...');
    const tooltips = await temuPage.$$('[data-tooltip-html]');
    console.log('  ℹ Товарів з tooltip: ' + tooltips.length);
    if (tooltips.length > 0) {
        const firstTooltip = await temuPage.$eval('[data-tooltip-html]', el => {
            const html = el.getAttribute('data-tooltip-html');
            const match = html.match(/Загальний бал: (\d+)/);
            return match ? match[1] : '?';
        }).catch(() => '?');
        console.log('  ℹ Перший товар score: ' + firstTooltip);
        console.log('  ✓ Tooltip data присутній');
    }

    // --- ТЕСТ 6: Курс валют ---
    console.log('\n📋 Тест 6: Курс валют (chrome.storage)...');
    const rate = await temuPage.evaluate(() => {
        return new Promise(resolve => {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                chrome.storage.local.get({ exchangeRate: 0 }, s => resolve(s.exchangeRate));
            } else {
                resolve(0);
            }
        });
    }).catch(() => 0);
    if (rate > 0) {
        console.log('  ✓ Курс: 1$ = ' + Math.round(rate) + '₴');
    } else {
        console.log('  ⚠ Курс не збережено в storage (або недоступно з content script)');
    }

    // --- ПІДСУМОК ---
    console.log('\n' + '═'.repeat(50));
    console.log('📊 ПІДСУМОК:');
    console.log('  Панель: ' + (panel ? '✓' : '✗'));
    console.log('  CSS: ' + (styles ? '✓' : '✗'));
    console.log('  Score Bars: ' + scoreBars.length);
    console.log('  Картки: ' + cards.length);
    console.log('  Tooltips: ' + tooltips.length);
    console.log('═'.repeat(50) + '\n');

    // НЕ закриваємо браузер — він вже запущений користувачем
    // browser.disconnect();
    console.log('✅ Тест завершено. Chrome залишається відкритим.\n');
    process.exit(0);
}

run().catch(err => {
    console.error('Помилка:', err.message);
    process.exit(1);
});
