import { afterAll, beforeAll, afterEach } from "vitest";
import prisma from "../../src/lib/prisma.js";

// Сбрасывает базу данных перед каждым тестом
export async function resetTestDb() {
  await prisma.answer.deleteMany();
  await prisma.session.deleteMany();
  await prisma.question.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
}

// Настройка для всех тестов
export function setupTestDatabase() {
  beforeAll(async () => {
    // Соединение с базой
    await prisma.$connect();
  });

  afterEach(async () => {
    // Очищаем базу после каждого теста
    await resetTestDb();
  });

  afterAll(async () => {
    // Закрываем соединение после всех тестов
    await prisma.$disconnect();
  });
}