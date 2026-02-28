---
description: Запакувати розширення для публікації у Chrome Web Store
---
# Збірка розширення (ZIP)

// turbo-all

1. Видалити старий zip якщо є:
```
Remove-Item -Force -ErrorAction SilentlyContinue temu-pro-extension.zip
```

2. Створити zip з потрібними файлами (без node_modules та тестів):
```
Compress-Archive -Path manifest.json,background.js,content.js,sidepanel.html,sidepanel.js,icons -DestinationPath temu-pro-extension.zip -Force
```

3. Вивести розмір:
```
Get-Item temu-pro-extension.zip | Select-Object Name, @{N='SizeKB';E={[math]::Round($_.Length/1KB,1)}}
```
