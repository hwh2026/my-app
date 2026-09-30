// ============================================================
// 《历史通关棋》游戏引擎
// ============================================================

// 合并题库
window.QUESTIONS = (window.Q1 || []).concat(window.Q2 || [], window.Q3 || [], window.Q4 || [], window.Q5 || []);

const COLORS = [
  { name: "红", bg: "#d64541", key: "red" },
  { name: "黄", bg: "#e9b53a", key: "yellow" },
  { name: "蓝", bg: "#3b7bbf", key: "blue" },
  { name: "绿", bg: "#2f9e63", key: "green" }
];

const CELL_COLS = 11;
const Q_TIME = 30;        // 普通答题秒数
const BUZZ_TIME = 10;     // 抢答秒数
const DUNGEON_TIME = 20;  // 副本答题秒数
const DUNGEON_QUESTIONS = 3;

const G = {
  mode: null,           // 'solo' | 'online'
  room: null,
  myId: null,
  players: [],
  current: 0,
  phase: "menu",        // menu | playing | question | buzzing | answering | dungeon | skill | ended
  dice: 0,
  q: null,
  qDeadline: 0,
  buzzer: null,
  dungeon: null,        // {steps, total, key}
  turn: 1,
  finishedCount: 0,
  winner: null,
  log: [],
  aiDiff: 0.55,
  pendingSkill: null,
  skillTargetNeeded: false
};

// ============================================================
// 音效（Web Audio 合成，无需音频文件）
// ============================================================
let AC = null, muted = false;
function audioCtx() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  return AC;
}
function tone(freq, dur, type = "sine", vol = 0.18, when = 0) {
  if (muted) return;
  const ctx = audioCtx(); if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(ctx.destination);
  o.start(t); o.stop(t + dur + 0.02);
}
const Sound = {
  unlock() { const c = audioCtx(); if (c && c.state === "suspended") c.resume(); },
  roll() { for (let i = 0; i < 4; i++) tone(300 + Math.random() * 500, 0.05, "square", 0.06, i * 0.06); },
  move() { tone(520, 0.07, "triangle", 0.12); tone(660, 0.07, "triangle", 0.12, 0.08); },
  correct() { tone(660, 0.12, "sine", 0.2); tone(880, 0.14, "sine", 0.2, 0.1); tone(1100, 0.2, "sine", 0.2, 0.2); },
  wrong() { tone(220, 0.25, "sawtooth", 0.14); tone(160, 0.3, "sawtooth", 0.12, 0.12); },
  skill() { tone(740, 0.1, "triangle", 0.16); tone(988, 0.12, "triangle", 0.16, 0.1); },
  win() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.22, "sine", 0.18, i * 0.14)); },
  buzz() { tone(880, 0.18, "square", 0.15); }
};

// ============================================================
// 工具
// ============================================================
function $(sel) { return document.querySelector(sel); }
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}
function log(msg) {
  G.log.unshift(`[第${G.turn}回合] ${msg}`);
  if (G.log.length > 60) G.log.pop();
  renderLog();
}
function shuffle(a) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}
function meepleColor(id) {
  const p = G.players.find(p => p.id === id);
  return p ? p.color : "#999";
}

