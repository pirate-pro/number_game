const { DIFFICULTIES, DIFFICULTY_ORDER } = require("../../utils/constants");
const { formatDuration } = require("../../utils/game");
const { updateProfileAfterSession } = require("../../utils/storage");
const cloudBattle = require("../../utils/battle-cloud");

function percent(value, total) {
  if (!total) {
    return 0;
  }
  return Math.round((value / total) * 100);
}

Page({
  data: {
    cloudReady: false,
    cloudTip: "",
    player: null,
    phase: "lobby",
    difficulty: "advanced",
    difficultyName: "进阶",
    difficultyList: [],
    onlinePlayers: [],
    roomCode: "",
    role: "",
    opponentName: "",
    tips: "",
    questions: [],
    memoryLeft: 0,
    answerLeft: 0,
    currentIndex: 0,
    currentExpression: "",
    inputValue: "",
    correctCount: 0,
    selfProgress: 0,
    rivalProgress: 0,
    result: null,
    canShare: false,
  },

  async onLoad(options) {
    const hasCloud = cloudBattle.hasCloud();
    if (!hasCloud) {
      this.setData({
        cloudReady: false,
        cloudTip: "当前环境未开启云开发，无法使用实时好友对战。",
      });
      return;
    }

    const player = cloudBattle.getLocalPlayer();
    const difficulty = options.difficulty || "advanced";
    const inviteCode = options.roomCode || options.inviteCode || "";
    const difficultyList = DIFFICULTY_ORDER.map((key) => ({
      key,
      name: DIFFICULTIES[key].name,
      unlocked: true,
    }));

    this.roomWatcher = null;
    this.roomId = "";
    this.currentRoom = null;
    this.isResultSaved = false;
    this.setData({
      cloudReady: true,
      player,
      difficulty,
      difficultyName: DIFFICULTIES[difficulty].name,
      difficultyList,
      cloudTip: "",
    });

    await this.touchPresence();
    this.startHeartbeat();

    if (inviteCode) {
      await this.joinByCode(inviteCode);
      return;
    }
    await this.loadOnlinePlayers();
    this.setData({
      phase: "lobby",
      tips: "选择在线玩家邀请 PK，或直接快速匹配。",
    });
  },

  onUnload() {
    this.stopHeartbeat();
    this.clearTimers();
    this.unwatchRoom();
    if (this.data.player) {
      cloudBattle.markOffline(this.data.player);
    }
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

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.touchPresence();
    }, 10000);
  },

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  },

  async touchPresence() {
    if (!this.data.player || !this.data.cloudReady) {
      return;
    }
    try {
      await cloudBattle.touchPresence(this.data.player, this.data.roomCode || "");
    } catch (e) {
      // ignore
    }
  },

  async loadOnlinePlayers() {
    if (!this.data.cloudReady) {
      return;
    }
    try {
      const list = await cloudBattle.fetchOnlinePlayers(this.data.player.id);
      this.setData({
        onlinePlayers: list.map((item) => ({
          id: item.playerId,
          name: item.nickName || "玩家",
          roomCode: item.roomCode || "",
        })),
      });
    } catch (e) {
      this.setData({
        tips: "在线列表刷新失败，请稍后再试。",
      });
    }
  },

  selectDifficulty(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({
      difficulty: key,
      difficultyName: DIFFICULTIES[key].name,
    });
  },

  async createInviteRoom() {
    if (!this.data.cloudReady) {
      return;
    }
    wx.showLoading({ title: "创建房间中" });
    try {
      const created = await cloudBattle.createInviteRoom({
        player: this.data.player,
        difficulty: this.data.difficulty,
      });
      this.roomId = created.roomId;
      this.currentRoom = created.room;
      this.isResultSaved = false;
      this.watchCurrentRoom();
      this.setData({
        phase: "waiting",
        role: "host",
        roomCode: created.roomCode,
        tips: `房间 ${created.roomCode} 已创建，点击分享邀请好友进入。`,
        canShare: true,
      });
      await this.touchPresence();
    } catch (e) {
      wx.showToast({ title: "创建房间失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  async inviteFromList(e) {
    const name = e.currentTarget.dataset.name || "好友";
    await this.createInviteRoom();
    this.setData({
      tips: `房间已创建，请将邀请卡片发送给 ${name}。`,
    });
  },

  async quickMatch() {
    if (!this.data.cloudReady) {
      return;
    }
    wx.showLoading({ title: "匹配中" });
    try {
      const matched = await cloudBattle.quickMatch({
        player: this.data.player,
        difficulty: this.data.difficulty,
      });
      this.roomId = matched.roomId;
      this.currentRoom = matched.room;
      this.isResultSaved = false;
      this.watchCurrentRoom();
      this.setData({
        phase: matched.matched ? "memory" : "waiting",
        role: matched.role,
        roomCode: matched.roomCode,
        tips: matched.matched
          ? "匹配成功，准备开始记忆。"
          : `暂未匹配到玩家，已创建房间 ${matched.roomCode} 等待加入。`,
        canShare: true,
      });
      await this.touchPresence();
      if (matched.room.status === "memory") {
        this.handleRoomUpdate(matched.room);
      }
    } catch (e) {
      wx.showToast({ title: "匹配失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  async joinByCode(roomCode) {
    wx.showLoading({ title: "加入房间中" });
    try {
      const joined = await cloudBattle.joinRoomByCode({
        player: this.data.player,
        roomCode,
      });
      this.roomId = joined.roomId;
      this.currentRoom = joined.room;
      this.isResultSaved = false;
      this.watchCurrentRoom();
      this.setData({
        role: joined.role,
        roomCode,
        canShare: joined.role === "host",
      });
      await this.touchPresence();
      this.handleRoomUpdate(joined.room);
    } catch (e) {
      this.setData({
        phase: "lobby",
        tips: "房间不存在或已结束，请重新发起邀请。",
      });
      wx.showToast({
        title: "加入失败",
        icon: "none",
      });
    } finally {
      wx.hideLoading();
    }
  },

  unwatchRoom() {
    if (this.roomWatcher) {
      this.roomWatcher.close();
      this.roomWatcher = null;
    }
  },

  watchCurrentRoom() {
    this.unwatchRoom();
    if (!this.roomId) {
      return;
    }
    this.roomWatcher = cloudBattle.watchRoom(
      this.roomId,
      (room) => {
        this.currentRoom = room;
        this.handleRoomUpdate(room);
      },
      () => {
        this.setData({
          tips: "房间连接中断，请返回重试。",
        });
      }
    );
  },

  handleRoomUpdate(room) {
    const role = this.data.role || (room.hostId === this.data.player.id ? "host" : "guest");
    const rivalName = role === "host" ? room.guestName || "等待加入" : room.hostName || "房主";
    const myState = role === "host" ? room.hostState : room.guestState;
    const rivalState = role === "host" ? room.guestState : room.hostState;
    const total = (room.questions || []).length || 1;

    this.setData({
      role,
      opponentName: rivalName,
      questions: (room.questions || []).map((q, idx) => ({
        id: `q_${idx}`,
        expression: q.expression,
        answer: q.answer,
      })),
      rivalProgress: percent(rivalState.correctCount || 0, total),
      selfProgress: percent(myState.correctCount || 0, total),
      correctCount: myState.correctCount || this.data.correctCount,
      currentIndex: myState.index || this.data.currentIndex,
      currentExpression:
        room.questions && room.questions[myState.index || 0]
          ? room.questions[myState.index || 0].expression
          : "",
    });

    if (room.status === "waiting") {
      this.clearTimers();
      this.setData({
        phase: "waiting",
        tips: `房间 ${room.roomCode} 已创建，等待对手加入。`,
      });
      return;
    }

    if (room.status === "memory") {
      this.enterMemoryStage(room);
      return;
    }

    if (room.status === "answer") {
      this.enterAnswerStage(room);
      this.tryFinalize(room);
      return;
    }

    if (room.status === "finished") {
      this.showResult(room);
    }
  },

  enterMemoryStage(room) {
    if (this.data.phase !== "memory") {
      this.setData({
        phase: "memory",
        tips: "双方记忆中...",
      });
    }
    if (this.memoryTimer) {
      return;
    }
    this.memoryTimer = setInterval(async () => {
      const left = Math.max(0, Math.ceil((room.memoryEndsAt - Date.now()) / 1000));
      this.setData({ memoryLeft: left });
      if (left <= 0) {
        clearInterval(this.memoryTimer);
        this.memoryTimer = null;
        if (this.data.role === "host" && this.currentRoom && this.currentRoom.status === "memory") {
          try {
            await cloudBattle.startAnswer(this.roomId, this.currentRoom.config.answerTime);
          } catch (e) {
            // ignore
          }
        }
      }
    }, 200);
  },

  enterAnswerStage(room) {
    if (this.data.phase !== "answer") {
      this.setData({
        phase: "answer",
        tips: "开始作答，先全对完成者获胜。",
        inputValue: "",
      });
    }
    if (this.answerTimer) {
      return;
    }
    this.answerTimer = setInterval(async () => {
      const left = Math.max(0, Math.ceil((room.answerEndsAt - Date.now()) / 1000));
      this.setData({ answerLeft: left });
      if (left <= 0) {
        clearInterval(this.answerTimer);
        this.answerTimer = null;
        await this.submitTimeoutState();
      }
    }, 200);
  },

  async submitTimeoutState() {
    if (!this.currentRoom || this.currentRoom.status !== "answer") {
      return;
    }
    const myState = this.data.role === "host" ? this.currentRoom.hostState : this.currentRoom.guestState;
    if (myState.finished) {
      return;
    }
    const next = {
      ...myState,
      finished: true,
      wrong: true,
      allCorrect: false,
      finishAt: Date.now(),
    };
    await cloudBattle.updatePlayerState(this.roomId, this.data.role, next);
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
    this.setData({
      inputValue: `${this.data.inputValue}${value}`,
    });
  },

  onPadDelete() {
    if (this.data.phase !== "answer") {
      return;
    }
    this.setData({
      inputValue: this.data.inputValue.slice(0, -1),
    });
  },

  onPadClear() {
    if (this.data.phase !== "answer") {
      return;
    }
    this.setData({ inputValue: "" });
  },

  async onPadSubmit() {
    if (this.data.phase !== "answer") {
      return;
    }
    if (!this.data.inputValue) {
      wx.showToast({ title: "请输入答案", icon: "none" });
      return;
    }
    const idx = this.data.currentIndex;
    const question = this.data.questions[idx];
    if (!question) {
      return;
    }

    const userAnswer = Number(this.data.inputValue);
    const myState = this.data.role === "host" ? this.currentRoom.hostState : this.currentRoom.guestState;

    if (userAnswer !== question.answer) {
      const wrongState = {
        ...myState,
        finished: true,
        wrong: true,
        allCorrect: false,
        finishAt: Date.now(),
      };
      await cloudBattle.updatePlayerState(this.roomId, this.data.role, wrongState);
      this.setData({
        inputValue: "",
      });
      return;
    }

    const nextCorrect = (myState.correctCount || 0) + 1;
    const isLast = idx >= this.data.questions.length - 1;
    const nextState = {
      ...myState,
      index: isLast ? idx : idx + 1,
      correctCount: nextCorrect,
      finished: isLast,
      wrong: false,
      allCorrect: isLast,
      finishAt: isLast ? Date.now() : 0,
    };
    await cloudBattle.updatePlayerState(this.roomId, this.data.role, nextState);
    this.setData({
      inputValue: "",
    });
  },

  async tryFinalize(room) {
    if (!room || room.status !== "answer" || room.winner) {
      return;
    }
    const decision = cloudBattle.decideWinner(room);
    if (!decision) {
      return;
    }
    try {
      await cloudBattle.finalizeRoom(this.roomId, decision);
    } catch (e) {
      // another client may have finalized
    }
  },

  showResult(room) {
    if (this.data.phase === "result" && this.isResultSaved) {
      return;
    }
    this.clearTimers();

    const role = this.data.role;
    const myState = role === "host" ? room.hostState : room.guestState;
    const rivalState = role === "host" ? room.guestState : room.hostState;
    const win = room.winner === role;
    const draw = room.winner === "draw";
    const points = draw ? myState.correctCount || 0 : win ? (myState.correctCount || 0) + 5 : myState.correctCount || 0;
    const startedAt = room.startedAt || (room.answerEndsAt ? room.answerEndsAt - room.config.answerTime * 1000 : 0);
    const userElapsedMs = myState.finishAt && startedAt ? Math.max(0, myState.finishAt - startedAt) : 0;

    if (!this.isResultSaved) {
      updateProfileAfterSession({
        mode: "battle",
        difficulty: room.difficulty,
        points,
        correctCount: myState.correctCount || 0,
        totalCount: (room.questions || []).length,
        isClear: win,
        battleWin: win,
        elapsedMs: userElapsedMs,
      });
      this.isResultSaved = true;
    }

    this.setData({
      phase: "result",
      result: {
        win,
        draw,
        winner: room.winner,
        reason: room.reason,
        points,
        correctCount: myState.correctCount || 0,
        totalCount: (room.questions || []).length,
        userTime: myState.finishAt ? formatDuration(userElapsedMs) : "--",
        rivalCorrect: rivalState.correctCount || 0,
      },
      tips: draw ? "平局，继续来一局！" : win ? "你赢了！" : "本局惜败，再来一局。",
    });
  },

  async refreshOnline() {
    await this.loadOnlinePlayers();
  },

  async leaveToLobby() {
    this.clearTimers();
    this.unwatchRoom();
    this.roomId = "";
    this.currentRoom = null;
    this.isResultSaved = false;
    this.setData({
      phase: "lobby",
      roomCode: "",
      role: "",
      opponentName: "",
      tips: "已回到大厅。",
      questions: [],
      inputValue: "",
      currentIndex: 0,
      correctCount: 0,
      selfProgress: 0,
      rivalProgress: 0,
      result: null,
      canShare: false,
    });
    await this.touchPresence();
    await this.loadOnlinePlayers();
  },

  async playAgain() {
    await this.leaveToLobby();
    await this.quickMatch();
  },

  toHome() {
    wx.reLaunch({ url: "/pages/index/index" });
  },

  onShareAppMessage() {
    if (this.data.phase === "waiting" && this.data.roomCode) {
      return {
        title: `来数忆数和我 PK，房间码 ${this.data.roomCode}`,
        path: `/pages/battle/battle?roomCode=${this.data.roomCode}`,
      };
    }
    if (this.data.result) {
      return {
        title: `好友对战${this.data.result.win ? "获胜" : "结束"}，来和我比一局`,
        path: "/pages/index/index",
      };
    }
    return {
      title: "数忆数好友对战，来 1v1 比拼",
      path: "/pages/index/index",
    };
  },
});
