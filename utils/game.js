const {
  DIFFICULTIES,
  LEVEL_QUESTION_COUNTS,
  MAX_LEVEL,
  SPEED_MODE_CONFIG,
} = require("./constants");

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(list) {
  return list[randInt(0, list.length - 1)];
}

function getOperationPool(difficulty, level, mode) {
  if (mode === "speed") {
    return ["+", "-", "*"];
  }
  if (difficulty === "advanced" && level <= 2) {
    return ["+", "-"];
  }
  if (difficulty === "challenge" && level <= 2) {
    return ["+", "-", "*"];
  }
  return DIFFICULTIES[difficulty].operations.slice();
}

function createQuestionByOperation(op, maxNumber) {
  if (op === "+") {
    const a = randInt(0, maxNumber);
    const b = randInt(0, maxNumber - a);
    return { expression: `${a}+${b}`, answer: a + b };
  }

  if (op === "-") {
    const a = randInt(0, maxNumber);
    const b = randInt(0, a);
    return { expression: `${a}-${b}`, answer: a - b };
  }

  if (op === "*") {
    const a = randInt(1, 9);
    const b = randInt(1, 9);
    return { expression: `${a}×${b}`, answer: a * b };
  }

  const divisor = randInt(1, 9);
  const quotient = randInt(1, 9);
  const dividend = divisor * quotient;
  return { expression: `${dividend}÷${divisor}`, answer: quotient };
}

function buildRoundConfig({ mode, difficulty, level }) {
  if (mode === "speed") {
    return {
      difficulty: SPEED_MODE_CONFIG.difficulty,
      level: 0,
      memoryTime: SPEED_MODE_CONFIG.memoryTime,
      answerTime: SPEED_MODE_CONFIG.answerTime,
      questionCount: SPEED_MODE_CONFIG.questionCount,
      operations: getOperationPool(SPEED_MODE_CONFIG.difficulty, 3, "speed"),
    };
  }

  const clampedLevel = Math.min(Math.max(level || 1, 1), MAX_LEVEL);
  const difficultyCfg = DIFFICULTIES[difficulty];
  const memoryPenalty = Math.floor((clampedLevel - 1) / 3);
  const answerPenalty = Math.floor((clampedLevel - 1) / 2);

  let questionCount = LEVEL_QUESTION_COUNTS[clampedLevel - 1] || 6;
  if (mode === "daily") {
    questionCount = Math.min(questionCount + 1, 10);
  }

  return {
    difficulty,
    level: clampedLevel,
    memoryTime: Math.max(3, difficultyCfg.memoryTime - memoryPenalty),
    answerTime: Math.max(10, difficultyCfg.answerTime - answerPenalty),
    questionCount,
    operations: getOperationPool(difficulty, clampedLevel, mode),
  };
}

function generateQuestions({ mode, difficulty, level }) {
  const config = buildRoundConfig({ mode, difficulty, level });
  const difficultyCfg = DIFFICULTIES[config.difficulty];
  const questions = [];
  for (let i = 0; i < config.questionCount; i += 1) {
    const op = pickRandom(config.operations);
    const question = createQuestionByOperation(op, difficultyCfg.maxNumber);
    questions.push({
      id: `${Date.now()}_${i}`,
      expression: question.expression,
      answer: question.answer,
      status: "pending",
      userAnswer: null,
    });
  }
  return { config, questions };
}

function calcScore({ mode, correctCount, totalCount, elapsedMs, isAllCorrect }) {
  if (mode === "speed") {
    const base = correctCount * 2;
    const timeBonus = Math.max(0, Math.round((20000 - elapsedMs) / 120));
    const clearBonus = isAllCorrect ? 60 : 0;
    const speedScore = base + timeBonus + clearBonus;
    const points = isAllCorrect ? correctCount * 2 : correctCount;
    return { points, speedScore };
  }

  const points = isAllCorrect ? correctCount * 2 : correctCount;
  return { points, speedScore: 0 };
}

function formatDuration(ms) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

module.exports = {
  generateQuestions,
  calcScore,
  formatDuration,
};