// ============================================================
// 棋盘渲染
// ============================================================
function renderBoard() {
  const board = $("#board");
  board.innerHTML = "";
  const len = BOARD.length;
  const rows = Math.ceil(len / CELL_COLS);
  for (let r = 0; r < rows; r++) {
    const rowDiv = el("div", "board-row");
    rowDiv.style.cssText = "display:contents;";
    board.appendChild(rowDiv);
    let cells = [];
    for (let c = 0; c < CELL_COLS; c++) {
      const idx = r * CELL_COLS + c;
      if (idx >= len) { board.appendChild(el("div", "cell-empty")); continue; }
      cells.push({ idx, data: BOARD[idx] });
    }
    if (r % 2 === 1) cells.reverse();
    cells.forEach(({ idx, data }) => {
      const cell = el("div", "cell");
      cell.dataset.idx = idx;
      cell.dataset.name = data.name;
      // 类型样式
      if (data.effect) {
        if (data.effect.type === "drawQ") cell.classList.add("drawQ");
        else if (data.effect.type === "drawSkill") cell.classList.add("drawSkill");
        else if (data.effect.type === "dungeon") cell.classList.add("dungeon");
        else if (data.effect.type === "move" && data.effect.n < 0) cell.classList.add("retreat");
      }
      if (idx === 0) cell.classList.add("start");
      if (idx === len - 1) cell.classList.add("end");

      const name = data.name;
      cell.innerHTML = `<div class="cell-name">${name}</div>` +
        (data.year ? `<div class="cell-year">${data.year}</div>` : "");
      // 机关点
      if (data.effect) {
        if (data.effect.type === "move") {
          const dot = data.effect.n > 0 ? "g" : "r";
          cell.appendChild(el("div", `dot ${dot}`));
          cell.appendChild(el("div", "cell-badge", (data.effect.n > 0 ? "+" : "") + data.effect.n));
        } else if (data.effect.type === "drawQ") {
          cell.appendChild(el("div", "dot g"));
          cell.appendChild(el("div", "cell-badge", "答题"));
        } else if (data.effect.type === "drawSkill") {
          cell.appendChild(el("div", "dot g"));
          cell.appendChild(el("div", "cell-badge", "技能"));
        }
      }
      cell.appendChild(el("div", "meeples"));
      board.appendChild(cell);
    });
  }
  renderMeeples();
}

function renderMeeples() {
  document.querySelectorAll(".cell .meeples").forEach(m => m.innerHTML = "");
  G.players.forEach(p => {
    const cell = document.querySelector(`.cell[data-idx="${p.pos}"] .meeples`);
    if (cell) {
      const m = el("div", "meeple-on");
      m.style.background = p.color;
      m.textContent = p.name.slice(0, 1);
      cell.appendChild(m);
    }
  });
}

// ============================================================
// 玩家面板渲染
// ============================================================
function renderPlayers() {
  const row = $("#players-row");
  row.innerHTML = "";
  G.players.forEach((p, i) => {
    const card = el("div", "player-card");
    if (i === G.current && G.phase !== "ended") card.classList.add("active");
    card.innerHTML = `
      <div class="pc-top">
        <div class="meeple" style="background:${p.color}">${p.name.slice(0, 1)}</div>
        <div class="pc-name">${p.name}${p.isAI ? " 🤖" : ""}</div>
        ${p.finished ? '<span class="crown">👑</span>' : ""}
      </div>
      <div class="pc-stats">
        <span>能量卡 <b>${p.cards}</b></span>
        <span>积分 <b>${p.score}</b></span>
        <span>第 <b>${p.pos}</b> 格</span>
      </div>`;
    row.appendChild(card);
  });
}

function renderLog() {
  const lg = $("#log");
  lg.innerHTML = G.log.slice(0, 40).map(s => `<div>${s}</div>`).join("");
}

// ============================================================
// 游戏流程
// ============================================================
function startSolo(name, diff) {
  G.mode = "solo";
  G.aiDiff = diff;
  G.players = [
    { id: "p1", name: name || "我", color: COLORS[0].bg, isAI: false, pos: 0, prevPos: 0, cards: 0, score: 0, shield: false, skip: false, rollMod: 0, doubleNext: false, fifty: false, removeOne: false, finished: false, rank: 0 },
    { id: "ai1", name: "诸葛亮", color: COLORS[1].bg, isAI: true, pos: 0, prevPos: 0, cards: 0, score: 0, shield: false, skip: false, rollMod: 0, doubleNext: false, fifty: false, removeOne: false, finished: false, rank: 0 },
    { id: "ai2", name: "李白", color: COLORS[2].bg, isAI: true, pos: 0, prevPos: 0, cards: 0, score: 0, shield: false, skip: false, rollMod: 0, doubleNext: false, fifty: false, removeOne: false, finished: false, rank: 0 },
    { id: "ai3", name: "苏轼", color: COLORS[3].bg, isAI: true, pos: 0, prevPos: 0, cards: 0, score: 0, shield: false, skip: false, rollMod: 0, doubleNext: false, fifty: false, removeOne: false, finished: false, rank: 0 }
  ];
  beginGame();
}

