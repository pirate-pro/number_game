const {
  DIFFICULTY_ORDER,
  MAX_LEVEL,
  TITLES,
  ITEM_UNLOCK_CLEARED_LEVELS,
} = require("./constants");

const PROFILE_KEY = "sy_profile_v1";
const DAILY_KEY = "sy_daily_v1";

const BOT_GLOBAL = [
  { name: "闪电小鹿", score: 210, elapsedMs: 7800 },
  { name: "九宫飞燕", score: 186, elapsedMs: 9100 },
  { name: "云端速算", score: 174, elapsedMs: 9800 },
  { name: "算力浪客", score: 162, elapsedMs: 11000 },
];

const BOT_FRIEND = [
  { name: "小陈", score: 168, elapsedMs: 10200 },
  { name: "阿林", score: 156, elapsedMs: 11400 },
  { name: "Yuki", score: 148, elapsedMs: 12100 },
];

function todayString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function defaultProfile() {
  return {
    nickname: "玩家",
    points: 0,
    totalGames: 0,
    totalCorrect: 0,
    totalQuestions: 0,
    clearedLevels: {
      beginner: 0,
      advanced: 0,
      challenge: 0,
    },
    unlockedTitles: ["title_1"],
    activeTitle: "title_1",
    speedRecords: [],
    bestSpeedScore: 0,
    battleWins: 0,
    battleTotal: 0,
    lastPlayAt: 0,
  };
}

function mergeProfile(stored) {
  const base = defaultProfile();
  const source = stored && typeof stored === "object" ? stored : {};
  const merged = {
    ...base,
    ...source,
    clearedLevels: {
      ...base.clearedLevels,
      ...(source.clearedLevels || {}),
    },
  };
  if (!Array.isArray(merged.speedRecords)) {
    merged.speedRecords = [];
  }
  if (!Array.isArray(merged.unlockedTitles) || merged.unlockedTitles.length === 0) {
    merged.unlockedTitles = ["title_1"];
  }
  if (!merged.activeTitle) {
    merged.activeTitle = "title_1";
  }
  return merged;
}

function getProfile() {
  const stored = wx.getStorageSync(PROFILE_KEY);
  return mergeProfile(stored);
}

function saveProfile(profile) {
  wx.setStorageSync(PROFILE_KEY, profile);
  return profile;
}

function getCurrentTitleByPoints(points) {
  let current = TITLES[0];
  for (let i = 0; i < TITLES.length; i += 1) {
    if (points >= TITLES[i].threshold) {
      current = TITLES[i];
    }
  }
  return current;
}

function refreshTitles(profile, previousTitleId) {
  const unlocked = TITLES.filter((item) => profile.points >= item.threshold).map((item) => item.id);
  profile.unlockedTitles = unlocked.length ? unlocked : ["title_1"];
  const currentTitle = getCurrentTitleByPoints(profile.points);
  profile.activeTitle = currentTitle.id;
  const newTitle = previousTitleId !== currentTitle.id ? currentTitle : null;
  return { profile, newTitle };
}

function canAccessDifficulty(profile, difficulty) {
  if (difficulty === "beginner") {
    return true;
  }
  if (difficulty === "advanced") {
    return (profile.clearedLevels.beginner || 0) >= MAX_LEVEL;
  }
  return (profile.clearedLevels.advanced || 0) >= MAX_LEVEL;
}

function getDifficultyLockReason(profile, difficulty) {
  if (difficulty === "advanced" && !canAccessDifficulty(profile, difficulty)) {
    return "先通关入门 1-7 关";
  }
  if (difficulty === "challenge" && !canAccessDifficulty(profile, difficulty)) {
    return "先通关进阶 1-7 关";
  }
  return "";
}

function getUnlockedItems(profile) {
  const totalCleared = DIFFICULTY_ORDER.reduce((sum, key) => sum + (profile.clearedLevels[key] || 0), 0);
  const unlocked = totalCleared >= ITEM_UNLOCK_CLEARED_LEVELS;
  return {
    totalCleared,
    revive: unlocked,
    extraTime: unlocked,
  };
}

function getDailyStatus() {
  const today = todayString();
  const stored = wx.getStorageSync(DAILY_KEY);
  if (!stored || stored.date !== today) {
    const fresh = {
      date: today,
      played: false,
      rewardClaimed: false,
      bestCorrect: 0,
    };
    wx.setStorageSync(DAILY_KEY, fresh);
    return fresh;
  }
  return stored;
}

function markDailyPlayed({ correctCount, rewardClaimed }) {
  const status = getDailyStatus();
  status.played = true;
  status.bestCorrect = Math.max(status.bestCorrect || 0, correctCount || 0);
  if (rewardClaimed) {
    status.rewardClaimed = true;
  }
  wx.setStorageSync(DAILY_KEY, status);
  return status;
}

function updateProfileAfterSession(payload) {
  const profile = getProfile();
  const previousTitle = profile.activeTitle;
  const points = payload.points || 0;
  const correctCount = payload.correctCount || 0;
  const totalCount = payload.totalCount || 0;

  profile.points += points;
  profile.totalGames += 1;
  profile.totalCorrect += correctCount;
  profile.totalQuestions += totalCount;
  profile.lastPlayAt = Date.now();

  let levelUnlocked = false;
  if (payload.mode === "gate" && payload.isClear && payload.difficulty && payload.level) {
    const currentLevel = profile.clearedLevels[payload.difficulty] || 0;
    if (payload.level > currentLevel) {
      profile.clearedLevels[payload.difficulty] = payload.level;
      levelUnlocked = true;
    }
  }

  if (payload.mode === "speed" && payload.isClear && payload.speedScore) {
    profile.speedRecords.push({
      score: payload.speedScore,
      elapsedMs: payload.elapsedMs || 0,
      date: Date.now(),
    });
    profile.speedRecords.sort((a, b) => b.score - a.score || a.elapsedMs - b.elapsedMs);
    profile.speedRecords = profile.speedRecords.slice(0, 20);
    profile.bestSpeedScore = Math.max(profile.bestSpeedScore || 0, payload.speedScore);
  }

  if (payload.mode === "battle") {
    profile.battleTotal += 1;
    if (payload.battleWin) {
      profile.battleWins += 1;
    }
  }

  const titleResult = refreshTitles(profile, previousTitle);
  saveProfile(titleResult.profile);

  return {
    profile: titleResult.profile,
    newTitle: titleResult.newTitle,
    levelUnlocked,
  };
}

function sortRankings(list) {
  return list
    .slice()
    .sort((a, b) => b.score - a.score || a.elapsedMs - b.elapsedMs)
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

function getSpeedRankings(profile) {
  const selfRecords = (profile.speedRecords || []).map((item, index) => ({
    id: `self_${index}`,
    name: "我",
    score: item.score,
    elapsedMs: item.elapsedMs,
    isSelf: true,
  }));

  const globalBots = BOT_GLOBAL.map((item, index) => ({
    id: `global_bot_${index}`,
    ...item,
    isSelf: false,
  }));

  const friendBots = BOT_FRIEND.map((item, index) => ({
    id: `friend_bot_${index}`,
    ...item,
    isSelf: false,
  }));

  const global = sortRankings([...globalBots, ...selfRecords]).slice(0, 20);
  const friend = sortRankings([...friendBots, ...selfRecords]).slice(0, 20);
  return { global, friend };
}

module.exports = {
  getProfile,
  saveProfile,
  getDailyStatus,
  markDailyPlayed,
  canAccessDifficulty,
  getDifficultyLockReason,
  getUnlockedItems,
  updateProfileAfterSession,
  getSpeedRankings,
};
