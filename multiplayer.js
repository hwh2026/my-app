// ============================================================
// 《历史通关棋》联机模块（Supabase）
// 架构：回合制 + 轮询同步 + 抢答原子插入
// 原则：只有"行动者"写入状态，其他人轮询渲染
// ============================================================

const SUPABASE_URL = "https://dlaipbcqltgwprmxibze.supabase.co";
const SUPABASE_KEY = "sb_publishable_2dtWUceG-3k16iA4KARUnQ_sZlLqlQJ";

let sb = null;
let roomCode = null;
let pollTimer = null;
let pollFast = false;

function initSupabase() {
  if (sb) return sb;
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return sb;
}

// ============================================================
// 状态序列化
// ============================================================
function serializeState() {
  return {
    version: G.version || 0,
    phase: G.phase,
    players: G.players,
    current: G.current,
    dice: G.dice,
    q: G.q,
    qDeadline: G.qDeadline,
    buzzer: G.buzzer,
    dungeon: G.dungeon,
    turn: G.turn,
    finishedCount: G.finishedCount,
    winner: G.winner,
    log: G.log,
    hostId: G.hostId
  };
}

function applyRemoteState(s) {
  if (!s) return;
  if (s.version <= (G.version || 0)) return;
  G.version = s.version;
  G.phase = s.phase;
  G.players = s.players || [];
  G.current = s.current || 0;
  G.dice = s.dice || 0;
  G.q = s.q || null;
  G.qDeadline = s.qDeadline || 0;
  G.buzzer = s.buzzer || null;
  G.dungeon = s.dungeon || null;
  G.turn = s.turn || 1;
  G.finishedCount = s.finishedCount || 0;
  G.winner = s.winner || null;
  G.log = s.log || [];
  G.hostId = s.hostId || null;
  renderAll();
}

// ============================================================
// 读写
// ============================================================
async function save() {
  if (!roomCode) return;
  const prev = G.version || 0;
  G.version = prev + 1;
  const state = serializeState();
  const { error } = await initSupabase()
    .from("rooms")
    .update({ state, version: G.version })
    .eq("code", roomCode)
    .eq("version", prev);
  if (error) {
    // 版本冲突：拉取最新状态
    await fetchState(true);
  }
}

async function fetchState(force = false) {
  if (!roomCode) return;
  const { data, error } = await initSupabase()
    .from("rooms")
    .select("state, version")
    .eq("code", roomCode)
    .single();
  if (!error && data) {
    if (data.state) applyRemoteState(Object.assign({}, data.state, { version: data.version }));
    return data;
  }
  return null;
}

function setPollInterval(fast) {
  pollFast = fast;
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  const ms = fast ? 600 : 1400;
  pollTimer = setInterval(() => fetchState(), ms);
}

function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

// ============================================================
// 房间：创建 / 加入
// ============================================================
function randomCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let c = "";
  for (let i = 0; i < 3; i++) c += letters[Math.floor(Math.random() * letters.length)];
  c += String(Math.floor(100 + Math.random() * 900));
  return c;
}

function newPlayer(name, i) {
  return {
    id: "p" + Date.now().toString(36) + Math.floor(Math.random() * 1000),
    name: name, color: COLORS[i % 4].bg, isAI: false,
    pos: 0, prevPos: 0, cards: 0, score: 0, shield: false, skip: false,
    rollMod: 0, doubleNext: false, fifty: false, removeOne: false, finished: false, rank: 0
  };
}

function onlineShowSetup() {
  $("#menu").classList.add("hidden");
  $("#online-setup").classList.remove("hidden");
  $("#online-create-btn").onclick = onlineCreate;
  $("#online-join-btn").onclick = onlineJoin;
  $("#online-back").onclick = () => location.reload();
}

async function onlineCreate() {
  const name = $("#online-name").value.trim() || "玩家1";
  initSupabase();
  const me = newPlayer(name, 0);
  G.mode = "online";
  G.myId = me.id;
  G.players = [me];
  G.hostId = me.id;
  G.version = 0;
  G.phase = "lobby";
  // 尝试创建唯一房间号
  for (let i = 0; i < 10; i++) {
    const code = randomCode();
    const state = serializeState();
    const { error } = await sb.from("rooms").insert({ code, state, version: 0 });
    if (!error) {
      roomCode = code;
      G.version = 1;
      break;
    }
  }
  if (!roomCode) { alert("创建房间失败，请重试"); return; }
  enterLobby();
}

