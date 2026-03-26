# сборка приложения
FROM node:20-alpine AS builder
# Устанавливаем рабочую директорию
WORKDIR /app
# Копируем package.json и package-lock.json для установки зависимостей
COPY package*.json ./
# Устанавливаем все зависимости (включая devDependencies для сборки)
RUN npm ci
# Копируем исходный код и Prisma схему
COPY . .

# Генерируем Prisma Client
RUN npx prisma generate
# Собираем TypeScript приложение
RUN npm run build

# production окружение
FROM node:20-alpine AS runner

# Устанавливаем рабочую директорию
WORKDIR /app

# Создаем пользователя без прав root для безопасности
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Установка wget для healthcheck
# Без кэширования (--no-cache) для уменьшения размера образа
# wget понадобится для healthcheck - проверки работоспособности приложения
RUN apk add --no-cache wget

# Копируем package.json и package-lock.json
COPY --from=builder /app/package*.json ./
# Устанавливаем только production зависимости
RUN npm ci --only=production && \
    npm cache clean --force

# Копируем скомпилированный код из стадии сборки
COPY --from=builder /app/dist ./dist
# Копируем prisma схему для возможных миграций или генерации клиента
COPY --from=builder /app/prisma ./prisma
# Копируем сгенерированный Prisma Client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Создаем директорию для SQLite базы данных
RUN mkdir -p /app/data && \
    chown -R nodejs:nodejs /app/data

# Переключаемся с root на непривилегированного пользователя nodejs
# Все последующие команды будут выполняться от этого пользователя
USER nodejs
# Открываем порт
EXPOSE 3000

# Настраиваем проверку здоровья контейнера
# --interval=30s - проверять каждые 30 секунд
# --timeout=10s - таймаут выполнения проверки 10 секунд
# --start-period=5s - даем 5 секунд на запуск перед первой проверкой
# --retries=3 - после 3 неудачных попыток считать контейнер unhealthy
# CMD - выполняем wget с опцией --spider (только проверяет существование URL, не скачивает)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --spider http://localhost:3000/health || exit 1

# Команда для запуска приложения с миграциями
CMD ["node", "dist/src/index.js"]