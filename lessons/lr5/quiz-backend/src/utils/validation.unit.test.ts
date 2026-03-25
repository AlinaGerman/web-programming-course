import { describe, it, expect } from 'vitest';
import {
  AnswerSchema,
  ScoringRulesSchema,
  GradeSchema,
  QuestionSchema,
  SessionSubmitSchema
} from './validation.js';

describe('Validation Schemas - Unit Tests', () => {
  
  describe('AnswerSchema', () => {
    const validId = 'cmn4dva4q000op9ocr4ky9e8r';
    const validId2 = 'cmn4dva4q000op9ocr4ky9e8s';

    it('1. должен валидировать multiple-select ответ с массивом строк', () => {
      const result = AnswerSchema.safeParse({
        questionId: validId,
        userAnswer: ['A', 'B', 'C'],
        sessionId: validId2
      });
      expect(result.success).toBe(true);
    });

    it('2. должен валидировать essay ответ со строкой', () => {
      const result = AnswerSchema.safeParse({
        questionId: validId,
        userAnswer: 'Essay answer text',
        sessionId: validId2
      });
      expect(result.success).toBe(true);
    });

    it('3. должен принимать любой непустой questionId', () => {
      const result = AnswerSchema.safeParse({
        questionId: 'invalid-id-format',
        userAnswer: ['A'],
        sessionId: validId2
      });
      expect(result.success).toBe(true);
    });

    it('4. должен отклонять отсутствующий questionId', () => {
      const result = AnswerSchema.safeParse({
        userAnswer: ['A'],
        sessionId: validId2
      });
      expect(result.success).toBe(false);
    });

    it('5. должен отклонять отсутствующий userAnswer', () => {
      const result = AnswerSchema.safeParse({
        questionId: validId,
        sessionId: validId2
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ScoringRulesSchema', () => {
    it('1. должен валидировать корректные правила', () => {
      const result = ScoringRulesSchema.safeParse({
        pointsPerCorrect: 1,
        pointsPerIncorrect: -0.5,
        minScore: 0,
        maxScore: 10
      });
      expect(result.success).toBe(true);
    });

    it('2. должен отклонять положительный штраф', () => {
      const result = ScoringRulesSchema.safeParse({
        pointsPerCorrect: 1,
        pointsPerIncorrect: 0.5,
        minScore: 0,
        maxScore: 10
      });
      expect(result.success).toBe(false);
    });

    it('3. баллы за правильный ответ не могут быть отрицательными', () => {
      const result = ScoringRulesSchema.safeParse({
        pointsPerCorrect: -1,
        pointsPerIncorrect: -0.5,
        minScore: 0,
        maxScore: 10
      });
      expect(result.success).toBe(false);
    });

    it('4. должен валидировать граничные значения', () => {
      const result = ScoringRulesSchema.safeParse({
        pointsPerCorrect: 2,
        pointsPerIncorrect: -1,
        minScore: 0,
        maxScore: 100
      });
      expect(result.success).toBe(true);
    });

    it('5. максимальный балл не может быть отрицательным', () => {
      const result = ScoringRulesSchema.safeParse({
        pointsPerCorrect: 1,
        pointsPerIncorrect: -0.5,
        minScore: 0,
        maxScore: -5
      });
      expect(result.success).toBe(false);
    });
  });

  describe('GradeSchema', () => {
    it('1. должен валидировать корректную оценку', () => {
      const result = GradeSchema.safeParse({
        criterion: 'Grammar',
        points: 8,
        feedback: 'Good job!'
      });
      expect(result.success).toBe(true);
    });

    it('2. должен валидировать оценку без feedback', () => {
      const result = GradeSchema.safeParse({
        criterion: 'Grammar',
        points: 8
      });
      expect(result.success).toBe(true);
    });

    it('3. criterion не может быть пустой строкой', () => {
      const result = GradeSchema.safeParse({
        criterion: '',
        points: 8
      });
      expect(result.success).toBe(false);
    });

    it('4. баллы не могут быть отрицательными', () => {
      const result = GradeSchema.safeParse({
        criterion: 'Grammar',
        points: -1
      });
      expect(result.success).toBe(false);
    });

    it('5. должен отклонять баллы выше 10', () => {
      const result = GradeSchema.safeParse({
        criterion: 'Grammar',
        points: 11
      });
      expect(result.success).toBe(false);
    });
  });

  describe('QuestionSchema', () => {
    const validId = 'cmn4dva4q000op9ocr4ky9e8r';

    it('1. должен валидировать корректный multiple-select вопрос', () => {
      const result = QuestionSchema.safeParse({
        text: 'What are the benefits of TypeScript?',
        type: 'multiple-select',
        points: 10,
        categoryId: validId,
        correctAnswer: ['Type safety', 'Better tooling']
      });
      expect(result.success).toBe(true);
    });

    it('2. должен валидировать корректный essay вопрос', () => {
      const result = QuestionSchema.safeParse({
        text: 'Explain closures in JavaScript',
        type: 'essay',
        points: 20,
        categoryId: validId
      });
      expect(result.success).toBe(true);
    });

    it('3. проверка обязательности correctAnswer для multiple-select', () => {
      const result = QuestionSchema.safeParse({
        text: 'Benefits of TypeScript?',
        type: 'multiple-select',
        points: 10,
        categoryId: validId
      });
      expect(result.success).toBe(false);
    });

    it('4. проверка минимальной длины текста вопроса эссе', () => {
      const result = QuestionSchema.safeParse({
        text: 'Hi',
        type: 'essay',
        points: 10,
        categoryId: validId
      });
      expect(result.success).toBe(false);
    });

    it('5. должен отклонять баллы вне диапазона', () => {
      const result = QuestionSchema.safeParse({
        text: 'Valid question text',
        type: 'essay',
        points: 101,
        categoryId: validId
      });
      expect(result.success).toBe(false);
    });
  });

  describe('SessionSubmitSchema', () => {
    it('1. должен валидировать пустой объект', () => {
      const result = SessionSubmitSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('2. должен валидировать undefined', () => {
      const result = SessionSubmitSchema.safeParse(undefined);
      expect(result.success).toBe(true);
    });

    it('3. должен отклонять null', () => {
      const result = SessionSubmitSchema.safeParse(null);
      expect(result.success).toBe(false);
    });

    it('4. должен игнорировать дополнительные поля', () => {
      const result = SessionSubmitSchema.safeParse({ extra: 'field' });
      expect(result.success).toBe(true);
    });

    it('5. должен отклонять строку (если схема ожидает объект)', () => {
      const result = SessionSubmitSchema.safeParse('string');
      expect(result.success).toBe(false);
    });
  });
});