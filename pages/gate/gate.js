const { DIFFICULTIES, DIFFICULTY_ORDER, MAX_LEVEL } = require("../../utils/constants");
const {
  getProfile,
  getDailyStatus,
  canAccessDifficulty,
  getDifficultyLockReason,
  getUnlockedItems,
} = require("../../utils/storage");

Page({
  data: {
    tab: "daily",
    profile: null,
    dailyStatus: null,
    selectedDifficulty: "beginner",
    selectedLevel: 1,
    difficultyList: [],
    levelItems: [],
    difficultyConfig: null,
    tools: null,
  },

  onShow() {
    this.loadState();
  },

  loadState() {
    const profile = getProfile();
    const dailyStatus = getDailyStatus();
    let selectedDifficulty = this.data.selectedDifficulty;
    if (!canAccessDifficulty(profile, selectedDifficulty)) {
      selectedDifficulty = "beginner";
    }

    const difficultyList = DIFFICULTY_ORDER.map((key) => ({
      key,
      name: DIFFICULTIES[key].name,
      desc: DIFFICULTIES[key].description,
      unlocked: canAccessDifficulty(profile, key),
      lockReason: getDifficultyLockReason(profile, key),
    }));

    const difficultyConfig = DIFFICULTIES[selectedDifficulty];
    const levelItems = this.buildLevelItems(profile, selectedDifficulty);
    const selectedLevel = levelItems.find((item) => item.current)?.level || 1;

    this.setData({
      profile,
      dailyStatus,
      selectedDifficulty,
      difficultyList,
      levelItems,
      selectedLevel,
      difficultyConfig,
      tools: getUnlockedItems(profile),
    });
  },

  buildLevelItems(profile, difficulty) {
    const cleared = profile.clearedLevels[difficulty] || 0;
    const list = [];
    for (let level = 1; level <= MAX_LEVEL; level += 1) {
      list.push({
        level,
        cleared: level <= cleared,
        current: level === Math.min(cleared + 1, MAX_LEVEL),
        locked: level > cleared + 1,
      });
    }
    return list;
  },

  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab });
  },

  selectDifficulty(e) {
    const key = e.currentTarget.dataset.key;
    const target = this.data.difficultyList.find((item) => item.key === key);
    if (!target || !target.unlocked) {
      wx.showToast({
        title: target ? target.lockReason : "尚未解锁",
        icon: "none",
      });
      return;
    }

    const levelItems = this.buildLevelItems(this.data.profile, key);
    const selectedLevel = levelItems.find((item) => item.current)?.level || 1;
    this.setData({
      selectedDifficulty: key,
      difficultyConfig: DIFFICULTIES[key],
      levelItems,
      selectedLevel,
    });
  },

  selectLevel(e) {
    const level = Number(e.currentTarget.dataset.level);
    const target = this.data.levelItems.find((item) => item.level === level);
    if (!target || target.locked) {
      wx.showToast({ title: "请先通关前置关卡", icon: "none" });
      return;
    }
    this.setData({ selectedLevel: level });
  },

  startGame() {
    const difficulty = this.data.selectedDifficulty;
    if (this.data.tab === "daily") {
      wx.navigateTo({
        url: `/pages/game/game?mode=daily&difficulty=${difficulty}&level=1`,
      });
      return;
    }

    const level = this.data.selectedLevel;
    const target = this.data.levelItems.find((item) => item.level === level);
    if (!target || target.locked) {
      wx.showToast({ title: "关卡尚未解锁", icon: "none" });
      return;
    }

    wx.navigateTo({
      url: `/pages/game/game?mode=gate&difficulty=${difficulty}&level=${level}`,
    });
  },
});
