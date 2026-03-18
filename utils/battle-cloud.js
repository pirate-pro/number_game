const { generateQuestions } = require("./game");

const PLAYER_KEY = "sy_player_profile_v1";

function hasCloud() {
  return !!(wx.cloud && wx.cloud.database);
}

function getDb() {
  if (!hasCloud()) {
    return null;
  }
  return wx.cloud.database();
}

function randomId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function randomNick() {
  return `玩家${Math.floor(Math.random() * 9000 + 1000)}`;
}

function getLocalPlayer() {
  const stored = wx.getStorageSync(PLAYER_KEY);
  if (stored && stored.id && stored.name) {
    return stored;
  }
  const player = {
    id: randomId("p"),
    name: randomNick(),
  };
  wx.setStorageSync(PLAYER_KEY, player);
  return player;
}

async function touchPresence(player, roomCode = "") {
  const db = getDb();
  if (!db) {
    throw new Error("cloud_unavailable");
  }
  await db.collection("players").doc(player.id).set({
    data: {
      playerId: player.id,
      nickName: player.name,
      roomCode,
      onlineAt: Date.now(),
      updatedAt: Date.now(),
    },
  });
}

async function fetchOnlinePlayers(currentPlayerId) {
  const db = getDb();
  if (!db) {
    throw new Error("cloud_unavailable");
  }
  const _ = db.command;
  const threshold = Date.now() - 30000;
  const res = await db
    .collection("players")
    .where({
      onlineAt: _.gt(threshold),
    })
    .orderBy("onlineAt", "desc")
    .limit(30)
    .get();
  return (res.data || []).filter((item) => item.playerId !== currentPlayerId);
}

function buildEmptyState() {
  return {
    index: 0,
    correctCount: 0,
    finished: false,
    wrong: false,
    allCorrect: false,
    finishAt: 0,
    updatedAt: Date.now(),
  };
}

function createRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function simplifyQuestions(questions) {
  return questions.map((item) => ({
    expression: item.expression,
    answer: item.answer,
  }));
}

async function createInviteRoom({ player, difficulty }) {
  const db = getDb();
  if (!db) {
    throw new Error("cloud_unavailable");
  }
  const roomCode = createRoomCode();
  const { config, questions } = generateQuestions({
    mode: "gate",
    difficulty,
    level: 3,
  });
  const now = Date.now();
  const doc = {
    roomCode,
    difficulty,
    status: "waiting",
    hostId: player.id,
    hostName: player.name,
    guestId: "",
    guestName: "",
    config: {
      memoryTime: config.memoryTime,
      answerTime: config.answerTime,
      questionCount: questions.length,
    },
    questions: simplifyQuestions(questions),
    memoryEndsAt: 0,
    answerEndsAt: 0,
    hostState: buildEmptyState(),
    guestState: buildEmptyState(),
    winner: "",
    reason: "",
    createdAt: now,
    updatedAt: now,
  };
  const res = await db.collection("rooms").add({ data: doc });
  await touchPresence(player, roomCode);
  return {
    roomId: res._id,
    roomCode,
    room: {
      ...doc,
      _id: res._id,
    },
  };
}

async function findWaitingRoom(currentPlayerId) {
  const db = getDb();
  if (!db) {
    throw new Error("cloud_unavailable");
  }
  const res = await db
    .collection("rooms")
    .where({
      status: "waiting",
    })
    .orderBy("createdAt", "asc")
    .limit(20)
    .get();
  const list = res.data || [];
  return list.find((item) => item.hostId !== currentPlayerId) || null;
}

async function startMemoryWithGuest(roomId, guest) {
  const db = getDb();
  if (!db) {
    throw new Error("cloud_unavailable");
  }
  const roomRes = await db.collection("rooms").doc(roomId).get();
  const room = roomRes.data;
  if (!room || room.status !== "waiting") {
    throw new Error("room_not_waiting");
  }
  const memoryEndsAt = Date.now() + room.config.memoryTime * 1000;
  await db.collection("rooms").doc(roomId).update({
    data: {
      status: "memory",
      guestId: guest.id,
      guestName: guest.name,
      memoryEndsAt,
      updatedAt: Date.now(),
      guestState: buildEmptyState(),
    },
  });
  await touchPresence(guest, room.roomCode);
  return {
    ...room,
    guestId: guest.id,
    guestName: guest.name,
    status: "memory",
    memoryEndsAt,
  };
}

