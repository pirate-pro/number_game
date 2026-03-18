const DIFFICULTY_ORDER = ["beginner", "advanced", "challenge"];

const DIFFICULTIES = {
  beginner: {
    key: "beginner",
    name: "入门",
    description: "10 以内加减",
    memoryTime: 8,
    answerTime: 30,
    maxNumber: 10,
    operations: ["+", "-"],
  },
  advanced: {
    key: "advanced",
    name: "进阶",
    description: "20 以内加减 + 表内乘法",
    memoryTime: 5,
    answerTime: 20,
    maxNumber: 20,
    operations: ["+", "-", "*"],
  },
  challenge: {
    key: "challenge",
    name: "挑战",
    description: "50 以内加减 + 表内乘除",
    memoryTime: 3,
    answerTime: 10,
    maxNumber: 50,
    operations: ["+", "-", "*", "/"],
  },
};

const MAX_LEVEL = 7;
const LEVEL_QUESTION_COUNTS = [3, 4, 5, 6, 7, 8, 10];

const SPEED_MODE_CONFIG = {
  mode: "speed",
  difficulty: "advanced",
  memoryTime: 5,
  answerTime: 20,
  questionCount: 6,
};

const MODE_NAMES = {
  gate: "关卡闯关",
  daily: "每日闯关",
  speed: "极速冲榜",
  battle: "好友对战",
};

const TITLES = [
  { id: "title_1", name: "记忆新芽", threshold: 0 },
  { id: "title_2", name: "心算学徒", threshold: 20 },
  { id: "title_3", name: "闯关行者", threshold: 60 },
  { id: "title_4", name: "速算骑士", threshold: 120 },
  { id: "title_5", name: "记忆猎手", threshold: 200 },
  { id: "title_6", name: "算式宗师", threshold: 320 },
  { id: "title_7", name: "冲榜传奇", threshold: 460 },
  { id: "title_8", name: "数忆王者", threshold: 640 },
];

const DAILY_REWARD_POINTS = 12;
const ITEM_UNLOCK_CLEARED_LEVELS = 5;

module.exports = {
  DIFFICULTY_ORDER,
  DIFFICULTIES,
  MAX_LEVEL,
  LEVEL_QUESTION_COUNTS,
  SPEED_MODE_CONFIG,
  MODE_NAMES,
  TITLES,
  DAILY_REWARD_POINTS,
  ITEM_UNLOCK_CLEARED_LEVELS,
};
