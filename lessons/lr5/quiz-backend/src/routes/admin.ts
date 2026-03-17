import { Hono } from 'hono';
import type { Context } from 'hono';
import prisma from '../lib/prisma.js'
import { adminAuth } from '../middleware/admin.js';
import { QuestionSchema, GradeSchema } from '../utils/validation.js';

const admin = new Hono();

// Применяем middleware ко всем admin роутам
admin.use('*', adminAuth);

//Получить все вопросы с информацией
admin.get('/questions', async (c: Context) => {
  try {
    const questions = await prisma.question.findMany({
      select: {
        id: true,
        text: true,
        type: true,
        points: true,
        correctAnswer: true,
        createdAt: true,
        updatedAt: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        _count: {
          select: {
            answers: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // correctAnswer из JSON в объект для ответа
    const formattedQuestions = questions.map(question => {
      let correctAnswer = question.correctAnswer;
      if (typeof correctAnswer === 'string') {
        try {
          correctAnswer = JSON.parse(correctAnswer);
        } catch {
          // Если не получается, оставляем как есть
        }
      }

      return {
        id: question.id,
        text: question.text,
        type: question.type,
        points: question.points,
        category: question.category,
        correctAnswer: correctAnswer,
        answersCount: question._count.answers,
        createdAt: question.createdAt,
        updatedAt: question.updatedAt
      };
    });

    return c.json({
      success: true,
      data: formattedQuestions
    });

  } catch (error) {
    console.error('Get admin questions error:', error);
    return c.json({
      success: false,
      error: 'Internal server error'
    }, 500);
  }
});


//Создать новый вопрос
admin.post('/questions', async (c: Context) => {
  try {
    const body = await c.req.json();
    
    const validationResult = QuestionSchema.safeParse(body);
    
    if (!validationResult.success) {
      return c.json({
        success: false,
        error: 'Validation failed',
        details: validationResult.error.issues
      }, 400);
    }

    const { text, type, points, categoryId, correctAnswer } = validationResult.data;

    const question = await prisma.question.create({
      data: {
        text,
        type,
        points,
        categoryId,
        correctAnswer: correctAnswer ? JSON.stringify(correctAnswer) : undefined
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });

    // correctAnswer для ответа
    let parsedCorrectAnswer = question.correctAnswer;
    if (typeof parsedCorrectAnswer === 'string') {
      try {
        parsedCorrectAnswer = JSON.parse(parsedCorrectAnswer);
      } catch {
        // Если не получается, оставляем как есть
      }
    }

    return c.json({
      success: true,
      data: {
        id: question.id,
        text: question.text,
        type: question.type,
        points: question.points,
        category: question.category,
        correctAnswer: parsedCorrectAnswer,
        createdAt: question.createdAt
      }
    }, 201);

  } catch (error) {
    console.error('Create question error:', error);
    return c.json({
      success: false,
      error: 'Internal server error'
    }, 500);
  }
});

//Обновить существующий вопрос
 admin.put('/questions/:id', async (c: Context) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();

    const validationResult = QuestionSchema.partial().safeParse(body);
    
    if (!validationResult.success) {
      return c.json({
        success: false,
        error: 'Validation failed',
        details: validationResult.error.issues
      }, 400);
    }

    const { text, type, points, categoryId, correctAnswer } = validationResult.data;

    // Подготавливаем данные для обновления
    const updateData: any = {};
    
    if (text !== undefined) updateData.text = text;
    if (type !== undefined) updateData.type = type;
    if (points !== undefined) updateData.points = points;
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (correctAnswer !== undefined) updateData.correctAnswer = JSON.stringify(correctAnswer);

    const updatedQuestion = await prisma.question.update({
      where: { id },
      data: updateData,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });

    // correctAnswer для ответа
    let parsedCorrectAnswer = updatedQuestion.correctAnswer;
    if (typeof parsedCorrectAnswer === 'string') {
      try {
        parsedCorrectAnswer = JSON.parse(parsedCorrectAnswer);
      } catch {
        // Если не получается, оставляем как есть
      }
    }

    return c.json({
      success: true,
      data: {
        id: updatedQuestion.id,
        text: updatedQuestion.text,
        type: updatedQuestion.type,
        points: updatedQuestion.points,
        category: updatedQuestion.category,
        correctAnswer: parsedCorrectAnswer,
        updatedAt: updatedQuestion.updatedAt
      }
    });

  } catch (error) {
    console.error('Update question error:', error);
    return c.json({
      success: false,
      error: 'Internal server error'
    }, 500);
  }
});

//Получить essay ответы которые не проверены
admin.get('/answers/pending', async (c: Context) => {
  try {
    // Ищем ответы без оценки, только для essay вопросов
    const pendingAnswers = await prisma.answer.findMany({
      where: {
        score: null,
        question: {
          type: 'essay'
        }
      },
      select: {
        id: true,
        userAnswer: true,
        createdAt: true,
        session: {
          select: {
            id: true,
            status: true,
            startedAt: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        },
        question: {
          select: {
            id: true,
            text: true,
            points: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    // Форматируем ответы
    const formattedAnswers = pendingAnswers.map(answer => {
      let userAnswer = answer.userAnswer;
      if (typeof userAnswer === 'string') {
        try {
          userAnswer = JSON.parse(userAnswer);
        } catch {
          // Если не получается, оставляем как есть
        }
      }

      return {
        id: answer.id,
        userAnswer: userAnswer,
        session: {
          id: answer.session.id,
          status: answer.session.status,
          startedAt: answer.session.startedAt,
          user: answer.session.user
        },
        question: answer.question,
        submittedAt: answer.createdAt
      };
    });

    return c.json({
      success: true,
      data: formattedAnswers
    });

  } catch (error) {
    console.error('Get pending answers error:', error);
    return c.json({
      success: false,
      error: 'Internal server error'
    }, 500);
  }
});

//Выставить оценку за essay
admin.post('/answers/:id/grade', async (c: Context) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();

    const validationResult = GradeSchema.safeParse(body);
    
    if (!validationResult.success) {
      return c.json({
        success: false,
        error: 'Validation failed',
        details: validationResult.error.issues
      }, 400);
    }

    const { points } = validationResult.data;

    const result = await prisma.$transaction(async (tx) => {
      // Находим ответ
      const answer = await tx.answer.findUnique({
        where: { id },
        include: {
          session: true,
          question: true
        }
      });

      if (!answer) {
        throw new Error('Answer not found');
      }

      if (answer.score !== null) {
        throw new Error('Answer already graded');
      }

      const updatedAnswer = await tx.answer.update({
        where: { id },
        data: {
          score: points,
        }
      });

      // Проверяем, все ли essay ответы в сессии проверены
      const sessionAnswers = await tx.answer.findMany({
        where: {
          sessionId: answer.sessionId,
          question: {
            type: 'essay'
          }
        }
      });

      const allEssaysGraded = sessionAnswers.every(a => a.score !== null);

      // Если все essay ответы проверены, обновляем общий счет сессии
      if (allEssaysGraded) {
        const allSessionAnswers = await tx.answer.findMany({
          where: {
            sessionId: answer.sessionId
          }
        });

        const totalScore = allSessionAnswers.reduce((sum, a) => sum + (a.score || 0), 0);

        await tx.session.update({
          where: { id: answer.sessionId },
          data: { 
            score: totalScore,
            status: 'completed',
            completedAt: new Date()
          }
        });
      }

      return updatedAnswer;
    });

    return c.json({
      success: true,
      message: 'Answer graded successfully',
      data: {
        id: result.id,
        score: result.score
      }
    });

  } catch (error) {
    console.error('Grade answer error:', error);
    
    if (error instanceof Error) {
      if (error.message === 'Answer not found') {
        return c.json({
          success: false,
          error: 'Not Found'
        }, 404);
      }
      
      if (error.message === 'Answer already graded') {
        return c.json({
          success: false,
          error: 'Bad Request'
        }, 400);
      }
    }
    
    return c.json({
      success: false,
      error: 'Internal server error'
    }, 500);
  }
});

//Получить статистику студента
admin.get('/students/:userId/stats', async (c: Context) => {
  try {
    const { userId } = c.req.param();

    // Получаем завершенные сессии пользователя
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        status: 'completed'
      },
      select: {
        id: true,
        score: true,
        startedAt: true,
        completedAt: true,
        _count: {
          select: {
            answers: true
          }
        }
      },
      orderBy: {
        completedAt: 'desc'
      }
    });

    // Рассчитываем статистику
    const totalSessions = sessions.length;
    
    const scores = sessions
      .map(s => s.score || 0)
      .filter(s => s > 0);
    
    const averageScore = scores.length > 0
      ? scores.reduce((sum, s) => sum + s, 0) / scores.length
      : 0;

    const totalAnswers = sessions.reduce((sum, s) => sum + s._count.answers, 0);

    const latestSession = sessions.length > 0 ? sessions[0] : null;

    return c.json({
      success: true,
      data: {
        userId,
        stats: {
          totalSessions,
          averageScore: Number(averageScore.toFixed(2)),
          totalAnswers,
          latestSession: latestSession ? {
            id: latestSession.id,
            score: latestSession.score,
            completedAt: latestSession.completedAt,
            answersCount: latestSession._count.answers
          } : null
        }
      }
    });

  } catch (error) {
    console.error('Get student stats error:', error);
    return c.json({
      success: false,
      error: 'Internal server error'
    }, 500);
  }
});

export default admin;