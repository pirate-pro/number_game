const { formatDuration } = require("../../utils/game");

Page({
  data: {
    result: null,
    elapsedLabel: "0:00",
    newTitleName: "",
  },

  onShow() {
    const app = getApp();
    const result = app.globalData.latestResult;
    if (!result) {
      this.setData({
        result: null,
      });
      return;
    }

    this.setData({
      result,
      elapsedLabel: formatDuration(result.elapsedMs || 0),
      newTitleName: result.newTitle ? result.newTitle.name : "",
    });
  },

  playAgain() {
    const result = this.data.result;
    if (!result) {
      wx.reLaunch({ url: "/pages/index/index" });
      return;
    }

    if (result.mode === "speed") {
      wx.redirectTo({ url: "/pages/game/game?mode=speed" });
      return;
    }

    wx.redirectTo({
      url: `/pages/game/game?mode=${result.mode}&difficulty=${result.difficulty}&level=${result.level || 1}`,
    });
  },

  toHome() {
    wx.reLaunch({ url: "/pages/index/index" });
  },

  toRank() {
    wx.navigateTo({ url: "/pages/rank/rank" });
  },

  onShareAppMessage() {
    const result = this.data.result;
    if (!result) {
      return {
        title: "数忆数：来挑战记忆心算",
        path: "/pages/index/index",
      };
    }
    return {
      title: `${result.modeName}成绩：${result.correctCount}/${result.totalCount}，快来挑战我`,
      path: "/pages/index/index",
    };
  },
});
