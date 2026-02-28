---
description: Запустити Chrome з розширенням для ручного тестування
---
# Запуск Chrome з розширенням для розробки

// turbo-all

1. Запустити Chrome з розширенням у окремому профілі:
```
Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" -ArgumentList "--load-extension=c:\Users\vlift\.gemini\antigravity\scratch\temu_pro_extension","--user-data-dir=$env:TEMP\chrome-temu-dev","https://www.temu.com/"
```

2. Перевірити що розширення завантажилось на chrome://extensions/.
