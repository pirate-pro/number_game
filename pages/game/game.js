const {
  DIFFICULTIES,
  MODE_NAMES,
  DAILY_REWARD_POINTS,
} = require("../../utils/constants");
const { generateQuestions, calcScore } = require("../../utils/game");
const {
  getProfile,
  getUnlockedItems,
  getDailyStatus,
  markDailyPlayed,
  updateProfileAfterSession,
} = require("../../utils/storage");

function percent(correct, total) {
  if (!total) {
    return 0;
  }
  return Math.round((correct / total) * 100);
}

Page({
  data: {
    mode: "gate",
    modeName: "",
    difficulty: "beginner",
    difficultyName: "",
    level: 1,
    phase: "ready",
    questions: [],
    memoryLeft: 0,
    answerLeft: 0,
    currentIndex: 0,
    currentExpression: "",
    inputValue: "",
    correctCount: 0,
    tips: "",
    toolRevive: false,
    toolExtraTime: false,
    usedRevive: false,
    usedExtraTime: false,
    questionCount: 0,
    memoryTime: 0,
    answerTime: 0,
  },

  onLoad(options) {
    this.prepareRound(options || {});
  },

  onUnload() {
    this.clearTimers();
  },

  prepareRound(options) {
    const mode = options.mode || "gate";
    let difficulty = options.difficulty || "beginner";
    let level = Number(options.level || 1);
    if (mode === "speed") {
      difficulty = "advanced";
      level = 3;
    }

    const { config, questions } = generateQuestions({ mode, difficulty, level });
    const profile = getProfile();
    const tools = getUnlockedItems(profile);

    this.roundConfig = config;
    this.answerStartTime = 0;

    this.setData({
      mode,
      modeName: MODE_NAMES[mode],
      difficulty: config.difficulty,
      difficultyName: DIFFICULTIES[config.difficulty].name,
      level: config.level || level,
      phase: "ready",
      questions,
      memoryLeft: config.memoryTime,
      answerLeft: config.answerTime,
      currentIndex: 0,
      currentExpression: questions[0]?.expression || "",
      inputValue: "",
      correctCount: 0,
      tips: "准备开始",
      toolRevive: tools.revive,
      toolExtraTime: tools.extraTime,
      usedRevive: false,
      usedExtraTime: false,
      questionCount: questions.length,
      memoryTime: config.memoryTime,
      answerTime: config.answerTime,
    });
  },

  clearTimers() {
    if (this.memoryTimer) {
      clearInterval(this.memoryTimer);
      this.memoryTimer = null;
    }
    if (this.answerTimer) {
      clearInterval(this.answerTimer);
      this.answerTimer = null;
    }
  },

  startRound() {
    if (this.data.phase !== "ready") {
      return;
    }
    this.startMemoryPhase();
  },

  startMemoryPhase() {
    this.clearTimers();
    this.setData({
      phase: "memory",
      memoryLeft: this.roundConfig.memoryTime,
      tips: "记住这些算式，时间结束后会隐藏。",
    });

    this.memoryTimer = setInterval(() => {
      const next = this.data.memoryLeft - 1;
      if (next <= 0) {
        this.clearTimers();
        this.startAnswerPhase();
        return;
      }
      this.setData({ memoryLeft: next });
    }, 1000);
  },

  startAnswerPhase() {
    this.answerStartTime = Date.now();
    this.setData({
      phase: "answer",
      answerLeft: this.roundConfig.answerTime,
      currentIndex: 0,
      currentExpression: this.data.questions[0]?.expression || "",
      inputValue: "",
      tips: "请输入答案并点击确认。",
    });

    this.answerTimer = setInterval(() => {
      const next = this.data.answerLeft - 1;
      if (next <= 0) {
        this.finishRound(false, "timeout");
        return;
      }
      this.setData({ answerLeft: next });
    }, 1000);
  },

  onPadInput(e) {
    if (this.data.phase !== "answer") {
      return;
    }
    const value = String(e.detail.value || "");
    if (!/^\d$/.test(value)) {
      return;
    }
    if (this.data.inputValue.length >= 4) {
      return;
    }
    this.setData({ inputValue: `${this.data.inputValue}${value}` });
  },

  onPadDelete() {
    if (this.data.phase !== "answer") {
      return;
    }
    const next = this.data.inputValue.slice(0, -1);
    this.setData({ inputValue: next });
  },

  onPadClear() {
    if (this.data.phase !== "answer") {
      return;
    }
    this.setData({ inputValue: "" });
  },

  onPadSubmit() {
    if (this.data.phase !== "answer") {
      return;
    }
    if (this.data.inputValue === "") {
      wx.showToast({ title: "请输入答案", icon: "none" });
      return;
    }

    const idx = this.data.currentIndex;
    const userAnswer = Number(this.data.inputValue);
    const questions = this.data.questions.slice();
    const question = questions[idx];
    if (!question) {
      return;
    }

    if (userAnswer === question.answer) {
      questions[idx] = {
        ...question,
        userAnswer,
        status: "correct",
      };
      const nextCorrect = this.data.correctCount + 1;

      if (idx >= questions.length - 1) {
        this.setData({
          questions,
          correctCount: nextCorrect,
          inputValue: "",
        });
        this.finishRound(true, "complete", questions, nextCorrect);
        return;
      }

      this.setData({
        questions,
        correctCount: nextCorrect,
        currentIndex: idx + 1,
        currentExpression: questions[idx + 1].expression,
        inputValue: "",
        tips: "回答正确，继续下一题。",
      });
      return;
    }

    questions[idx] = {
      ...question,
      userAnswer,
      status: "wrong",
    };
    this.setData({
      questions,
      inputValue: "",
      tips: "回答错误。",
    });
    this.handleWrongAnswer(questions);
  },

  handleWrongAnswer(questions) {
    if (this.data.toolRevive && !this.data.usedRevive) {
      wx.showModal({
        title: "使用复活道具",
        content: "可以重答当前题，单局仅 1 次，是否使用？",
        confirmText: "立即复活",
        success: (res) => {
          if (res.confirm) {
            const idx = this.data.currentIndex;
            const nextQuestions = questions.slice();
            nextQuestions[idx] = {
              ...nextQuestions[idx],
              status: "retry",
              userAnswer: null,
            };
            this.setData({
              questions: nextQuestions,
              usedRevive: true,
              tips: "已复活，请重新作答当前题。",
              inputValue: "",
            });
            return;
          }
          this.finishRound(false, "wrong", questions);
        },
      });
      return;
    }
    this.finishRound(false, "wrong", questions);
  },

  onUseExtraTime() {
    if (!this.data.toolExtraTime || this.data.usedExtraTime || this.data.phase !== "answer") {
      return;
    }
    this.setData({
      answerLeft: this.data.answerLeft + 2,
      usedExtraTime: true,
      tips: "已加时 2 秒。",
    });
  },

  finishRound(success, reason, latestQuestions, correctCountOverride) {
    if (this.data.phase === "finished") {
      return;
    }
    this.clearTimers();

    const questions = latestQuestions || this.data.questions;
    const totalCount = questions.length;
    const correctCount =
      typeof correctCountOverride === "number" ? correctCountOverride : this.data.correctCount;
    const elapsedMs = this.answerStartTime ? Date.now() - this.answerStartTime : 0;
    const isAllCorrect = success && correctCount === totalCount;
    const scoreInfo = calcScore({
      mode: this.data.mode,
      correctCount,
      totalCount,
      elapsedMs,
      isAllCorrect,
    });

    let points = scoreInfo.points;
    let dailyBonus = 0;
    if (this.data.mode === "daily") {
      const dailyStatus = getDailyStatus();
      const rewardClaimed = isAllCorrect && !dailyStatus.rewardClaimed;
      if (rewardClaimed) {
        dailyBonus = DAILY_REWARD_POINTS;
      }
      points += dailyBonus;
      markDailyPlayed({
        correctCount,
        rewardClaimed,
      });
    }

    const session = {
      mode: this.data.mode,
      difficulty: this.data.difficulty,
      level: this.data.level,
      points,
      correctCount,
      totalCount,
      isClear: isAllCorrect,
      speedScore: scoreInfo.speedScore,
      elapsedMs,
      battleWin: false,
    };

    const profileResult = updateProfileAfterSession(session);
    const result = {
      ...session,
      modeName: this.data.modeName,
      difficultyName: this.data.difficultyName,
      accuracy: percent(correctCount, totalCount),
      reason,
      usedRevive: this.data.usedRevive,
      usedExtraTime: this.data.usedExtraTime,
      dailyBonus,
      newTitle: profileResult.newTitle,
      profile: profileResult.profile,
    };

    const app = getApp();
    app.globalData.latestResult = result;

    this.setData({
      phase: "finished",
      tips: "结算中...",
    });

    setTimeout(() => {
      wx.redirectTo({
        url: "/pages/result/result",
      });
    }, 400);
  },

  onShareAppMessage() {
    return {
      title: `${this.data.modeName}进行中，来挑战我！`,
      path: "/pages/index/index",
    };
  },
});
