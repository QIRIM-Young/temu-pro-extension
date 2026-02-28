const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EXTENSION_PATH = path.resolve(__dirname);
const TEMU_URL = 'https://www.temu.com/';

// --- Кольори для лога ---
const OK = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const INFO = '\x1b[36mℹ\x1b[0m';
const WARN = '\x1b[33m⚠\x1b[0m';

async function runTests() {
    let browser;
    let passed = 0;
    let failed = 0;
    let warnings = 0;

    function assert(condition, message) {
        if (condition) { console.log(`  ${OK} ${message}`); passed++; }
        else { console.log(`  ${FAIL} ${message}`); failed++; }
    }
    function warn(message) { console.log(`  ${WARN} ${message}`); warnings++; }

    try {
        console.log(`\n${INFO} Запуск Chrome з розширенням...\n`);

        browser = await puppeteer.launch({
            executablePath: CHROME_PATH,
            headless: false,
            args: [
                `--disable-extensions-except=${EXTENSION_PATH}`,
                `--load-extension=${EXTENSION_PATH}`,
                '--no-first-run',
                '--no-default-browser-check'
            ]
        });

        // --- ТЕСТ 1: Браузер ---
        assert(browser.connected, 'Chrome запустився з розширенням');

        // --- ТЕСТ 2: Завантаження Temu ---
        console.log(`\n${INFO} Завантажую ${TEMU_URL}...\n`);
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        let temuLoaded = false;
        try {
            await page.goto(TEMU_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
            temuLoaded = true;
        } catch (e) {
            // Temu може блокувати або повільно відповідати
        }
        assert(temuLoaded, 'Сторінка Temu завантажилась');

        if (!temuLoaded) {
            warn('Temu не відповів — подальші тести content script неможливі');
            console.log(`\n${'═'.repeat(40)}`);
            console.log(`  Результат: ${passed} пройшло, ${failed} провалено, ${warnings} попереджень`);
            console.log(`${'═'.repeat(40)}\n`);
            browser.on('disconnected', () => process.exit(1));
            return;
        }

        // Невеличка пауза щоб content script встиг ін'єктуватись
        await new Promise(r => setTimeout(r, 5000));

        // --- ТЕСТ 3: Панель Temu Pro ---
        let panelFound = false;
        try {
            panelFound = await page.$('#temu-pro-window') !== null;
        } catch { }

        if (!panelFound) {
            // Спробувати ще раз після додаткового очікування
            await new Promise(r => setTimeout(r, 5000));
            try { panelFound = await page.$('#temu-pro-window') !== null; } catch { }
        }
        assert(panelFound, 'Панель Temu Pro (#temu-pro-window) ін\'єктована');

        // --- ТЕСТ 4: Заголовок панелі ---
        if (panelFound) {
            try {
                const headerText = await page.$eval('#tpw-header span', el => el.textContent);
                assert(headerText.includes('Temu Pro'), `Заголовок: "${headerText}"`);
            } catch {
                assert(false, 'Заголовок панелі не знайдено');
            }
        } else {
            warn('Пропущено (панель не знайдена)');
        }

        // --- ТЕСТ 5: Вкладки ---
        if (panelFound) {
            try {
                const tabs = await page.$$('.tpw-tab');
                assert(tabs.length >= 2, `Вкладки знайдено: ${tabs.length} шт.`);
            } catch {
                assert(false, 'Вкладки не знайдено');
            }
        }

        // --- ТЕСТ 6: CSS стилі розширення ---
        try {
            const hasStyles = await page.evaluate(() => {
                const styles = document.querySelectorAll('style');
                for (const s of styles) {
                    if (s.textContent.includes('temu-score-container')) return true;
                }
                return false;
            });
            assert(hasStyles, 'CSS стилі розширення ін\'єктовані');
        } catch {
            assert(false, 'CSS стилі не знайдено');
        }

        // --- ПІДСУМОК ---
        console.log(`\n${'═'.repeat(40)}`);
        console.log(`  Результат: ${passed} пройшло, ${failed} провалено, ${warnings} попереджень`);
        console.log(`${'═'.repeat(40)}\n`);

        if (failed === 0) console.log(`${OK} Усі тести пройдено!`);
        else console.log(`${FAIL} ${failed} тест(ів) провалено.`);

        console.log(`\n${INFO} Браузер відкритий для ручної перевірки. Закрийте Chrome щоб завершити.\n`);

        browser.on('disconnected', () => {
            console.log(`${INFO} Завершено.`);
            process.exit(failed > 0 ? 1 : 0);
        });

    } catch (error) {
        console.error(`\n${FAIL} Критична помилка:`, error.message);
        if (browser) await browser.close();
        process.exit(1);
    }
}

runTests();
