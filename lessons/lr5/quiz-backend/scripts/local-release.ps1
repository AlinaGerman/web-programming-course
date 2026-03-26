# Получаем текущую дату и время в формате
$tag = Get-Date -Format "yyyyMMdd-HHmmss"

# Информируем о начале сборки
Write-Host "Building image: quiz-backend:$tag"
# Сборка Docker образа с двумя тегами:
# 1. quiz-backend:$tag - уникальный тег на основе даты (для отката)
# 2. quiz-backend:latest - стандартный тег последней версии
docker build -t "quiz-backend:$tag" -t quiz-backend:latest .

# Информируем о начале деплоя
Write-Host "Deploying..."
# Останавливаем и удаляем все контейнеры из docker-compose.yml
# Удаляются контейнеры, но тома сохраняются (данные БД не теряются)
docker compose down
# Запускаем контейнеры в фоновом режиме
# -d (detached) - запуск в фоне, терминал не блокируется
docker compose up -d

# Информируем об ожидании
Write-Host "Waiting for service..."
# Пауза 5 секунд, чтобы приложение успело запуститься
Start-Sleep -Seconds 5

# Информируем о начале проверки
Write-Host "Smoke check..."
# Выполняем HTTP запрос к health endpoint
# Invoke-WebRequest - основной командлет PowerShell для HTTP запросов
# -Uri "http://localhost:3000/health" - адрес проверки здоровья
# -UseBasicParsing - упрощенный парсинг ответа (быстрее, меньше зависимостей)
$response = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing

if ($response.StatusCode -eq 200) {
    Write-Host "Release successful! Tag: $tag" -ForegroundColor Green # Релиз успешен - выводим зеленое сообщение с тегом
    # Сохраняем тег в файл .current-release-tag (это нужно для возможного отката)
    # Позволяет скрипту отката узнать, на какую версию откатываться
    $tag | Out-File ".current-release-tag"
} else {
    Write-Host "Release failed!" -ForegroundColor Red
    # Выходим с кодом ошибки 1
    # Это остановит выполнение скрипта и укажет CI/CD, что произошла ошибка
    exit 1
}