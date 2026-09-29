// ============================================================
// 《历史通关棋》技能卡 —— 16 张
// 前 4 张为原版卡（忠实还原 PDF 可读内容），其余为补齐卡
// type 决定游戏引擎如何结算效果
// ============================================================

window.SKILLS = [
  // ---- 原版卡（PDF 可读）----
  { id: "steal",      name: "抽取对方一张能量卡", desc: "指定一名对手，随机抽走他 1 张能量卡",
    type: "stealCard" },
  { id: "rollMinus",  name: "点数减三",           desc: "指定一名玩家，他下一次掷骰点数减少 3 点",
    type: "targetRollMod", n: -3 },
  { id: "steal2",     name: "随机抽取2名玩家",     desc: "随机抽 2 名对手，各拿走他们 1 张能量卡",
    type: "stealFromRandom2" },
  { id: "swap",       name: "互换位置",           desc: "指定一名玩家，双方棋子位置互换",
    type: "swapWithTarget" },

  // ---- 补齐卡 ----
  { id: "rollAgain",  name: "再掷一次",           desc: "立刻再掷一次骰子",
    type: "rollAgain" },
  { id: "advance3",   name: "时空隧道·前进5步",    desc: "沿着时间轴前进 5 步",
    type: "advanceN", n: 5 },
  { id: "shield",     name: "护身符",             desc: "获得护盾，抵消下一次后退惩罚",
    type: "shield" },
  { id: "fifty",      name: "锦囊妙计·去二",       desc: "下次答题时去掉两个错误选项",
    type: "fiftyFifty" },
  { id: "double",     name: "积分翻倍",           desc: "下次答对题目，积分翻倍",
    type: "doublePoints" },
  { id: "skip",       name: "定身术",             desc: "指定一名玩家，暂停一轮",
    type: "skipTarget" },
  { id: "hint",       name: "锦囊妙计·去一",       desc: "下次答题时去掉一个错误选项",
    type: "removeOneWrong" },
  { id: "swapLeader", name: "后来居上",           desc: "与最靠前的玩家互换位置",
    type: "swapWithLeader" },
  { id: "gain",       name: "天降卡牌",           desc: "直接获得 1 张知识能量卡",
    type: "gainCard", n: 1 },
  { id: "pushBack",   name: "推波助澜",           desc: "指定一名玩家，后退 3 步",
    type: "pushBack", n: 3 },
  { id: "chaos",      name: "乾坤大挪移",         desc: "其余玩家各后退 1 步，你前进 1 步",
    type: "chaosShift" },
  { id: "rewind",     name: "时光倒流",           desc: "回到你上一回合所在的位置",
    type: "teleportBack" }
];