function beginGame() {
  G.phase = "playing";
  G.current = 0;
  G.turn = 1;
  G.finishedCount = 0;
  G.winner = null;
  $("#menu").classList.add("hidden");
  $("#solo-setup").classList.add("hidden");
  $("#online-setup").classList.add("hidden");
  $("#lobby").classList.add("hidden");
  $("#game").classList.remove("hidden");
  window.scrollTo(0, 0);
  renderBoard();
  renderPlayers();
  renderLog();
  log("游戏开始！由 " + G.players[0].name + " 先走。");
  startTurn();
}

function currentPlayer() { return G.players[G.current]; }
function playerById(id) { return G.players.find(p => p.id === id); }
function activePlayers() { return G.players.filter(p => !p.finished); }

function startTurn() {
  const p = currentPlayer();
  if (G.phase === "ended") return;
  // 处理暂停/跳过
  if (p.skip) {
    p.skip = false;
    log(p.name + " 被定身，暂停一轮。");
    advanceTurn();
    return;
  }
  if (p.isAI && G.mode === "solo") {
    setTimeout(() => aiRoll(), 900);
  } else {
    showConsole(`${p.name} 的回合，点击骰子`, true);
  }
}

function showConsole(text, canRoll) {
  $("#turn-hint").textContent = text;
  $("#roll-btn").classList.toggle("hidden", !canRoll);
}

function rollDice() {
  const p = currentPlayer();
  if (G.phase !== "playing" || p.isAI) return;
  Sound.unlock();
  const diceEl = $("#dice");
  diceEl.classList.add("rolling");
  $("#roll-btn").disabled = true;
  setTimeout(() => {
    diceEl.classList.remove("rolling");
    let n = 1 + Math.floor(Math.random() * 6);
    let mod = p.rollMod || 0;
    p.rollMod = 0;
    let final = Math.max(1, n + mod);
    diceEl.textContent = final;
    Sound.roll();
    log(`${p.name} 掷出了 ${n}${mod ? (mod > 0 ? "+" + mod : mod) : ""} 点。`);
    movePlayer(p, final);
  }, 650);
}

function aiRoll() {
  const p = currentPlayer();
  const diceEl = $("#dice");
  diceEl.classList.add("rolling");
  $("#roll-btn").disabled = true;
  setTimeout(() => {
    diceEl.classList.remove("rolling");
    let n = 1 + Math.floor(Math.random() * 6);
    let mod = p.rollMod || 0;
    p.rollMod = 0;
    let final = Math.max(1, n + mod);
    diceEl.textContent = final;
    Sound.roll();
    log(`${p.name} 掷出了 ${final} 点。`);
    movePlayer(p, final);
  }, 650);
}

function movePlayer(p, steps, isTeleport = false) {
  const lastIdx = BOARD.length - 1;
  let target = p.pos + steps;
  // 越过终点则反弹
  if (!isTeleport && target > lastIdx) {
    const overshoot = target - lastIdx;
    target = lastIdx - overshoot;
    log(`${p.name} 越过终点，多出的点数往回走。`);
  }
  target = Math.max(0, Math.min(target, lastIdx));
  p.prevPos = p.pos;
  p.pos = target;
  Sound.move();
  renderMeeples();
  renderPlayers();
  // 到达终点判定
  if (p.pos === lastIdx) {
    onReachEnd(p);
    return;
  }
  const cell = BOARD[p.pos];
  log(`${p.name} 走到第 ${p.pos} 格：${cell.name}。`);
  applyEffect(p, cell);
}