async function onlineJoin() {
  const name = $("#online-name").value.trim() || "玩家";
  const code = $("#online-code").value.trim().toUpperCase();
  if (!code) { alert("请输入房间号"); return; }
  initSupabase();
  roomCode = code;
  const data = await fetchState(true);
  if (!data || !data.state) { alert("房间不存在，请检查房间号"); return; }
  const st = data.state;
  if (st.phase !== "lobby") { alert("该房间已开始游戏，无法加入"); return; }
  if (st.players.length >= 4) { alert("房间已满（最多4人）"); return; }
  const me = newPlayer(name, st.players.length);
  G.mode = "online";
  G.myId = me.id;
  G.version = data.version;
  G.players = st.players.concat(me);
  G.hostId = st.hostId;
  G.phase = "lobby";
  G.log = st.log || [];
  G.current = 0;
  await save();
  enterLobby();
}

function enterLobby() {
  $("#online-setup").classList.add("hidden");
  $("#lobby").classList.remove("hidden");
  $("#room-code-display").textContent = roomCode;
  $("#room-badge").textContent = "房间 " + roomCode;
  $("#room-badge").classList.remove("hidden");
  setPollInterval(true);
  renderLobby();
  if (G.myId === G.hostId) {
    $("#lobby-start").classList.remove("hidden");
    $("#lobby-start").onclick = onlineStartGame;
  } else {
    $("#lobby-start").classList.add("hidden");
  }
  $("#lobby-leave").onclick = () => location.reload();
}

function renderLobby() {
  $("#wait-list").innerHTML = "";
  G.players.forEach(p => {
    const item = el("div", "wl-item");
    item.innerHTML = `<div class="meeple" style="width:1.6em;height:1.6em;border-radius:50%;background:${p.color};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900">${p.name.slice(0,1)}</div>
      <span>${p.name}${p.id === G.hostId ? "（房主）" : ""}${p.id === G.myId ? "（我）" : ""}</span>`;
    $("#wait-list").appendChild(item);
  });
  $("#lobby-count").textContent = `${G.players.length}/4 人`;
  $("#lobby-start").disabled = G.players.length < 2;
}

async function onlineStartGame() {
  if (G.players.length < 2) return;
  G.phase = "playing";
  G.current = 0;
  G.turn = 1;
  G.finishedCount = 0;
  G.log = [];
  G.log.unshift("游戏开始！");
  await save();
  enterGameUI();
}

function enterGameUI() {
  $("#lobby").classList.add("hidden");
  $("#game").classList.remove("hidden");
  renderAll();
}

// ============================================================
// 渲染
// ============================================================
function renderAll() {
  if (G.phase === "lobby") { renderLobby(); return; }
  if (G.phase === "ended") {
    renderBoard(); renderPlayers(); renderLog();
    const ranked = G.players.slice().sort((a, b) => b.score - a.score);
    if (!document.querySelector("#win-modal:not(.hidden)")) showWinModal(ranked);
    return;
  }
  renderBoard();
  renderPlayers();
  renderLog();
  // 骰子
  const myTurn = G.phase === "playing" && G.players[G.current] && G.players[G.current].id === G.myId;
  $("#turn-hint").textContent = myTurn
    ? `${G.players[G.current].name}（你）的回合，点击骰子`
    : `等待 ${G.players[G.current] ? G.players[G.current].name : ""} 行动…`;
  $("#roll-btn").classList.toggle("hidden", !myTurn);
  $("#roll-btn").disabled = !myTurn;
  $("#dice").textContent = G.dice || "🎲";

  // 题目弹窗
  if (G.phase === "buzzing" || G.phase === "answering" || G.phase === "question") {
    renderOnlineQuestion();
  } else if (G.phase === "dungeon") {
    // 副本弹窗由本地事件驱动；远程时若弹窗未开则补开
    if (document.querySelector("#q-modal.hidden")) renderRemoteDungeon();
  } else {
    if (!document.querySelector("#q-modal.hidden")) closeQuestionModal();
  }
}

