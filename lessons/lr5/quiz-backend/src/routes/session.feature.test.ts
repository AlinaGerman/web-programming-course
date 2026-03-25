import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp } from '../../tests/setup/test-app.js';
import { setupTestDatabase } from '../../tests/setup/test-db.js';
import prisma from '../lib/prisma.js';

describe('Sessions Feature Tests', () => {
  const app = createTestApp();
  setupTestDatabase();

  let authToken: string;
  let categoryId: string;

  beforeEach(async () => {
    // Получаем токен аутентификации
    const authResponse = await app.request('/api/auth/github/callback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code: 'test_code' }),
    });
    
    const authData = await authResponse.json();
    authToken = authData.token;

    // Создаем тестовую категорию вопросов
    const category = await prisma.category.create({
      data: {
        name: 'Test Category',
        slug: 'test-category'
      }
    });
    categoryId = category.id;

    // Создаем тестовые вопросы
    await prisma.question.createMany({
      data: [
        {
          text: 'Essay?',
          type: 'essay',
          points: 10,
          categoryId,
        },
        {
          text: 'Question1',
          type: 'multiple-select',
          points: 5,
          categoryId,
          correctAnswer: JSON.stringify(['A', 'B', 'C'])
        },
        {
          text: 'Essay2?',
          type: 'essay',
          points: 10,
          categoryId,
        }
      ]
    });
  });

  describe('Создание сессии', () => {
    it('1. должен создавать новую сессию с валидной категорией', async () => {    
    // Подготавливаем тело запроса для создания сессии
      const requestBody = {
      categoryId,
      questionCount: 3
    };

    // POST запрос на создание сессии
    const response = await app.request('/api/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    expect(response.status).toBe(201);
    const responseData = await response.json();
    // Проверяем структуру ответа
    expect(responseData).toMatchObject({
      success: true,
      data: {
        id: expect.any(String),
        status: 'in_progress',
        totalQuestions: 3,
        answeredQuestions: 0,
      }
    });
    // Проверяем, что вернулось 3 вопроса
    expect(responseData.data.questions).toHaveLength(3);
  });
    it('2. должен ограничивать количество вопросов доступным в категории', async () => {
      const requestBody = {
        categoryId,
        questionCount: 10
      };

      const response = await app.request('/api/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      expect(response.status).toBe(201);
      const responseData = await response.json();
      // Проверяем, что вернулось 3 вопроса, а не 10
      expect(responseData.data.totalQuestions).toBe(3);
      expect(responseData.data.questions).toHaveLength(3);
    });

    it('3. должен отклонять создание сессии без аутентификации', async () => {
      const requestBody = {
        categoryId,
        questionCount: 3
      };

      // Отправляем запрос БЕЗ заголовка Authorization
      const response = await app.request('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Отправка ответов', () => {
    let sessionId: string;
    let questionIds: string[];

    beforeEach(async () => {
      // Создаем сессию перед каждым тестом
      const createResponse = await app.request('/api/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          categoryId,
          questionCount: 3
        }),
      });
      
      const createData = await createResponse.json();
      sessionId = createData.data.id;
      questionIds = createData.data.questions.map((q: any) => q.id);
    });

    it('1. должен отправлять ответ на вопрос типа эссе', async () => {
      // Подготавливаем ответ на первый вопрос
      const requestBody = {
        questionId: questionIds[0],
        sessionId: sessionId,
        userAnswer: 'essay answer'
      };

      // Отправляем POST запрос с ответом
      const response = await app.request(`/api/sessions/${sessionId}/answers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // Проверяем успешность
      expect(response.status).toBe(201);
      const responseData = await response.json();
      
      // userAnswer может прийти как строка или как JSON строка
      const expectedAnswer = 'essay answer';
      const actualAnswer = responseData.data.userAnswer;
      
      // Если ответ пришел как JSON строка с кавычками, удаляем их
      const cleanAnswer = typeof actualAnswer === 'string' 
        ? actualAnswer.replace(/^"|"$/g, '') 
        : actualAnswer;
      
      // Проверяем, что ответ сохранился корректно
      expect(cleanAnswer).toBe(expectedAnswer);
      expect(responseData.data.questionId).toBe(questionIds[0]);
      // Для эссе isCorrect и score должны быть null
      expect(responseData.data.isCorrect).toBe(null);
      expect(responseData.data.score).toBe(null);
    });

    it('2. должен отправлять ответ на вопрос с множественным выбором и автоматически оценивать', async () => {
      // Подготавливаем ответ на второй вопрос
      const requestBody = {
        questionId: questionIds[1],
        sessionId: sessionId,
        userAnswer: ['A', 'B']
      };

      // Отправляем POST запрос с ответом
      const response = await app.request(`/api/sessions/${sessionId}/answers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      expect(response.status).toBe(201);
      const responseData = await response.json();
      
      // userAnswer может прийти как массив или как JSON строка
      let actualAnswer = responseData.data.userAnswer;
      if (typeof actualAnswer === 'string') {
        try {
          actualAnswer = JSON.parse(actualAnswer);
        } catch (e) {
          // Если не парсится, оставляем как есть
        }
      }
      
      // Проверяем, что ответ сохранился
      expect(actualAnswer).toEqual(['A', 'B']);
      expect(responseData.data.questionId).toBe(questionIds[1]);
      // Для multiple-select должна быть автоматическая оценка
      expect(responseData.data.isCorrect).toBeDefined();
      expect(responseData.data.score).toBeDefined();
    });

    it('3. должен отклонять отправку ответа без аутентификации', async () => {
      const requestBody = {
        questionId: questionIds[0],
        sessionId: sessionId,
        userAnswer: 'Тестовый ответ'
      };

      // Отправляем запрос БЕЗ токена
      const response = await app.request(`/api/sessions/${sessionId}/answers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Завершение сессии', () => {
    let sessionId: string;
    let questionIds: string[];

    beforeEach(async () => {
      // Создаем сессию для тестов завершения
      const createResponse = await app.request('/api/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          categoryId,
          questionCount: 3
        }),
      });
      
      const createData = await createResponse.json();
      sessionId = createData.data.id;
      questionIds = createData.data.questions.map((q: any) => q.id);
    });

    it('1. должен получать информацию о сессии со всеми деталями', async () => {
      // GET запрос для получения деталей сессии
      const response = await app.request(`/api/sessions/${sessionId}`, {
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
        data: {
          id: sessionId,
          status: 'in_progress',
          score: 0,
          answers: expect.any(Array)
        }
      });
    });

    it('2. должен завершать сессию и подсчитывать итоговый балл', async () => {
      // Отправляем ответы на все вопросы
      for (let i = 0; i < questionIds.length; i++) {
        const qId = questionIds[i];
        const answer = i === 1 ? ['A', 'B'] : 'Пример текста ответа'; // Для второго вопроса (multiple-select) отправляем массив, для остальных - строку

        // Отправляем POST запрос с ответом
        const answerResponse = await app.request(`/api/sessions/${sessionId}/answers`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            questionId: qId,
            sessionId: sessionId,
            userAnswer: answer
          }),
        });
        
        expect(answerResponse.status).toBe(201);
      }

      // Отправляем POST запрос с завершением сессии
      const response = await app.request(`/api/sessions/${sessionId}/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);
      const responseData = await response.json();
      // Проверяем структуру ответа с итогами
      expect(responseData).toMatchObject({
        success: true,
        data: {
          id: sessionId,
          status: 'completed',
          summary: {
            totalScore: expect.any(Number),
            correctAnswers: expect.any(Number),
            incorrectAnswers: expect.any(Number)
          }
        }
      });
    });

    it('3. должен завершать сессию даже без ответов (нулевой балл)', async () => {
      // Завершаем сессию, не отправляя ни одного ответа
      const response = await app.request(`/api/sessions/${sessionId}/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);
      const responseData = await response.json();
      // Сессия завершена, но с 0 баллов
      expect(responseData.data.status).toBe('completed');
      expect(responseData.data.summary.totalScore).toBe(0);
    });
  });
});