function onReachEnd(p) {
  p.finished = true;
  G.finishedCount++;
  p.rank = G.finishedCount;
  const bonus = p.rank === 1 ? 3 : p.rank === 2 ? 2 : 1;
  p.cards += bonus; p.score += bonus;
  log(`${p.name} 到达终点！获得第 ${p.rank} 名奖励 ${bonus} 张能量卡！`);
  Sound.correct();
  const need = G.players.length === 2 ? 1 : G.players.length === 3 ? 2 : 3;
  if (G.finishedCount >= need) {
    endGame();
    return;
  }
  advanceTurn();
}

function applyEffect(p, cell) {
  const ef = cell.effect;
  if (!ef) { endTurn(); return; }
  switch (ef.type) {
    case "drawQ":
      log(`${p.name} 触发答题格，抽取知识能量卡！`);
      askQuestion(p, cell.dynasty);
      break;
    case "drawSkill":
      log(`${p.name} 触发技能卡！`);
      drawSkill(p);
      break;
    case "move":
      log(`${p.name} 遇到机关：${ef.n > 0 ? "前进" : "后退"} ${Math.abs(ef.n)} 步。`);
      if (ef.n < 0 && p.shield) {
        p.shield = false;
        log(`${p.name} 的护身符抵消了后退！`);
        endTurn();
      } else {
        movePlayer(p, ef.n, true);
      }
      break;
    case "dungeon":
      log(`${p.name} 进入${DUNGEON_NAMES[ef.key]}！`);
      enterDungeon(p, ef.key);
      break;
    case "tunnel":
      log(`${p.name} 搭上时空隧道，直达第 ${ef.to} 格！`);
      p.pos = ef.to;
      renderMeeples();
      endTurn();
      break;
    default:
      endTurn();
  }
}

function endTurn() {
  renderPlayers();
  advanceTurn();
}

function advanceTurn() {
  if (G.phase === "ended") return;
  // 找到下一个未完成的玩家
  let next = G.current;
  for (let i = 0; i < G.players.length; i++) {
    next = (next + 1) % G.players.length;
    if (!G.players[next].finished) break;
  }
  G.current = next;
  G.turn++;
  renderPlayers();
  startTurn();
}

// ============================================================
// 答题
// ============================================================
function pickQuestion(dynasty) {
  const pool = window.QUESTIONS.filter(q => q.d === dynasty);
  const src = pool.length >= 3 ? pool : window.QUESTIONS;
  const q = src[Math.floor(Math.random() * src.length)];
  return q;
}

function askQuestion(p, dynasty) {
  const q = pickQuestion(dynasty);
  G.q = Object.assign({}, q, { dynasty });
  G.buzzer = null;
  G.qDeadline = Date.now() + Q_TIME * 1000;
  if (G.mode === "solo") {
    G.phase = "question";
    renderPlayers();
    showQuestionModal(false);
    if (p.isAI) aiAnswer();
  } else {
    // 在线：进入抢答阶段
    G.phase = "buzzing";
    G.qDeadline = Date.now() + BUZZ_TIME * 1000;
    renderPlayers();
    showQuestionModal(true);
    onlineBeginBuzz();
  }
}

function showQuestionModal(buzz) {
  const q = G.q;
  $("#q-dynasty").textContent = DYNASTY_NAMES[q.dynasty] || "";
  $("#q-text").textContent = q.q;
  const opts = $("#options");
  opts.innerHTML = "";
  const letters = ["A", "B", "C", "D"];
  q.o.forEach((opt, i) => {
    const b = el("button", "option");
    b.innerHTML = `<span class="opt-letter">${letters[i]}</span><span>${opt}</span>`;
    b.dataset.i = i;
    b.onclick = () => onOptionClick(i);
    opts.appendChild(b);
  });
  $("#explain").classList.add("hidden");
  $("#explain").textContent = "";
  $("#buzz-panel").classList.toggle("hidden", !buzz);
  $("#answer-panel").classList.toggle("hidden", buzz);
  $("#q-modal").classList.remove("hidden");
  startTimer();
}

