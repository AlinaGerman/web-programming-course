import { Hono } from 'hono';
import { z } from 'zod';
import prisma from '../lib/prisma.js'
import { AnswerSchema } from '../utils/validation.js';
import { sessionService } from '../services/sessionService.js';
import { authMiddleware, checkSessionAccess, type SessionUser } from '../middleware/session.js';

const sessions = new Hono();

// Схема для создания сессии
const createSessionSchema = z.object({
  categoryId: z.string(),
  questionCount: z.number().min(1).max(50).optional().default(10)
});

// Все роуты требуют аутентификации
sessions.use('*', authMiddleware);

//Создание новой сессии квиза и получение количества вопросов для квиза
sessions.post('/', async (c) => {
  try {
    // Получаем пользователя из контекста
    const user = (c as any).get('user') as SessionUser;
    // Парсим тело запроса (JSON) в JavaScript объект
    const body = await c.req.json();
    // Валидируем входные данные по схеме
    const validationResult = createSessionSchema.safeParse(body);
    
    // Если данные неверны, возвращаем ошибку
    if (!validationResult.success) {
      return c.json({ 
        success: false,
        error: 'Validation failed',
        details: validationResult.error.issues  
      }, 400);
    }
    
    const { categoryId, questionCount } = validationResult.data;
    
    // Считаем, сколько всего вопросов есть в выбранной категории.
    const questionsCount = await prisma.question.count({
      where: { categoryId }
    });
    
    if (questionsCount === 0) {
      return c.json({ 
        success: false,
        error: 'No questions found in this category' 
      }, 404);
    }
    
    // Определяем реальное количество вопросов. Если пользователь запросил больше, чем есть в базе, берем то, что есть
    const actualQuestionCount = Math.min(questionCount, questionsCount);
    
    const questions = await prisma.question.findMany({
      where: { categoryId },
      take: actualQuestionCount,
      select: {
        id: true,
        text: true,
        type: true,
        points: true
      }
    });
    
    // Устанавливаем время истечения сессии (через 1 час от текущего момента)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);
     
    // Создаем запись о сессии в базе данных.
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        expiresAt,
        status: 'in_progress',
        score: 0,
        startedAt: new Date(),
      }
    });
    
    return c.json({ 
      success: true,
      data: {
        id: session.id,
        status: session.status,
        startedAt: session.startedAt,
        expiresAt: session.expiresAt,
        totalQuestions: actualQuestionCount,
        answeredQuestions: 0,
        questions
      }
    }, 201);
    
  } catch (error) {
    console.error('Create session error:', error);
    return c.json({ 
      success: false,
      error: 'Internal server error'
    }, 500);
  }
});

// Отправка ответа на вопрос
sessions.post('/:id/answers', checkSessionAccess, async (c) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();
    
    const validationResult = AnswerSchema.safeParse(body);
    
    if (!validationResult.success) {
      return c.json({ 
        success: false,
        error: 'Validation failed',
        details: validationResult.error.issues  
      }, 400);
    }
    
    const { questionId, userAnswer } = validationResult.data;
    
    // Передаем логику обработки ответа
    const answer = await sessionService.submitAnswer(id, questionId, userAnswer);
    
    // Возвращаем созданный ответ с его оценкой
    return c.json({ 
      success: true,
      data: {
        id: answer.id,
        questionId: answer.questionId,
        userAnswer: answer.userAnswer,
        isCorrect: answer.isCorrect,
        score: answer.score,
        createdAt: answer.createdAt
      }
    }, 201);
    
  } catch (error) {
    console.error('Submit answer error:', error);
    
    if (error instanceof Error) {
      if (error.message === 'Session not found') {
        return c.json({ 
          success: false,
          error: 'Session not found'
        }, 404);
      }
      
      if (error.message === 'Question not found in this session') {
        return c.json({ 
          success: false,
          error: 'Question not found in this session'
        }, 400);
      }
      
      if (error.message === 'Session has expired' || error.message === 'Session already completed') {
        return c.json({ 
          success: false,
          error: error.message
        }, 400);
      }
    }
    
    return c.json({ 
      success: false,
      error: 'Internal server error'
    }, 500);
  }
});

