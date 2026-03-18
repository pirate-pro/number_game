const { getProfile } = require("./utils/storage");

App({
  globalData: {
    profile: null,
    latestResult: null,
  },

  onLaunch() {
    if (wx.cloud) {
      wx.cloud.init({
        traceUser: true,
      });
    }

    wx.showShareMenu({
      withShareTicket: true,
      menus: ["shareAppMessage", "shareTimeline"],
    });

    this.refreshProfile();
  },

  refreshProfile() {
    const profile = getProfile();
    this.globalData.profile = profile;
    return profile;
  },
});