function renderOnlineQuestion() {
  const q = G.q;
  if (!q) return;
  if (document.querySelector("#q-modal.hidden")) {
    $("#q-dynasty").textContent = DYNASTY_NAMES[q.dynasty] || "";
    $("#q-text").textContent = q.q;
    const opts = $("#options");
    opts.innerHTML = "";
    const letters = ["A", "B", "C", "D"];
    q.o.forEach((opt, i) => {
      const b = el("button", "option");
      b.innerHTML = `<span class="opt-letter">${letters[i]}</span><span>${opt}</span>`;
      b.dataset.i = i;
      b.onclick = () => onlineOptionClick(i);
      opts.appendChild(b);
    });
    $("#explain").classList.add("hidden");
    $("#explain").textContent = "";
    $("#q-modal").classList.remove("hidden");
    startTimer();
  }
  const isBuzzing = G.phase === "buzzing";
  $("#buzz-panel").classList.toggle("hidden", !isBuzzing);
  $("#answer-panel").classList.toggle("hidden", isBuzzing);
  if (isBuzzing) {
    $("#buzz-btn").onclick = onlineBuzz;
    $("#turn-hint").textContent = "抢答！点击下方按钮";
  } else {
    const isMe = G.buzzer === G.myId;
    document.querySelectorAll("#options .option").forEach(b => { b.disabled = !isMe; });
    $("#turn-hint").textContent = isMe ? "轮到你作答（30秒）" : `等待 ${(G.players.find(p => p.id === G.buzzer) || {}).name || ""} 作答…`;
  }
}

function renderRemoteDungeon() {
  if (!G.dungeon || !G.q) return;
  const q = G.q;
  $("#q-dynasty").textContent = `副本 · ${DYNASTY_NAMES[q.dynasty] || ""}`;
  $("#q-text").textContent = q.q;
  const opts = $("#options");
  opts.innerHTML = "";
  const letters = ["A", "B", "C", "D"];
  q.o.forEach((opt, i) => {
    const b = el("button", "option");
    b.innerHTML = `<span class="opt-letter">${letters[i]}</span><span>${opt}</span>`;
    b.dataset.i = i;
    b.onclick = () => onlineDungeonClick(i);
    opts.appendChild(b);
  });
  $("#explain").classList.add("hidden");
  $("#explain").textContent = "";
  $("#buzz-panel").classList.add("hidden");
  $("#answer-panel").classList.remove("hidden");
  $("#dungeon-hint").textContent = `副本第 ${(G.dungeon.steps || 0) + 1}/${G.dungeon.total} 题`;
  $("#q-modal").classList.remove("hidden");
  const isMe = G.players[G.current] && G.players[G.current].id === G.myId;
  document.querySelectorAll("#options .option").forEach(b => { b.disabled = !isMe; });
  startTimer();
}

// ============================================================
// 在线行动
// ============================================================
// 掷骰子（当前玩家设备）
const _origRoll = rollDice;
rollDice = function () {
  if (G.mode === "online") {
    const p = G.players[G.current];
    if (!p || p.id !== G.myId || G.phase !== "playing") return;
    Sound.unlock();
    const diceEl = $("#dice");
    diceEl.classList.add("rolling");
    $("#roll-btn").disabled = true;
    setTimeout(async () => {
      diceEl.classList.remove("rolling");
      let n = 1 + Math.floor(Math.random() * 6);
      let mod = p.rollMod || 0;
      p.rollMod = 0;
      let final = Math.max(1, n + mod);
      G.dice = final;
      diceEl.textContent = final;
      Sound.roll();
      G.log.unshift(`[第${G.turn}回合] ${p.name} 掷出了 ${final} 点。`);
      movePlayer(p, final);
      // movePlayer 内部触发效果或 endTurn；endTurn 需写入状态
      await save();
    }, 650);
  } else {
    _origRoll();
  }
};

// 覆盖 endTurn / advanceTurn / 关键动作，使在线模式写入状态
const _origEndTurn = endTurn;
endTurn = function () {
  if (G.mode === "online") {
    advanceTurn();
    save();
  } else {
    _origEndTurn();
  }
};

// 抢答
async function onlineBuzz() {
  if (G.phase !== "buzzing") return;
  Sound.buzz();
  const { data, error } = await sb.from("buzzes").insert({
    room_code: roomCode, round_id: G.q.roundId, player_id: G.myId
  });
  if (error) {
    // 已有人抢到
    $("#turn-hint").textContent = "抢答失败，已有人抢先！";
    $("#buzz-btn").disabled = true;
    return;
  }
  G.buzzer = G.myId;
  G.phase = "answering";
  G.qDeadline = Date.now() + Q_TIME * 1000;
  await save();
  renderOnlineQuestion();
}