//Получение информации о сессии
sessions.get('/:id', checkSessionAccess, async (c) => {
  try {
    const { id } = c.req.param();
    
    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        answers: {
          include: {
            question: true // Для каждого ответа подгружаем сам вопрос
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });
    
    if (!session) {
      return c.json({ 
        success: false,
        error: 'Session not found'
      }, 404);
    }
  
    // Подсчёт отвеченных вопросов
    const answeredQuestions = session.answers.filter(a => 
      a.userAnswer !== null && 
      (Array.isArray(a.userAnswer) ? a.userAnswer.length > 0 : a.userAnswer !== '')
    ).length;
    
    return c.json({ 
      success: true,
      data: {
        id: session.id,
        status: session.status,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        expiresAt: session.expiresAt,
        score: session.score,
        totalQuestions: session.answers.length,
        answeredQuestions,
        answers: session.answers.map(answer => ({
          id: answer.id,
          question: {
            id: answer.question.id,
            text: answer.question.text,
            type: answer.question.type,
            points: answer.question.points
          },
          userAnswer: answer.userAnswer,
          isCorrect: answer.isCorrect,
          score: answer.score,
          createdAt: answer.createdAt
        }))
      }
    });
    
  } catch (error) {
    console.error('Get session error:', error);
    return c.json({ 
      success: false,
      error: 'Internal server error'
    }, 500);
  }
});


// Завершение сессии
sessions.post('/:id/submit', checkSessionAccess, async (c) => {
  try {
    const { id } = c.req.param();
    
    // Проверяем статус сессии
    const session = await prisma.session.findUnique({
      where: { id },
      select: { status: true }
    });
    
    if (!session) {
      return c.json({ 
        success: false,
        error: 'Session not found'
      }, 404);
    }
    
    if (session.status === 'completed') {
      return c.json({ 
        success: false,
        error: 'Session already completed'
      }, 400);
    }
    
    // Вызываем метод сервиса для завершения сессии и подсчета итогового балла
    const completedSession = await sessionService.submitSession(id);
    
    // После завершения снова запрашиваем сессию из базы со всеми данными для ответа клиенту
    const fullSession = await prisma.session.findUnique({
      where: { id: completedSession.id },
      include: {
        answers: {
          include: {
            question: true
          }
        }
      }
    });
    
    if (!fullSession) {
      throw new Error('Completed session not found');
    }
    
    // Подсчёт отвеченных вопросов
    const answeredQuestions = fullSession.answers.filter(a => 
      a.userAnswer !== null && 
      (Array.isArray(a.userAnswer) ? a.userAnswer.length > 0 : a.userAnswer !== '') 
    );
    
    //Сбор статистики
    const summary = {
      totalScore: fullSession.score,
      correctAnswers: fullSession.answers.filter(a => a.isCorrect === true).length,
      incorrectAnswers: fullSession.answers.filter(a => a.isCorrect === false).length,
      unanswered: fullSession.answers.length - answeredQuestions.length
    };
    
    return c.json({ 
      success: true,
      data: {
        id: fullSession.id,
        status: fullSession.status,
        startedAt: fullSession.startedAt,
        completedAt: fullSession.completedAt,
        score: fullSession.score,
        totalQuestions: fullSession.answers.length,
        answeredQuestions: answeredQuestions.length,
        summary,
        answers: fullSession.answers.map(answer => ({
          id: answer.id,
          question: {
            id: answer.question.id,
            text: answer.question.text,
            type: answer.question.type,
            points: answer.question.points
          },
          userAnswer: answer.userAnswer,
          isCorrect: answer.isCorrect,
          score: answer.score
        }))
      }
    });
    
  } catch (error) {
    console.error('Submit session error:', error);
    
    if (error instanceof Error) {
      if (error.message === 'Session not found') {
        return c.json({ 
          success: false,
          error: 'Session not found'
        }, 404);
      }
      
      if (error.message === 'Session already completed') {
        return c.json({ 
          success: false,
          error: 'Session already completed'
        }, 400);
      }
    }
    
    return c.json({ 
      success: false,
      error: 'Internal server error'
    }, 500);
  }
});

export default sessions;