function onOptionClick(i) {
  const q = G.q;
  if (!q || q._resolved) return;
  if (G.phase !== "question" && G.phase !== "answering") return;
  const p = G.phase === "question" ? currentPlayer() : playerById(G.buzzer);
  if (G.mode === "solo" && p.isAI) return;
  q._resolved = true;
  resolveAnswer(p, i);
}

function resolveAnswer(p, chosen) {
  const q = G.q;
  const correct = chosen === q.a;
  // 标记选项
  document.querySelectorAll("#options .option").forEach(b => {
    b.disabled = true;
    const i = +b.dataset.i;
    if (i === q.a) b.classList.add("correct");
    else if (i === chosen) b.classList.add("wrong");
  });
  let points = 1;
  if (correct) {
    if (p.doubleNext) { points *= 2; p.doubleNext = false; }
    p.cards += points; p.score += points;
    log(`${p.name} 答对了！+${points} 张能量卡。`);
    Sound.correct();
  } else {
    log(`${p.name} 答错了。`);
    Sound.wrong();
  }
  showExplain();
  const finish = () => {
    closeQuestionModal();
    afterQuestion();
  };
  setTimeout(finish, correct ? 1800 : 2600);
}

function showExplain() {
  const q = G.q;
  $("#explain").textContent = "📖 " + q.e;
  $("#explain").classList.remove("hidden");
}

function closeQuestionModal() {
  $("#q-modal").classList.add("hidden");
  stopTimer();
}

function afterQuestion() {
  if (G.mode === "solo") {
    endTurn();
  } else {
    onlineAfterQuestion();
  }
}

// AI 答题
function aiAnswer() {
  const p = currentPlayer();
  const q = G.q;
  const correctRate = G.aiDiff;
  const fifty = p.fifty || p.removeOne;
  setTimeout(() => {
    let options = [0, 1, 2, 3];
    let choose;
    if (Math.random() < correctRate) {
      choose = q.a;
    } else {
      const wrong = options.filter(i => i !== q.a);
      choose = wrong[Math.floor(Math.random() * wrong.length)];
    }
    resolveAnswer(p, choose);
    p.fifty = false; p.removeOne = false;
  }, 1200 + Math.random() * 1500);
}

// ============================================================
// 副本
// ============================================================
function enterDungeon(p, key) {
  G.dungeon = { steps: 0, total: DUNGEON_QUESTIONS, key };
  G.phase = "dungeon";
  nextDungeonQuestion();
}

function nextDungeonQuestion() {
  const p = currentPlayer();
  if (G.dungeon.steps >= G.dungeon.total) {
    dungeonSuccess();
    return;
  }
  const q = pickQuestion(dungeonDynasty());
  G.q = Object.assign({}, q, { dynasty: dungeonDynasty() });
  G.buzzer = p.id;
  G.qDeadline = Date.now() + DUNGEON_TIME * 1000;
  $("#q-dynasty").textContent = `副本 · ${DYNASTY_NAMES[G.q.dynasty] || ""}`;
  $("#q-text").textContent = q.q;
  const opts = $("#options");
  opts.innerHTML = "";
  const letters = ["A", "B", "C", "D"];
  q.o.forEach((opt, i) => {
    const b = el("button", "option");
    b.innerHTML = `<span class="opt-letter">${letters[i]}</span><span>${opt}</span>`;
    b.dataset.i = i;
    b.onclick = () => onDungeonClick(i);
    opts.appendChild(b);
  });
  $("#explain").classList.add("hidden");
  $("#explain").textContent = "";
  $("#buzz-panel").classList.add("hidden");
  $("#answer-panel").classList.remove("hidden");
  $("#dungeon-hint").textContent = `副本第 ${G.dungeon.steps + 1}/${G.dungeon.total} 题`;
  $("#q-modal").classList.remove("hidden");
  startTimer();
  if (p.isAI) setTimeout(() => aiDungeonAnswer(), 1000);
}