// 抢答超时（由提问者设备处理）
function onlineBuzzTimeout() {
  if (G.mode !== "online" || G.phase !== "buzzing") return;
  if (G.q && G.q.questionerId === G.myId) {
    // 无人抢答，提问者作答
    G.buzzer = G.q.questionerId;
    G.phase = "answering";
    G.qDeadline = Date.now() + Q_TIME * 1000;
    save();
    renderOnlineQuestion();
  }
}

// 在线答题
function onlineOptionClick(i) {
  if (G.phase !== "answering" || G.buzzer !== G.myId) return;
  const p = playerById(G.myId);
  resolveAnswerOnline(p, i);
}

function resolveAnswerOnline(p, chosen) {
  const q = G.q;
  const correct = chosen === q.a;
  document.querySelectorAll("#options .option").forEach(b => {
    b.disabled = true;
    const i = +b.dataset.i;
    if (i === q.a) b.classList.add("correct");
    else if (i === chosen) b.classList.add("wrong");
  });
  if (correct) {
    let pts = 1;
    if (p.doubleNext) { pts = 2; p.doubleNext = false; }
    p.cards += pts; p.score += pts;
    G.log.unshift(`[第${G.turn}回合] ${p.name} 抢答成功，答对了！+${pts} 张能量卡。`);
    Sound.correct();
    showExplain();
    setTimeout(async () => {
      closeQuestionModal();
      onlineAfterQuestion();
      await save();
    }, 2000);
  } else {
    G.log.unshift(`[第${G.turn}回合] ${p.name} 答错了。`);
    Sound.wrong();
    showExplain();
    setTimeout(async () => {
      // 按顺序补答
      const next = nextAnswerer(p.id);
      if (next) {
        G.buzzer = next;
        G.qDeadline = Date.now() + Q_TIME * 1000;
        // 恢复选项
        document.querySelectorAll("#options .option").forEach(b => {
          b.disabled = true; b.classList.remove("correct", "wrong");
        });
        $("#explain").classList.add("hidden");
        $("#explain").textContent = "";
        await save();
        renderOnlineQuestion();
      } else {
        closeQuestionModal();
        onlineAfterQuestion();
        await save();
      }
    }, 1800);
  }
}

function nextAnswerer(afterId) {
  // 按掷骰子顺序从提问者开始，排除已回答/已结束的玩家
  const q = G.q;
  const answered = q.answered || [];
  const order = q.order || G.players.filter(x => !x.finished).map(x => x.id);
  for (const id of order) {
    if (id !== afterId && !answered.includes(id)) {
      q.answered = answered.concat(afterId);
      return id;
    }
  }
  return null;
}

function onlineAfterQuestion() {
  G.q = null;
  G.buzzer = null;
  G.phase = "playing";
  advanceTurn();
}

// 在线副本
function onlineDungeonClick(i) {
  const p = G.players[G.current];
  if (!p || p.id !== G.myId) return;
  resolveDungeonOnline(p, i);
}

async function resolveDungeonOnline(p, chosen) {
  const q = G.q;
  const correct = chosen === q.a;
  document.querySelectorAll("#options .option").forEach(b => {
    b.disabled = true;
    const i = +b.dataset.i;
    if (i === q.a) b.classList.add("correct");
    else if (i === chosen) b.classList.add("wrong");
  });
  if (correct) {
    G.dungeon.steps++;
    G.log.unshift(`[第${G.turn}回合] ${p.name} 副本第 ${G.dungeon.steps} 题答对！`);
    Sound.correct();
  } else {
    G.log.unshift(`[第${G.turn}回合] ${p.name} 副本挑战失败。`);
    Sound.wrong();
  }
  showExplain();
  setTimeout(async () => {
    $("#q-modal").classList.add("hidden");
    stopTimer();
    if (correct && G.dungeon.steps < G.dungeon.total) {
      G.phase = "dungeon";
      await save();
      // 本地继续下一题
      if (G.players[G.current].id === G.myId) nextDungeonQuestion();
      else renderRemoteDungeon();
    } else if (correct) {
      p.cards += 2; p.score += 2;
      G.log.unshift(`[第${G.turn}回合] ${p.name} 副本通关！+2 张能量卡，前进3步。`);
      Sound.win();
      G.dungeon = null;
      G.phase = "playing";
      movePlayer(p, 3, true);
      await save();
    } else {
      G.dungeon = null;
      G.phase = "playing";
      advanceTurn();
      await save();
    }
  }, 1600);
}

