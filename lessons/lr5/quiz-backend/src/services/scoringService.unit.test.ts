import { describe, it, expect, beforeEach } from 'vitest';
import { ScoringService } from './scoringService.js';

describe('ScoringService - Unit Tests', () => {
  let scoringService: ScoringService;

  // Инициализируем новый сервис перед каждым тестом
  // Это гарантирует, что тесты не влияют друг на друга
  beforeEach(() => {
    scoringService = new ScoringService();
  });

  describe('scoreMultipleSelect', () => {
    it('1. должен вернуть максимальный балл когда все ответы правильные', () => {
      const correct = ['A', 'B', 'C'];
      const student = ['A', 'B', 'C'];
      expect(scoringService.scoreMultipleSelect(correct, student)).toBe(3);
    });

    it('2. должен правильно считать комбинацию правильных и неправильных ответов', () => {
      const correct = ['A', 'B', 'C'];
      const student = ['A', 'B', 'D']; // A(+1), B(+1), D(-0.5) = 1.5
      expect(scoringService.scoreMultipleSelect(correct, student)).toBe(1.5);
    });

    it('3. должен вернуть 0 при пустом массиве ответов студента', () => {
      const correct = ['A', 'B', 'C'];
      const student: string[] = [];
      expect(scoringService.scoreMultipleSelect(correct, student)).toBe(0);
    });

    it('4. должен вернуть 0 когда штрафы превышают бонусы', () => {
      const correct = ['A'];
      const student = ['A', 'B', 'C', 'D']; // +1 -0.5 -0.5 -0.5 = -0.5 -> 0
      expect(scoringService.scoreMultipleSelect(correct, student)).toBe(0);
    });

    it('5. должен вернуть 0 когда все ответы неправильные', () => {
      const correct = ['A', 'B'];
      const student = ['C', 'D', 'E'];
      expect(scoringService.scoreMultipleSelect(correct, student)).toBe(0);
    });
  });

  describe('scoreEssay', () => {
    it('1. должен правильно суммировать оценки в пределах рубрики', () => {
      const grades = [4, 2, 1];
      const rubric = [5, 3, 2];
      expect(scoringService.scoreEssay(grades, rubric)).toBe(7); // 4+2+1=7
    });

    it('2. должен ограничить оценки максимальными значениями рубрики', () => {
      const grades = [6, 4, 3]; // все превышают максимум
      const rubric = [5, 3, 2];
      expect(scoringService.scoreEssay(grades, rubric)).toBe(10); // 5+3+2=10
    });

    it('3. должен ограничить только те оценки, которые превышают максимум', () => {
      const grades = [5, 4, 1]; // вторая оценка 4 > 3
      const rubric = [5, 3, 2];
      expect(scoringService.scoreEssay(grades, rubric)).toBe(9); // 5+3+1=9
    });

    it('4. должен вернуть 0 при пустых массивах', () => {
      const grades: number[] = [];
      const rubric: number[] = [];
      expect(scoringService.scoreEssay(grades, rubric)).toBe(0);
    });

    it('5. должен корректно работать с нулевыми оценками', () => {
      const grades = [0, 0, 0];
      const rubric = [5, 3, 2];
      expect(scoringService.scoreEssay(grades, rubric)).toBe(0);
    });
  });
});