function dungeonDynasty() {
  const key = G.dungeon.key;
  const map = { dongzhou: "xsz", xihan: "qh", sanguo: "sgnb", nanbeichao: "sgnb", tang: "st", beisong: "sy", ming: "mq", minguo: "modern" };
  return map[key] || "qh";
}

function onDungeonClick(i) {
  const p = currentPlayer();
  if (p.isAI) return;
  if (G.q && G.q._resolved) return;
  G.q._resolved = true;
  resolveDungeonAnswer(p, i);
}

function aiDungeonAnswer() {
  const p = currentPlayer();
  const q = G.q;
  const choose = Math.random() < G.aiDiff ? q.a : [0,1,2,3].filter(i => i !== q.a)[Math.floor(Math.random()*3)];
  resolveDungeonAnswer(p, choose);
}

function resolveDungeonAnswer(p, chosen) {
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
    log(`${p.name} 副本第 ${G.dungeon.steps} 题答对！`);
    Sound.correct();
  } else {
    log(`${p.name} 副本挑战失败。`);
    Sound.wrong();
  }
  showExplain();
  setTimeout(() => {
    $("#q-modal").classList.add("hidden");
    stopTimer();
    if (correct && G.dungeon.steps < G.dungeon.total) {
      nextDungeonQuestion();
    } else if (correct) {
      dungeonSuccess();
    } else {
      dungeonFail();
    }
  }, 1600);
}

function dungeonSuccess() {
  const p = currentPlayer();
  p.cards += 2; p.score += 2;
  log(`${p.name} 副本通关！奖励 +2 张能量卡，前进 3 步！`);
  Sound.win();
  G.dungeon = null;
  movePlayer(p, 3, true);
  // movePlayer 会触发 applyEffect 或 endTurn；但我们需要直接进入下一回合
}

function dungeonFail() {
  G.dungeon = null;
  endTurn();
}

// ============================================================
// 技能卡
// ============================================================
function drawSkill(p) {
  const skill = SKILLS[Math.floor(Math.random() * SKILLS.length)];
  G.pendingSkill = skill;
  G.phase = "skill";
  renderPlayers();
  showSkillModal(skill, p);
}

function showSkillModal(skill, p) {
  $("#skill-name").textContent = skill.name;
  $("#skill-desc").textContent = skill.desc;
  $("#skill-modal").classList.remove("hidden");
  $("#skill-modal .btn").onclick = () => {
    $("#skill-modal").classList.add("hidden");
    applySkill(skill, p, null);
  };
  if (p.isAI) {
    setTimeout(() => {
      $("#skill-modal").classList.add("hidden");
      applySkill(skill, p, null);
    }, 1600);
  }
}

