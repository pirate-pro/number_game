const { TITLES, DIFFICULTY_ORDER, DIFFICULTIES } = require("../../utils/constants");
const { getProfile, getDailyStatus, canAccessDifficulty } = require("../../utils/storage");

function titleNameById(id) {
  const target = TITLES.find((item) => item.id === id);
  return target ? target.name : TITLES[0].name;
}

Page({
  data: {
    profile: null,
    currentTitleName: "",
    dailyStatus: null,
    difficultyCards: [],
  },

  onShow() {
    this.loadDashboard();
  },

  loadDashboard() {
    const profile = getProfile();
    const dailyStatus = getDailyStatus();
    const difficultyCards = DIFFICULTY_ORDER.map((key) => ({
      key,
      name: DIFFICULTIES[key].name,
      unlocked: canAccessDifficulty(profile, key),
    }));

    this.setData({
      profile,
      currentTitleName: titleNameById(profile.activeTitle),
      dailyStatus,
      difficultyCards,
    });

    const app = getApp();
    app.globalData.profile = profile;
  },

  toGate() {
    wx.navigateTo({ url: "/pages/gate/gate" });
  },

  toBattle() {
    wx.navigateTo({ url: "/pages/battle/battle?difficulty=advanced" });
  },

  toSpeed() {
    wx.navigateTo({ url: "/pages/game/game?mode=speed" });
  },

  toRank() {
    wx.navigateTo({ url: "/pages/rank/rank" });
  },

  onShareAppMessage() {
    return {
      title: "数忆数：记算式、拼手速、冲榜单",
      path: "/pages/index/index",
    };
  },
});
