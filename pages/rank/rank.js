const { getProfile, getSpeedRankings } = require("../../utils/storage");

function msToText(ms) {
  if (!ms) {
    return "--";
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

Page({
  data: {
    tab: "global",
    profile: null,
    globalList: [],
    friendList: [],
    displayList: [],
  },

  onShow() {
    this.loadRankings();
  },

  loadRankings() {
    const profile = getProfile();
    const rankings = getSpeedRankings(profile);
    this.setData(
      {
        profile,
        globalList: rankings.global.map((item) => ({ ...item, timeText: msToText(item.elapsedMs) })),
        friendList: rankings.friend.map((item) => ({ ...item, timeText: msToText(item.elapsedMs) })),
      },
      () => {
        this.refreshDisplay();
      }
    );
  },

  switchTab(e) {
    this.setData(
      {
        tab: e.currentTarget.dataset.tab,
      },
      () => {
        this.refreshDisplay();
      }
    );
  },

  refreshDisplay() {
    const list = this.data.tab === "global" ? this.data.globalList : this.data.friendList;
    this.setData({
      displayList: list,
    });
  },

  toSpeed() {
    wx.navigateTo({ url: "/pages/game/game?mode=speed" });
  },
});