function applySkill(skill, p, target) {
  switch (skill.type) {
    case "stealCard": {
      const t = target || pickRandomOther(p);
      if (t && t.cards > 0) { t.cards--; p.cards++; log(`${p.name} 抽走了 ${t.name} 1 张能量卡。`); }
      else log(`${p.name} 使用技能，但没有可偷的卡。`);
      break;
    }
    case "targetRollMod": {
      const t = target || pickRandomOther(p);
      t.rollMod = (t.rollMod || 0) + skill.n;
      log(`${p.name} 让 ${t.name} 下次掷骰点数减少 ${Math.abs(skill.n)}。`);
      break;
    }
    case "stealFromRandom2": {
      const others = G.players.filter(x => x.id !== p.id && !x.finished);
      shuffle(others).slice(0, 2).forEach(t => {
        if (t.cards > 0) { t.cards--; p.cards++; }
      });
      log(`${p.name} 随机抽取 2 名玩家的能量卡。`);
      break;
    }
    case "swapWithTarget": {
      const t = target || pickRandomOther(p);
      const tmp = p.pos; p.pos = t.pos; t.pos = tmp;
      log(`${p.name} 与 ${t.name} 互换了位置。`);
      break;
    }
    case "rollAgain":
      log(`${p.name} 获得再掷一次机会。`);
      G.phase = "playing";
      Sound.skill();
      if (G.mode === "online") { save(); renderAll(); return; }
      setTimeout(() => (G.mode === "solo" && p.isAI ? aiRoll() : rollDice()), 400);
      return;
    case "advanceN":
      log(`${p.name} 沿时空隧道前进 ${skill.n} 步。`);
      movePlayer(p, skill.n, true);
      break;
    case "shield":
      p.shield = true;
      log(`${p.name} 获得护身符，可抵消一次后退。`);
      break;
    case "fiftyFifty":
      p.fifty = true;
      log(`${p.name} 下次答题将去掉两个错误选项。`);
      break;
    case "doublePoints":
      p.doubleNext = true;
      log(`${p.name} 下次答对积分翻倍。`);
      break;
    case "skipTarget": {
      const t = target || pickRandomOther(p);
      t.skip = true;
      log(`${p.name} 让 ${t.name} 暂停一轮。`);
      break;
    }
    case "removeOneWrong":
      p.removeOne = true;
      log(`${p.name} 下次答题将去掉一个错误选项。`);
      break;
    case "swapWithLeader": {
      const leaders = G.players.filter(x => x.id !== p.id && !x.finished);
      if (leaders.length) {
        const leader = leaders.reduce((a, b) => a.pos > b.pos ? a : b);
        const tmp = p.pos; p.pos = leader.pos; leader.pos = tmp;
        log(`${p.name} 与领先者 ${leader.name} 互换位置。`);
      }
      break;
    }
    case "gainCard":
      p.cards += skill.n; p.score += skill.n;
      log(`${p.name} 获得 ${skill.n} 张能量卡。`);
      break;
    case "pushBack": {
      const t = target || pickRandomOther(p);
      const np = Math.max(0, t.pos - skill.n);
      t.pos = np;
      log(`${p.name} 把 ${t.name} 推后 ${skill.n} 步。`);
      break;
    }
    case "chaosShift":
      G.players.filter(x => x.id !== p.id).forEach(t => { t.pos = Math.max(0, t.pos - 1); });
      p.pos = Math.min(BOARD.length - 1, p.pos + 1);
      log(`${p.name} 发动乾坤大挪移！`);
      break;
    case "teleportBack":
      p.pos = p.prevPos || 0;
      log(`${p.name} 时光倒流，回到上一位置。`);
      break;
  }
  Sound.skill();
  renderMeeples();
  renderPlayers();
  G.pendingSkill = null;
  endTurn();
}

function pickRandomOther(p) {
  const others = G.players.filter(x => x.id !== p.id && !x.finished);
  return others.length ? others[Math.floor(Math.random() * others.length)] : null;
}

// ============================================================
// 结束
// ============================================================
function endGame() {
  G.phase = "ended";
  renderPlayers();
  const ranked = G.players.slice().sort((a, b) => b.score - a.score);
  G.winner = ranked[0];
  log(`游戏结束！${G.winner.name} 获胜！`);
  Sound.win();
  showWinModal(ranked);
}

function showWinModal(ranked) {
  $("#rank-list").innerHTML = "";
  const medals = ["🥇", "🥈", "🥉", "4"];
  ranked.forEach((p, i) => {
    const item = el("div", "rank-item");
    item.innerHTML = `
      <div class="rank-no">${medals[i] || i + 1}</div>
      <div class="meeple" style="width:1.8em;height:1.8em;border-radius:50%;background:${p.color};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900">${p.name.slice(0, 1)}</div>
      <div style="flex:1;text-align:left"><b>${p.name}</b>${i === 0 ? "（冠军）" : ""}<br><small style="color:#8a6a40">能量卡 ${p.cards} 张 · 积分 ${p.score}</small></div>`;
    $("#rank-list").appendChild(item);
  });
  $("#win-modal").classList.remove("hidden");
}

