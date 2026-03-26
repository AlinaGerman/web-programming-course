# Определяем путь к файлу, где хранится тег последнего успешного релиз
$tagFile = ".current-release-tag"

# Проверка существования файла с тегом предыдущего релиза
if (Test-Path $tagFile) {
    # Читаем содержимое файла как одну строку (включая все символы)
    $oldTag = Get-Content $tagFile -Raw
    $oldTag = $oldTag.Trim() # Trim() удаляет пробелы, символы табуляции и перевода строки
    # Информируем о начале отката
    Write-Host "Rolling back to: quiz-backend:$oldTag" -ForegroundColor Cyan
    # Создаем/обновляем тег latest, указывая его на старый образ
    # Теперь quiz-backend:latest указывает на стабильную предыдущую версию
    docker tag "quiz-backend:$oldTag" "quiz-backend:latest"
} else {
    Write-Host "No previous release found" -ForegroundColor Yellow
    exit 1
}

# Информируем о деплое отката
Write-Host "Deploying rollback..." -ForegroundColor Cyan
# Останавливаем и удаляем текущие контейнеры
# Контейнеры пересоздадутся с новой конфигурацией
docker compose down
# Запускаем контейнеры в фоновом режиме
# Теперь будет использован образ с тегом latest (который перенаправили на старую версию)
docker compose up -d

Start-Sleep -Seconds 5

# Информируем о начале проверки
Write-Host "Smoke check:" -ForegroundColor Cyan
try {
     # Выполняем HTTP запрос к health endpoint
    # Invoke-WebRequest - командлет PowerShell для HTTP запросов
    # -Uri - адрес проверки здоровья
    # -UseBasicParsing - упрощенный парсинг (быстрее, без зависимостей от IE)
    $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "Rollback successful!" -ForegroundColor Green
    } else {
        Write-Host "Rollback failed! Status: $($response.StatusCode)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Rollback failed: $_" -ForegroundColor Red
    exit 1
}