async function joinRoomByCode({ player, roomCode }) {
  const db = getDb();
  if (!db) {
    throw new Error("cloud_unavailable");
  }
  const res = await db
    .collection("rooms")
    .where({
      roomCode,
    })
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();
  const room = (res.data || [])[0];
  if (!room) {
    throw new Error("room_not_found");
  }
  if (room.hostId === player.id) {
    return { roomId: room._id, role: "host", room };
  }
  if (room.status !== "waiting" && room.guestId !== player.id) {
    throw new Error("room_unavailable");
  }
  if (room.guestId && room.guestId !== player.id) {
    throw new Error("room_full");
  }
  if (room.status === "waiting") {
    const started = await startMemoryWithGuest(room._id, player);
    return { roomId: room._id, role: "guest", room: started };
  }
  await touchPresence(player, roomCode);
  return { roomId: room._id, role: "guest", room };
}

async function quickMatch({ player, difficulty }) {
  const found = await findWaitingRoom(player.id);
  if (found) {
    const room = await startMemoryWithGuest(found._id, player);
    return {
      roomId: found._id,
      roomCode: found.roomCode,
      role: "guest",
      room,
      matched: true,
    };
  }
  const created = await createInviteRoom({ player, difficulty });
  return {
    roomId: created.roomId,
    roomCode: created.roomCode,
    role: "host",
    room: created.room,
    matched: false,
  };
}

function watchRoom(roomId, onRoom, onError) {
  const db = getDb();
  if (!db) {
    throw new Error("cloud_unavailable");
  }
  return db.collection("rooms").doc(roomId).watch({
    onChange(snapshot) {
      if (snapshot && snapshot.docs && snapshot.docs.length) {
        onRoom(snapshot.docs[0]);
      }
    },
    onError(error) {
      if (onError) {
        onError(error);
      }
    },
  });
}

async function startAnswer(roomId, answerTime) {
  const db = getDb();
  if (!db) {
    throw new Error("cloud_unavailable");
  }
  const answerEndsAt = Date.now() + answerTime * 1000;
  await db.collection("rooms").doc(roomId).update({
    data: {
      status: "answer",
      startedAt: Date.now(),
      answerEndsAt,
      updatedAt: Date.now(),
    },
  });
}

async function updatePlayerState(roomId, role, state) {
  const db = getDb();
  if (!db) {
    throw new Error("cloud_unavailable");
  }
  const key = role === "host" ? "hostState" : "guestState";
  await db.collection("rooms").doc(roomId).update({
    data: {
      [key]: {
        ...state,
        updatedAt: Date.now(),
      },
      updatedAt: Date.now(),
    },
  });
}

function decideWinner(room) {
  const host = room.hostState || {};
  const guest = room.guestState || {};
  const hostFinished = !!host.finished;
  const guestFinished = !!guest.finished;

  if (hostFinished && host.allCorrect && !guestFinished) {
    return { winner: "host", reason: "host_first" };
  }
  if (guestFinished && guest.allCorrect && !hostFinished) {
    return { winner: "guest", reason: "guest_first" };
  }

  if (hostFinished && guestFinished) {
    if (host.allCorrect && guest.allCorrect) {
      if (host.finishAt === guest.finishAt) {
        return { winner: "draw", reason: "same_time" };
      }
      return host.finishAt < guest.finishAt
        ? { winner: "host", reason: "faster" }
        : { winner: "guest", reason: "faster" };
    }
    if (host.allCorrect) {
      return { winner: "host", reason: "guest_wrong" };
    }
    if (guest.allCorrect) {
      return { winner: "guest", reason: "host_wrong" };
    }
    return { winner: "draw", reason: "both_wrong" };
  }

  if (room.status === "answer" && room.answerEndsAt && Date.now() > room.answerEndsAt) {
    if (host.correctCount === guest.correctCount) {
      return { winner: "draw", reason: "time_up_draw" };
    }
    return host.correctCount > guest.correctCount
      ? { winner: "host", reason: "time_up_score" }
      : { winner: "guest", reason: "time_up_score" };
  }

  return null;
}

async function finalizeRoom(roomId, result) {
  const db = getDb();
  if (!db) {
    throw new Error("cloud_unavailable");
  }
  await db.collection("rooms").doc(roomId).update({
    data: {
      status: "finished",
      winner: result.winner,
      reason: result.reason,
      finishedAt: Date.now(),
      updatedAt: Date.now(),
    },
  });
}

async function markOffline(player) {
  const db = getDb();
  if (!db) {
    return;
  }
  try {
    await db.collection("players").doc(player.id).update({
      data: {
        roomCode: "",
        onlineAt: Date.now() - 120000,
        updatedAt: Date.now(),
      },
    });
  } catch (e) {
    // ignore
  }
}

module.exports = {
  hasCloud,
  getLocalPlayer,
  touchPresence,
  fetchOnlinePlayers,
  createInviteRoom,
  joinRoomByCode,
  quickMatch,
  watchRoom,
  startAnswer,
  updatePlayerState,
  decideWinner,
  finalizeRoom,
  markOffline,
};
