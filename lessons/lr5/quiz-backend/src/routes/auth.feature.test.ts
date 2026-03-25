import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp } from '../../tests/setup/test-app.js';
import { setupTestDatabase } from '../../tests/setup/test-db.js';
import prisma from '../lib/prisma.js';

describe('Auth Feature Tests', () => {
  const app = createTestApp();
  setupTestDatabase();

  describe('GitHub OAuth Flow', () => {
    it('1. должен аутентифицировать пользователя с валидным GitHub кодом и вернуть JWT токен', async () => {
      const validCode = 'test_code';
      const requestBody = { code: validCode };

      //POST запрос к github/callback
      const response = await app.request('/api/auth/github/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      expect(response.status).toBe(200);
      const responseData = await response.json();
      
      // Проверяем структуру ответа с помощью toMatchObject (проверяет, что объект содержит указанные поля (дополнительные поля игнорируются))
      expect(responseData).toMatchObject({
        success: true,
        token: expect.any(String),
        user: {
          id: expect.any(String),
          email: 'test@example.com',
          name: 'Test User',
          githubId: expect.any(String)
        }
      });
    });

    it('2. должен отклонять аутентификацию с невалидным GitHub кодом', async () => {
      const invalidCode = 'invalid_code';
      const requestBody = { code: invalidCode };

      const response = await app.request('/api/auth/github/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      expect(response.status).toBe(400);
      const responseData = await response.json();
      expect(responseData.success).toBe(false);
    });

    it('3. должен валидировать отсутствие кода авторизации', async () => {
      const requestBody = {};

      const response = await app.request('/api/auth/github/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      expect(response.status).toBe(400);
      const responseData = await response.json();
    });
  });

  describe('Получение текущего пользователя', () => {
    let authToken: string;

    beforeEach(async () => {
      const authResponse = await app.request('/api/auth/github/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: 'test_code' }),
      });
      const authData = await authResponse.json();
      authToken = authData.token;
    });

    it('1. должен возвращать информацию о текущем пользователе с валидным токеном', async () => {
      const response = await app.request('/api/auth/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);
      const responseData = await response.json();
      
      // Проверяем структуру ответа
      expect(responseData).toMatchObject({
        success: true,
        user: {
          id: expect.any(String),
          email: 'test@example.com',
          name: 'Test User'
        }
      });
    });

    it('2. должен отклонять запрос без заголовка Authorization', async () => {
      const response = await app.request('/api/auth/me', {
        method: 'GET',
      });

      expect(response.status).toBe(401);
    });

    it('3. должен отклонять запрос с невалидным токеном', async () => {
      const response = await app.request('/api/auth/me', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer invalid-token',
        },
      });

      expect(response.status).toBe(401);
    });

    it('4. должен отклонять запрос с некорректным форматом заголовка', async () => {
      const response = await app.request('/api/auth/me', {
        method: 'GET',
        headers: {
          'Authorization': 'InvalidFormat',
        },
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Проверка прав доступа', () => {
    let userToken: string;
    let adminToken: string;

    beforeEach(async () => {
      // Получаем токен обычного пользователя
      const userAuthResponse = await app.request('/api/auth/github/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'test_code' }),
      });
      userToken = (await userAuthResponse.json()).token;

      // Создаем администратора в базе
      await prisma.user.upsert({
        where: { githubId: '67890' },
        update: { role: 'admin' },
        create: {
          githubId: '67890',
          email: 'admin@example.com',
          name: 'Admin User',
          role: 'admin'
        }
      });

      // Получаем токен администратора
      const adminAuthResponse = await app.request('/api/auth/github/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'test_code_2' }),
      });
      adminToken = (await adminAuthResponse.json()).token;
    });

    it('1. должен отклонять доступ обычного пользователя (student) к admin endpoint (403)', async () => {
      const response = await app.request('/api/admin/questions', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${userToken}`,
        },
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('2.должен разрешать доступ администратора к admin endpoint (200)', async () => {
      const response = await app.request('/api/admin/questions', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });
});