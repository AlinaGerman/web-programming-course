import prisma from '../lib/prisma.js'
import { scoringService } from "./scoringService.js";


export class SessionService {
  //Отправка 1 ответа пользователя
  async submitAnswer(
    sessionId: string,
    questionId: string,
    userAnswer: string | string[]
  ) {
    const question = await prisma.question.findUnique({
      where: { id: questionId }
    });

    if (!question) throw new Error('Question not found');

    let score: number | null = null;

    if (question.type === 'multiple-select') {
      score = scoringService.scoreMultipleSelect(
        question.correctAnswer as string[],
        userAnswer as string[]
      );
    }

    return await prisma.answer.create({
      data: {
        sessionId,
        questionId,
        userAnswer: JSON.stringify(userAnswer),
        score
      }
    });
  }

  //Завершение сессии
  async submitSession(sessionId: string) {
    return await prisma.$transaction(async (tx) => { //Транзакция - либо все операции успешно выполняются, либо не выполняется ни одна (все изменения откатываются)
      const session = await tx.session.findUnique({
        where: { id: sessionId },
        include: { answers: true }
      });

      // Проверки на существование и актуальность сессии
      if (!session) throw new Error('Session not found');
      if (session.expiresAt < new Date()) throw new Error('Expired');

      const totalScore = session.answers
        .filter(a => a.score !== null)
        .reduce((sum, a) => sum + (a.score || 0), 0);

      return await tx.session.update({
        where: { id: sessionId },
        data: { status: 'completed', score: totalScore }
      });
    });
  }
}

export const sessionService = new SessionService();