// ============================================================
// 覆盖问答题：在线时走抢答流程
// ============================================================
const _origAskQuestion = askQuestion;
askQuestion = function (p, dynasty) {
  if (G.mode === "online") {
    const q = pickQuestion(dynasty);
    G.q = Object.assign({}, q, {
      dynasty,
      roundId: roomCode + "-" + G.turn + "-" + Date.now(),
      questionerId: p.id,
      order: orderFrom(p.id),
      answered: []
    });
    G.buzzer = null;
    G.phase = "buzzing";
    G.qDeadline = Date.now() + BUZZ_TIME * 1000;
    G.log.unshift(`[第${G.turn}回合] ${p.name} 触发答题格，全员抢答！`);
    save();
    renderOnlineQuestion();
    setPollInterval(true);
  } else {
    _origAskQuestion(p, dynasty);
  }
};

function orderFrom(startId) {
  const ids = G.players.filter(x => !x.finished).map(x => x.id);
  const si = ids.indexOf(startId);
  return ids.slice(si).concat(ids.slice(0, si));
}

// 覆盖副本进入：在线写入状态
const _origEnterDungeon = enterDungeon;
enterDungeon = function (p, key) {
  if (G.mode === "online") {
    G.dungeon = { steps: 0, total: DUNGEON_QUESTIONS, key };
    G.phase = "dungeon";
    G.log.unshift(`[第${G.turn}回合] ${p.name} 进入${DUNGEON_NAMES[key]}！`);
    save();
    if (p.id === G.myId) nextDungeonQuestion();
    else renderRemoteDungeon();
  } else {
    _origEnterDungeon(p, key);
  }
};

// 覆盖技能卡：在线写入状态
const _origDrawSkill = drawSkill;
drawSkill = function (p) {
  if (G.mode === "online") {
    const skill = SKILLS[Math.floor(Math.random() * SKILLS.length)];
    G.pendingSkill = skill;
    G.log.unshift(`[第${G.turn}回合] ${p.name} 触发技能卡：${skill.name}。`);
    save();
    if (p.id === G.myId) showSkillModal(skill, p);
  } else {
    _origDrawSkill(p);
  }
};

// 覆盖到达终点
const _origOnReachEnd = onReachEnd;
onReachEnd = function (p) {
  _origOnReachEnd(p);
  if (G.mode === "online") save();
};

// 覆盖游戏结束
const _origEndGame = endGame;
endGame = function () {
  _origEndGame();
  if (G.mode === "online") save();
};

// 覆盖 startTurn：在线模式由 renderAll 统一控制 UI
const _origStartTurn = startTurn;
startTurn = function () {
  if (G.mode === "online") { renderAll(); return; }
  _origStartTurn();
};

// 覆盖 onTimeout：在线模式只有行动者处理超时
const _origOnTimeout = onTimeout;
onTimeout = function () {
  if (G.mode !== "online") { _origOnTimeout(); return; }
  if (G.phase === "buzzing") { onlineBuzzTimeout(); return; }
  if (G.phase === "answering") {
    if (G.buzzer !== G.myId) return;
    const p = playerById(G.myId);
    document.querySelectorAll("#options .option").forEach(b => { b.disabled = true; if (+b.dataset.i === G.q.a) b.classList.add("correct"); });
    showExplain();
    setTimeout(async () => {
      const next = nextAnswerer(p.id);
      if (next) {
        G.buzzer = next;
        G.qDeadline = Date.now() + Q_TIME * 1000;
        document.querySelectorAll("#options .option").forEach(b => { b.disabled = true; b.classList.remove("correct", "wrong"); });
        $("#explain").classList.add("hidden");
        $("#explain").textContent = "";
        await save();
        renderOnlineQuestion();
      } else {
        closeQuestionModal();
        onlineAfterQuestion();
        await save();
      }
    }, 1800);
    return;
  }
  if (G.phase === "dungeon") {
    const p = G.players[G.current];
    if (!p || p.id !== G.myId) return;
    document.querySelectorAll("#options .option").forEach(b => { b.disabled = true; if (+b.dataset.i === G.q.a) b.classList.add("correct"); });
    showExplain();
    setTimeout(async () => {
      $("#q-modal").classList.add("hidden");
      stopTimer();
      G.dungeon = null;
      G.phase = "playing";
      advanceTurn();
      await save();
    }, 1600);
    return;
  }
  _origOnTimeout();
};

// ============================================================
// 暴露给全局
// ============================================================
window.Online = { onlineBuzz, onlineBuzzTimeout, onlineAfterQuestion, fetchState, save };