// ============================================================
// 计时器
// ============================================================
let timerId = null;
function startTimer() {
  stopTimer();
  const fill = $("#timer-fill");
  timerId = setInterval(() => {
    const remain = Math.max(0, G.qDeadline - Date.now());
    const total = (G.phase === "dungeon" ? DUNGEON_TIME : (G.phase === "buzzing" ? BUZZ_TIME : Q_TIME)) * 1000;
    const pct = Math.max(0, (remain / total) * 100);
    fill.style.width = pct + "%";
    fill.classList.toggle("warn", pct < 50);
    fill.classList.toggle("danger", pct < 20);
    if (remain <= 0) {
      stopTimer();
      onTimeout();
    }
  }, 150);
}
function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }

function onTimeout() {
  if (G.phase === "buzzing") { onlineBuzzTimeout(); return; }
  if (G.phase === "question" || G.phase === "answering") {
    const p = G.phase === "question" ? currentPlayer() : playerById(G.buzzer);
    log(`${p ? p.name : "玩家"} 答题超时。`);
    Sound.wrong();
    document.querySelectorAll("#options .option").forEach(b => { b.disabled = true; if (+b.dataset.i === G.q.a) b.classList.add("correct"); });
    showExplain();
    setTimeout(() => { closeQuestionModal(); afterQuestion(); }, 2200);
  } else if (G.phase === "dungeon") {
    const p = currentPlayer();
    document.querySelectorAll("#options .option").forEach(b => { b.disabled = true; if (+b.dataset.i === G.q.a) b.classList.add("correct"); });
    showExplain();
    setTimeout(() => { $("#q-modal").classList.add("hidden"); dungeonFail(); }, 1800);
  }
}

// ============================================================
// UI 事件绑定
// ============================================================
function bindUI() {
  $("#btn-solo").onclick = () => { showSoloSetup(); };
  $("#btn-online").onclick = () => { showOnlineSetup(); };
  $("#roll-btn").onclick = rollDice;
  $("#sound-btn").onclick = () => {
    muted = !muted;
    $("#sound-btn").textContent = muted ? "🔇" : "🔊";
    if (!muted) Sound.unlock();
  };
  $("#back-menu").onclick = () => location.reload();
  $("#replay-btn").onclick = () => location.reload();
  $("#win-close").onclick = () => $("#win-modal").classList.add("hidden");
}

function showSoloSetup() {
  $("#menu").classList.add("hidden");
  $("#solo-setup").classList.remove("hidden");
  let diff = 0.55;
  document.querySelectorAll("#diff-row button").forEach(b => {
    b.onclick = () => {
      document.querySelectorAll("#diff-row button").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      diff = { "easy": 0.4, "normal": 0.55, "hard": 0.7 }[b.dataset.d];
    };
  });
  $("#start-solo-btn").onclick = () => {
    const name = $("#solo-name").value.trim() || "我";
    startSolo(name, diff);
  };
  $("#solo-back").onclick = () => location.reload();
}

// ============================================================
// 在线模式占位（由 multiplayer.js 覆盖）
// ============================================================
function showOnlineSetup() { onlineShowSetup(); }
function onlineBuzzTimeout() {}
function onlineAfterQuestion() {}
function onlineShowSetup() {}

// ============================================================
// 启动
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  // 标记 JS 已成功执行（灰色=没跑起来，绿色=正常）
  const ver = document.getElementById("ver");
  if (ver) { ver.textContent = "v2 ✓已就绪"; ver.style.background = "#2f9e63"; }
  bindUI();
  renderBoard();
  renderPlayers();
  // 预渲染空棋盘供菜单背景
});
