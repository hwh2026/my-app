// ============================================================
// 《历史通关棋》棋盘数据 —— 61 格历史时间轴
// dynasty 键值对应题库分类，用于"跟随朝代抽题"
// effect 为空 = 普通事件格；非空 = 该格附带机关
// ============================================================

window.DYNASTY_NAMES = {
  pre:    "史前时期",
  xsz:    "夏商周·春秋战国",
  qh:     "秦汉",
  sgnb:   "三国两晋南北朝",
  st:     "隋唐",
  sy:     "宋元",
  mq:     "明清",
  modern: "近现代"
};

window.BOARD = [
  { name: "出发",                 year: "",            dynasty: "pre", effect: null },

  // ---------- 史前时期 ----------
  { name: "元谋人",               year: "约170万年前",  dynasty: "pre", effect: null },
  { name: "北京人",               year: "约70万年前",   dynasty: "pre", effect: null },
  { name: "山顶洞人",             year: "约3万年前",    dynasty: "pre", effect: null },
  { name: "涿鹿之战",             year: "约4700年前",   dynasty: "pre", effect: { type: "drawQ" } },
  { name: "大禹治水",             year: "约前2070年",   dynasty: "pre", effect: null },

  // ---------- 夏商周 · 春秋战国 ----------
  { name: "夏朝建立",             year: "约前2070年",   dynasty: "xsz", effect: null },
  { name: "商朝建立",             year: "约前1600年",   dynasty: "xsz", effect: { type: "drawQ" } },
  { name: "武王伐纣",             year: "前1046年",     dynasty: "xsz", effect: null },
  { name: "烽火戏诸侯",           year: "前771年",      dynasty: "xsz", effect: { type: "move", n: -3 } },
  { name: "东周开始",             year: "前770年",      dynasty: "xsz", effect: { type: "dungeon", key: "dongzhou" } },
  { name: "春秋争霸",             year: "前770-476年",  dynasty: "xsz", effect: null },
  { name: "孙子兵法",             year: "春秋末期",     dynasty: "xsz", effect: { type: "drawSkill" } },
  { name: "战国七雄",             year: "前475-221年",  dynasty: "xsz", effect: null },
  { name: "秦灭六国",             year: "前221年",      dynasty: "xsz", effect: { type: "drawQ" } },

  // ---------- 秦汉 ----------
  { name: "车同轨 书同文",        year: "前221年",      dynasty: "qh", effect: null },
  { name: "焚书坑儒",             year: "前213年",      dynasty: "qh", effect: { type: "move", n: -2 } },
  { name: "大泽乡起义",           year: "前209年",      dynasty: "qh", effect: null },
  { name: "秦朝灭亡",             year: "前207年",      dynasty: "qh", effect: { type: "drawSkill" } },
  { name: "西汉建立",             year: "前202年",      dynasty: "qh", effect: { type: "dungeon", key: "xihan" } },
  { name: "文景之治",             year: "前180-141年",  dynasty: "qh", effect: { type: "drawQ" } },
  { name: "张骞出使西域",         year: "前138年",      dynasty: "qh", effect: null },
  { name: "王莽篡汉",             year: "公元9年",      dynasty: "qh", effect: { type: "move", n: -4 } },
  { name: "东汉建立",             year: "公元25年",     dynasty: "qh", effect: null },
  { name: "蔡伦改进造纸术",       year: "公元105年",    dynasty: "qh", effect: { type: "drawQ" } },
  { name: "张衡发明地动仪",       year: "公元132年",    dynasty: "qh", effect: null },

  // ---------- 三国两晋南北朝 ----------
  { name: "官渡之战",             year: "公元200年",    dynasty: "sgnb", effect: { type: "drawSkill" } },
  { name: "赤壁之战",             year: "公元208年",    dynasty: "sgnb", effect: null },
  { name: "曹丕建魏",             year: "公元220年",    dynasty: "sgnb", effect: { type: "dungeon", key: "sanguo" } },
  { name: "刘备称帝",             year: "公元221年",    dynasty: "sgnb", effect: { type: "drawQ" } },
  { name: "魏国灭蜀",             year: "公元263年",    dynasty: "sgnb", effect: { type: "move", n: -2 } },
  { name: "西晋建立",             year: "公元266年",    dynasty: "sgnb", effect: null },
  { name: "东晋建立",             year: "公元317年",    dynasty: "sgnb", effect: null },
  { name: "北魏孝文帝改革",       year: "公元494年",    dynasty: "sgnb", effect: { type: "dungeon", key: "nanbeichao" } },

  // ---------- 隋唐 ----------
  { name: "隋朝建立",             year: "公元581年",    dynasty: "st", effect: { type: "drawSkill" } },
  { name: "隋灭陈",               year: "公元589年",    dynasty: "st", effect: null },
  { name: "唐朝建立",             year: "公元618年",    dynasty: "st", effect: { type: "dungeon", key: "tang" } },
  { name: "玄武门之变",           year: "公元626年",    dynasty: "st", effect: null },
  { name: "玄奘取经",             year: "公元627年",    dynasty: "st", effect: { type: "drawQ" } },
  { name: "女皇武则天",           year: "公元690年",    dynasty: "st", effect: null },
  { name: "安史之乱",             year: "公元755年",    dynasty: "st", effect: { type: "move", n: -5 } },
  { name: "朱温篡唐",             year: "公元907年",    dynasty: "st", effect: { type: "drawSkill" } },

  // ---------- 宋元 ----------
  { name: "陈桥兵变",             year: "公元960年",    dynasty: "sy", effect: { type: "dungeon", key: "beisong" } },
  { name: "纸币交子",             year: "公元1023年",   dynasty: "sy", effect: { type: "drawQ" } },
  { name: "活字印刷术",           year: "公元11世纪",   dynasty: "sy", effect: null },
  { name: "靖康之变",             year: "公元1127年",   dynasty: "sy", effect: { type: "move", n: -3 } },
  { name: "岳飞抗金",             year: "南宋",         dynasty: "sy", effect: { type: "drawQ" } },
  { name: "元朝建立",             year: "公元1271年",   dynasty: "sy", effect: null },
  { name: "红巾军起义",           year: "公元1351年",   dynasty: "sy", effect: { type: "drawSkill" } },

  // ---------- 明清 ----------
  { name: "明朝建立",             year: "公元1368年",   dynasty: "mq", effect: { type: "dungeon", key: "ming" } },
  { name: "郑和下西洋",           year: "公元1405年",   dynasty: "mq", effect: { type: "drawQ" } },
  { name: "本草纲目",             year: "公元1553年",   dynasty: "mq", effect: null },
  { name: "清朝建立",             year: "公元1636年",   dynasty: "mq", effect: null },
  { name: "郑成功收复台湾",       year: "公元1662年",   dynasty: "mq", effect: { type: "drawQ" } },
  { name: "虎门销烟",             year: "公元1839年",   dynasty: "mq", effect: { type: "drawSkill" } },
  { name: "鸦片战争",             year: "公元1840年",   dynasty: "mq", effect: { type: "move", n: -3 } },

  // ---------- 近现代 ----------
  { name: "中日甲午战争",         year: "公元1894年",   dynasty: "modern", effect: { type: "drawQ" } },
  { name: "辛亥革命",             year: "公元1911年",   dynasty: "modern", effect: { type: "dungeon", key: "minguo" } },
  { name: "共产党成立",           year: "公元1921年",   dynasty: "modern", effect: { type: "drawSkill" } },
  { name: "抗日战争胜利",         year: "公元1945年",   dynasty: "modern", effect: { type: "drawQ" } },
  { name: "中华人民共和国成立",   year: "1949年10月1日",dynasty: "modern", effect: null },

  { name: "终点",                 year: "",            dynasty: "modern", effect: null }
];

// 副本（黄色格）名称与进入提示
window.DUNGEON_NAMES = {
  dongzhou:    "东周副本",
  xihan:       "西汉副本",
  sanguo:      "三国副本",
  nanbeichao:  "南北朝副本",
  tang:        "唐朝副本",
  beisong:     "北宋副本",
  ming:        "明朝副本",
  minguo:      "中华民国副本"
};
