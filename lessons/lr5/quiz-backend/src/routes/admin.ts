import { Hono } from 'hono';
import type { Context } from 'hono';
import prisma from '../lib/prisma.js'
import { adminAuth } from '../middleware/admin.js';
import { QuestionSchema, GradeSchema } from '../utils/validation.js';

const admin = new Hono();

// Применяем middleware ко всем admin роутам
admin.use('*', adminAuth);

// функция для пагинации
const getPagination = (c: Context) => {
  const page = Number(c.req.query('page')) || 1;
  const limit = Number(c.req.query('limit')) || 20;
  return { page, limit, skip: (page - 1) * limit };
};

// функция для парсинга JSON
const parseJSON = (data: any) => {
  if (typeof data === 'string') {
    try { return JSON.parse(data); } catch { return data; }
  }
  return data;
};

// GET /api/admin/questions
admin.get('/questions', async (c: Context) => {
  try {
    const { page, limit, skip } = getPagination(c);
    
    const [totalCount, questions] = await Promise.all([
      prisma.question.count(),
      prisma.question.findMany({
        select: {
          id: true, text: true, type: true, points: true,
          correctAnswer: true, createdAt: true, updatedAt: true,
          category: { select: { id: true, name: true, slug: true } },
          _count: { select: { answers: true } },
          answers: { select: { score: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip, take: limit
      })
    ]);

    const formattedQuestions = questions.map(q => ({
      id: q.id, text: q.text, type: q.type, points: q.points,
      category: q.category, correctAnswer: parseJSON(q.correctAnswer),
      totalAnswers: q._count.answers,
      stats: {
        answeredCount: q.answers.filter(a => a.score !== null).length,
        averageScore: q.answers.length ? Number((q.answers.reduce((sum, a) => sum + (a.score || 0), 0) / q.answers.length).toFixed(2)) : 0,
        completionRate: q.answers.length ? Number(((q.answers.filter(a => a.score !== null).length / q.answers.length) * 100).toFixed(2)) : 0
      },
      createdAt: q.createdAt, updatedAt: q.updatedAt
    }));

    return c.json({
      success: true,
      questions: formattedQuestions,
      pagination: { page, limit, total: totalCount, pages: Math.ceil(totalCount / limit) }
    });
  } catch (error) {
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// POST /api/admin/questions
admin.post('/questions', async (c: Context) => {
  try {
    const body = await c.req.json();
    const validation = QuestionSchema.safeParse(body);
    if (!validation.success) {
      return c.json({ success: false, error: 'Validation failed', details: validation.error.issues }, 400);
    }

    const { text, type, points, categoryId, correctAnswer } = validation.data;
    
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) return c.json({ success: false, error: 'Category not found' }, 404);

    const questionData: any = {
      text,
      type,
      points,
      categoryId,
    };
    
    if (correctAnswer !== undefined) {
      questionData.correctAnswer = correctAnswer as any;
    }

    const question = await prisma.question.create({
      data: questionData,
      include: { category: { select: { id: true, name: true, slug: true } } }
    });

    return c.json({
      success: true,
      question: { ...question, correctAnswer: parseJSON(question.correctAnswer) }
    }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// PUT /api/admin/questions/:id
admin.put('/questions/:id', async (c: Context) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();

    const existing = await prisma.question.findUnique({ where: { id } });
    if (!existing) return c.json({ success: false, error: 'Not Found' }, 404);

    const validation = QuestionSchema.partial().safeParse(body);
    if (!validation.success) {
      return c.json({ success: false, error: 'Validation failed', details: validation.error.issues }, 400);
    }

    const { text, type, points, categoryId, correctAnswer } = validation.data;

    if (categoryId) {
      const category = await prisma.category.findUnique({ where: { id: categoryId } });
      if (!category) return c.json({ success: false, error: 'Category not found' }, 404);
    }

    const updateData: any = {};
    if (text !== undefined) updateData.text = text;
    if (type !== undefined) updateData.type = type;
    if (points !== undefined) updateData.points = points;
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (correctAnswer !== undefined) updateData.correctAnswer = correctAnswer as any;

    const updated = await prisma.question.update({
      where: { id },
      data: updateData,
      include: { category: { select: { id: true, name: true, slug: true } } }
    });

    return c.json({
      success: true,
      question: { ...updated, correctAnswer: parseJSON(updated.correctAnswer) }
    });
  } catch (error) {
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// GET /api/admin/answers/pending
admin.get('/answers/pending', async (c: Context) => {
  try {
    const { page, limit, skip } = getPagination(c);
    
    const [totalCount, pendingAnswers] = await Promise.all([
      prisma.answer.count({ where: { score: null, question: { type: 'essay' } } }),
      prisma.answer.findMany({
        where: { score: null, question: { type: 'essay' } },
        select: {
          id: true, userAnswer: true, createdAt: true,
          session: {
            select: {
              id: true, status: true, startedAt: true,
              user: { select: { id: true, name: true, email: true } }
            }
          },
          question: { select: { id: true, text: true, points: true } }
        },
        orderBy: { createdAt: 'asc' },
        skip, take: limit
      })
    ]);

    const formatted = pendingAnswers.map(a => ({
      id: a.id, userAnswer: parseJSON(a.userAnswer),
      session: a.session, question: a.question, submittedAt: a.createdAt
    }));

    return c.json({
      success: true,
      pendingAnswers: formatted,
      pagination: { page, limit, total: totalCount, pages: Math.ceil(totalCount / limit) }
    });
  } catch (error) {
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// POST /api/admin/answers/:id/grade
admin.post('/answers/:id/grade', async (c: Context) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();

    const validation = GradeSchema.safeParse(body);
    if (!validation.success) {
      return c.json({ success: false, error: 'Validation failed', details: validation.error.issues }, 400);
    }

    const { points } = validation.data;

    const result = await prisma.$transaction(async (tx) => {
      const answer = await tx.answer.findUnique({
        where: { id },
        include: { 
          session: { 
            include: { 
              answers: { 
                where: { 
                  question: { 
                    type: 'essay' 
                  } 
                } 
              } 
            } 
          }, 
          question: true 
        }
      });

      if (!answer) throw new Error('Answer not found');
      if (answer.score !== null) throw new Error('Answer already graded');
      if (answer.question.type !== 'essay') throw new Error('Can only grade essay answers');

      const updated = await tx.answer.update({ 
        where: { id }, 
        data: { 
          score: points 
        } 
      });

      const sessionAnswers = await tx.answer.findMany({
        where: { 
          sessionId: answer.sessionId, 
          question: { 
            type: 'essay' 
          } 
        }
      });

      const allEssaysGraded = sessionAnswers.every(a => a.score !== null);

      if (allEssaysGraded) {
        const allAnswers = await tx.answer.findMany({ 
          where: { 
            sessionId: answer.sessionId 
          } 
        });
        
        const totalScore = allAnswers.reduce((sum, a) => sum + (a.score || 0), 0);
        
        await tx.session.update({
          where: { id: answer.sessionId },
          data: { 
            score: totalScore, 
            ...(answer.session.status === 'in_progress' && { 
              status: 'completed', 
              completedAt: new Date() 
            }) 
          }
        });
      }

      return updated;
    });

    return c.json({ 
      success: true, 
      message: 'Answer graded successfully', 
      answer: { 
        id: result.id, 
        score: result.score, 
        gradedAt: result.updatedAt 
      } 
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Answer not found') return c.json({ success: false, error: 'Not Found' }, 404);
      if (['Answer already graded', 'Can only grade essay answers'].includes(error.message)) {
        return c.json({ success: false, error: 'Bad Request', message: error.message }, 400);
      }
    }
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// GET /api/admin/students
admin.get('/students', async (c: Context) => {
  try {
    const { page, limit, skip } = getPagination(c);
    const search = c.req.query('search') || '';
    
    const where = search ? { 
      OR: [
        { email: { contains: search } }, 
        { name: { contains: search } }
      ] 
    } : {};
    
    const [totalCount, students] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: {
          id: true, email: true, name: true, githubId: true, role: true, createdAt: true,
          _count: { 
            select: { 
              sessions: { 
                where: { 
                  status: 'completed' 
                } 
              } 
            } 
          },
          sessions: { 
            where: { 
              status: 'completed' 
            }, 
            select: { 
              score: true 
            }, 
            take: 1 
          }
        },
        orderBy: { createdAt: 'desc' },
        skip, take: limit
      })
    ]);

    const formatted = students.map(s => {
      const scores = s.sessions.map(s => s.score || 0).filter(s => s > 0);
      return {
        id: s.id, email: s.email, name: s.name, githubId: s.githubId, role: s.role, createdAt: s.createdAt,
        stats: {
          totalSessions: s._count.sessions,
          averageScore: scores.length ? Number((scores.reduce((sum, s) => sum + s, 0) / scores.length).toFixed(2)) : 0
        }
      };
    });

    return c.json({
      success: true,
      students: formatted,
      pagination: { page, limit, total: totalCount, pages: Math.ceil(totalCount / limit) }
    });
  } catch (error) {
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

export default admin;