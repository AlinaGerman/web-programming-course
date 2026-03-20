export class ScoringService {
  //Правила: +1 за правильный, -0.5 за неправильный, min 0  
  scoreMultipleSelect(correctAnswers: string[], studentAnswers: string[]): number { 
    let score = 0;

    // Проходим по каждому ответу, который дал студент.
    for (const answer of studentAnswers) {
        // Проверяем, есть ли текущий ответ студента в массиве правильных ответов.
        if (correctAnswers.includes(answer)) {
            score += 1; 
        } else {
            score -= 0.5; 
        }
    }

    return Math.max(0, score);
  }

  //Параметры: массив оценок, рубрика с максимальными баллами
  scoreEssay(grades: number[], rubric: number[]): number {
    
    if (grades.length !== rubric.length || grades.length === 0) {
      return 0;
    }

    let total = 0;
    
    for (let i = 0; i < grades.length; i++) {
      total += Math.min(grades[i], rubric[i]);
    }
    
    return total;
  } 
}

export const scoringService = new ScoringService()