// ==UserScript==
// @name         广外抢课助手（接口版）
// @namespace    local.gdufs-grabber-api
// @version      7.8.0
// @updateURL    https://github.com/ykykztr/gdufs-course-grabber/releases/latest/download/gdufs-grabber.user.js
// @downloadURL  https://github.com/ykykztr/gdufs-course-grabber/releases/latest/download/gdufs-grabber.user.js
// @homepageURL  https://github.com/ykykztr/gdufs-course-grabber
// @description  广外强智选课页自动盯盘（接口直连版）。后台拉全量课程，页面不动；支持按类别抢、多时段全抢、轮次自动进入。
// @author       ykykztr
// @match        *://jwxt.gdufs.edu.cn/*
// @match        *://*.gdufs.edu.cn/jsxsd/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

/* ==================================================================
   控制台命令（任意 frame，结果一致）
     GRAB.debug()    表头 / 认列 / 每行解析
     GRAB.where()    状态总览
     GRAB.facts()    ★ DataTables 真相：是否服务器端分页 / 总记录数 / 每页条数
     GRAB.filters()  列出页面所有筛选控件
     GRAB.cache()    已收集到的全部课程
     GRAB.sweep()    手动跑一次翻页扫描
     GRAB.catRound() 手动跑一次类别轮询
     GRAB.catState() 各类别抓到了多少门
     GRAB.setCat("类别名")  直接切换页面的通选课类别下拉框
     GRAB.net()      最近的网络请求（含接口地址与参数）
     GRAB.enter("关键字")  在轮次列表页进入指定轮次
     GRAB.report()   完整状态（复制到剪贴板）

   v3.0.0 关键变化（接口直连 —— 页面完全不动）：
     ★★★ 列表改走接口：POST /jsxsd/xsxkkc/xsxkGgxxkxk
           query: kcxx skls skxq skjc endJc sfym sfct szjylb sfxx skfs kctype
           body : sEcho iColumns iDisplayStart iDisplayLength(可改!) mDataProp_0..11
           响应: { aaData:[完整课程对象], iTotalRecords, iDisplayTotalRecords }
           —— aaData 里直接有 kch/kcmc/xf/skls/sksj/skdd/xqmc/syrs/ctsm/jx0404id/jx02id/cfbs
     ★★★ 提交改直连：POST /jsxsd/xsxkkc/ggxxkxkOper?kcid=<jx02id>&cfbs=<cfbs>
           body: jx0404id=&xkzy=&trjf=&sfsyjc=  → { success, message }
           —— 不弹窗、不阻塞、也不碰页面（页面 xsxkOper 里有 debugger;，F12 开着会断住）
     ★ 类别代码从 #szjylb 的 option.value 现读（自然科学13/人文科学11/社科12/艺术26/通识特色27）
     ★ 数据不再受"当前页/当前类别"限制：接口一次拉全，跨类别跨页同时盯
     ★ 落位、类别轮询、翻页扫描全部变成兜底（DOM 模式仍保留，可关 api.enabled 回退）

   v2.3.0 关键变化（修正一个方向性错误）：
     ★★ 找到目标后，页面要切到【目标所在的类别】并停在那儿，不是切回你原来在看的类别。
        我上一版搞反了 —— 把"停在自然科学（原类别）"当成了修复成功。
        实际影响很大：停在目标类别时常规刷新 3.6 秒一次；停在别的类别，目标数据只能靠
        低频轮询刷新（几分钟）—— 差 50 倍，等于盯着一个没有目标的类别。
     ★ 落位后【彻底停止轮询】：目标都在同一类别且页面已在位时，常规刷新 + 翻页扫描足够，
        页面完全不再跳（这才是真正的"不折腾"）
     ★ 修一个结构错误：落位判断不能连"类别命中检查"一起跳过，否则勾选的类别永远不抢

   v2.2.0 关键变化（修等待页面无面板 + 状态说谎 + 乱跳）：
     ★★ 等待页面也能出面板：闸门改成"有课程表【或】有 jrxk 轮次入口"都放行；
        boot2 不再因为没有课程表就提前返回（那样连 S().api 都不注册，按钮全死）
     ★ 轮次去重：LayUI 把同一行渲染多份（主表 + 固定列），按 jrxk 参数归并，
       保留格子最多的那份 —— 之前同一个轮次会显示两次，第二次还是"(未命名)"
     ★ 状态栏说实话：显示【页面当前是哪个类别】【勾选了什么】【数据是什么时候抓的】
       —— 以前只显示缓存里的统计，页面明明在自然科学却显示"人文科学 40门"
     ★ 类别表状态修正：没在运行时显示"未运行/已停止"，不再谎报"盯盘中"
     ★ 减少乱跳：搜索期 24 秒一轮，找到目标后的维持期改成 3 分钟一轮

   v2.1.0 关键变化：
     ★★ 目标所在类别【持续刷新】—— 修用户实测发现的真 bug：
        全类别搜索找到目标后就停了，catRows 那份数据永远停在"找到那一刻"，
        别的类别里有人退课也看不见 → 现在记录"目标命中过哪些类别"，
        这些类别每轮都重新扫，名额变化能持续看到
     ★ 新增「选课轮次」区块（等待页面 xklc_list 用）：自动识别轮次表，
        解析开放时间算状态（未开放倒计时 / 开放中 / 已结束），
        支持「一键进入选课」和「到点自动进」—— 到点自动点 jrxk()，
        进入后自动恢复队列并开抢
     ★ 面板按当前页面的能力显示区块：有课程表显示监控区，有轮次表显示轮次区

   v2.0.0 关键变化（终于找对了根本原因）：
     ★★★ 引擎从"表格所在 frame"搬到【最外层同源 frame（顶层）】。
           事实：切 tab 时顶层 frame（newXsxkzx）根本不刷新，换的只是里面的 iframe；
           以前引擎住在表格 frame 里，那个 frame 每次切 tab 都被销毁重建，
           面板（在顶层）与引擎（在子 frame）生命周期错位 → 僵尸面板。
           放顶层后引擎永不销毁，面板与它同生共死，整类问题从根上消失。
     ★ 类别轮询不再无限跑：找到目标即停；全类别最多搜 maxSearchRounds 圈就放弃；
       每轮结束【切回用户原本在看的类别】，不再抢走浏览视图
     ★ 队列目标展开显示：每个目标下列出它匹配到的所有教学班（教师/时间/余量/状态），
       "一门课两个时段"看得见，不会再以为"第二个没进队"
     ★ tick 每轮重新挂钩子（切 tab 后表格 frame 是新的）

   v1.9.0 关键变化（修"切 tab 后永久僵死"+"按名字搜不到"）：
     1. ★★ 启动重试循环：新页面表格是 JS 后渲染的，document-idle 时常常还没有 →
        第一次闸门失败；而旧的 2.5 秒补试条件写成"没有面板才重试"，
        屏幕上正好残留旧面板时反而跳过 → 新引擎永远起不来。
        现在改成"本 frame 还不是活引擎就每秒重试，最多 20 次"
     2. ★★ 类别轮询的触发条件补上"队列里有没找到的课" ——
        以前只有勾了「类别抢课」才轮询，所以手动输入课程名时既不翻类别也找不到
     3. ★ 手动输入后立刻触发一轮全类别搜索，不用等轮询周期
     4. 面板顶部显示「🔍 搜索中 N 门」

   v1.8.0 关键变化（修三个实测 bug）：
     1. ★ 面板按钮改为"转发给当前引擎"：不再直接绑定本 frame 的函数。
        切 tab 后即使面板没被重建，只要新引擎注册过 S().api 就照样能用
     2. ★ 删空队列自动停止（原来删完还在空转）
     3. ★ 手动锁定课程名时自动轮询【全部类别】去找它 ——
        不用维护"课程名→类别"映射表，5 次请求就能找到
     4. probe/认表跳过自己面板里的表；category 兜底改 null
        （选修 12 列布局里 index 9 是"剩余容量"，当类别读会出错）

   v1.7.0 关键变化（修"切 tab 面板就坏"）：
     1. ★ 僵尸面板修复：面板存在顶层文档，但 iframe 换 tab 后旧引擎被销毁，
        面板按钮指向已死的 window → 点了没反应。现在给面板打 __owner__ 标记 +
        引擎心跳，新引擎起来立刻拆掉重建
     2. ★ 自动认表：不再写死 #dataView，改成给每张表按表头打分挑最像课程表的一张。
        必修/选修如果换了表格 id 也能认出来
     3. ★ GRAB.probe()：一键导出当前 tab 的全部 frame/表格/控件/函数，用来适配新 tab
     4. 面板精简：翻页扫描/展开全部行/诊断/网络 收进「⚙ 高级工具」折叠区

   v1.6.0 关键变化（据 09-18 实测：翻页扫描 3 页收到 28 条，通过）：
     1. ★ 类别抢课改为【按类别轮询】：轮流把页面 #szjylb 切到勾选的类别 →
        触发查询 → 翻页扫完该类别 → 得到该类别【全部】课程。
        这样"有名额"计数才是全量的，不受当前页 10 条限制。
        类别匹配用【精确匹配】（人文科学 vs 人文科学（艺术审美课程）是包含关系）
     2. ★ 抢到后三重提醒：桌面通知 + 蜂鸣 + 标题闪烁 + 面板绿框
     3. ★ 类别模式抢到 1 门即停（通识课只能选一门），不再做"抢 N 门就停"设置
     4. 面板加类别监控表：每个类别的课程数 / 有名额数 / 状态（★可抢 自动标绿）
   ================================================================== */
const CFG = {

  urlKeyword: "/jsxsd/xsxk/",
  tableId: "dataView",

  refreshFn: "queryKxkcList",
  refreshBtn: 'button[onclick*="queryKxkcList"]',

  submitFn: "xsxkFun",
  submitArgsRegex: /xsxkFun\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/,

  //   公选课 11 列：0编号 1名称 2学分 3教师 4时间 5地点 6校区 7余量 8冲突 9类别 10操作
  //   选修课 12 列：0编号 1名称 2分组名 3合班名 4学分 5教师 6时间 7地点 8校区 9余量 10冲突 11操作
  //   → category 兜底必须是 null，否则在选修 tab 会把"剩余容量"当类别读
  col: { code: 0, name: 1, teacher: 3, time: 4, remain: [7], status: 8, category: null },

  head: {
    code: /课程编号|课程代码|课程号/,
    name: /^课程名称|^课程名/,
    // ★ 分组名 / 课堂名 / 单位：必修课表有这三列，而课程名常常重名
    //   （用户实测：一堆都叫「体育(3)」，真正区分的是分组名，如「啦啦操」「篮球」）
    //   以前没认这三列 → DOM 行的"抢"按钮只能拿课程名当 key → 分不开班
    group: /分组名|^分组$|分组名称/,
    classroom: /课堂名|^课堂$|教学班名|合班名/,
    unit: /开课单位|^单位$|院系|学院/,
    teacher: /教师|老师|任课/,
    time: /上课时间/,
    place: /上课地点/,
    campus: /上课校区|^校区/,
    remain: /剩余容量|余量|剩余名额|可选人数/,
    status: /冲突|状态/,
    category: /通选课类别|课程类别|^类别$|模块/,
    action: /操作/
  },

  word: {
    conflict: "冲突",
    noConflict: "无冲突",
    selected: ["退课", "退选", "已选"],
    success: "成功",
    confirm: ["确定", "确认", "是", "OK"]
  },

  pollMs: 1200,
  refreshEvery: 3,
  // ★ v7.1 统一队列：队列项带 kind（通识类别 / 必修分组 / 关键词），两个池都刷，
  //   所有未完成项每拍一起匹配（并行盯盘），每拍最多提交一个（串行提交）。
  //   关掉它 = 回到旧的"全局模式 + 类别开关"那套。
  queueMode: true,
  stopAfter: 0,                    // 抢到几门就停；0 = 不限（队列做完才停）。09-19 实测通识可抢多门
  maxFails: 10,
  confirmWaitMs: 4000,
  verifyDelayMs: 1200,
  abortOnCaptcha: true,
  useServerCache: true,

  // ---- 翻页扫描 ----
  sweep: {
    enabled: true,
    everyNTicks: 12,   // 每多少拍扫一次全部分页
    maxPages: 40
  },

  // ---- 类别抢课：按类别轮询 ----
  // 轮流把页面的 #szjylb 切到你勾选的类别 → 触发查询 → 翻页扫完该类别 →
  // 得到【该类别全部课程】。这样"有名额"计数才是全量的，不受当前页 10 条限制。
  category: {
    enabled: false,
    match: [],         // 例如 ["人文科学","人文科学（艺术审美课程）"]（全角括号）
    everyNTicks: 20,   // 每多少拍跑一轮完整轮询（20 拍 ≈ 24 秒）
    settleMs: 800,     // 切换类别后等多久让表格重绘
    // 手动输入课程名时，不知道它在哪个类别 → 轮询全部类别去找它（5 次请求）
    // 这样就不用维护"课程名→类别"的映射表了
    scanAllWhenSearching: true,
    maxSearchRounds: 3,   // 全类别搜索最多轮几圈，超过就放弃（避免无限折腾页面）
    keepEveryNTicks: 150, // 找到目标后，维持刷新目标类别的间隔（150 拍 ≈ 3 分钟，别老跳页面）
    // ★ 找到目标后要不要把页面切到【目标所在的类别】并停在那儿。
    //   为什么重要：停留在目标类别时，常规刷新（每 3.6 秒）+ 翻页扫描保证数据新鲜；
    //   如果停在别的类别，目标那份数据只能靠低频轮询（几分钟一次）刷新 —— 差 50 倍。
    followTarget: true
  },

  // ---- 抢到后的提醒 ----
  notify: {
    desktop: true,     // 桌面通知（首次会请求权限）
    sound: true,       // 蜂鸣
    flashTitle: true   // 标签页标题闪烁
  },

  // ---- ★ 接口直连（v3.0 核心）----------------------------------------
  // 实测拿到的接口（见 logs/2026-09-18.md）：
  //   列表 POST /jsxsd/xsxkkc/xsxkGgxxkxk?<query>  body: DataTables 分页参数
  //        响应 { aaData:[完整课程对象], iTotalRecords, ... }，iDisplayLength 可改
  //   提交 POST /jsxsd/xsxkkc/ggxxkxkOper?kcid=<jx02id>&cfbs=<cfbs>
  //        body: jx0404id=&xkzy=&trjf=&sfsyjc=   响应 { success, message }
  // 注意：不要调页面的 xsxkOper —— 它里面有 debugger;，F12 开着时会断住
  api: {
    enabled: true,          // 总开关；关掉就回到纯 DOM 模式
    listUrl: "/jsxsd/xsxkkc/xsxkGgxxkxk",
    submitUrl: "/jsxsd/xsxkkc/ggxxkxkOper",
    // 每页要多少条（给大值就不会被分页截断；服务端不认会自动退化成翻页拉取）
    pageSize: 500,
    maxPages: 30,
    // 拉取哪些类别：null = 用页面 #szjylb 的全部选项；也可以填 ["人文科学","自然科学"]
    categories: null,
    // 多久整体刷新一次（毫秒）。接口很快，可以比 DOM 模式密
    refreshMs: 3000,
    // 列表参数里几个过滤开关（false = 不过滤，能看到满员/冲突的课）
    // ★ 搜索阶段要【全量】：服务端过滤（冲突/限选）会把同门课的其他教学班一起滤掉，
    //   表现就是"输入世界只能搜出 4 个"。冲突/已选的判断改在客户端做（tick 里本来就跳）。
    filterFull: false,      // sfym
    filterConflict: false,   // sfct —— 冲突课本来也选不了，过滤掉省事
    filterLimited: false,     // sfxx
    // ★ 必修课选课（用户 09-18 实测抓包）：
    //   列表 POST /jsxsd/xsxkkc/xsxkBxxk?1=1&kcxx=&skls=&skfs=   13 列，响应同结构
    //   ⏳ 提交 endpoint 未抓到 —— 必修先只读（GRAB.bxList() 看余量），提交留给"点页面按钮"那条路
    bxUrl: "/jsxsd/xsxkkc/xsxkBxxk",
    // ★ 必修提交（用户 09-18 抓到的真实请求，200 + 真响应）：
    //   /jsxsd/xsxkkc/bxxkOper?kcid=<jx02id>&cfbs=null
    //   body: jx0404id=...&xkzy=&trjf=&sfsyjc=&sfkv（比通识多一个 sfkv）
    bxSubmitUrl: "/jsxsd/xsxkkc/bxxkOper",
    bxFields: ["kch", "kcmc", "dwmc", "fzmc", "ktmc", "xf", "skls", "sksj", "skdd", "xqmc", "syrs", "ctsm", "czOper"]
  },

  preArmMs: 5000,                 // 定时开抢：提前多久先 start()
  roundsWatchMs: 3000,            // 🛰 守候轮次：多久重查一次轮次列表（并点页面「查询」刷新）；
                                  //    轮次一渲染出来还有 DOM 观察器兜底，所以这个间隔只决定"多久点一次查询"
  enterLeadMs: 20000,             // ★ 轮次页：提前多少毫秒点「进入选课」（到点才进就来不及了）
  // ★ 接口优先：进了轮次就直接发接口抢，不必非切到「公选课选课」标签。
  //   依据：列表/提交都是同源 XHR，服务端认的是 session 里的轮次上下文，不认你在哪个标签页。
  //   ⏳ 未实测：若服务端其实要求页面上下文，把它设成 false 就会先切标签再抢。
  apiFirst: true,
  // 面板分版：auto = 等待页精简（只留轮次+类别+一条龙），选课页给全套；也可强制 "rounds"/"full"
  panelLayout: "auto",
  mode: "gg",                     // gg = 通识抢课（类别包圆）/ bx = 必修抢课（点页面按钮提交）
  panelEverywhere: true,          // ★ 进轮次后会先落在「选课学分情况」页 —— 那页也要出面板，
                                  //   否则待命状态看不见、也没法再操作（用户实测提的）
  tabKeywords: ["公选课选课", "公共选修", "公选课", "通识选修"],   // 进入后要自动切到的标签名
  burstPollMs: 350,
  burstDurationMs: 60000
};

(function () {
  "use strict";

  const W = window;
  const K_QUEUE = "__GRAB_QUEUE__";
  const BTN_CLASS = "grab-inline-btn";
  const PANEL_ID = "grab-ui";
  const VERSION = "7.8.0";

  function topHost() {
    let w = W;
    for (let i = 0; i < 10; i++) {
      let p;
      try { p = w.parent; } catch (e) { break; }
      if (!p || p === w) break;
      let d = null;
      try { d = p.document; } catch (e) { break; }
      if (!d || !d.body) break;
      w = p;
    }
    try { return { win: w, doc: w.document }; } catch (e) { return { win: W, doc: document }; }
  }

  let SH = null;
  function S() {
    if (SH) return SH;
    const blank = function () {
      return {
        queue: [], running: false, tickNo: 0, lastMsg: "", submitResult: [],
        allRows: [], cacheStamp: 0, state: {}, netLog: [], engineFrame: "",
        pagedRows: [], pagedStamp: 0, sweepBusy: false,
        catRows: {}, catStamp: 0, catBusy: false, catFail: [],
        searching: false, searchRounds: 0, snapAll: [],
        targetCats: {}, catOf: {}, rounds: [], enterTimer: null, armTimer: null, arm: null, catMap: {},
        apiRows: [], apiStamp: 0, apiBusy: false, apiErr: "", apiTimer: null, apiCount: 0,
        tableId: "", autoTable: null, engineAt: 0, engineFrameUrl: "",
        timer: null, burstTimer: null, burstUntil: 0, scheduleTimer: null, scheduleAt: 0
      };
    };
    let holder = W;
    try { holder = topHost().win; } catch (e) {}
    try {
      if (!holder.__GRAB_SHARED__) holder.__GRAB_SHARED__ = blank();
      SH = holder.__GRAB_SHARED__;
    } catch (e) {
      if (!W.__GRAB_SHARED__) W.__GRAB_SHARED__ = blank();
      SH = W.__GRAB_SHARED__;
    }
    return SH;
  }

  function st(id) {
    const m = S().state;
    if (!m[id]) m[id] = { fails: 0, success: false, selecting: false };
    return m[id];
  }

  // ★ 面板所在的文档记在共享状态里，这样即使本 frame 已被销毁，
  //   界面函数依然能写到顶层面板上（切 tab 后老引擎仍能显示错误信息）
  function hostDoc() {
    try { if (S().panelDoc) return S().panelDoc; } catch (e) {}
    try { return topHost().doc; } catch (e) { return document; }
  }

  function panelNote(msg, kind) {
    try {
      const d = hostDoc();
      const box = d.getElementById("grab-log");
      if (!box) return;
      const line = d.createElement("div");
      line.textContent = msg;
      if (kind === "err") line.style.color = "#f87171";
      else if (kind === "ok") line.style.color = "#4ade80";
      box.appendChild(line);
      box.scrollTop = box.scrollHeight;
      while (box.children.length > 40) box.removeChild(box.firstChild);
    } catch (e) {}
  }

  // ★ 面板按钮全部经此转发：面板在顶层、引擎在 iframe，切 tab 会销毁旧引擎。
  //   新引擎注册 S().api 之后，连"老面板"也能继续用 —— 不再依赖面板被重建
  function callEngine(name, arg) {
    let api = null, age = 1e9;
    try { api = S().api; age = Date.now() - (S().engineAt || 0); } catch (e) {}
    if (!api || age > 8000) {
      panelNote("引擎未就绪或已断开 —— 切到选课列表 tab；或在控制台运行 GRAB.revive()", "err");
      return;
    }
    try {
      if (typeof api[name] === "function") { api[name](arg); return; }
      // ★ 回退到 GRAB 对象：S().api 只注册了一部分方法，新加的功能常常只挂在 GRAB 上 →
      //   以前这里直接报「引擎没有这个方法」，面板按钮就成了死按钮（v5.8 的「重找轮次」就是）。
      //   用 typeof 判存在，标识符不存在也不会抛。
      if (typeof GRAB !== "undefined" && GRAB && typeof GRAB[name] === "function") { GRAB[name](arg); return; }
      panelNote("引擎没有这个方法：" + name, "err");
    } catch (e) {
      panelNote("调用 " + name + " 失败：" + (e && e.message), "err");
    }
  }

  /* ============ 定位 ============ */

  // ★ 当前生效的表格 id（自动发现的优先）
  function tid() { return S().tableId || CFG.tableId; }

  // ★ 给一张表打分，判断它像不像"课程列表"
  function scoreTable(t) {
    let score = 0;
    try {
      const hs = Array.from(t.querySelectorAll("thead th")).map(function (th) { return norm(th.textContent); });
      const join = hs.join("|");
      if (/课程编号|课程代码|课程号/.test(join)) score += 10;
      if (/课程名称|课程名/.test(join)) score += 6;
      if (/教师|老师|任课/.test(join)) score += 3;
      if (/剩余容量|余量|剩余名额/.test(join)) score += 4;
      if (/操作/.test(join)) score += 2;
      if (hs.length >= 5) score += 2;
      const rows = t.querySelectorAll("tbody tr").length;
      if (rows > 0) score += Math.min(rows, 20);
      if (/节次|第一大节|星期一|星期二/.test(join)) score -= 60;   // 课表网格，排除
      if (hs.length <= 2) score -= 20;                              // 学分统计小表
      try { if (t.closest && t.closest("#" + PANEL_ID)) return -999; } catch (e) {}   // 自己面板里的表
    } catch (e) { return -999; }
    return score;
  }

  // ★ 自动发现课程表格：不再依赖写死的 #dataView，必修/选修换 id 也能认
  function discoverTable() {
    const SH = S();
    const explicit = (function walk(w, d) {
      if (!w || d > 8) return null;
      try { if (w.document && w.document.getElementById(CFG.tableId)) return { doc: w.document }; } catch (e) {}
      try {
        for (let i = 0; i < w.frames.length; i++) { const r = walk(w.frames[i], d + 1); if (r) return r; }
      } catch (e) {}
      return null;
    })(W, 0);
    if (explicit && scoreTable(explicit.doc.getElementById(CFG.tableId)) >= 10) {
      SH.tableId = CFG.tableId;
      SH.autoTable = null;
      return true;
    }

    let best = null;
    (function walk(w, d) {
      if (!w || d > 8) return;
      try {
        if (w.document) {
          const list = w.document.querySelectorAll("table");
          for (const t of list) {
            const s = scoreTable(t);
            if (!best || s > best.score) best = { score: s, el: t, win: w };
          }
        }
      } catch (e) {}
      try { for (let i = 0; i < w.frames.length; i++) walk(w.frames[i], d + 1); } catch (e) {}
      try { for (const f of w.document.querySelectorAll("iframe, frame")) if (f.contentWindow) walk(f.contentWindow, d + 1); } catch (e) {}
    })(W, 0);

    if (best && best.score >= 10) {
      if (!best.el.id) best.el.id = "__grab_table__";
      SH.tableId = best.el.id;
      SH.autoTable = { id: best.el.id, score: best.score };
      log("自动识别到课程表：#" + best.el.id + "（评分 " + best.score + "）", "ok");
      return true;
    }
    SH.tableId = "";
    return false;
  }

  function findCtx() {
    function walk(w, d) {
      if (!w || d > 8) return null;
      try { if (w.document && w.document.getElementById(tid())) return { win: w, doc: w.document }; } catch (e) {}
      try {
        for (let i = 0; i < w.frames.length; i++) { const r = walk(w.frames[i], d + 1); if (r) return r; }
      } catch (e) {}
      try {
        for (const f of w.document.querySelectorAll("iframe, frame")) {
          if (f.contentWindow) { const r = walk(f.contentWindow, d + 1); if (r) return r; }
        }
      } catch (e) {}
      return null;
    }
    try { return walk(W, 0) || { win: W, doc: document, none: true }; }
    catch (e) { return { win: W, doc: document, none: true }; }
  }

  function allDocs() {
    const out = [];
    let root;
    try { root = topHost().win; } catch (e) { root = W; }
    (function walk(w, d) {
      if (!w || d > 8) return;
      try { if (w.document) out.push(w.document); } catch (e) {}
      try { for (let i = 0; i < w.frames.length; i++) walk(w.frames[i], d + 1); } catch (e) {}
    })(root, 0);
    if (out.indexOf(document) < 0) out.push(document);
    return out;
  }

  function resolveTable(ctx) {
    if (!ctx || !ctx.doc || ctx.none) return null;
    const doc = ctx.doc;
    const src = doc.getElementById(tid());
    if (!src) return null;
    let view = null;
    try {
      view = doc.querySelector('.layui-table-view[lay-id="' + tid() + '"]');
      if (!view && src.closest) {
        const wrap = src.closest(".qz-table") || src.parentElement;
        if (wrap) view = wrap.querySelector(".layui-table-view");
      }
      const nx = src.nextElementSibling;
      if (!view && nx && nx.classList && nx.classList.contains("layui-table-view")) view = nx;
    } catch (e) {}
    if (view) return { el: view, kind: "layui", src: src };
    return { el: src, kind: "plain", src: src };
  }

  function rowsOf(t) {
    if (!t) return [];
    if (t.kind === "layui") {
      let rows = t.el.querySelectorAll(".layui-table-body.layui-table-main tbody tr");
      if (!rows.length) rows = t.el.querySelectorAll(".layui-table-body tbody tr");
      return Array.from(rows);
    }
    return Array.from(t.el.querySelectorAll("tbody tr"));
  }

  /* ============ 工具 ============ */

  function norm(s) { return String(s || "").replace(/\s+/g, "").replace(/\u00a0/g, "").trim(); }

  function htmlToRow(html) {
    try {
      const clean = String(html).replace(/<button[^>]*grab-inline-btn[^>]*>[\s\S]*?<\/button>/g, "");
      const d = document.createElement("div");
      d.innerHTML = "<table><tbody>" + clean + "</tbody></table>";
      const tr = d.querySelector("tr");
      return (tr && tr.cells && tr.cells.length) ? tr : null;
    } catch (e) { return null; }
  }

  function arrayToRow(cells) {
    try {
      if (!Array.isArray(cells) || !cells.length) return null;
      const html = cells.map(function (c) {
        if (c == null) return "<td></td>";
        if (typeof c === "object") return "<td>" + String(c.value != null ? c.value : JSON.stringify(c)) + "</td>";
        return "<td>" + String(c) + "</td>";
      }).join("");
      return htmlToRow("<tr>" + html + "</tr>");
    } catch (e) { return null; }
  }

  /* ============ ★ 按类别轮询 ============ */

  function categoryOptions(ctx) {
    try {
      const sel = (ctx.doc || document).getElementById("szjylb");
      if (!sel) return [];
      return Array.from(sel.options).map(function (o) { return { value: o.value, text: norm(o.textContent) }; });
    } catch (e) { return []; }
  }

  // 类别名归一化：全角括号/空格/大小写差异 → 一律当同一个
  //   为什么需要：等待页勾的是种子名（全角括号），选课页下拉的文字可能不同，
  //   精确比较会对不上 → 表现就是"进去以后类别选择没了，还得自己再点一次"
  function normCat(v) {
    return String(v || "").replace(/\s+/g, "").replace(/[（(]/g, "(").replace(/[）)]/g, ")").toLowerCase();
  }

  // 把"等待页选的类别"落到选课页的真实下拉文字上（认不出来就用原样）
  function applyCatsToPage() {
    const opts = categoryOptions(findCtx());
    // ★ v7.4 队列模式：把队列里的 gg-cat 项名字对到页面的真名上 ——
    //   否则种子名（全角括号）与页面名不一致时，matchItem 的精确比较会失败，类别项永远不命中。
    if (CFG.queueMode) {
      if (!opts.length) return 0;
      let ch = 0;
      (S().queue || []).forEach(function (c) {
        if ((c.kind || "") !== "gg-cat") return;
        const m = opts.filter(function (o) {
          return normCat(o.text) === normCat(c.code) || normCat(o.text).indexOf(normCat(c.code)) >= 0;
        })[0];
        if (m && m.text !== c.code) {
          c.id = "gg-cat:" + m.text; c.code = m.text; c.name = m.text; ch++;
        }
      });
      if (ch) { save(); render(); log("队列里的类别名已对到页面下拉：" + ch + " 项", "ok"); }
      return opts.length;
    }
    if (!opts.length || !CFG.category.match.length) return 0;
    const map = {};
    opts.forEach(function (o) { map[normCat(o.text)] = o.text; });
    let changed = 0;
    const out = [];
    CFG.category.match.forEach(function (m) {
      let use = map[normCat(m)];
      if (!use) {
        const near = opts.filter(function (o) { return normCat(o.text).indexOf(normCat(m)) >= 0; })[0];
        use = near ? near.text : m;
      }
      if (use !== m) changed++;
      if (out.indexOf(use) < 0) out.push(use);
    });
    if (changed) {
      CFG.category.match = out;
      save();
      log("已把等待页选的类别对到选课页下拉：" + out.join("、"), "ok");
    }
    return opts.length;
  }

  // ★ 类别表【学来的，不写死】：只有选课页有 #szjylb。学到一次就存下来，
  //   这样等待页（xklc_list）也能提前把类别列出来、提前勾好。
  function learnCats() {
    try {
      applyCatsToPage();                    // ★ 每页读到时都把选的类别"对一次"
      const m = S().catMap;
      if (!Object.keys(m).length) DEFAULT_CATS.forEach(function (c) { m[c.text] = c.value; });   // 种子先上
      const opts = categoryOptions(findCtx());
      if (!opts.length) return 0;
      let n = 0;
      opts.forEach(function (o) { if (o.text && m[o.text] !== o.value) { m[o.text] = o.value; n++; } });
      if (n) { save(); log("已学到 " + opts.length + " 个类别：" + opts.map(function (o) { return o.text; }).join("、"), "info"); }
      return opts.length;
    } catch (e) { return 0; }
  }

  // ★ 类别种子：GDUFS 的 5 个类别（09-18 实测从 #szjylb option.value 读到的）。
  //   用户指出"等待页面板还要进系统拿类别不合理 —— 其实已经有类型了"，所以种一份进来：
  //   等待页立刻能勾类别；一旦选课页读到真值就以页面为准覆盖（种子只是兜底，不是唯一来源）
  const DEFAULT_CATS = [
    { text: "人文科学", value: "11" },
    { text: "社会科学", value: "12" },
    { text: "自然科学", value: "13" },
    { text: "人文科学（艺术审美课程）", value: "26" },
    { text: "通识特色", value: "27" }
  ];

  // 当前可用类别名：优先读页面（真源），读不到用学到的/种子
  function catNames() {
    const page = categoryOptions(findCtx()).map(function (o) { return o.text; }).filter(Boolean);
    if (page.length) return page;
    const learned = Object.keys(S().catMap || {});
    if (learned.length) return learned;
    return DEFAULT_CATS.map(function (c) { return c.text; });
  }

  // 类别名 → 接口需要的 code（页面 > 学到的 > 种子）
  function catValue(text) {
    const hit = categoryOptions(findCtx()).filter(function (o) { return o.text === text; })[0];
    if (hit) return hit.value;
    const m = S().catMap || {};
    if (m[text]) return m[text];
    const d = DEFAULT_CATS.filter(function (c) { return c.text === text; })[0];
    return d ? d.value : "";
  }

  // 页面当前显示的是哪个类别
  /* ============ 表头认列 ============ */

  function headersOf(t) {
    const out = [];
    try {
      const src = t.src || t.el;
      let ths = Array.from(src.querySelectorAll("thead tr:last-child th"));
      if (!ths.length) ths = Array.from(src.querySelectorAll("thead th"));
      if (!ths.length) ths = Array.from(t.el.querySelectorAll("thead tr:last-child th"));
      ths.forEach(function (th) { out.push(norm(th.textContent)); });
    } catch (e) {}
    return out;
  }

  function headerMap(t) {
    const hs = headersOf(t);
    const map = { _headers: hs, _found: [] };
    const H = CFG.head;
    hs.forEach(function (h, i) {
      if (!h) return;
      if (H.status.test(h) && map.status == null) { map.status = i; map._found.push(i + "=状态"); return; }
      if (H.remain.test(h) && map.remain == null) { map.remain = i; map._found.push(i + "=余量"); return; }
      if (H.category.test(h) && map.category == null) { map.category = i; map._found.push(i + "=类别"); return; }
      if (H.code.test(h) && map.code == null) { map.code = i; map._found.push(i + "=编号"); return; }
      if (H.name.test(h) && map.name == null) { map.name = i; map._found.push(i + "=名称"); return; }
      if (H.teacher.test(h) && map.teacher == null) { map.teacher = i; map._found.push(i + "=教师"); return; }
      if (H.time.test(h) && map.time == null) { map.time = i; map._found.push(i + "=时间"); return; }
      if (H.place.test(h) && map.place == null) { map.place = i; map._found.push(i + "=地点"); return; }
      if (H.campus.test(h) && map.campus == null) { map.campus = i; map._found.push(i + "=校区"); return; }
      if (H.action.test(h) && map.action == null) { map.action = i; map._found.push(i + "=操作"); return; }
    });
    return map;
  }

  function colsFor(t) {
    const auto = t ? headerMap(t) : { _headers: [], _found: [] };
    const C = CFG.col;
    const pick = function (k) { return auto[k] != null ? auto[k] : C[k]; };
    return {
      _headers: auto._headers, _found: auto._found,
      code: pick("code"), name: pick("name"), teacher: pick("teacher"),
      time: pick("time"), status: pick("status"), category: pick("category"),
      remain: auto.remain != null ? [auto.remain] : C.remain
    };
  }

  /* ============ 日志 / 持久化 ============ */

  function log(msg, kind, tag) {
    const styles = { info: "color:#38bdf8", ok: "color:#4ade80;font-weight:bold", warn: "color:#facc15;font-weight:bold", err: "color:#f87171;font-weight:bold" };
    const head = tag ? "[" + tag + "] " : "";
    try { console.log("%c[GRAB] " + new Date().toLocaleTimeString() + " " + head + msg, styles[kind] || styles.info); } catch (e) {}
    try {
      const d = hostDoc();
      const box = d.getElementById("grab-log");
      if (box) {
        const line = d.createElement("div");
        line.textContent = head + msg;
        box.appendChild(line);
        box.scrollTop = box.scrollHeight;
        while (box.children.length > 40) box.removeChild(box.firstChild);
      }
    } catch (e) {}
  }

  function save() {
    try {
      sessionStorage.setItem(K_QUEUE, JSON.stringify(S().queue));
      sessionStorage.setItem("__GRAB_RUN__", S().running ? "1" : "0");
      sessionStorage.setItem("__GRAB_CAT__", JSON.stringify({ enabled: CFG.category.enabled, match: CFG.category.match }));
      sessionStorage.setItem("__GRAB_CATMAP__", JSON.stringify(S().catMap || {}));
      sessionStorage.setItem("__GRAB_ARM__", JSON.stringify(S().arm || null));
      // ★ 模式要存：F5 后不存就回落到「通识抢课」，于是搜必修的分组名（羽毛球1）永远找不到
      sessionStorage.setItem("__GRAB_MODE__", CFG.mode || "gg");
    } catch (e) {}
  }

  function restore() {
    try {
      const raw = sessionStorage.getItem(K_QUEUE);
      if (raw) { const p = JSON.parse(raw); if (Array.isArray(p)) S().queue = p; }
      const c = sessionStorage.getItem("__GRAB_CAT__");
      if (c) { const o = JSON.parse(c); if (o) { CFG.category.enabled = !!o.enabled; CFG.category.match = o.match || []; } }
      try { const m = JSON.parse(sessionStorage.getItem("__GRAB_CATMAP__") || "{}"); if (m) S().catMap = m; } catch (e) {}
      try { const a = JSON.parse(sessionStorage.getItem("__GRAB_ARM__") || "null"); if (a && !a.done) S().arm = a; } catch (e) {}
      try { const md = sessionStorage.getItem("__GRAB_MODE__"); if (md) CFG.mode = (md === "bx") ? "bx" : "gg"; } catch (e) {}
      if (S().queue.length) log("已恢复 " + S().queue.length + " 门监控课程", "info");
      if (CFG.category.enabled && CFG.category.match.length) log("已恢复类别：" + CFG.category.match.join("、"), "info");
      // ★ 类别模式（队列为空）也要能续抢 —— 以前这里只认 queue，导致"包圆"模式一换页就断
      const catOn = CFG.category.enabled && CFG.category.match.length;
      if (sessionStorage.getItem("__GRAB_RUN__") === "1" && (S().queue.length || catOn)) setTimeout(start, 600);
      if (S().arm) setTimeout(maybeArm, 800);
    } catch (e) {}
  }

  /* ============ 网络 ============ */

  function isSubmitUrl(u) { return /xsxkOper|xsxkFun|comeXkjg|xsxk_exit|xkOper/i.test(u); }

  function noteNet(o) {
    try {
      const L = S().netLog;
      o.t = new Date().toLocaleTimeString();
      L.push(o);
      if (L.length > 40) L.shift();
    } catch (e) {}
  }

  // ★ 钩 fetch —— 接口模式的请求走 fetch，不钩的话 GRAB.net() 看不到自己发的请求
  // ★ 把网络钩子挂到【所有 frame】—— 必修选课的请求可能从我们没钩过的 frame 发出来
  function hookAllFrames() {
    const ws = [];
    (function walk(w, d) {
      if (!w || d > 8) return;
      ws.push(w);
      try { for (let i = 0; i < w.frames.length; i++) walk(w.frames[i], d + 1); } catch (e) {}
    })((function () { try { return W.top || W; } catch (e) { return W; } })(), 0);
    ws.forEach(function (w) { try { hookNet(w); hookJq(w); hookMessages(w); } catch (e) {} });
    return ws.length;
  }

  // ★ GRAB.xhr()：把记下来的请求【全量】打出来（不过滤），用来抓"点一下选课到底发了什么"
  function xhrDump() {
    const n = hookAllFrames();
    const L = (S().netLog || []).slice();
    log("已挂钩 " + n + " 个 frame；共记录 " + L.length + " 条请求" +
      (L.length ? "（下面表格里找 /jsxsd/ 且名字带 Oper / xsxk 的那条）" : "（现在去点一次页面的按钮，再跑一次 GRAB.xhr()）"), "ok");
    try {
      console.table(L.slice(-40).map(function (o) {
        return {
          时间: o.t, 方法: o.method, 状态: o.status, 长度: o.len,
          条数: (o["数组条数"] === null || o["数组条数"] === undefined) ? "-" : o["数组条数"],
          地址: String(o.url).slice(0, 90),
          参数: String(o.params || "").slice(0, 70),
          响应开头: String(o["响应开头"] || "").slice(0, 60)
        };
      }));
      // ★ 对比小结：页面自己发的（method=post 那批）回来了几条 vs 我们的接口池
      const ours = L.filter(function (o) { return /xsxkGgxxkxk|xsxkBxxk/.test(String(o.url)); });
      const pageOnes = ours.filter(function (o) { return String(o.method).toLowerCase() === "post"; });
      log("请求对比：列表类请求 " + ours.length + " 条；页面自己发的 " + pageOnes.length +
        " 条，条数 " + pageOnes.slice(-6).map(function (o) { return (o["数组条数"] == null ? "?" : o["数组条数"]); }).join("/") +
        "；接口池现在 通识 " + (S().apiRows || []).length + " 门 / 必修 " + (S().bxRows || []).length + " 门", "warn");
    } catch (e) {}
    const sub = S().submitResult || [];
    if (sub.length) { log("提交类响应 " + sub.length + " 条（看控制台对象）：", "warn"); try { console.log(sub); } catch (e) {} }
    return L;
  }

  function hookFetch(win) {
    try {
      if (win.__GRAB_FETCH__) return;
      const of = win.fetch;
      if (typeof of !== "function") return;
      win.__GRAB_FETCH__ = true;
      win.fetch = function (input, init) {
        const url = (typeof input === "string") ? input : ((input && input.url) || "");
        const method = (init && init.method) || (input && input.method) || "GET";
        const body = (init && typeof init.body === "string") ? init.body : "";
        const t0 = Date.now();
        return of.apply(this, arguments).then(function (res) {
          try {
            res.clone().text().then(function (txt) {
              let keys = null, n = null;
              try {
                const j = JSON.parse(txt);
                if (j && typeof j === "object") {
                  keys = Object.keys(j).slice(0, 14).join(",");
                  const a = j.aaData || j.data;
                  if (Array.isArray(a)) n = a.length;
                }
              } catch (e) {}
              noteNet({
                url: url, method: method + "(fetch)", status: res.status, len: txt.length,
                keys: keys, 数组条数: n, params: body.slice(0, 400),
                响应开头: "[" + (Date.now() - t0) + "ms] " + txt.slice(0, 110)
              });
            });
          } catch (e) {}
          return res;
        });
      };
    } catch (e) {}
  }

  function hookNet(win) {
    try {
      if (win.__GRAB_NET__) return;
      win.__GRAB_NET__ = true;
      const OP = win.XMLHttpRequest.prototype.open;
      const SD = win.XMLHttpRequest.prototype.send;
      win.XMLHttpRequest.prototype.open = function (m, u) {
        try { this.__gUrl = String(u); this.__gMethod = String(m || "GET"); } catch (e) {}
        return OP.apply(this, arguments);
      };
      win.XMLHttpRequest.prototype.send = function (body) {
        const xhr = this;
        try { xhr.__gBody = typeof body === "string" ? body.slice(0, 500) : (body ? String(body).slice(0, 500) : ""); } catch (e) {}
        try {
          xhr.addEventListener("load", function () {
            try {
              const u = xhr.__gUrl || "";
              const txt = String(xhr.responseText || "");
              let keys = null, arrLen = null;
              try {
                const j = JSON.parse(txt);
                if (j && typeof j === "object") {
                  keys = Object.keys(j).slice(0, 14).join(",");
                  const arr = j.aaData || j.data || j.rows;
                  if (Array.isArray(arr)) arrLen = arr.length;
                }
              } catch (e) {}
              noteNet({ url: u, method: xhr.__gMethod || "GET", status: xhr.status, len: txt.length,
                        keys: keys, 数组条数: arrLen, params: xhr.__gBody || "", 响应开头: txt.slice(0, 140) });

              if (isSubmitUrl(u)) {
                S().submitResult.push({ url: u, status: xhr.status, body: txt.slice(0, 500) });
                if (S().submitResult.length > 12) S().submitResult.shift();
                if (/"success"/.test(txt)) { S().lastMsg = txt; log("提交响应: " + txt.slice(0, 180), "info"); }
                return;
              }
              if (CFG.useServerCache && isListUrl(u) && txt.length > 20) {
                let arr = null;
                try { const j = JSON.parse(txt); arr = j && (j.aaData || j.data || j.rows); } catch (e) { return; }
                if (Array.isArray(arr) && arr.length) {
                  const rows = arr.map(arrayToRow).filter(Boolean);
                  if (rows.length) {
                    S().allRows = rows;
                    S().cacheStamp = Date.now();
                    log("★ 服务器返回 " + rows.length + " 条课程（页面显示 " + rowsOf(resolveTable(findCtx())).length + " 条）", "ok");
                  }
                }
              }
            } catch (e) {}
          });
        } catch (e) {}
        return SD.apply(this, arguments);
      };
    } catch (e) {}
  }

  function hookJq(win) {
    try {
      const jq = win.jQuery || win.$;
      if (!jq || !jq.ajax || jq.__grabAjax) return;
      jq.__grabAjax = true;
      const orig = jq.ajax;
      jq.ajax = function (opts) {
        try {
          const o = (typeof opts === "string") ? { url: opts } : (opts || {});
          noteNet({ url: String(o.url || "(无url)"), method: String(o.type || o.method || "GET"), status: "发送",
                    len: 0, keys: null, 数组条数: null,
                    params: typeof o.data === "string" ? o.data.slice(0, 400) : JSON.stringify(o.data || {}).slice(0, 400),
                    响应开头: "(jQuery ajax 请求)" });
        } catch (e) {}
        return orig.apply(this, arguments);
      };
    } catch (e) {}
  }

  function hookMessages(win) {
    try {
      if (win.__GRAB_MSG__) return;
      win.__GRAB_MSG__ = true;
      win.confirm = function () { return true; };
      win.alert = function (m) { S().lastMsg = String(m); log("系统提示: " + m, "warn"); };
      ["qzMessageBox", "qzAlert", "qzTips", "qzDialog"].forEach(function (n) {
        try {
          const orig = win[n];
          if (typeof orig !== "function") return;
          win[n] = function () {
            try {
              const txt = [arguments[0], arguments[1]].filter(function (x) { return typeof x === "string"; }).join(" | ");
              if (txt) S().lastMsg = txt;
            } catch (e) {}
            return orig.apply(this, arguments);
          };
        } catch (e) {}
      });
      try {
        if (win.layer && typeof win.layer.msg === "function" && !win.layer.__grab) {
          win.layer.__grab = true;
          const om = win.layer.msg;
          win.layer.msg = function (c) { if (typeof c === "string") S().lastMsg = c; return om.apply(this, arguments); };
        }
      } catch (e) {}
    } catch (e) {}
  }

  const CLICKED = new WeakSet();
  function clickConfirmOnce() {
    for (const d of allDocs()) {
      let btns;
      try {
        btns = d.querySelectorAll(".layui-layer-btn a, .layui-layer-btn button, .messager-button a, .el-message-box__btns button, .panel.window .l-btn");
      } catch (e) { continue; }
      for (const b of btns) {
        let visible = true;
        try { visible = !!(b.offsetParent || (b.getClientRects && b.getClientRects().length)); } catch (e) {}
        if (!visible) continue;
        const cls = String(b.className || "");
        if (cls.indexOf("layui-layer-btn1") >= 0) continue;
        const layer = (b.closest && b.closest(".layui-layer")) || b;
        if (CLICKED.has(layer)) continue;
        const txt = String(b.textContent || "").trim();
        const isPrimary = cls.indexOf("layui-layer-btn0") >= 0;
        if (!isPrimary && !CFG.word.confirm.some(function (w) { return txt.indexOf(w) >= 0; })) continue;
        CLICKED.add(layer);
        try { b.click(); return "「" + (txt || "确定") + "」"; } catch (e) {}
      }
    }
    return null;
  }

  function autoConfirm(maxMs, cb) {
    const t0 = Date.now();
    let n = 0;
    const id = setInterval(function () {
      const hit = clickConfirmOnce();
      if (hit) { n++; log("已自动点击弹窗 " + hit, "ok"); }
      if (Date.now() - t0 >= maxMs) { clearInterval(id); cb(n); }
    }, 150);
  }

  /* ============ 解析 / 全量收集 ============ */

  /* ============================================================
     ★★★ 接口直连层（v3.0）—— 页面完全不动
     ============================================================ */

  // 表头文字 → 接口 JSON 字段名
  const FIELD_OF_HEADER = {
    "课程编号": "kch", "课程号": "kch", "课程代码": "kch",
    "课程名称": "kcmc", "课程名": "kcmc",
    "分组名": "fzmc", "合班名称": "ktmc", "教学班": "ktmc",
    "学分": "xf",
    "上课教师": "skls", "教师": "skls", "任课教师": "skls",
    "上课时间": "sksj", "时间": "sksj",
    "上课地点": "skdd", "地点": "skdd",
    "上课校区": "xqmc", "校区": "xqmc",
    "剩余容量": "syrs", "余量": "syrs", "剩余名额": "syrs",
    "已选人数": "xkrs",
    "时间冲突": "ctsm",
    "通选课类别": "szkcflmc", "课程类别": "szkcflmc", "类别": "szkcflmc",
    "操作": "czOper"
  };

  // 按【当前表格的表头顺序】把 JSON 字段排出来 —— 这样虚拟行与真实行结构一致，
  // 后面所有解析/匹配/判定逻辑都能原样复用
  function headersAsFields(t) {
    const hs = t ? headersOf(t) : [];
    if (!hs.length) return ["kch", "kcmc", "xf", "skls", "sksj", "skdd", "xqmc", "syrs", "ctsm", "szkcflmc", "czOper"];
    return hs.map(function (h) { return FIELD_OF_HEADER[h] || null; });
  }

  // ★ 接口记录 → 规范行对象（直接造，不再绕 <tr> + 表头映射那条链）
  //   为什么：接口字段顺序是**我们自己定的**（mDataProp_0=kch…_8=syrs…_11=czOper），
  //   跟页面 11 列表头不一定对齐；绕一圈 <tr> 再按表头解析，余量可能落在错列上。
  //   这样造出来的行跟页面行同构，submit() / 类别命中 / 列表渲染全都能直接用。
  function apiRowOf(o, catText) {
    const num = function (v) {
      const n = parseInt(String(v == null ? "-1" : v).replace(/[^0-9-]/g, ""), 10);
      return isNaN(n) ? -1 : n;
    };
    return {
      // ★ 唯一键必须是【教学班】级别：同一门课的多个班 kch 相同，
      //   拿 kch 当键会把 6 个班压成 1 个（用户实测："输入世界只能搜出 2 个，之前是 6 个"）
      id: String(o.jx0404id || o.kch || ""), code: String(o.kch || ""),
      // ★ 必修的课程名经常重名（一堆「体育(3)」），真正的区分在分组名 fzmc / 课堂名 ktmc
      //   → 拼进 name，列表看得见、匹配也能按分组名命中
      name: String(o.kcmc || "") + (o.fzmc ? "／" + String(o.fzmc) : "") + (o.ktmc ? "／" + String(o.ktmc) : ""),
      teacher: String(o.skls || ""), timeInfo: String(o.sksj || ""), place: String(o.skdd || ""),
      campus: String(o.xqmc || ""), credit: String(o.xf || ""),
      remain: num(o.syrs), taken: num(o.xkrs),
      conflicted: !!o.ctsm && !/无冲突/.test(String(o.ctsm)),
      // 已选判定：通识是 xstkOper；必修的退课按钮可能不叫这个名字 → 一并认退课/退选字样
      already: /xstkOper|退课|退选/.test(String(o.czOper || "")),
      category: String(o.szkcflmc || ""),
      // 分组名/课堂名单独留一份：列表要显示、匹配要用、调试要看
      group: String(o.fzmc || ""), classroom: String(o.ktmc || ""), unit: String(o.dwmc || ""),
      __cat: String(catText || o.__catText || ""),
      __api: o
    };
  }

  // 把一条接口记录造成一个虚拟 <tr>（与页面行同构）
  function rowFromApi(o, fields) {
    const tds = fields.map(function (f) {
      const v = f ? o[f] : "";
      if (v == null || v === "") return "<td>&nbsp;</td>";
      return "<td>" + String(v) + "</td>";
    });
    const tr = htmlToRow("<tr>" + tds.join("") + "</tr>");
    if (tr) { tr.__api = o; }
    return tr;
  }

  // 请求一页
  function apiPage(code, start, len) {
    const A = CFG.api;
    try { S().apiReqs = (S().apiReqs || 0) + 1; } catch (e) {}
    const q = "?kcxx=&skls=&skxq=&skjc=&endJc=" +
      "&sfym=" + A.filterFull + "&sfct=" + A.filterConflict +
      "&szjylb=" + encodeURIComponent(code) +
      "&sfxx=" + A.filterLimited + "&skfs=&kctype=";
    const b = "sEcho=1&iColumns=12&sColumns=" +
      "&iDisplayStart=" + start + "&iDisplayLength=" + len +
      "&mDataProp_0=kch&mDataProp_1=kcmc&mDataProp_2=xf&mDataProp_3=skls" +
      "&mDataProp_4=sksj&mDataProp_5=skdd&mDataProp_6=xqmc&mDataProp_7=xkrs" +
      "&mDataProp_8=syrs&mDataProp_9=ctsm&mDataProp_10=szkcflmc&mDataProp_11=czOper";
    return fetch(A.listUrl + q, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest"
      },
      body: b,
      credentials: "same-origin"
    }).then(function (r) { return r.text(); })
      .then(function (t) { try { return JSON.parse(t); } catch (e) { return null; } })
      .catch(function () { return null; });
  }

  // 拉完一个类别的所有页（服务端不认大 pageSize 时自动翻页）
  function apiListAll(code) {
    const out = [];
    let start = 0, total = 0, guard = 0;
    return (function step() {
      return apiPage(code, start, CFG.api.pageSize).then(function (r) {
        if (!r || !Array.isArray(r.aaData)) return out;
        if (r.iTotalRecords != null) total = Number(r.iTotalRecords) || 0;
        // 第一次请求就能看出服务端认不认大 pageSize
        if (S().apiBigOK === null && start === 0) {
          S().apiBigOK = !(total && r.aaData.length < total);
        }
        out.push.apply(out, r.aaData);
        start += r.aaData.length;
        if (!r.aaData.length || (total && start >= total) || ++guard >= CFG.api.maxPages) return out;
        return step();
      });
    })();
  }

  /* ============ ★ 必修课选课（用户实测抓到的接口）============ */
  // 列表：POST /jsxsd/xsxkkc/xsxkBxxk?1=1&kcxx=&skls=&skfs=   13 列（比通识多 dwmc/fzmc/ktmc）
  // ⏳ 提交的 endpoint 还没抓到 → 必修先只读（GRAB.bxList() 看余量），提交走"点页面按钮"
  function apiBxPage(start, len, kw) {
    const A = CFG.api;
    try { S().apiReqs = (S().apiReqs || 0) + 1; } catch (e) {}
    const q = "?1=1&kcxx=" + encodeURIComponent(kw || "") + "&skls=&skfs=";
    let b = "sEcho=1&iColumns=" + A.bxFields.length + "&sColumns=" +
      "&iDisplayStart=" + start + "&iDisplayLength=" + len;
    A.bxFields.forEach(function (f, i) { b += "&mDataProp_" + i + "=" + f; });
    return fetch(A.bxUrl + q, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest"
      },
      body: b,
      credentials: "same-origin"
    }).then(function (r) { return r.text(); })
      .then(function (t) { try { return JSON.parse(t); } catch (e) { return null; } })
      .catch(function () { return null; });
  }

  function apiBxListAll() {
    const out = [];
    let start = 0, total = 0, guard = 0;
    return (function step() {
      return apiBxPage(start, CFG.api.pageSize).then(function (r) {
        if (!r || !Array.isArray(r.aaData)) return out;
        if (r.iTotalRecords != null) total = Number(r.iTotalRecords) || 0;
        out.push.apply(out, r.aaData);
        start += r.aaData.length;
        if (!r.aaData.length || (total && start >= total) || ++guard >= CFG.api.maxPages) return out;
        return step();
      });
    })();
  }

  // ★ 必修提交：不猜 endpoint —— 直接在页面上找到那一行的「选课」按钮点下去，
  //   参数由页面自己带，我们只负责判定结果（响应由 XHR 钩子抓）
  function submitBxByClick(row) {
    const code = String(row.kch || ""), name = String(row.kcmc || "");
    let hit = null;
    allDocs().forEach(function (d) {
      if (hit) return;
      let trs = [];
      try { trs = d.querySelectorAll("tr"); } catch (e) { return; }
      Array.from(trs).forEach(function (tr) {
        if (hit) return;
        const t = norm(tr.textContent);
        if (!t) return;
        if (code && t.indexOf(code) < 0 && !(name && t.indexOf(name) >= 0)) return;
        const btn = Array.from(tr.querySelectorAll("a,button,span")).filter(function (b) {
          const bt = norm(b.textContent);
          return bt.length <= 6 && /选课|选择/.test(bt) && !/退课|已选/.test(bt);
        })[0];
        if (btn) hit = { btn: btn, t: t };
      });
    });
    if (!hit) {
      log("必修：页面上没找到【" + (name || code) + "】的选课按钮 —— 先切到「必修选课」标签再点开始", "warn");
      return false;
    }
    log("必修：点页面按钮提交【" + (name || code) + "】", "warn");
    try { hit.btn.click(); } catch (e) { log("点击失败：" + e.message, "err"); return false; }
    try { autoConfirm(8000, null); } catch (e) {}
    return true;
  }

  // ★ GRAB.alive()：一眼看"还活着吗、在蹲什么、最后成功刷新是什么时候"
  function alive(everySec) {
    const SH = S();
    if (everySec) {                      // ★ GRAB.alive(30) = 每 30 秒自动打一行简版
      if (SH.aliveTimer) clearInterval(SH.aliveTimer);
      const tickOnce = function () {
        const hb = Math.round((Date.now() - (SH.engineAt || 0)) / 1000);
        const bxAge = SH.bxStamp ? Math.round((Date.now() - SH.bxStamp) / 1000) : -1;
        const ggAge = SH.apiStamp ? Math.round((Date.now() - SH.apiStamp) / 1000) : -1;
        const mins = SH.runSince ? Math.round((Date.now() - SH.runSince) / 60000) : 0;
        // ★ 措辞：以前写"停着"，容易被读成"挂了"。它其实只是说"没点开始"。
        const notRun = !SH.running;
        log("[alive] 心跳 " + hb + "s｜" + (SH.running ? "在跑 " + mins + " 分" : "未启动（没点开始/守候）") +
            "｜模式 " + CFG.mode + "｜队列 " + (SH.queue || []).length + "｜类别 " + ((CFG.category.match || []).length || 0) +
            "｜必修刷新 " + (bxAge < 0 ? "还没拉过" : bxAge + "s 前") +
            "｜通识刷新 " + (ggAge < 0 ? "还没拉过" : ggAge + "s 前") +
            (hb > 10 ? "｜⚠ 引擎心跳断了（脚本卡死）" : "") +
            (SH.apiErr || SH.bxErr ? "｜⚠ " + (SH.apiErr || SH.bxErr) : "") +
            (notRun ? "｜提示：面板点「🚀 开始」或「🎯 进入守候」才会开始拉数据" : ""),
            (hb > 10 || SH.apiErr || SH.bxErr) ? "warn" : "info");
      };
      tickOnce();
      SH.aliveTimer = setInterval(tickOnce, Math.max(5, everySec) * 1000);
      log("已开启持续体检：每 " + everySec + " 秒一行 [alive]（再跑 GRAB.alive() 可关掉）", "ok");
      return SH.aliveTimer;
    }
    if (SH.aliveTimer) { clearInterval(SH.aliveTimer); SH.aliveTimer = null; log("持续体检已关", "info"); }
    const hb = Math.round((Date.now() - (SH.engineAt || 0)) / 1000);
    const info = {
      引擎就绪: SH.engineFrameUrl ? "是" : "否",
      心跳距今秒: hb,
      在跑: SH.running ? "是（已跑 " + (SH.runSince ? Math.round((Date.now() - SH.runSince) / 60000) : 0) + " 分）" : "否 —— 没点开始/守候，此时不会拉数据",
      已跑分钟: SH.runSince ? Math.round((Date.now() - SH.runSince) / 60000) : 0,
      模式: CFG.mode,
      队列: (SH.queue || []).length,
      队列任务: (SH.queue || []).length + " 项" +
        ((SH.queue || []).length ? "（" + (SH.queue || []).map(function (c) { return (c.kind || "kw") + ":" + c.code; }).join(" / ") + "）" : ""),
      类别: CFG.queueMode ? "(队列模式，看上一行)" : ((CFG.category.match || []).join("、") || "(无)"),
      必修池: (SH.bxRows || []).length,
      通识池: (SH.apiRows || []).length,
      必修最后刷新: SH.bxStamp ? Math.round((Date.now() - SH.bxStamp) / 1000) + " 秒前" : "从未",
      通识最后刷新: SH.apiStamp ? Math.round((Date.now() - SH.apiStamp) / 1000) + " 秒前" : "从未",
      待命: SH.arm ? (SH.arm.done ? "已完成" : "等待进入 " + (SH.arm.name || "")) : "(无)",
      接口报错: SH.apiErr || SH.bxErr || "(无)"
    };
    console.table([info]);
    if (!SH.running) log("提示：现在没在跑。要开始：点面板「🚀 开始」，或在等待页点「🎯 进入守候并抢课」", "warn");
    return info;
  }

  // ★ GRAB.inspect()：一次把三件事打全 —— 队列存了什么、必修池有什么、通识池有什么。
  //   用途：查"点了某行的抢，为什么队列里只有课程名"这类问题。
  function inspect() {
    const SH = S();
    // ★ 池子空就先自己拉一次 —— 刷新页面后 S() 是空的，直接 dump 只会打三张空表
    const needBx = !(SH.bxRows || []).length;
    const needGg = !(SH.apiRows || []).length;
    if (needBx || needGg) {
      log("inspect：池子还空着（刚刷新过页面），先自动拉一次数据（必修列表 + 通识全类别）…", "warn");
      const jobs = [];
      if (needBx) jobs.push(apiBxListAll().then(function (r) { SH.bxRows = r || []; SH.bxStamp = Date.now(); }));
      if (needGg) jobs.push(apiRefreshAll() || new Promise(function (res) { setTimeout(res, 1500); }));
      return Promise.all(jobs).then(function () { return dumpInspect(); });
    }
    return dumpInspect();
  }

  function dumpInspect() {
    const SH = S();
    console.log("%c[GRAB inspect] 队列（点「抢」时存下来的东西）", "color:#38bdf8;font-weight:bold");
    console.table(SH.queue.map(function (q) {
      return { id: q.id, code: q.code, name: q.name, group: q.group || "(没存)", teacher: q.teacher, time: q.timeInfo };
    }));
    const bx = SH.bxRows || [], gg = SH.apiRows || [];
    console.log("[GRAB inspect] 必修池：" + bx.length + " 门 ｜ 通识池：" + gg.length + " 门");
    if (bx.length) {
      console.log("%c[GRAB inspect] 必修池前 15 条（看 fzmc 有没有值）", "color:#facc15");
      console.table(bx.slice(0, 15).map(function (o) {
        return {
          课程号: o.kch, 课程名: o.kcmc, 分组名: o.fzmc, 课堂名: o.ktmc, 单位: o.dwmc,
          余量: o.syrs, jx0404id: o.jx0404id, 操作列开头: String(o.czOper || "").slice(0, 60)
        };
      }));
    }
    const tag = bx.filter(function (o) { return String(o.kcmc || "").indexOf("体育") >= 0; });
    if (tag.length) {
      console.log("%c[GRAB inspect] 必修池里所有「体育」班 —— 篮球/毽球 到底叫什么名字", "color:#facc15");
      console.table(tag.map(function (o) { return { 分组名: o.fzmc, 课堂名: o.ktmc, 课程号: o.kch, 余量: o.syrs, 教师: o.skls }; }));
    }
    return { queue: SH.queue.length, bx: bx.length, gg: gg.length };
  }

  // ★ 提交管道自检：**拿假 id 打真接口**。
  //   目的：验证"通识/必修的提交这条管道"（URL、参数形状、HTTP 通道、响应能否解析），
  //   用假 id → 服务器必然拒绝 → **绝无可能真选上**，但会给一个合法响应。
  //   唯一验不了的是"成功时服务器回什么字"（那必须有真名额）。
  function testSubmit(mode) {
    const bx = mode === "bx";
    const url = (bx ? CFG.api.bxSubmitUrl : CFG.api.submitUrl) + "?kcid=00000000000000000000000000000000&cfbs=null";
    const body = bx ? "jx0404id=000000000000000&xkzy=&trjf=&sfsyjc=&sfkv"
                    : "jx0404id=000000000000000&xkzy=&trjf=&sfsyjc=";
    log("自检提交（" + (bx ? "必修" : "通识") + "）：假 id 打真接口，看服务器怎么回 —— 不会真选上", "warn");
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest"
      },
      body: body,
      credentials: "same-origin"
    }).then(function (r) {
      return r.text().then(function (t) { return { status: r.status, t: t }; });
    }).then(function (x) {
      let j = null;
      try { j = JSON.parse(x.t); } catch (e) {}
      log("HTTP " + x.status + " · " + String(x.t).slice(0, 200), j ? "ok" : "warn");
      if (j && typeof j.success !== "undefined") {
        log("✅ 管道通：标准 {success,message}（成功字样只能等真名额才能验）", "ok");
      } else {
        log("⚠ 响应不是标准 JSON —— 可能被踢下登录，或接口/参数变了", "err");
      }
      console.table([{ 模式: bx ? "必修" : "通识", HTTP: x.status, 是否JSON: !!j, 响应: String(x.t).slice(0, 120) }]);
      return x;
    }).catch(function (e) { log("自检异常：" + e.message, "err"); });
  }

  // ★ 在线时长探测：每 60 秒发一次列表请求，看"第几分钟开始拿不到数据"
  //   用途：测教务系统的会话超时 —— 守候能不能挂过夜，全靠这个数
  function watch(minutes) {
    const total = (minutes || 240) * 60000;
    const t0 = Date.now();
    const code = catValue(catNames()[0]) || "";
    log("开始探测会话超时：每 60 秒一次，最多 " + Math.round(total / 60000) + " 分钟，结果看控制台（F12）", "ok");
    const timer = setInterval(function () {
      const el = Math.round((Date.now() - t0) / 60000);
      apiListAll(code).then(function (rows) {
        if (rows && rows.length) {
          console.log("[GRAB watch] 第 " + el + " 分钟：在线（" + rows.length + " 门）");
          return;
        }
        console.log("[GRAB watch] 第 " + el + " 分钟：⚠ 拿不到数据（疑似被踢下登录）");
        log("⚠ 会话可能已失效：第 " + el + " 分钟起拿不到数据", "err");
      });
      if (Date.now() - t0 > total) { clearInterval(timer); console.log("[GRAB watch] 探测结束"); }
    }, 60000);
    S().watchTimer = timer;
    return timer;
  }

  // ★ 必修的匹配语义（用户拍板）：按【分组名/课堂名】找，不拿课程名搜。
  //   为什么：必修的课程名是聚合名 —— 一门体育课的 19 个分组（篮球1/篮球2/毽球/健美操…）
  //   全叫「体育（3）」。拿课程名搜等于把整门课都拖进来，用户原话：
  //   「体育不应该能被搜出来才对，必修应该按照分组来找」。
  //   所以：搜「篮球」→ 出 篮球1/篮球2；搜「体育」→ 出 0 个（这才是对的）。
  function bxHit(o, kw) {
    const k = String(kw || "").trim();
    if (!k) return false;
    const specific = [o.fzmc, o.ktmc].map(function (v) { return String(v == null ? "" : v); }).join(" ").trim();
    if (specific) return specific.indexOf(k) >= 0;
    return String(o.kcmc || "").indexOf(k) >= 0;   // 没有分组名的课才退回课程名
  }

  // ★ 必修提交：接口直连（参数形状来自用户抓到的真实请求）
  function apiBxSubmit(o) {
    const kcid = o.jx02id || o.kcid || "";
    const cfbs = (o.cfbs === undefined || o.cfbs === null || o.cfbs === "") ? "null" : String(o.cfbs);
    const url = CFG.api.bxSubmitUrl + "?kcid=" + encodeURIComponent(kcid) + "&cfbs=" + encodeURIComponent(cfbs);
    const body = "jx0404id=" + encodeURIComponent(o.jx0404id || "") + "&xkzy=&trjf=&sfsyjc=&sfkv";
    log("必修直连提交【" + o.kcmc + "】kx02id=" + kcid + " jx0404id=" + o.jx0404id, "warn");
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest"
      },
      body: body,
      credentials: "same-origin"
    }).then(function (r) { return r.text(); })
      .then(function (t) {
        log("必修提交响应（" + String(t).length + " 字节）：" + String(t).slice(0, 220), "warn");
        return t;
      })
      .catch(function (e) { log("必修提交异常：" + e.message, "err"); return ""; });
  }

  // ★ 必修盯盘：列表走接口找余量 → 命中队列目标就接口提交
  //   必修没有"类别"这一说，所以必须有明确目标（避免瞎抢）
  function bxTick() {
    const SH = S();
    if (!SH.queue.length) {
      if (SH.tickNo % 8 === 0) updateStatus("必修模式：先在下面输入课程编号/课名并锁定（必修不看类别）");
      return;
    }
    if (!SH.bxBusy && Date.now() - (SH.bxStamp || 0) > CFG.api.refreshMs) {
      SH.bxBusy = true;
      apiBxListAll().then(function (rows) {
        // ★ 空响应要出声：要么被踢下登录，要么服务端按上下文返回
        SH.bxErr = (rows && rows.length) ? "" : "必修列表返回 0 条（可能被踢下登录，或不在「必修选课」标签页）";
        SH.bxRows = rows || [];
        SH.bxStamp = Date.now();
        SH.bxBusy = false;
        // ★ 降噪：以前每 3 秒刷一行"必修刷新"，看着像在空转。现在只在数量变化时报。
        if (SH.bxRows.length !== SH.bxLastCount) {
          SH.bxLastCount = SH.bxRows.length;
          log("必修刷新：" + SH.bxRows.length + " 门" +
            (SH.bxRows.length ? "" : "（0 门：确认当前在「必修选课」标签页？接口可能按页面上下文返回）"),
            SH.bxRows.length ? "info" : "warn");
        }
        render();
      });
    }
    const num = function (v) { const n = parseInt(String(v == null ? "-1" : v).replace(/[^0-9-]/g, ""), 10); return isNaN(n) ? -1 : n; };
    // 与通识保持一致：满 / 冲突 / 已选 都不算可抢
    const free = (SH.bxRows || []).filter(function (o) {
      return num(o.syrs) > 0 && !/xstkOper|退课|退选/.test(String(o.czOper || ""));
    });
    for (const q of SH.queue) {
      const stt = st(q.id);
      if (stt.success || stt.selecting || stt.terminal) continue;
      // ★ 必修的"名字"往往不是唯一的（用户实测：一堆都叫「体育(3)」，
      //   真正的区分在【分组名 fzmc】和【课堂名 ktmc】）→ 一起参与匹配
      const hit = free.filter(function (o) { return bxHit(o, q.id); })[0];
      if (!hit) continue;
      stt.selecting = true;
      log("必修命中【" + hit.kcmc + (hit.fzmc ? "／" + hit.fzmc : "") +
        (hit.ktmc ? "／" + hit.ktmc : "") + "】余量 " + hit.syrs + " —— 接口提交", "warn");
      apiBxSubmit(hit).then(function (t) {
        stt.selecting = false;
        if (/"success"\s*:\s*true/.test(t)) { markOk({ id: q.id, code: hit.kch, name: hit.kcmc }, "接口返回成功"); }
        else {
          const m = (String(t).match(/"message"\s*:\s*"([^"]*)"/) || [])[1] || "";
          // ★ 终局性拒绝：这不是"手慢没抢到"，而是"这门课你已经选了别的教学班"。
          //   再打一百次也是一样的结果，只会刷屏（实测：连打 7 次同一响应）。
          //   → 标记终止、不再重试，并把真正该做的事告诉用户。
          if (/已选择其它教学班|已选择其他教学班|已选中|不开放|未开放|不在选课时间|已结束/.test(m)) {
            stt.terminal = true;
            log("【" + hit.kcmc + (hit.fzmc ? "／" + hit.fzmc : "") + "】服务器：" + m +
                " —— 要换班得先退掉已选的那个班，这个目标不再重试", "err");
            save(); render();
            return;
          }
          stt.fails++;
          log("必修被拒（第 " + stt.fails + " 次）：" + m, "warn");
          if (stt.fails >= CFG.maxFails) { log("连续失败 " + stt.fails + " 次，自动停止", "err"); stop(); }
        }
        save();
      });
      return;
    }
    if (SH.tickNo % 8 === 0) {
      const mins = SH.runSince ? Math.round((Date.now() - SH.runSince) / 60000) : 0;
      updateStatus("必修盯盘中｜" + (SH.bxRows || []).length + " 门｜余量 " + free.length +
        " 门｜已跑 " + mins + " 分钟");
    }
    // ★ 活着报告：每 ~48 秒在日志里留一条，方便判断"到底还在不在蹲"
    if (SH.tickNo % 40 === 0) {
      const mins = SH.runSince ? Math.round((Date.now() - SH.runSince) / 60000) : 0;
      log("▶ 必修还在盯：已跑 " + mins + " 分钟｜最后刷新 " +
        (SH.bxStamp ? Math.round((Date.now() - SH.bxStamp) / 1000) + " 秒前" : "还没成功过") +
        (SH.bxErr ? "｜⚠ " + SH.bxErr : ""), SH.bxErr ? "warn" : "info");
    }
    // 搜不到东西时别让人瞎猜：把列表里真实存在的「课程名／分组名」打出来（30 拍一次）
    if (SH.tickNo % 30 === 0) {
      const list = free.map(function (o) { return (o.kcmc || "") + "／" + (o.fzmc || ""); });
      log("必修列表里【有余量】的班：" + (list.length ? list.slice(0, 15).join("；") : "（当前一个都没余量）"), "info");
    }
  }

  // 必修只读体检：看有多少门、多少有余量（提交没抓到前不动手）
  function bxList() {
    return apiBxListAll().then(function (rows) {
      const num = function (v) { return parseInt(String(v == null ? "-1" : v).replace(/[^0-9-]/g, ""), 10); };
      const free = rows.filter(function (o) { return num(o.syrs) > 0; });
      // ★ 必修提交的入口很可能就藏在列表记录的 czOper（操作列 HTML）里 ——
      //   把它里面的函数名抽出来，比去抓包快得多
      const fns = {};
      let sample = "";
      rows.forEach(function (o) {
        const html = String(o.czOper || "");
        if (!sample && html) sample = html.slice(0, 220);
        const re = /([A-Za-z_$][\w$]*)\s*\(/g;
        let m; while ((m = re.exec(html))) fns[m[1]] = (fns[m[1]] || 0) + 1;
      });
      log("必修操作列里的函数：" + (Object.keys(fns).length ? JSON.stringify(fns) : "（czOper 是空的）"), "warn");
      if (sample) log("czOper 样本：" + sample, "info");
      log("必修课：共 " + rows.length + " 门，有余量 " + free.length + " 门" +
        (free.length ? "（" + free.slice(0, 5).map(function (o) { return o.kcmc + " 余" + o.syrs; }).join("；") + "）" : ""), "ok");
      try {
        console.table(rows.slice(0, 30).map(function (o) {
          return { 分组名: o.fzmc, 课堂名: o.ktmc, 课程名: o.kcmc, 课程号: o.kch, 单位: o.dwmc, 学分: o.xf, 余量: o.syrs, 冲突: o.ctsm };
        }));
      } catch (e) {}
      return rows;
    });
  }

  // 整体刷新：遍历类别（默认用页面 #szjylb 的全部选项）→ 后台拿全部课程
  function apiRefreshAll() {
    const SH = S();
    if (!CFG.api.enabled || SH.apiBusy) return;
    let cats = null;
    learnCats();                                  // 有 #szjylb 就顺手把类别表学下来
    const names = catNames();
    if (!names.length) { SH.apiErr = "还没学到类别表：先在选课页跑一次，脚本会把类别学下来"; return; }
    if (!CFG.api.categories) {
      cats = names.map(function (t) { return { text: t, value: catValue(t) }; });
    } else {
      cats = CFG.api.categories.map(function (n) {
        const t = names.filter(function (x) { return x === n || x.indexOf(n) >= 0; })[0];
        return t ? { text: t, value: catValue(t) } : null;
      }).filter(Boolean);
    }
    cats = cats.filter(function (c) { return c && c.value; });
    if (!cats.length) return;

    SH.apiBusy = true;
    const t0 = Date.now();
    SH.apiReqs = 0;
    SH.apiBigOK = null;      // 服务端认不认大 iDisplayLength，第一次刷新就能看出来
    const acc = [];
    let i = 0;

    (function step() {
      if (i >= cats.length) {
        SH.apiRows = acc;
        SH.apiStamp = Date.now();
        SH.apiBusy = false;
        SH.apiErr = "";
        if (acc.length !== SH.apiCount) {
          SH.apiCount = acc.length;
          // ★ 报出到底刷了哪几个类别 —— "接口数据 10 门"这种异常一看名字就知道是漏刷了还是真只有 10 门
          log("本次刷的类别：" + cats.map(function (c) { return c.text + "(" + c.value + ")"; }).join("、"), "info");
          log("★ 接口刷新完成：" + cats.length + " 个类别 / " + acc.length + " 门课程 / " +
            SH.apiReqs + " 次请求 / " + (Date.now() - t0) + "ms" +
            (SH.apiBigOK === false ? "（服务端不认大 pageSize，已按页循环拉）" : ""), "ok");
        }
        S().apiMs = Date.now() - t0;
        render(); renderCats();
        return;
      }
      const c = cats[i++];
      apiListAll(c.value).then(function (rows) {
        // ★ 每个类别各回来几门：把"总共只有 10 门"拆开看 —— 是真只有 10 门，还是某个类别空了
        log("  " + c.text + "(" + c.value + ")：" + rows.length + " 门", "info");
        rows.forEach(function (o) { o.__catText = c.text; });
        acc.push.apply(acc, rows);
        step();
      });
    })();
  }

  // ★ 直连提交：绕开页面 xsxkOper（它里面有 debugger;，F12 开着会断住）
  function apiSubmit(o) {
    const A = CFG.api;
    const cfbs = (o.cfbs === null || o.cfbs === undefined) ? "null" : String(o.cfbs);
    const url = A.submitUrl + "?kcid=" + encodeURIComponent(o.jx02id || "") + "&cfbs=" + encodeURIComponent(cfbs);
    const body = "jx0404id=" + encodeURIComponent(o.jx0404id || "") + "&xkzy=&trjf=&sfsyjc=";
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest"
      },
      body: body,
      credentials: "same-origin"
    }).then(function (r) { return r.text(); })
      .then(function (t) {
        let j = null;
        try { j = JSON.parse(t); } catch (e) {}
        const ok = j ? (j.success === true || j.success === "true") : /"success"\s*:\s*true/.test(t);
        const msg = (j && j.message) ? j.message : String(t).slice(0, 200);
        return { ok: ok, msg: msg, raw: String(t).slice(0, 600) };
      })
      .catch(function (e) { return { ok: false, msg: "请求失败：" + (e && e.message), raw: "" }; });
  }

  function parseRow(row, cols) {
    const cells = row.cells;
    if (!cells || cells.length < 4) return null;
    const html = row.innerHTML || "";
    const last = cells[cells.length - 1];
    const lastHtml = last ? last.innerHTML : "";
    const txt = function (i) { return (i != null && cells[i]) ? norm(cells[i].textContent) : ""; };

    let args = null;
    try { const m = html.match(CFG.submitArgsRegex); if (m) args = m.slice(1); } catch (e) {}

    let id = args && args[0] ? String(args[0]) : "";
    if (!id) {
      try { const d = row.querySelector("div[id]"); if (d) id = String(d.id).replace(/^[a-z]+_/i, "").trim(); } catch (e) {}
    }

    let code = txt(cols.code);
    let name = txt(cols.name);
    if (!code) {
      for (let i = 0; i < Math.min(cells.length, 3); i++) {
        const t = norm(cells[i].textContent);
        if (/^[A-Za-z0-9]{4,16}$/.test(t) && /\d/.test(t)) { code = t; break; }
      }
      if (!code) code = norm(cells[0] && cells[0].textContent);
    }
    if (!name) {
      let a = null;
      try { a = row.querySelector("a[href*='openkcjj']"); } catch (e) {}
      name = a ? norm(a.textContent) : norm(cells[1] && cells[1].textContent);
    }
    if (!id) id = (code + "_" + txt(cols.teacher)).replace(/\s+/g, "_");

    let remain = -1;
    for (const i of cols.remain) {
      const t = txt(i);
      if (/^\d+$/.test(t)) { remain = parseInt(t, 10); break; }
    }

    const statusText = txt(cols.status);
    const full = row.textContent || "";
    const conflicted = statusText.indexOf(CFG.word.conflict) >= 0 ||
      (full.indexOf(CFG.word.conflict) >= 0 && full.indexOf(CFG.word.noConflict) < 0);
    const already = CFG.word.selected.some(function (w) { return lastHtml.indexOf(w) >= 0 || statusText.indexOf(w) >= 0; });

    let btn = null;
    if (last && last.querySelector) {
      try {
        btn = last.querySelector("a[href*='" + CFG.submitFn + "']") ||
              last.querySelector("button:not(." + BTN_CLASS + "), input[type='button'], a:not(." + BTN_CLASS + ")");
      } catch (e) {}
    }

    return {
      id: id, code: code, name: name, teacher: txt(cols.teacher), timeInfo: txt(cols.time),
      category: txt(cols.category), remain: remain, conflicted: conflicted, already: already,
      statusText: statusText, btn: btn, args: args, row: row,
      __api: row.__api || null
    };
  }

  // ★ 五个数据源合一，全部去重
  // 归并键：教学班级别（课程号|课名|教师|时间）—— DOM 行和接口行都能算，
  // 同班不重复计数、不同班不互相吞掉
  function keyOf(r) {
    return [r.code || r.id || "", r.name || "", r.teacher || "", r.timeInfo || ""].join("|");
  }

  function allParsed(ctx, t, cols) {
    const out = [];
    const seen = {};
    function add(row, cat) {
      const info = parseRow(row, cols);
      if (!info) return;
      const d = keyOf(info);
      if (seen[d]) return;
      seen[d] = 1;
      info.win = ctx.win; info.doc = ctx.doc;
      if (cat) info.__cat = cat;
      out.push(info);
    }
    // ★★★ 接口数据（最高优先级：不受分页、不受类别显示、不碰页面）
    // ★ 数据源按模式隔离：必修模式只用必修列表、通识模式只用通识列表。
    //   否则必修搜索会把通识课也搜出来（用户实测：必修搜索搜到了通识课「体育美学专题」）。
    // ★ v7.1：队列模式把【通识池 + 必修池】合并进同一个快照，队列项各自按 kind 匹配；
    //   否则必修项与通识项会互相看不见对方的数据。
    const apiSrc = CFG.queueMode
      ? (S().apiRows || []).concat(S().bxRows || [])
      : ((CFG.mode === "bx") ? (S().bxRows || []) : S().apiRows);
    if (CFG.api.enabled && apiSrc.length) {
      for (const o of apiSrc) {
        const info = apiRowOf(o, o.__catText);
        const d = keyOf(info);
        if (seen[d]) continue;
        seen[d] = 1;
        info.win = ctx ? ctx.win : W;
        info.doc = (ctx && ctx.doc) || document;
        out.push(info);
      }
    }
    // ★ 接口池非空 → 不再混用页面行（接口是全量：不受分页、不受当前类别限制）
    //   混着用会出两种假象：① 同一个班两条记录（接口行 name 带分组名、页面行不带 → 去重键不同）
    //                     ② 页面行的状态列会把班标成"已在课表"
    const apiWins = CFG.api.enabled && apiSrc.length > 0;
    if (t && !apiWins) {
      for (const r of rowsOf(t)) {
        if (r.classList.contains("dataTables_empty") || r.classList.contains("layui-hide")) continue;
        add(r);
      }
    }
    for (const r of S().pagedRows) add(r);
    for (const cat of Object.keys(S().catRows || {})) {
      for (const r of S().catRows[cat]) add(r, cat);      // ★ 类别轮询抓到的行也要进池子，并带类别标签
    }
    if (CFG.useServerCache) for (const r of S().allRows) add(r);
    return out;
  }

  function snapshot() {
    const ctx = findCtx();
    const t = ctx.none ? null : resolveTable(ctx);
    const cols = colsFor(t);
    return { ctx: ctx, t: t, cols: cols, all: allParsed(ctx, t, cols) };
  }

  function scan(key, snap) {
    const k = String(key || "").trim();
    if (!k) return [];
    const s = snap || snapshot();
    return s.all.filter(function (i) {
      return i.id === k || i.code === k || String(i.name).indexOf(k) >= 0;
    });
  }

  /* ============ 注入 / 队列 ============ */

  function inject() {
    const ctx = findCtx();
    if (ctx.none) return;
    const t = resolveTable(ctx);
    if (!t) return;
    const cols = colsFor(t);
    for (const row of rowsOf(t)) {
      if (row.classList.contains("dataTables_empty") || row.classList.contains("layui-hide")) continue;
      if (row.querySelector("." + BTN_CLASS)) continue;
      const info = parseRow(row, cols);
      if (!info || !info.id) continue;
      const last = row.cells[row.cells.length - 1];
      if (!last) continue;
      const b = ctx.doc.createElement("button");
      b.className = BTN_CLASS;
      b.textContent = "⚡ 抢这门";
      b.style.cssText = "margin-left:6px;background:#0284c7;color:#fff;border:none;border-radius:4px;" +
        "padding:2px 6px;font-size:11px;cursor:pointer;font-weight:bold;position:relative;z-index:9;";
      b.onclick = function (e) { e.preventDefault(); e.stopPropagation(); addTarget(info); };
      last.appendChild(b);
    }
  }

  // ★ v7.1 队列项的匹配规则（按 kind 分派）
  function matchItem(q, i) {
    const kind = q.kind || "kw";
    // ★★ 必须用 q.code（纯名字），不能用 q.id —— id 是带类型前缀的复合键（"gg-cat:人文科学"），
    //   拿它跟 i.__cat（"人文科学"）比永远不相等 → 类别项/分组项永远匹配不到任何课 →
    //   静默地不提交、也没有任何报错（用户实测："之前禁止会报错，现在啥都没了"）。
    const k = String(q.code || q.id || "");
    if (kind === "gg-cat") return String(i.__cat || "") === k;              // 通识类别：精确匹配类别名
    if (kind === "bx-group") {                                             // 必修分组：只看分组名/课堂名
      const spec = String((i.group || "") + " " + (i.classroom || "")).trim();
      return spec ? spec.indexOf(k) >= 0 : String(i.name || "").indexOf(k) >= 0;
    }
    return i.id === k || i.code === k || String(i.name || "").indexOf(k) >= 0;   // 关键词：课名/课号
  }

  // ★ 入队助手：类别任务（通识）与分组任务（必修）
  function enqueueTask(kind, key, name) {
    const id = kind + ":" + key;
    if (S().queue.some(function (c) { return c.id === id; })) return false;
    S().queue.push({ id: id, kind: kind, name: name || key, code: key });
    save(); render();
    log("入队（" + (kind === "gg-cat" ? "通识类别" : "必修分组") + "）：" + (name || key), "ok");
    return true;
  }
  function dequeueTask(kind, key) {
    const id = kind + ":" + key;
    const i = S().queue.findIndex(function (c) { return c.id === id; });
    if (i < 0) return false;
    S().queue.splice(i, 1);
    save(); render();
    log("出队：" + key, "info");
    return true;
  }

  function addTarget(info) {
    // ★ 点某一行的「抢」= 抢【那个班】，所以优先用最具体的标识：
    //   分组名 > 课堂名 > 课程名。否则一堆「体育(3)」会互相撞在一起。
    const specific = info.group || info.classroom || "";
    const key = specific || info.id || info.code;
    if (!key) return;
    const q = S().queue;
    if (!q.some(function (c) { return c.id === key; })) {
      q.push({ id: key, code: info.code || key,
               name: (info.name || key) + (specific && String(info.name || "").indexOf(specific) < 0 ? "／" + specific : ""),
               teacher: info.teacher || "", timeInfo: info.timeInfo || "",
               group: specific, code2: info.code || key });
      save(); render();
      log("加入监控：" + (info.name || key), "ok");
    }
    // ★ 等待页只登记，不启动搜索 —— 搜索要"进了轮次"才开始（用户明确要求：
    //   "进去之后自动跳转然后才开始搜索"）。以前这里无条件 start()，于是
    //   在等待页点一下「锁定」引擎就跑起来了，接着点「准时进并抢课」反而进不去（见 maybeArm）。
    if (!S().running && !hasRoundUI()) start();
  }

  function addManual(v) {
    const parts = String(v || "").split(/[\n,，;；]/).map(function (x) { return x.trim(); }).filter(Boolean);
    if (!parts.length) return;
    parts.forEach(function (s) { addTarget({ id: s, code: s, name: s, teacher: "", timeInfo: "" }); });
    log("已加入 " + parts.length + " 个目标：" + parts.join("、") + "｜" +
      (hasRoundUI() ? "已在等待页登记，进轮次后自动开始搜索（不用选类别）" : "开始盯盘搜索（不用选类别）"), "info");
    // 立刻搜一轮，不用等下一个轮询周期
    setTimeout(function () {
      const ctx = findCtx();
      if (ctx.none) return;
      try { if (!ctx.doc.getElementById("szjylb")) return; } catch (e) { return; }   // 没类别下拉的 tab 不用轮
      if (S().catBusy) return;
      S().catManual = true;
    }, 700);
  }

  /* ============ 提交 ============ */

  function captchaOn(ctx) {
    try {
      const el = (ctx.doc || document).getElementById("sfyzmxk");
      return !!el && String(el.value).trim() === "1";
    } catch (e) { return false; }
  }

  function submit(c) {
    const s = st(c.id);
    if (s.selecting) return;
    s.selecting = true;
    S().lastMsg = "";
    S().submitResult = [];

    const ctx = findCtx();
    const win = c.win || ctx.win || W;
    log("发现余量 " + c.remain + "！提交【" + c.name + (c.category ? "／" + c.category : "") + "】", "warn", c.code);

    if (CFG.abortOnCaptcha && captchaOn(ctx)) {
      log("⚠ 本轮启用验证码（#sfyzmxk=1），需人工填码，已暂停", "err");
      s.selecting = false; stop(); return;
    }

    hookNet(win); hookJq(win); hookMessages(win);

    // ★★★ 接口模式提交：直接用 JSON 里的 jx0404id / jx02id 打提交接口，
    //    不弹窗、不阻塞、也不碰页面（页面的 xsxkOper 里有 debugger;）
    if (CFG.api.enabled && c.__api && c.__api.jx0404id) {
      const o = c.__api;
      log("直连提交【" + c.name + "】jx0404id=" + o.jx0404id, "warn", c.code);
      const t0 = Date.now();
      apiSubmit(o).then(function (r) {
        log("提交返回（" + (Date.now() - t0) + "ms）：" + (r.ok ? "✅ 成功" : "✗ 失败") + " · " + r.msg, r.ok ? "ok" : "warn", c.code);
        if (r.ok) {
          markOk(c, "接口返回：" + r.msg);
        } else {
          // ★ 终局性拒绝（09-19 用户实测）：服务器说「公共选修选课不开放！」——
          //   这不是手慢没抢到，而是**这个轮次当前不给你选**（轮次已关/结果被撤回）。
          //   列表接口照样返回数据（它不查轮次），所以脚本会一直找到"有余量"的课再提交，
          //   结果全是这一句 —— 再打一百次也一样，直接停，并说清为什么。
          if (/不开放|未开放|不在选课时间|选课时间已过|无权|不允许|已结束/.test(r.msg)) {
            s.selecting = false;
            log("⛔ 服务器：" + r.msg + " —— 这个轮次当前不给你选，脚本停止（继续等也没用）", "err");
            stop();
            return;
          }
          s.fails++;
          s.selecting = false;
          if (/已满|人数已满|冲突|重复/.test(r.msg)) s.fails = Math.max(0, s.fails - 1); // 满员不算失败
          if (s.fails >= CFG.maxFails) { log("连续失败 " + s.fails + " 次，自动停止", "err"); stop(); }
          save(); render();
        }
      });
      return;
    }

    let done = false;
    if (c.args && c.args.length && CFG.submitFn) {
      try {
        if (typeof win[CFG.submitFn] === "function") { win[CFG.submitFn].apply(win, c.args); done = true; }
        else {
          const d = c.doc || ctx.doc || document;
          const sc = d.createElement("script");
          sc.textContent = CFG.submitFn + "(" + c.args.map(function (a) { return JSON.stringify(String(a)); }).join(",") + ");";
          (d.head || d.body || d.documentElement).appendChild(sc);
          sc.remove();
          done = true;
        }
      } catch (e) {}
    }
    if (!done && c.btn) { try { c.btn.click(); done = true; } catch (e) {} }

    if (!done) {
      log("这一行没有 " + CFG.submitFn + " 参数（退课行 / 或不在可选列表）", "err", c.code);
      s.selecting = false; return;
    }

    autoConfirm(CFG.confirmWaitMs, function (n) {
      if (!n) log("没等到确认弹窗", "warn", c.code);
      setTimeout(function () { verify(c); }, CFG.verifyDelayMs);
    });
  }

  function judge() {
    const R = S().submitResult;
    for (let i = R.length - 1; i >= 0; i--) {
      const b = R[i].body || "";
      if (/"success"\s*:\s*true/.test(b)) {
        const m = b.match(/"message"\s*:\s*"([^"]*)"/);
        return { ok: true, msg: m ? m[1] : "成功" };
      }
      if (/"success"\s*:\s*false/.test(b)) {
        const m = b.match(/"message"\s*:\s*"([^"]*)"/);
        return { ok: false, msg: m ? m[1] : b.slice(0, 120) };
      }
    }
    const lm = S().lastMsg;
    if (/成功/.test(lm)) return { ok: true, msg: lm.slice(0, 120) };
    if (/失败|已满|冲突|重复|超过/.test(lm)) return { ok: false, msg: lm.slice(0, 120) };
    return null;
  }

  function verify(c) {
    const s = st(c.id);
    try {
      const r = judge();
      if (r && r.ok) markOk(c, "服务器返回：" + r.msg);
      else if (r && !r.ok) { s.fails++; log("未成功：" + r.msg, "warn", c.code); }
      else {
        const now = scan(c.id).filter(function (x) { return x.id === c.id; })[0];
        if (now && now.already) markOk(c, "状态已变成已选");
        else { s.fails++; log("没拿到明确结果，已尝试 " + s.fails + " 次", "info", c.code); }
      }
      if (!s.success && s.fails >= CFG.maxFails) { log("【" + c.name + "】连续失败 " + s.fails + " 次，自动停止", "err"); stop(); }
    } catch (e) {
    } finally { s.selecting = false; save(); render(); }
  }

  function markOk(c, why) {
    const s = st(c.id);
    s.success = true; s.fails = 0;
    log("🎊 抢到了【" + c.name + "】（" + why + "）", "ok", c.code);
    alertSuccess(c, why);
    // ★ 09-19 实测：**通识可以抢多门**（用户一次抢到两门，共 4.0 学分）——
    //   以前这里"类别模式抢到 1 门就停"，依据的是"通识只能选一门"，那条规则已作废。
    //   现在：只按 CFG.stopAfter 停（0 = 不限）；队列目标全部抢到才停。
    S().wins = (S().wins || 0) + 1;
    const q = S().queue;
    const allQueueDone = q.length > 0 && q.every(function (x) { return st(x.id).success; });
    if (CFG.stopAfter > 0 && S().wins >= CFG.stopAfter) {
      log("已抢到 " + S().wins + " 门（达到 stopAfter=" + CFG.stopAfter + "），自动停止", "ok");
      stop();
    } else if (allQueueDone) {
      log("队列目标全部抢到（共 " + S().wins + " 门），自动停止", "ok");
      stop();
    } else {
      log("已抢到 " + S().wins + " 门，继续盯剩下的目标", "ok");
      render();
    }
    save();
  }

  /* ============ ★ 抢到后的三重提醒 ============ */

  function alertSuccess(c, why) {
    const body = c.name + (c.teacher ? " · " + c.teacher : "") + (c.timeInfo ? "\n" + c.timeInfo : "") + "\n" + (why || "");
    if (CFG.notify.flashTitle) {
      try {
        const base = document.title;
        let flip = false, n = 0;
        const id = setInterval(function () {
          flip = !flip;
          document.title = flip ? "🎊 抢到了 " + c.name : base;
          if (++n > 20) { clearInterval(id); document.title = "🎊 抢到了 " + c.name; }
        }, 700);
      } catch (e) {}
    }
    if (CFG.notify.sound) beep(3);
    if (CFG.notify.desktop) {
      try {
        const N = W.Notification;
        if (N) {
          const fire = function () {
            try { new N("🎊 抢课成功", { body: body, tag: "grab" }); } catch (e) {}
          };
          if (N.permission === "granted") fire();
          else if (N.permission !== "denied") N.requestPermission().then(function (p) { if (p === "granted") fire(); });
        }
      } catch (e) {}
    }
    try {
      const ui = hostDoc().getElementById(PANEL_ID);
      if (ui) {
        ui.style.borderColor = "#4ade80";
        ui.style.boxShadow = "0 0 0 4px rgba(74,222,128,.55), 0 16px 40px rgba(0,0,0,.7)";
        ui.style.display = "block";
      }
    } catch (e) {}
  }

  function beep(times) {
    try {
      const AC = W.AudioContext || W.webkitAudioContext;
      if (!AC) return;
      const ac = new AC();
      const n = times || 3;
      for (let i = 0; i < n; i++) {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.connect(g); g.connect(ac.destination);
        o.type = "sine";
        o.frequency.value = 880;
        const t0 = ac.currentTime + i * 0.35;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
        o.start(t0); o.stop(t0 + 0.32);
      }
    } catch (e) {}
  }

  /* ============ 主循环 ============ */

  function refresh(ctx) {
    try { if (CFG.refreshFn && typeof ctx.win[CFG.refreshFn] === "function") { ctx.win[CFG.refreshFn](); return true; } } catch (e) {}
    try { const b = ctx.doc.querySelector(CFG.refreshBtn); if (b) { b.click(); return true; } } catch (e) {}
    return false;
  }

  function tick() {
    const SH = S();
    if (!SH.running) return;
    SH.tickNo++;

    const ctx = findCtx();
    const hasTable = !ctx.none && !!resolveTable(ctx);
    // ★★ 没有课程表也照样能抢 —— 接口这条路完全不碰页面。
    //   用户实测："直接等待页面进去 → 选类型 → 进去，接口通了"，也就是 apiFirst 之后我们
    //   停在「选课学分情况」；而旧代码在这里 ctx.none 就 return，于是**每拍原地返回、一下都没抢**。
    if (ctx.none && !CFG.api.enabled) { updateStatus("这一页没有课程表（切到选课列表页）"); return; }
    try { hookNet(ctx.win); hookJq(ctx.win); hookMessages(ctx.win); } catch (e) {}

    // ★ 必修模式单独一条路：列表/提交都走接口（bxxkOper 已抓到）
    // ★ v7.1 队列模式：两个池都要刷（通识全类别 + 必修全表），队列项才有数据可匹配
    if (CFG.queueMode) {
      // ★ 按需刷池：队列里有什么类型就刷哪些池 —— 只放必修任务时不必拉 5 个通识类别
      //   （kw 关键词任务要两个池都看；空队列时两个都刷，好让类别看板有数据）
      const open = SH.queue.filter(function (c) { const s2 = st(c.id); return !s2.success && !s2.terminal; });
      const needGg = !open.length || open.some(function (c) { return (c.kind || "kw") !== "bx-group"; });
      const needBx = !open.length || open.some(function (c) { return (c.kind || "kw") !== "gg-cat"; });
      if (needGg && !SH.apiBusy && Date.now() - (SH.apiStamp || 0) > CFG.api.refreshMs) apiRefreshAll();
      if (needBx && !SH.bxBusy && Date.now() - (SH.bxStamp || 0) > CFG.api.refreshMs) {
        SH.bxBusy = true;
        apiBxListAll().then(function (rows) {
          SH.bxErr = (rows && rows.length) ? "" : "必修列表返回 0 条（可能被踢下登录，或不在「必修选课」标签页）";
          SH.bxRows = rows || []; SH.bxStamp = Date.now(); SH.bxBusy = false; render();
        });
      }
      SH.snapAll = snapshot().all;
    }
    if (CFG.mode === "bx" && !CFG.queueMode) {
      bxTick();
      // ★★ 必修分支在这里就 return 了，而 S().snapAll 是在本函数后半段才赋值的
      //     → 必修模式下 snapAll 永远是空的 → 面板的匹配列表读它 → 搜什么都"没有匹配"。
      //     （用户实测：池子 19 门、分组名里有「篮球2」，搜「篮球」却匹配不到）
      try { S().snapAll = snapshot().all; } catch (e) {}
      render();
      return;
    }

    // ★ 接口刷新的唯一门槛是"引擎在跑"：
    //   start() 只会由「进轮次之后」或用户手点开始触发 → 天然满足"进去之后才开始搜索"，
    //   不必再拿"有没有课程表"当代理判据（拿代理判据已经坑过两次了）。
    if (CFG.api.enabled && !CFG.queueMode && CFG.mode !== "bx" && !SH.apiBusy &&
        Date.now() - (SH.apiStamp || 0) > CFG.api.refreshMs) {
      apiRefreshAll();
    }
    // 页面自身低频刷新一次，只为别让页面看起来卡死（不参与判定）
    if (hasTable && SH.tickNo % (CFG.refreshEvery * 12) === 0) refresh(ctx);

    // ★ v7.2：队列模式下"类别"已经是队列项，旧的全局类别分支必须关掉 ——
    //   否则 sessionStorage 里残留的类别会继续命中，日志里会冒出"搜索人文"（用户实测报的）
    const catOn = !CFG.queueMode && CFG.category.enabled && CFG.category.match.length;
    if (!SH.queue.length && !catOn) return;

    const snap = snapshot();
    SH.snapAll = snap.all;

    // 类别模式：勾选的类别里有余量就抢（精确匹配，不受页面/分页限制）
    if (catOn) {
      const hits = snap.all.filter(function (r) {
        if (!(r.remain > 0) || r.conflicted || r.already) return false;
        const cat = r.__cat || r.category || "";
        return CFG.category.match.some(function (m) { return cat === m; });
      });
      if (hits.length) {
        hits.sort(function (a, b) { return b.remain - a.remain; });
        log("类别命中 " + hits.length + " 门（" + (hits[0].__cat || hits[0].category) + "），抢【" + hits[0].name + "】余量 " + hits[0].remain, "warn");
        submit(hits[0]);
        render();
        return;
      }
    }

    // ★★ v7.1 统一队列：所有未完成项每拍一起匹配（并行盯盘），每拍最多提交一个（串行提交）。
    //   为什么这样：数据源是全量的（两池共用），盯 N 个目标不增加请求；
    //   而"做完 A 才看 B"会让永远满员的 A 把 B 饿死 —— 这正是用户要避免的"卡住"。
    for (const q of SH.queue) {
      const s = st(q.id);
      if (s.success || s.selecting || s.terminal) continue;
      const rows = snap.all.filter(function (i) { return matchItem(q, i); });
      if (!rows.length) continue;
      s.found = true;
      // ★★ 匹配到但一个都不可抢 → 必须说出来。
      //   以前这里是静默的：面板列了匹配的班，但引擎一声不吭 → 用户会以为"提交坏了"（实测问过）。
      //   跟"空状态不能静默"是同一条规矩。
      const canGrab = rows.filter(function (r) { return r.remain > 0 && !r.conflicted && !r.already; });
      if (!canGrab.length && SH.tickNo % 20 === 1) {
        const whyTxt = rows.slice(0, 3).map(function (r) {
          const w = [];
          if (r.already) w.push("已在课表");
          if (r.conflicted) w.push("时间冲突");
          if (!(r.remain > 0)) w.push(r.remain === 0 ? "满" : "余量未知");
          return (r.group || r.name) + "=" + (w.join("+") || "?");
        }).join("；");
        log("【" + q.name + "】匹配到 " + rows.length + " 个班，但都不可抢：" + whyTxt + " → 有人退课就会抢", "info");
      }

      if (q.name === q.id && rows[0].name && rows[0].name !== q.id) {
        q.name = rows[0].name; q.code = rows[0].code || q.code;
        q.teacher = rows[0].teacher; q.timeInfo = rows[0].timeInfo;
        save(); render();
      }

      const got = rows.filter(function (r) { return r.already; })[0];
      if (got) {
        // ★ "已在课表"不等于"抢到了"：以前这里也走 markOk → 面板报「🎊 抢到了（已在课表里）」
        //   还会响铃。它只是"不用抢"，静默标记成功即可。
        const stt = st(q.id);
        if (!stt.success) {
          stt.success = true;
          log("【" + got.name + "】已经在课表里，跳过（这不算抢到）", "info", got.code);
          save(); render();
        }
        continue;
      }

      for (const r of rows) {
        if (r.conflicted) { if (SH.tickNo % 8 === 0) log("【" + r.name + "】时间冲突，跳过", "warn", q.code); continue; }
        if (r.remain > 0) { submit(r); return; }
      }
    }

    if (!snap.all.length && SH.tickNo % 4 === 0) {
      updateStatus("已进入轮次，守候中 —— 课程列表还没开放，出来就抢");
      render();
      return;
    }
    if (SH.tickNo % 4 === 0) {
      const age = SH.apiStamp ? Math.round((Date.now() - SH.apiStamp) / 1000) : -1;
      const free = snap.all.filter(function (r) { return r.remain > 0 && !r.conflicted && !r.already; }).length;
      updateStatus("盯盘中｜接口 " + snap.all.length + " 门" + (age < 0 ? "" : "（" + age + " 秒前）") +
        "｜现在有余量 " + free + " 门｜队列 " + SH.queue.length + " 个目标");
    }
    render();
  }

  function start() {
    const SH = S();
    if (SH.running) return;
    const legacyCat = !CFG.queueMode && CFG.category.enabled && CFG.category.match.length;
    if (!SH.queue.length && !legacyCat) {
      log("先输入课程编号/课名点「锁定」（这一条就够了）；或者点亮类别芯片整类抢", "warn"); return;
    }
    const ctx = findCtx();
    if (CFG.abortOnCaptcha && captchaOn(ctx)) { log("⚠ 本轮启用验证码，自动抢课已禁用", "err"); return; }

    SH.running = true; SH.tickNo = 0; SH.runSince = Date.now();
    SH.queue.forEach(function (q) { const s = st(q.id); s.fails = 0; s.selecting = false; s.found = false; s.terminal = false; });

    const t = ctx.none ? null : resolveTable(ctx);
    log("开始 | 队列 " + SH.queue.length + " 门" + ((!CFG.queueMode && CFG.category.enabled) ? " | 类别模式：" + CFG.category.match.join("/") : "") +
        " | 接口数据 " + S().apiRows.length + " 门 | 页内 " + (t ? rowsOf(t).length : 0), "ok");

    save(); refresh(ctx);
    if (CFG.api.enabled) setTimeout(function () { apiRefreshAll(); }, 200);   // 立刻拉一次
    setTimeout(tick, 400);
    if (SH.timer) clearInterval(SH.timer);
    SH.timer = setInterval(tick, CFG.pollMs);
    if (!CFG.queueMode && CFG.category.enabled && CFG.category.match.length) {
      log("类别模式已开：" + CFG.category.match.join("、") + " —— 该类别下有余量就抢", "info");
    }
    buttons(); updateStatus("正在自动抢课中...");
  }

  function stop(why) {
    const SH = S();
    // ★ 用户问过"为什么突然已停止、也没报禁止" —— 停止有多条来路（终局拒绝/连续失败/队列完成/
    //   守候进入前先停…），只打一句"已停止"根本分不清。这里自动抓调用栈点名。
    let who = why || "";
    if (!who) {
      try {
        // 只取"函数名() 第 N 行"——原来直接打整行，里面是 URL 编码的脚本地址，一长串没人看得懂
        const line = String((new Error().stack || "").split("\n")[2] || "");
        const m = line.match(/at\s+([A-Za-z_$][\w$]*)[^\n]*?:(\d+):(\d+)/);
        who = m ? (m[1] + "() 第 " + m[2] + " 行") : line.trim().slice(0, 60);
      } catch (e) {}
    }
    SH.running = false;
    if (SH.timer) { clearInterval(SH.timer); SH.timer = null; }
    if (SH.burstTimer) { clearInterval(SH.burstTimer); SH.burstTimer = null; }
    save(); log("已停止" + (who ? "  ← " + who : ""), "warn"); buttons(); updateStatus("未运行");
  }

  function startFastLoop() {
    const SH = S();
    if (SH.burstTimer) clearInterval(SH.burstTimer);
    SH.burstUntil = Date.now() + CFG.burstDurationMs;
    if (SH.apiRefreshSaved == null) SH.apiRefreshSaved = CFG.api.refreshMs;
    CFG.api.refreshMs = Math.max(200, CFG.burstPollMs);      // 高频时接口也跟着变密，否则 350ms 空转
    SH.burstTimer = setInterval(function () {
      if (!S().running || Date.now() > S().burstUntil) {
        clearInterval(S().burstTimer); SH.burstTimer = null;
        if (SH.apiRefreshSaved != null) { CFG.api.refreshMs = SH.apiRefreshSaved; SH.apiRefreshSaved = null; }
        log("高频模式结束，回落常规节奏", "info"); return;
      }
      tick();
    }, CFG.burstPollMs);
    log("⚡ 高频模式：" + CFG.burstPollMs + "ms 一次，持续 " + Math.round(CFG.burstDurationMs / 1000) + " 秒", "ok");
  }

  function scheduleAt(hms) {
    const m = String(hms || "").match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!m) { log("时间格式要像 12:00:00", "err"); return; }
    const now = new Date();
    const t = new Date(now.getFullYear(), now.getMonth(), now.getDate(), +m[1], +m[2], +(m[3] || 0), 0);
    if (t.getTime() <= now.getTime()) t.setDate(t.getDate() + 1);
    const SH = S();
    if (SH.scheduleTimer) clearTimeout(SH.scheduleTimer);
    SH.scheduleAt = t.getTime();
    log("⏰ 已设定：" + t.toLocaleTimeString() + "（" + Math.round((t.getTime() - Date.now()) / 1000) + " 秒后）｜提前 " + (CFG.preArmMs / 1000) + " 秒就位", "ok");
    SH.scheduleTimer = setTimeout(function () {
      log("预备就位...", "warn");
      start();
      setTimeout(function () { startFastLoop(); }, Math.max(0, t.getTime() - Date.now()));
    }, Math.max(0, t.getTime() - CFG.preArmMs - Date.now()));
  }

  function debug() {
    const tag = "%c[GRAB.debug v" + VERSION + "] ";
    const sty = "color:#38bdf8;font-weight:bold";
    const ctx = findCtx();
    const t = ctx.none ? null : resolveTable(ctx);
    console.log(tag + "本 frame: " + location.href, sty);
    console.log("  引擎 frame: " + (S().engineFrame || "(未启动)"));
    if (!t) { console.log(tag + "没找到表格", sty); return; }

    const cols = colsFor(t);
    const hs = headersOf(t);
    console.log(tag + "表头: " + hs.map(function (h, i) { return i + ":" + (h || "空"); }).join(" | "), sty);
    console.log(tag + "认出列 → " + JSON.stringify({ code: cols.code, name: cols.name, teacher: cols.teacher, time: cols.time, remain: cols.remain, status: cols.status, category: cols.category }) + " 依据: " + cols._found.join(" "), sty);

    const cats = {};
    snapshot().all.forEach(function (r) { if (r.category) cats[r.category] = (cats[r.category] || 0) + 1; });
    console.log(tag + "可选类别分布 →", sty, cats);

    rowsOf(t).slice(0, 2).forEach(function (row, ri) {
      console.log("---------- 第 " + (ri + 1) + " 行 ----------");
      Array.from(row.cells).forEach(function (c, i) {
        const mark = (i === cols.code ? " ★编号" : "") + (i === cols.remain[0] ? " ★余量" : "") +
          (i === cols.teacher ? " ★教师" : "") + (i === cols.time ? " ★时间" : "") +
          (i === cols.status ? " ★状态" : "") + (i === cols.category ? " ★类别" : "");
        console.log("  列[" + i + "]" + mark + " = " + JSON.stringify(norm(c.textContent)));
      });
      const p = parseRow(row, cols);
      if (p) console.log("  解析 →", { code: p.code, name: p.name, teacher: p.teacher, time: p.timeInfo, category: p.category, remain: p.remain, already: p.already, args: p.args });
    });
    console.log(tag + "刷新函数 " + CFG.refreshFn + " → " + (typeof ctx.win[CFG.refreshFn] === "function" ? "存在 ✅" : "找不到 ❌") +
      " | 验证码 " + (captchaOn(ctx) ? "⚠ 需人工" : "✅ 无需"), sty);
  }

  function net() {
    const L = S().netLog.slice(-25);
    console.log("%c[GRAB.net] 最近 " + L.length + " 条", "color:#38bdf8;font-weight:bold");
    L.forEach(function (o, i) {
      console.log((i + 1) + ". [" + o.status + "] " + o.method + " " + o.url +
        "\n   参数: " + (o.params || "-") +
        "\n   响应: " + (o.len || 0) + " 字节 | JSON键: " + (o.keys || "-") + " | 数组: " + (o.数组条数 == null ? "-" : o.数组条数) +
        "\n   开头: " + String(o.响应开头 || "").slice(0, 130));
    });
    try { copy(JSON.stringify(L, null, 2)); console.log("%c✅ 已复制", "color:#4ade80;font-weight:bold"); } catch (e) {}
    return L;
  }

  // ★ 列出本页所有筛选控件 —— 回答"能不能直接切页面的通选课类别"
  function filters() {
    const ctx = findCtx();
    const out = { frame: ctx.none ? "(未找到表格)" : String(ctx.win.location.href), 控件: [] };
    const docs = ctx.none ? [document] : [ctx.doc];
    docs.forEach(function (d) {
      let els;
      try { els = d.querySelectorAll("input, select, textarea"); } catch (e) { return; }
      Array.from(els).forEach(function (el) {
        try {
          if (el.closest && el.closest("#" + PANEL_ID)) return;
        } catch (e) {}
        const t = el.tagName.toLowerCase();
        if (t === "input" && el.type === "hidden" && !el.id) return;
        const isSel = t === "select";
        out.控件.push({
          id: el.id || "(无id)",
          name: el.name || "",
          类型: t + (el.type ? "/" + el.type : ""),
          当前值: isSel
            ? (el.options[el.selectedIndex] ? String(el.options[el.selectedIndex].text) : "")
            : (el.type === "checkbox" || el.type === "radio"
                ? (el.checked ? "✓已勾选" : "未勾选")
                : String(el.value || "").slice(0, 40)),
          可用选项: isSel ? Array.from(el.options).map(function (o) { return o.text; }).slice(0, 12) : undefined,
          外层文字: (function () {
            try { return norm((el.closest("label") || el.parentElement || {}).textContent || "").slice(0, 30); }
            catch (e) { return ""; }
          })()
        });
      });
    });
    const withId = out.控件.filter(function (c) { return c.id !== "(无id)"; });
    console.log("%c[GRAB.filters] 共 " + out.控件.length + " 个筛选控件（其中有 id 的 " + withId.length + " 个）", "color:#38bdf8;font-weight:bold");
    try {
      console.table(out.控件.map(function (c) {
        return { id: c.id, name: c.name, 类型: c.类型, 当前值: c.当前值, 外层文字: c.外层文字 };
      }));
    } catch (e) {}
    const kw = out.控件.filter(function (c) { return /类别|类型|模块|通选|偏好|性质/i.test(JSON.stringify(c)); });
    console.log(kw.length
      ? "★ 疑似「类别」控件 " + kw.length + " 个，见下方："
      : "★ 没找到任何「类别」相关控件 → 页面上没有类别下拉框，只能读表格的『通选课类别』列（脚本目前就是这么做的）");
    if (kw.length) console.log(kw);
    try { copy(JSON.stringify(out, null, 2)); console.log("%c✅ 已复制到剪贴板", "color:#4ade80;font-weight:bold"); } catch (e) {}
    return out;
  }

  // ★ 结构探针：把当前 tab 的所有 frame / 表格 / 控件 / 函数抓成一份快照
  function probe() {
    const out = { 当前frame: location.href, 时间: new Date().toLocaleString(), frames: [], 表格: [], 控件: [], 函数: [] };

    (function walk(w, d) {
      if (!w || d > 8) return;
      let href = "(跨域，读不到)";
      try { href = w.location.href; } catch (e) {}
      let doc = null;
      try { doc = w.document; } catch (e) {}
      out.frames.push({ 层级: d, url: href, 可读: !!doc });
      if (doc) {
        try {
          Array.from(doc.querySelectorAll("table")).forEach(function (t, i) {
            try {
              if (t.closest && t.closest("#" + PANEL_ID)) return;   // 跳过自己面板里的表
            } catch (e) {}
            const rows = t.querySelectorAll("tbody tr");
            out.表格.push({
              frame: href.slice(0, 110), 序号: i, id: t.id || "(无id)",
              class: String(t.className || "").slice(0, 70),
              像不像课程表_评分: scoreTable(t), 行数: rows.length,
              表头: Array.from(t.querySelectorAll("thead th")).map(function (th) { return norm(th.textContent); }),
              首行各列: rows[0] ? Array.from(rows[0].cells).map(function (c, j) { return j + ":" + norm(c.textContent).slice(0, 40); }) : [],
              首行HTML: rows[0] ? rows[0].outerHTML.replace(/\s+/g, " ").slice(0, 800) : ""
            });
          });
        } catch (e) {}
        try {
          const cand = Array.from(doc.querySelectorAll("input, select, textarea"))
            .filter(function (el) { try { return !(el.closest && el.closest("#" + PANEL_ID)); } catch (e) { return true; } })
            .map(function (el) {
              return { id: el.id || "", name: el.name || "",
                       类型: el.tagName.toLowerCase() + "/" + (el.type || ""),
                       值: String(el.value || "").slice(0, 40) };
            });
          if (cand.length) out.控件.push({ frame: href.slice(0, 110), 列表: cand.slice(0, 60) });
        } catch (e) {}
      }
      try { for (let i = 0; i < w.frames.length; i++) walk(w.frames[i], d + 1); } catch (e) {}
    })(topHost().win, 0);

    const c = findCtx();
    if (!c.none) {
      try {
        Object.keys(c.win).forEach(function (k) {
          if (out.函数.length >= 40 || !/xk|select|query|kc|choose|submit/i.test(k)) return;
          try {
            if (typeof c.win[k] === "function") {
              out.函数.push({ 名: k, 源码: String(c.win[k]).replace(/\s+/g, " ").slice(0, 170) });
            }
          } catch (e) {}
        });
      } catch (e) {}
    }
    out.自动识别 = { 表id: S().tableId, 详情: S().autoTable, 表格frame: c.none ? "未找到" : String(c.win.location.href) };

    console.log("%c[GRAB.probe] 当前 tab 结构快照", "color:#38bdf8;font-weight:bold");
    console.log(out);
    try { copy(JSON.stringify(out, null, 2)); console.log("%c✅ 已复制到剪贴板，直接粘给我", "color:#4ade80;font-weight:bold"); } catch (e) {}
    return out;
  }

  function report() {
    const ctx = findCtx();
    const t = ctx.none ? null : resolveTable(ctx);
    const cols = t ? colsFor(t) : null;
    const snap = snapshot();
    const cats = {};
    snap.all.forEach(function (r) { if (r.category) cats[r.category] = (cats[r.category] || 0) + 1; });
    const info = {
      version: VERSION, 引擎frame: S().engineFrame,
      表头: t ? headersOf(t) : [],
      认出列: cols ? { code: cols.code, name: cols.name, teacher: cols.teacher, time: cols.time, remain: cols.remain, status: cols.status, category: cols.category, 依据: cols._found } : null,
      类别分布: cats,
      队列: S().queue.map(function (c) { const s = st(c.id); return { id: c.id, name: c.name, 状态: s.success ? "已抢到" : (s.fails + "次失败") }; }),
      类别模式: CFG.category,
      运行中: S().running, 验证码: captchaOn(ctx),
      最近请求: S().netLog.slice(-5)
    };
    console.log(info);
    try { copy(JSON.stringify(info, null, 2)); console.log("%c✅ 已复制到剪贴板", "color:#4ade80;font-weight:bold"); } catch (e) {}
    return info;
  }

  /* ============ UI ============ */

  function createUI() {
    const doc = topHost().doc;
    if (!doc || !doc.body) return false;
    const old = doc.getElementById(PANEL_ID);
    if (old) {
      // ★ 面板只能由"当前活着的引擎 frame"持有。iframe 换页后旧面板是僵尸
      //   （按钮指向已销毁的 window，点了没反应）→ 拆掉重建
      if (old.__owner__ === W && !old.__dead__) return true;
      try { old.remove(); } catch (e) {}
    }

    const style = doc.createElement("style");
    style.textContent = [
      "#" + PANEL_ID + "{position:fixed!important;top:14px;right:14px;width:344px!important;z-index:2147483647!important;",
      "background:#090d16!important;border:2px solid #38bdf8!important;border-radius:12px!important;",
      "box-shadow:0 16px 40px rgba(0,0,0,.7)!important;color:#f1f5f9!important;",
      'font:12px/1.5 -apple-system,BlinkMacSystemFont,"Microsoft YaHei",sans-serif!important;overflow:hidden!important}',
      "#" + PANEL_ID + " *{box-sizing:border-box!important}",
      ".grab-hd{padding:9px 12px;background:#0f172a;display:flex;justify-content:space-between;align-items:center;",
      "border-bottom:1px solid #1e293b;cursor:move;user-select:none;font-weight:bold;color:#38bdf8}",
      ".grab-bd{padding:9px;display:flex;flex-direction:column;gap:6px}",
      ".grab-btn{padding:7px;border:none;border-radius:6px;font-size:12px;font-weight:bold;cursor:pointer}",
      ".grab-btn:disabled{opacity:.45;cursor:not-allowed}",
      "#grab-start{background:#0284c7;color:#fff;flex:1}",
      "#grab-stop{background:#be123c;color:#fff;flex:1}",
      ".grab-alt{background:#334155;color:#e2e8f0;flex:1}",
      ".grab-in{background:#020617;border:1px solid #1e293b;border-radius:5px;color:#f1f5f9;padding:6px 8px;font-size:12px}",
      "#grab-add{width:60px;background:#0f766e;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:bold;cursor:pointer}",
      ".grab-tab{flex:1;text-align:center;padding:3px 6px;font-size:11px;border-radius:6px;background:#1e293b;color:#94a3b8;cursor:pointer;user-select:none}",
      ".grab-tab.on{background:#0e7490;color:#fff;font-weight:bold}",
      ".grab-row{display:flex;gap:6px;align-items:center}",
      ".grab-list{max-height:96px;overflow:auto;display:flex;flex-direction:column;gap:4px}",
      ".grab-item{background:#020617;border:1px solid #1e293b;border-radius:4px;padding:4px 7px;display:flex;justify-content:space-between;align-items:center;gap:6px}",
      ".grab-item b{color:#f8fafc}",
      ".grab-sub{color:#64748b;font-size:10px}",
      ".grab-x{color:#f87171;cursor:pointer;font-size:15px;font-weight:bold;padding:0 4px}",
      ".grab-chip{display:inline-block;background:#1e293b;color:#cbd5e1;border-radius:10px;padding:1px 7px;margin:2px 3px 0 0;cursor:pointer;font-size:10px}",
      ".grab-chip.on{background:#0e7490;color:#fff}",
      "#grab-log{font:10px/1.4 monospace;color:#94a3b8;max-height:80px;overflow:auto;background:#020617;border:1px solid #1e293b;border-radius:5px;padding:5px}",
      "#grab-status{font-size:11px;color:#94a3b8}",
      "#grab-info{font-size:10px;color:#4ade80}",
      ".grab-t{width:100%;border-collapse:collapse;font-size:10px}",
      ".grab-t th{text-align:left;color:#64748b;font-weight:normal;padding:2px 3px;border-bottom:1px solid #1e293b}",
      ".grab-t td{padding:3px;border-bottom:1px solid #0f172a;color:#cbd5e1}",
      ".grab-t td.num{text-align:right;font-variant-numeric:tabular-nums}",
      ".grab-t .tag{font-size:9px;padding:1px 5px;border-radius:8px;white-space:nowrap}",
      ".grab-t .t-wait{background:#1e293b;color:#94a3b8}",
      ".grab-t .t-hit{background:#065f46;color:#6ee7b7}",
      ".grab-t .t-none{background:#3f1d1d;color:#fca5a5}"
    ].join("");
    (doc.head || doc.documentElement).appendChild(style);

    const ui = doc.createElement("div");
    ui.id = PANEL_ID;
    ui.innerHTML = [
      '<div class="grab-hd" id="grab-hd"><span id="grab-title">🎯 抢名额 v' + VERSION + '</span><span id="grab-min-status" style="display:none;font-size:10px;color:#94a3b8;margin-left:6px;">未运行</span><span id="grab-close" title="最小化" style="cursor:pointer;color:#94a3b8;font-weight:bold;padding:0 4px;">—</span></div>',
      '<div class="grab-bd">',
      '<div id="grab-status">未运行</div>',
      '<div id="grab-info"></div>',
      '<div id="grab-rounds"></div>',
      '<div class="grab-row" style="gap:4px"><span class="grab-tab on" id="grab-mode-gg">通识抢课</span><span class="grab-tab" id="grab-mode-bx">必修抢课</span></div>',
      '<div id="grab-cat-wrap">',
      '<div class="grab-sub" style="margin:0 0 2px 0">类别（点亮 = 这个类别里有余量就抢）：</div>',
      '<div id="grab-cats"></div>',
      '</div>',
      '<div class="grab-row"><input id="grab-manual" class="grab-in" style="flex:1" placeholder="课程编号/课名，可多个用逗号分隔"><button id="grab-add">锁定</button></div>',
      '<div class="grab-list" id="grab-list"></div>',
      '<div class="grab-row"><button class="grab-btn" id="grab-start">🚀 开始</button><button class="grab-btn" id="grab-stop" disabled>⏹ 停止</button></div>',
      '<div id="grab-full" style="display:flex;flex-direction:column;gap:6px">',
      '<div id="grab-cat-tbl"></div>',
      '<button class="grab-btn grab-alt" id="grab-adv-toggle">⚙ 高级工具 ▾</button>',
      '<div id="grab-adv" style="display:none;flex-direction:column;gap:6px">',
      '<div class="grab-row"><button class="grab-btn grab-alt" id="grab-dbg">🔍 诊断</button><button class="grab-btn grab-alt" id="grab-net">🌐 网络</button></div>',
      '</div>',
      '</div>',
      '<div id="grab-log"></div>',
      '</div>'
    ].join("");
    doc.body.appendChild(ui);
    ui.__owner__ = W;
    ui.__dead__ = false;
    S().panelDoc = doc;          // ★ 记下宿主文档，供跨 frame / 已死 frame 使用
    S().panelOwnerUrl = location.href;

    const $ = function (id) { return ui.querySelector(id); };
    $("#grab-close").onclick = function () {
      const u2 = hostDoc().getElementById(PANEL_ID);
      setMinimized(!(u2 && u2.__min));
    };
    $("#grab-start").onclick = function () { callEngine("start"); };
    $("#grab-stop").onclick = function () { callEngine("stop"); };
    $("#grab-dbg").onclick = function () { callEngine("debug"); };
    $("#grab-net").onclick = function () { callEngine("net"); };
    $("#grab-add").onclick = function () { callEngine("addManual", $("#grab-manual").value); $("#grab-manual").value = ""; };
    $("#grab-manual").addEventListener("keydown", function (e) { if (e.key === "Enter") { addManual(e.target.value); e.target.value = ""; } });
    $("#grab-mode-gg").onclick = function () { setMode("gg"); };
    $("#grab-mode-bx").onclick = function () { setMode("bx"); };
    $("#grab-adv-toggle").onclick = function () {
      const a = $("#grab-adv");
      const hide = a.style.display !== "none";
      a.style.display = hide ? "none" : "flex";
      $("#grab-adv-toggle").textContent = hide ? "⚙ 高级工具 ▾" : "⚙ 高级工具 ▴";
    };

    // ★ 勾选框已删（用户："没什么意义"）—— 模式标签 + 类别芯片本身就是开关。
    //   状态一律由 CFG.category.match 推导：有选中项 = 类别模式开
    CFG.category.enabled = CFG.category.match.length > 0;

    const hd = ui.querySelector("#grab-hd");
    hd.onmousedown = function (e) {
      e.preventDefault();
      const box = ui.getBoundingClientRect();
      const move = function (ev) {
        ui.style.left = (box.left + (ev.clientX - e.clientX)) + "px";
        ui.style.top = (box.top + (ev.clientY - e.clientY)) + "px";
        ui.style.right = "auto";
      };
      const up = function () { doc.removeEventListener("mousemove", move); doc.removeEventListener("mouseup", up); };
      doc.addEventListener("mousemove", move);
      doc.addEventListener("mouseup", up);
    };

    render(); renderCats(); renderRounds(); buttons();
    setInterval(inject, 1500);
    setInterval(function () {
      const e = doc.getElementById("grab-info");
      if (!e) return;
      const SH = S();
      const p = [];
      if (CFG.api.enabled) {
        const age = SH.apiStamp ? Math.round((Date.now() - SH.apiStamp) / 1000) : -1;
        p.push("接口 " + (SH.apiRows ? SH.apiRows.length : 0) + " 门");
        p.push(age < 0 ? "未刷新" : age + " 秒前");
        if (SH.apiMs) p.push(SH.apiMs + "ms");
        if (SH.apiBigOK === false) p.push("⚠按页拉");
        if (SH.apiErr) p.push("⚠" + SH.apiErr);
      } else {
        const ctx = findCtx();
        const t = ctx.none ? null : resolveTable(ctx);
        if (t) p.push("页内 " + rowsOf(t).length);
        p.push("合计 " + snapshot().all.length);
      }
      const missing = SH.queue.filter(function (q) { return !st(q.id).success && !st(q.id).found; });
      if (missing.length) p.push("🔍 搜索中 " + missing.length + " 门");
      e.textContent = p.join(" | ");
    }, 2000);
    setInterval(function () { renderCats(); renderRounds(); }, 3000);
    return true;
  }

  function toggleCat(name) {
    // ★ v7.1：队列模式下，点类别芯片 = 把"通识类别任务"加入/移出队列（不再是全局开关）
    if (CFG.queueMode) {
      if (!dequeueTask("gg-cat", name)) enqueueTask("gg-cat", name, name);
      CFG.category.enabled = CFG.category.match.length > 0;
      save(); renderCats(); buttons();
      return;
    }
    if (CFG.mode !== "gg") setMode("gg");        // ★ 选了类别就默认走通识（用户要的）
    const i = CFG.category.match.indexOf(name);
    if (i >= 0) CFG.category.match.splice(i, 1); else CFG.category.match.push(name);
    CFG.category.enabled = CFG.category.match.length > 0;
    save();
    renderCats(); buttons();
  }

  // ★ 通识 / 必修 两个模式（用户要的"专门的标签"）
  function setMode(m) {
    CFG.mode = (m === "bx") ? "bx" : "gg";
    const d = hostDoc();
    ["gg", "bx"].forEach(function (k) {
      const el = d.getElementById("grab-mode-" + k);
      if (el) el.className = "grab-tab" + (CFG.mode === k ? " on" : "");
    });
    if (CFG.mode === "bx") {
      CFG.category.enabled = false;              // 必修没有"类别"这回事

    } else {
      CFG.category.enabled = CFG.category.match.length > 0;

    }
    applyModeUI();
    save(); renderCats(); buttons();
  }

  // 模式标签高亮 + 类别区显隐（必修模式下整块类别都不出现）
  function applyModeUI() {
    try {
      const d = hostDoc();
      ["gg", "bx"].forEach(function (k) {
        const el = d.getElementById("grab-mode-" + k);
        if (el) el.className = "grab-tab" + (CFG.mode === k ? " on" : "");
      });
      const wrap = d.getElementById("grab-cat-wrap");
      if (wrap) wrap.style.display = CFG.mode === "bx" ? "none" : "";
      if (CFG.mode === "bx") { const t = d.getElementById("grab-cat-tbl"); if (t) t.style.display = "none"; }
    } catch (e) {}
  }

  // 方案 C：标签管输入 + 表格管输出（课程数 / 有名额 / 状态）
  /* ============ ★ 选课轮次（等待页面 xklc_list）============ */

  // 轮次表是 LayUI table：扫所有 frame 里带 jrxk(...) 的按钮，再顺着按钮找回它所在的行
  function roundsOf() {
    const raw = [];
    const root = topHost().win;
    (function walk(w, d) {
      if (!w || d > 8) return;
      let doc = null;
      try { doc = w.document; } catch (e) {}
      if (doc) {
        let btns = [];
        // ★ 放宽：除了 jrxk，也认带 zbid / jx0502zbid 的可点元素（页面改版过一次就会全灭）
        try {
          btns = doc.querySelectorAll(
            "button[onclick*='jrxk'], a[onclick*='jrxk'], [onclick*='jrxk'], " +
            "[onclick*='zbid'], a[href*='jx0502zbid'], [onclick*='jx0502zbid']");
        } catch (e) {}
        Array.from(btns).forEach(function (b) {
          let tr = null;
          try { tr = b.closest("tr"); } catch (e) {}
          const cells = tr ? Array.from(tr.cells).map(function (c) { return norm(c.textContent); }) : [];
          const txt = tr ? norm(tr.textContent) : "";
          const m = String(b.getAttribute("onclick") || "").match(/jrxk\(\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*\)/);
          const tm = txt.match(/(\d{4}-\d{2}-\d{2})\s*(\d{2}:\d{2}).*?~\s*(\d{4}-\d{2}-\d{2})\s*(\d{2}:\d{2})/);
          let name = "";
          cells.forEach(function (c) {
            if (!c || /^\d+$/.test(c) || /进入选课/.test(c) || /^\d{4}-\d{2}-\d{2}/.test(c)) return;
            if (c.length > name.length) name = c;
          });
          raw.push({
            name: name,
            start: tm ? (tm[1] + " " + tm[2]) : null,
            end: tm ? (tm[3] + " " + tm[4]) : null,
            args: m ? [m[1], m[2], m[3]] : null,
            cells: cells.length,
            btn: b
          });
        });
      }
      try { for (let i = 0; i < w.frames.length; i++) walk(w.frames[i], d + 1); } catch (e) {}
    })(root, 0);

    // ★ 去重：LayUI 把同一行渲染了多份（主表 + 固定列子表），按 jrxk 参数归并，
    //   保留"格子最多"的那份（主表那份才有轮次名和时间）
    const map = {};
    raw.forEach(function (r) {
      const key = r.args ? r.args.join("|") : ("n" + r.name);
      const prev = map[key];
      if (!prev) { map[key] = r; return; }
      const better = (r.cells > prev.cells) ||
        (r.cells === prev.cells && (r.start && !prev.start)) ||
        (r.cells === prev.cells && !r.name.match(/未命名/) && prev.name.match(/未命名/));
      if (better) map[key] = r;
    });
    return Object.keys(map).map(function (k) {
      const r = map[k];
      return { name: r.name || "(未命名轮次)", start: r.start, end: r.end,
               timeText: r.start ? (r.start + " ~ " + r.end) : "", args: r.args, btn: r.btn };
    });
  }

  function parseDT(s) { try { return new Date(String(s).replace(/-/g, "/")).getTime(); } catch (e) { return 0; } }

  function roundState(r) {
    const s = parseDT(r.start), e = parseDT(r.end), now = Date.now();
    if (!s) return { txt: "时间未知", cls: "t-wait", open: false };
    if (now < s) return { txt: "未开放 " + Math.ceil((s - now) / 60000) + " 分", cls: "t-none", open: false };
    if (e && now > e) return { txt: "已结束", cls: "t-none", open: false };
    return { txt: "● 开放中", cls: "t-hit", open: true };
  }

  function enterRound(idx) {
    const rs = (S().rounds && S().rounds.length) ? S().rounds : roundsOf();
    const r = rs[idx || 0];
    if (!r) { log("这一页没有检测到选课轮次入口", "err"); return; }
    const stt = roundState(r);
    if (r.btn) {
      log("进入轮次：" + r.name + "（" + stt.txt + "）", "ok");
      try { r.btn.click(); return true; } catch (e) { log("点击失败：" + e.message, "err"); }
    }
    try {
      const w = topHost().win;
      if (r.args && typeof w.jrxk === "function") {
        log("调用 jrxk 进入：" + r.name, "ok");
        w.jrxk.apply(w, r.args);
        return true;
      }
    } catch (e) {}
    log("找不到可点的进入按钮", "err");
    return false;
  }

  // ★ 关键修正：不是"到点才进"，而是"提前进 + 到点开抢"。
  //   到点才点「进入选课」，页面加载 + 读类别表 + 第一次刷新要好几秒 ——
  //   那几秒正是名额被抢光的窗口。提前进入后先空转盯盘，T0 一到立刻提交。
  function scheduleEnter(idx) {
    const rs = (S().rounds && S().rounds.length) ? S().rounds : roundsOf();
    const i = idx || 0;
    const r = rs[i];
    if (!r) { log("这一页没有检测到选课轮次", "err"); return; }
    const lead = CFG.enterLeadMs || 20000;
    S().arm = { idx: i, name: r.name, start: r.start, end: r.end, leadMs: lead, entered: false, done: false, on: Date.now() };
    save();
    const t = parseDT(r.start);
    if (t && Date.now() >= t - lead) {
      // 已经进入提前量区间（或已开放）→ 立刻进
      S().arm.entered = true; save();
      log("🚪 已在提前量内，马上进入「" + r.name + "」", "warn");
      enterRound(i);
      return;
    }
    if (!t) { log("读不到这个轮次的开放时间，改为直接进入", "warn"); S().arm.entered = true; save(); enterRound(i); return; }
    log("⏰ 已待命：将在 " + new Date(t - lead).toLocaleTimeString() + "（提前 " + Math.round(lead / 1000) +
        " 秒）进入「" + r.name + "」，开放时间 " + r.start + "，到点自动开抢", "ok");
    maybeArm();
  }

  // ★ 自动切到「公选课选课」标签 —— 进了轮次默认停在「选课学分情况」，
  //   要切过去才有课程表（用户实测：进去连面板都没有，因为那页啥都没有）
  function gotoCourseTab() {
    const KW = CFG.tabKeywords || ["公选课选课"];
    const hits = [];
    allDocs().forEach(function (d) {
      let els = [];
      try { els = d.querySelectorAll("a,li,span,button,div[onclick],td[onclick]"); } catch (e) { return; }
      Array.from(els).forEach(function (el) {
        const t = norm(el.textContent);
        if (!t || t.length > 14) return;
        const i = KW.findIndex(function (k) { return t.indexOf(k) >= 0; });
        if (i < 0) return;
        hits.push({ el: el, t: t, score: (KW.length - i) * 100 - t.length });   // 关键词越靠前、文字越短越像标签
      });
    });
    if (!hits.length) return false;
    hits.sort(function (a, b) { return b.score - a.score; });
    try {
      hits[0].el.click();
      log("已切到标签：「" + hits[0].t + "」", "ok");
      return true;
    } catch (e) { log("切标签失败：" + e.message, "err"); return false; }
  }

  // ★ 一条龙：**现在就进轮次守候** → 课程列表在开放时间一冒出来就抢
  //   为什么不等时间点：舍友实测"轮次列表抢课前就能进"，而课程列表要到 T0 才出来 ——
  //   等时间点再进，等于把整个加载/读表的开销压在 T0 那几秒上（正是名额被抢光的窗口）。
  function armAndGrab(idx) {
    // 输入框里还有没点「锁定」的内容 → 顺手吃掉，别让人白输一遍
    try {
      const inp = hostDoc().getElementById("grab-manual");
      if (inp && String(inp.value).trim()) { addManual(inp.value); inp.value = ""; }
    } catch (e) {}

    const catOn = CFG.category.enabled && CFG.category.match.length;
    if (CFG.mode === "bx") {
      if (!S().queue.length) { log("必修模式：先在下面输入课程编号/课名并点「锁定」（必修不看类别）", "warn"); return; }
    } else if (!catOn && !S().queue.length) {
      log("还差目标：点亮类别芯片（整类抢）或在下面输入课名点「锁定」，二选一即可", "warn"); return;
    }
    const i = idx || 0;
    const rs = (S().rounds && S().rounds.length) ? S().rounds : roundsOf();
    const r = rs[i];
    if (!r) { log("这一页没有检测到选课轮次入口", "err"); return; }
    S().arm = { idx: i, name: r.name, start: r.start, end: r.end, leadMs: 0,
                entered: false, done: false, auto: true, now: true, tries: 0, on: Date.now() };
    save();
    log("🎯 进入守候：现在直接进「" + r.name + "」。课程列表要等 " + (r.start || "开放时间") +
        " 才出来，出来就抢｜" + (catOn ? "目标类别：" + CFG.category.match.join("、") : "目标课程：" + S().queue.length + " 门"), "ok");
    updateStatus("正在进入轮次守候…");
    renderRounds(); renderCats();
    maybeArm();
  }

  // 待命状态机：等提前量 → 进轮次 → 切标签 → 就位开抢 → T0 转高频
  function maybeArm() {
    const a = S().arm;
    if (!a || a.done) return;
    if (S().armTimer) { clearTimeout(S().armTimer); S().armTimer = null; }
    // ★ 这里以前是 if (S().running) return; —— 只要引擎已经在跑（例如在等待页
    //   先锁了目标触发了 start），整个"待命→进入"状态机就再也不动了，
    //   表现就是"点了准时进却进不去"。进入轮次这件事跟 running 无关，去掉这个阻断。

    const ctx = findCtx();
    const onCourse = !ctx.none && !!resolveTable(ctx);

    // ★ 接口优先：进了轮次就能开抢，不必非切到「公选课选课」标签
    //   （列表/提交都是同源 XHR，服务端认 session 里的轮次，不认你在哪个标签页；
    //    ⏳ 没实测过 — 真要求页面上下文时把 CFG.apiFirst 关掉即可回到"先切标签"）
    if (onCourse || (a.entered && CFG.apiFirst)) {   // 到位 → 交棒给正常盯盘
      a.done = true; save();
      if (!S().running) {
        log("✅ 已进入轮次，直接开抢" + (onCourse ? "（课程页已就位）" : "（接口模式，不切标签）"), "ok");
        start();
      }
      const t = parseDT(a.start);
      setTimeout(function () {
        if (!S().running) return;
        log("★ 开放时间到 —— 转高频抢课", "warn");
        startFastLoop();
      }, Math.max(0, t - Date.now()) + 200);
      return;
    }

    if (!a.entered) {
      const t = parseDT(a.start);
      // a.now = 用户点了「进入并守候」→ 立刻进，不等时间点
      const at = a.now ? Date.now()
        : (t ? (t - (a.leadMs == null ? CFG.enterLeadMs : a.leadMs)) : Date.now());
      const wait = at - Date.now();
      if (wait > 0) {
        S().armTimer = setTimeout(function () { S().armTimer = null; maybeArm(); }, Math.min(3000, Math.max(300, wait)));
        return;
      }
      a.entered = true; a.tries = 0; save();
      if (S().running) { try { stop(); } catch (e) {} }   // 等待页上先停掉，别边等边空转
      log("🚪 提前 " + Math.round((a.leadMs || 0) / 1000) + " 秒进入「" + a.name + "」", "warn");
      enterRound(a.idx || 0);
      S().armTimer = setTimeout(function () { S().armTimer = null; maybeArm(); }, 2500);
      return;
    }

    // 点过进入了但还没看到课程表 → 自动切「公选课选课」标签，重试
    a.tries = (a.tries || 0) + 1;
    if (a.tries > 40) {
      a.done = true; save();
      log("⚠ 重试 40 次仍未看到课程表 —— 待命放弃。请手动点「公选课选课」标签，再点「🚀 开始」", "err");
      renderRounds();
      return;
    }
    if (a.tries % 3 === 1 && !gotoCourseTab()) {
      log("第 " + a.tries + " 次：还没找到「公选课选课」标签，继续重试…", "warn");
    }
    S().armTimer = setTimeout(function () { S().armTimer = null; maybeArm(); }, 1500);
  }

  function renderRounds() {
    const d = hostDoc();
    const box = d.getElementById("grab-rounds");
    if (!box) return;
    // ★ 轮次区块只在该出现的地方出现。
    //   以前这个函数每 3 秒无条件重画 → 选课页也会冒出「🛰 守候轮次」（用户实测报的）。
    //   判据（两重，任一成立且不在等待页 → 清空）：
    //     ① URL 不是等待页（不含 xklc）  ② 页面上确实能找到课程表（表头含 课程编号/课程名称/剩余容量）
    //   为什么不用 resolveTable：它在部分帧里会解析失败，判据就落空了（v6.7 就是这么漏的）。
    try {
      const url = String(location.href);
      const isWaiting = /xklc/i.test(url);
      // ★ 硬规则：URL 就是选课页（含 newXsxkzx 且不含 xklc）→ 直接清空，
      //   不等表格渲染。v6.8 只靠"扫到课程表"，而表格可能还没画出来 → 判据落空（用户实测又出现了）。
      if (!isWaiting && /newXsxkzx/i.test(url)) { box.innerHTML = ""; return; }
      let hasCourseTable = false;
      if (!isWaiting) {
        allDocs().forEach(function (doc) {
          if (hasCourseTable) return;
          let ts = [];
          try { ts = doc.querySelectorAll("table"); } catch (e) { return; }
          Array.from(ts).forEach(function (t) {
            const txt = norm(t.textContent || "");
            if (/课程编号|课程名称|剩余容量|剩余名额/.test(txt)) hasCourseTable = true;
          });
        });
      }
      if (hasCourseTable) { box.innerHTML = ""; return; }
    } catch (e) {}
    let rs = [];
    try { rs = roundsOf(); } catch (e) {}
    S().rounds = rs;
    if (!rs.length) {
      // ★ 以前这里直接 box.innerHTML = ""（静默）→ 用户看到的就是"入口没了、也没有自动进入"。
      //   现在把"找过什么、找到几个"写在面板上，并给一个重找按钮。
      let btns = 0, frames = 0;
      try {
        allDocs().forEach(function (d) {
          frames++;
          try { btns += d.querySelectorAll("[onclick*='jrxk'],[onclick*='zbid'],a[href*='jx0502zbid']").length; } catch (e) {}
        });
      } catch (e) {}
      box.innerHTML = '<div class="grab-sub" style="color:#facc15">这一页没检测到选课轮次入口' +
        '（扫了 ' + frames + ' 个 frame，匹配到 ' + btns + ' 个可点元素）。' +
        '如果页面上明明有「进入选课」按钮，点下面重找一次；还不行就把页面截图发我</div>' +
        '<div class="grab-row">' +
        '<button class="grab-btn grab-alt" id="grab-rounds-retry">🔁 重找</button>' +
        '<button class="grab-btn" id="grab-rounds-watch" style="flex:1;background:#7c2d12">' +
        (S().roundsWatch ? "🛰 停止守候" : "🛰 守候轮次（自动刷新）") + '</button></div>' +
        (S().roundsWatch ? '<div class="grab-sub" style="color:#4ade80">守候中：每 ' + Math.round(CFG.roundsWatchMs / 1000) + ' 秒重查一次，轮次一出现就自动进入抢课</div>' : "");
      const rb = d.getElementById("grab-rounds-retry");
      if (rb) rb.onclick = function () { callEngine("renderRounds"); };
      const wb = d.getElementById("grab-rounds-watch");
      if (wb) wb.onclick = function () { callEngine("watchRounds"); };
      return;
    }
    let html = '<table class="grab-t"><thead><tr><th>选课轮次</th><th style="text-align:right">状态</th></tr></thead><tbody>';
    rs.forEach(function (r) {
      const stt = roundState(r);
      html += "<tr><td>" + r.name + '<div class="grab-sub">' + (r.start ? r.start.slice(5) + " ~ " + (r.end || "").slice(5) : "?") + "</div></td>" +
        "<td class='num'><span class='tag " + stt.cls + "'>" + stt.txt + "</span></td></tr>";
    });
    html += "</tbody></table>";
    const arm = S().arm;
    if (arm && !arm.done) {
      html += '<div class="grab-sub" style="color:#facc15">⏰ 待命中：提前 ' + Math.round((arm.leadMs || 0) / 1000) +
        ' 秒进「' + arm.name + '」，' + (arm.start || "?") + ' 开抢</div>';
    }
    html += '<div class="grab-row" style="margin-top:3px">' +
      '<button class="grab-btn" id="grab-arm" style="flex:1;background:#15803d">🎯 进入守候并抢课</button>' +
      '<button class="grab-btn grab-alt" id="grab-enter">🚪 只进入</button>' +
      (arm && !arm.done ? '<button class="grab-btn grab-alt" id="grab-enter-off">✖</button>' : '') + '</div>' +
      '<div class="grab-sub">先点类别芯片或锁定课名 → 点「进入守候并抢课」→ 现在就进轮次，课程一开放就抢（不用守着到点）</div>';
    box.innerHTML = html;
    const b0 = d.getElementById("grab-arm");
    if (b0) b0.onclick = function () { callEngine("armAndGrab", 0); };
    const b1 = d.getElementById("grab-enter");
    if (b1) b1.onclick = function () { callEngine("enterRound", 0); };
    const b2 = d.getElementById("grab-enter-at");
    if (b2) b2.onclick = function () { callEngine("scheduleEnter", 0); };   // 老路子：到点才进
    const b3 = d.getElementById("grab-enter-off");
    if (b3) b3.onclick = function () {
      if (S().armTimer) { clearTimeout(S().armTimer); S().armTimer = null; }
      S().arm = null; save(); log("已撤销到点自动进入", "warn"); renderRounds();
    };
  }

  // 类别看板：接口模式下显示"每个类别多少门 / 现在多少门有余量"
  function renderCats() {
    const d = hostDoc();
    const box = d.getElementById("grab-cats");
    const tbl = d.getElementById("grab-cat-tbl");
    if (!box) return;

    learnCats();
    const names = catNames();
    if (!names.length) {
      box.innerHTML = '<span class="grab-sub">还没学到类别表 —— 先在选课页（有「课程类别」下拉那页）跑一次</span>';
      if (tbl) tbl.innerHTML = "";
      return;
    }
    box.innerHTML = names.map(function (k) {
      // ★ v7.3 队列模式下"选中"由队列推导（点芯片 = 入队），不再看 CFG.category.match ——
      //   否则点了芯片入了队、颜色却不变（用户实测报的）
      const on = (CFG.queueMode
        ? (S().queue || []).some(function (c) { return c.id === "gg-cat:" + k; })
        : CFG.category.match.indexOf(k) >= 0) ? " on" : "";
      return '<span class="grab-chip' + on + '" data-c="' + k + '">' + k + "</span>";
    }).join("");
    Array.from(box.querySelectorAll(".grab-chip")).forEach(function (el) {
      el.onclick = function () { toggleCat(el.dataset.c); };
    });
    if (!tbl) return;

    const rows = S().apiRows || [];
    let html = '<table class="grab-t"><thead><tr><th>类别</th><th style="text-align:right">课程</th>' +
               '<th style="text-align:right">有名额</th><th style="text-align:right">状态</th></tr></thead><tbody>';
    names.forEach(function (nm) {
      // ★ v7.4 队列模式下看板的"参与/不参与"也要看队列 —— 否则入了队却显示"不参与"（用户实测报的）
      const on = CFG.queueMode
        ? (S().queue || []).some(function (c) { return c.id === "gg-cat:" + nm; })
        : CFG.category.match.indexOf(nm) >= 0;
      let total = 0, free = 0;
      rows.forEach(function (o) {
        if (o.__catText !== nm) return;
        total++;
        const remain = parseInt(String(o.syrs == null ? "-1" : o.syrs).replace(/[^0-9-]/g, ""), 10);
        const already = /xstkOper/.test(String(o.czOper || ""));
        const conflict = !!o.ctsm && !/无冲突/.test(String(o.ctsm));
        if (remain > 0 && !already && !conflict) free++;
      });
      let state, cls;
      if (!on) { state = "不参与"; cls = "t-none"; }
      else if (!S().running) { state = "已停止"; cls = "t-none"; }
      else if (free > 0) { state = "★ 可抢 " + free; cls = "t-hit"; }
      else { state = "盯盘中"; cls = "t-wait"; }
      html += "<tr><td>" + nm + "</td><td class='num'>" + (total || "-") + "</td><td class='num'>" +
              (on ? free : "-") + "</td><td><span class='tag " + cls + "'>" + state + "</span></td></tr>";
    });
    html += "</tbody></table>";
    const age = S().apiStamp ? Math.round((Date.now() - S().apiStamp) / 1000) : -1;
    tbl.innerHTML = html + '<div class="grab-sub">接口数据共 ' + rows.length + " 门" +
      (age < 0 ? "（还未刷新）" : "（" + age + " 秒前）") + "</div>";
  }

  // 页面上有没有 jrxk 轮次入口（= 是不是等待页）—— 轻量现场探测，别拿缓存判
  function hasRoundUI() {
    try {
      return allDocs().some(function (d) {
        try { return !!d.querySelector("button[onclick*='jrxk'], a[onclick*='jrxk']"); } catch (e) { return false; }
      });
    } catch (e) { return false; }
  }

  // ★ GRAB.xklc()：探查"PC 端轮次列表为什么不出现"（手机端却有）
  //   一次打全：查询按钮的源码、最近一次查询请求与响应、轮次表所在 frame、学年学期控件的值
  function xklc() {
    const out = {};
    // 1) 查询按钮的 onclick 源码 —— 看它到底请求了什么、带哪些参数
    const btns = [];
    allDocs().forEach(function (d) {
      let els = [];
      try { els = d.querySelectorAll("button, a, input[type=button], span[onclick]"); } catch (e) { return; }
      Array.from(els).forEach(function (el) {
        const t = norm(el.textContent) || norm(el.value) || "";
        const oc = String(el.getAttribute("onclick") || "");
        if ((t.length <= 6 && /查询|搜索|刷新/.test(t)) || /query|refresh|search/i.test(oc)) {
          btns.push({ 文字: t, onclick: oc.slice(0, 200) });
        }
      });
    });
    console.log("%c[GRAB xklc] 页面上的查询类按钮", "color:#38bdf8;font-weight:bold");
    console.table(btns);
    out.按钮 = btns;
    // 2) 直接问页面：查询函数源码（最能说明"请求带什么参数"）
    const fns = {};
    try {
      const w = topHost().win;
      ["queryXklc", "queryKxkcList", "queryXk", "searchXklc"].forEach(function (n) {
        try { if (typeof w[n] === "function") fns[n] = String(w[n]).slice(0, 700); } catch (e) {}
      });
    } catch (e) {}
    console.log("%c[GRAB xklc] 页面查询函数源码（看请求参数）", "color:#facc15");
    Object.keys(fns).forEach(function (k) { console.log("--- " + k + " ---\n" + fns[k]); });
    if (!Object.keys(fns).length) console.log("（顶层 window 上没有这些函数名）");
    out.函数 = Object.keys(fns);
    // 3) 最近跟轮次有关的请求与响应
    const rel = (S().netLog || []).filter(function (o) {
      return /xklc|xklb|Xklc|轮次|query/i.test(String(o.url) + String(o.params || ""));
    });
    console.log("%c[GRAB xklc] 跟轮次相关的请求（含响应开头）", "color:#facc15");
    console.table(rel.slice(-10).map(function (o) {
      return { 时间: o.t, 方法: o.method, 状态: o.status, 长度: o.len, 地址: String(o.url).slice(0, 100), 参数: String(o.params || "").slice(0, 80), 响应开头: String(o["响应开头"] || "").slice(0, 80) };
    }));
    out.相关请求数 = rel.length;
    // 4) 轮次表在哪个 frame、表格 HTML 什么样
    const docs = allDocs();
    const tb = [];
    docs.forEach(function (d, i) {
      try {
        const t = d.querySelector("table");
        tb.push({ frame: i, 有表格: !!t, 行数: t ? t.querySelectorAll("tbody tr").length : 0, 文本: t ? norm(t.textContent).slice(0, 80) : "" });
      } catch (e) { tb.push({ frame: i, 有表格: false }); }
    });
    console.log("%c[GRAB xklc] 各 frame 的表格状态", "color:#38bdf8");
    console.table(tb);
    out.frame表格 = tb;
    // 5) 学年学期 / 批次等筛选控件的当前值
    const sel = [];
    docs.forEach(function (d) {
      let ss = [];
      try { ss = d.querySelectorAll("select"); } catch (e) { return; }
      Array.from(ss).forEach(function (s) {
        try { sel.push({ id: s.id || "(无)", 当前值: s.value, 当前文字: norm(s.options[s.selectedIndex] ? s.options[s.selectedIndex].textContent : ""), 选项数: s.options.length }); } catch (e) {}
      });
    });
    console.log("%c[GRAB xklc] 页面筛选控件（学年学期之类）", "color:#38bdf8");
    console.table(sel);
    out.筛选控件 = sel;
    log("xklc 探查完成：结果全在控制台（F12），共 5 张表；把内容发我", "ok");
    return out;
  }

  // ★ 点页面的「查询」按钮 —— 轮次表是查出来的，页面不会自己刷新，得替它点
  function clickQuery() {
    const hits = [];
    allDocs().forEach(function (d) {
      let els = [];
      try { els = d.querySelectorAll("button, a, input[type=button], input[type=submit], span[onclick]"); } catch (e) { return; }
      Array.from(els).forEach(function (el) {
        const t = norm(el.textContent) || norm(el.value) || "";
        const oc = String(el.getAttribute("onclick") || "");
        if (t.length <= 6 && /查询|搜索|刷新/.test(t) && !/重置|清除/.test(t)) hits.push({ el: el, s: 100 - t.length });
        else if (/query|refresh|search/i.test(oc) && !/reset/i.test(oc)) hits.push({ el: el, s: 50 });
      });
    });
    hits.sort(function (a, b) { return b.s - a.s; });
    if (!hits.length) return false;
    try { hits[0].el.click(); return true; } catch (e) { return false; }
  }

  // ★ 看到轮次就走：观察器与轮询共用这一条出口
  function roundsFound(rs) {
    if (S().roundsWatch) { clearInterval(S().roundsWatch); S().roundsWatch = null; }
    if (S().roundsObs) { S().roundsObs.forEach(function (m) { try { m.disconnect(); } catch (e) {} }); S().roundsObs = null; }
    log("★ 轮次出现了：" + rs.map(function (r) { return r.name; }).join("、") + " → 自动进入并抢课", "warn");
    renderRounds();
    setTimeout(function () { armAndGrab(0); }, 800);
  }

  // ★ DOM 观察器：查询结果什么时候回来是不确定的，光靠轮询会漏掉"刚好落在两次之间的那一刻"。
  //   挂上观察器后，轮次行一渲染出来就立刻抓（节流 300ms，避免表格重绘时连环触发）。
  function armRoundsObserver() {
    if (S().roundsObs) return;
    const obs = [];
    allDocs().forEach(function (d) {
      try {
        const mo = new MutationObserver(function () {
          if (S().roundsObsBusy || !S().roundsWatch) return;
          S().roundsObsBusy = true;
          setTimeout(function () {
            S().roundsObsBusy = false;
            if (!S().roundsWatch) return;
            let rs = [];
            try { rs = roundsOf(); } catch (e) {}
            if (rs.length) roundsFound(rs);
          }, 300);
        });
        mo.observe(d.body || d.documentElement, { childList: true, subtree: true });
        obs.push(mo);
      } catch (e) {}
    });
    S().roundsObs = obs;
  }

  // ★ 守候轮次：轮次列表还是空的（学校还没放）时，每 N 秒重查一次；一出现就自动进入并抢课
  function watchRounds(sec) {
    const every = Math.max(1, Math.round(sec || (CFG.roundsWatchMs / 1000))) * 1000;
    if (S().roundsWatch) {
      clearInterval(S().roundsWatch); S().roundsWatch = null;
      if (S().roundsObs) { S().roundsObs.forEach(function (m) { try { m.disconnect(); } catch (e) {} }); S().roundsObs = null; }
      log("已停止守候轮次", "info"); updateStatus("已停止守候轮次"); renderRounds(); return;
    }
    // ★ 已经有轮次了？那就等价于「进入守候并抢课」，不必轮询 ——
    //   这样「守候轮次」一个按钮就覆盖两种情况（轮次没出现 / 已出现），不会和另一个按钮重复。
    let rs0 = [];
    try { rs0 = roundsOf(); } catch (e) {}
    if (rs0.length) {
      log("已有轮次（" + rs0.map(function (r) { return r.name; }).join("、") + "），直接进入守候", "ok");
      roundsFound(rs0);
      return;
    }
    log("🛰 开始守候轮次：每 " + (every / 1000) + " 秒重查一次（顺手点页面「查询」），轮次一出现就自动进入并抢课", "ok");
    let n = 0;
    const step = function () {
      n++;
      let rs = [];
      try { rs = roundsOf(); } catch (e) {}
      if (rs.length) { roundsFound(rs); return; }
      const clicked = clickQuery();
      updateStatus("🛰 守候轮次中：第 " + n + " 次重查" + (clicked ? "（已点页面「查询」）" : "（没找到查询按钮）"));
      if (n % 5 === 1) log("🛰 守候轮次：第 " + n + " 次重查，页面还没放出轮次" + (clicked ? "" : "；且没找到页面「查询」按钮"), clicked ? "info" : "warn");
      renderRounds();
    };
    armRoundsObserver();
    step();
    S().roundsWatch = setInterval(step, every);
  }

  // ★ 面板分版：等待页只留「轮次 + 类别 + 一条龙」，类别抢课以下的全收起来
  //   （用户："其实类别抢课下面以下的都是用不到的"）
  function setLayout() {
    try {
      const d = hostDoc();
      const full = d.getElementById("grab-full");
      const tbl = d.getElementById("grab-cat-tbl");
      if (!full) return;
      // ★★ 判据：**只有等待页才用精简版** —— 判据是"页面上有没有 jrxk 轮次按钮"，现场取，不看缓存。
      //   为什么不再看"有没有课程表"：apiFirst 之后我们根本不进公选课选课页，
      //   进轮次后停在「选课学分情况」——那页既无轮次也无课程表，按旧判据会被当成等待页，
      //   于是搜索框/开始按钮又全没了（用户第二次报"搜索的不见了"）。
      const ctx = findCtx();
      if (!ctx.none && resolveTable(ctx)) S().mode = "course";
      const isWaiting = hasRoundUI();
      const want = CFG.panelLayout === "rounds" ? "lite"
        : (CFG.panelLayout === "full" ? "full"
          : (isWaiting ? "lite" : "full"));
      full.style.display = want === "full" ? "flex" : "none";
      if (tbl) tbl.style.display = (want === "full" && CFG.mode !== "bx") ? "" : "none";
      const wrap = d.getElementById("grab-cat-wrap");
      if (wrap) wrap.style.display = CFG.mode === "bx" ? "none" : "";
    } catch (e) {}
  }

  function buttons() {
    const d = hostDoc();
    setLayout();
    const a = d.getElementById("grab-start"), b = d.getElementById("grab-stop");
    if (a) a.disabled = S().running;
    if (b) b.disabled = !S().running;
  }

  // 最小化：只留标题栏（不彻底藏起来，方便随时展开）
  function setMinimized(min) {
    const d = hostDoc();
    const ui = d.getElementById(PANEL_ID);
    if (!ui) return;
    ui.__min = !!min;
    const body = ui.querySelector(".grab-bd");
    if (body) body.style.display = min ? "none" : "flex";
    ui.style.width = min ? "196px" : "344px";
    const b = d.getElementById("grab-close");
    if (b) { b.textContent = min ? "▣" : "—"; b.title = min ? "展开面板" : "最小化"; }
    const ms = d.getElementById("grab-min-status");
    if (ms) ms.style.display = min ? "inline" : "none";
  }

  function updateStatus(t) {
    const d = hostDoc();
    const txt = t || (S().running ? "正在自动抢课中..." : "未运行");
    const e = d.getElementById("grab-status");
    if (e) e.textContent = txt;
    const m = d.getElementById("grab-min-status");
    if (m) m.textContent = S().running ? "● 盯盘中" : "未运行";
  }

  function render() {
    try { setLayout(); } catch (e) {}
    const d = hostDoc();
    const list = d.getElementById("grab-list");
    if (!list) return;
    const q = S().queue;
    if (!q.length) {
      list.innerHTML = '<div class="grab-sub" style="text-align:center;padding:5px">点【⚡ 抢这门】/ 手动锁定 / 或开类别抢课</div>';
      return;
    }
    // ★ 队列目标展开：每个目标下面列出它匹配到的【所有教学班】，
    //   这样"一门课两个时段"看得见，不会再以为"第二个没进队"
    const all = (S().snapAll && S().snapAll.length) ? S().snapAll : [];
    list.innerHTML = q.map(function (c, i) {
      const s = st(c.id);
      const mark = s.success ? "✅ " : (s.fails ? "⚠" + s.fails + " " : "");
      let kids = [];
      try {
        const seen = {};
        all.forEach(function (r) {
          // ★ 必修只看【分组名/课堂名】—— 同 bxHit 的道理：课程名是聚合名
          const hay = (CFG.mode === "bx")
            ? String(((r.group || "") + " " + (r.classroom || "")).trim() || r.name || "")
            : String(r.name || "");
          if (!(r.id === c.id || r.code === c.code || hay.indexOf(c.id) >= 0)) return;
          const k = r.id || r.code; if (seen[k]) return; seen[k] = 1;
          kids.push(r);
        });
      } catch (e) {}
      const kidHtml = kids.slice(0, 4).map(function (k) {
        const free = k.remain > 0 && !k.conflicted && !k.already;
        const txt = k.already ? "已在课表" : (k.conflicted ? "时间冲突" : (free ? "★ " + k.remain + " 名额" : (k.remain === 0 ? "满" : "余量未知")));
        const col = free ? "#4ade80" : (k.already ? "#94a3b8" : "#64748b");
        return '<div style="padding-left:10px;font-size:10px;color:' + col + '">└ ' +
          k.name + " · " + (k.teacher || "?") + " · " + (k.timeInfo || "?") + " <b>" + txt + "</b></div>";
      }).join("");
      const more = kids.length > 4 ? '<div class="grab-sub" style="padding-left:10px">…还有 ' + (kids.length - 4) + " 个班</div>" : "";
      const none = (!kids.length && !s.success)
        ? (CFG.mode === "bx"
            ? (function () {
                const rows = S().bxRows || [];
                if (!rows.length) return '<div class="grab-sub" style="padding-left:10px;color:#facc15">🔍 必修池还是空的 —— 点「🚀 开始」或等一次「必修刷新」</div>';
                const names = rows.slice(0, 8).map(function (o) { return String(o.fzmc || o.kcmc || "?"); }).join("、");
                return '<div class="grab-sub" style="padding-left:10px;color:#facc15">🔍 必修池 ' + rows.length +
                  ' 门，没有匹配；可选分组：' + names + '…（必修按分组名找）</div>';
              })()
            : '<div class="grab-sub" style="padding-left:10px;color:#facc15">🔍 通识里没有匹配的课 —— 换个课名关键字，或点亮类别整类抢</div>')
        : "";
      // ★ 匹配到 ≠ 能抢：把"为什么不可抢"直接写在面板上（用户要求："说明原因，就是不在可抢集合里这种"）
      const whyNot = function (k) {
        const r = [];
        if (k.already) r.push("已在课表");
        if (k.conflicted) r.push("时间冲突");
        if (!(k.remain > 0)) r.push(k.remain === 0 ? "满" : "余量未知");
        return r.join("+") || "可抢";
      };
      const freeK = kids.filter(function (k) { return k.remain > 0 && !k.conflicted && !k.already; });
      const head = kids.length
        ? '<div class="grab-sub">匹配到 ' + kids.length + " 个班" +
          (freeK.length
            ? " · <span style=\"color:#4ade80\">其中 " + freeK.length + " 个可抢</span>，谁先有空位抢谁"
            : " · <b style=\"color:#facc15\">都不可抢：</b>" +
              kids.slice(0, 3).map(function (k) { return (k.group || k.name) + "=" + whyNot(k); }).join("；") +
              " → 一旦有人退课就会自动抢") + "</div>"
        : "";
      return '<div class="grab-item" style="flex-direction:column;align-items:stretch;gap:2px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
        '<div style="overflow:hidden"><b>' + mark + c.name + '</b> <span class="grab-sub">' +
          ({ "gg-cat": "通识类别", "bx-group": "必修分组", "kw": "关键词" }[c.kind || "kw"]) + " · " + c.code + '</span></div>' +
        '<span class="grab-x" data-i="' + i + '">×</span></div>' +
        head + kidHtml + more + none + '</div>';
    }).join("");
    Array.from(list.querySelectorAll(".grab-x")).forEach(function (el) {
      el.onclick = function () {
        S().queue.splice(Number(el.dataset.i), 1);
        save();
        render();
        // ★ 队列清空且没有类别任务 → 自动停止（原来删完还在空转）
        const catTask = CFG.queueMode
          ? (S().queue || []).length
          : (CFG.category.enabled && CFG.category.match.length);
        if (!S().queue.length && !catTask && S().running) {
          log("队列已清空，自动停止", "ok");
          stop();
        }
      };
    });
  }

  /* ============ 对外接口 ============ */

  W.GRAB = {
    version: VERSION,
    debug: debug, report: report, net: net, filters: filters, probe: probe,
    sweep: function () {
      const ctx = findCtx();
      if (ctx.none) return "找不到表格";
      return "扫描已启动，看控制台日志";
    },
    start: start, stop: stop, inject: inject,
    addManual: addManual, addTarget: addTarget, scheduleAt: scheduleAt, enter: enterRound,
    enterRound: enterRound, scheduleEnter: scheduleEnter,
    catNames: catNames, learnCats: learnCats,
    catMap: function () { return S().catMap; },
    arm: function () { return S().arm; }, maybeArm: maybeArm,
    armAndGrab: armAndGrab, gotoCourseTab: gotoCourseTab, bxList: bxList,
    xhr: xhrDump, hookAllFrames: hookAllFrames, watch: watch, testSubmit: testSubmit, inspect: inspect, alive: alive,
    renderRounds: renderRounds, watchRounds: watchRounds, clickQuery: clickQuery, xklc: xklc,
    addCat: function (n) { return enqueueTask("gg-cat", n, n); },
    addGroup: function (n) { return enqueueTask("bx-group", n, n); },
    delTask: function (k, n) { return dequeueTask(k, n); },
    tasks: function () { return (S().queue || []).map(function (c) { return { kind: c.kind || "kw", 值: c.id, 名称: c.name, 状态: st(c.id).success ? "已抢到" : (st(c.id).terminal ? "已终止" : "盯盘中") }; }); },
    rounds: function () { return roundsOf().map(function (r) { return { 轮次: r.name, 时间: r.timeText, args: r.args }; }); },
    setMode: setMode, setLayout: setLayout, applyCatsToPage: applyCatsToPage,
    rounds: function () { return roundsOf().map(function (r) { return { 轮次: r.name, 时间: r.timeText, 状态: roundState(r).txt, args: r.args }; }); },
    catOptions: function () { return categoryOptions(findCtx()); },
    catState: function () {
      const R = S();
      const o = {};
      Object.keys(R.catRows || {}).forEach(function (k) { o[k] = R.catRows[k].length; });
      return {
        勾选类别: CFG.queueMode ? "(队列模式，见下一行)" : CFG.category.match,
        队列: (S().queue || []).map(function (c) { return (c.kind || "kw") + ":" + c.code; }),
        上次轮询: R.catStamp ? new Date(R.catStamp).toLocaleTimeString() : null,
        各类别课程数: o, 失败: R.catFail || []
      };
    },
    config: CFG,
    cache: function () {
      const R = S();
      return {
        翻页缓存: R.pagedRows.length,
        服务器缓存: R.allRows.length,
        合计去重: (function () { try { return snapshot().all.length; } catch (e) { return -1; } })(),
        前3条: snapshot().all.slice(0, 3).map(function (r) {
          return { 编号: r.code, 名称: r.name, 教师: r.teacher, 时间: r.timeInfo, 类别: r.category, 余量: r.remain, 已选: r.already };
        })
      };
    },
    where: function () {
      const c = findCtx();
      const t = c.none ? null : resolveTable(c);
      const cols = t ? colsFor(t) : null;
      return {
        本frame: location.href, 引擎frame: S().engineFrame,
        表格在: c.none ? "未找到" : (c.win === W ? "本frame" : "子frame"),
        认出列: cols ? { code: cols.code, name: cols.name, teacher: cols.teacher, time: cols.time, remain: cols.remain, status: cols.status, category: cols.category } : null,
        页内: t ? rowsOf(t).length : 0,
        翻页缓存: S().pagedRows.length,
        服务器缓存: S().allRows.length,
        队列: S().queue.length, 运行中: S().running
      };
    },
    show: function () {
      const d = hostDoc();
      const u = d.getElementById(PANEL_ID);
      if (u) u.style.display = "block"; else createUI();
    },
    // ★ 面板僵死时的急救：拆掉重建
    revive: function () {
      try {
        const d = hostDoc();
        const u = d.getElementById(PANEL_ID);
        if (u) { u.__dead__ = true; u.remove(); }
      } catch (e) {}
      if (!gatesOk()) return "当前 frame 没有课程表 —— 先切到选课列表 tab 再执行";
      createUI();
      boot2();
      return "面板已重建，引擎已重新注册";
    }
  };
  W.hubuGrab = W.GRAB;

  /* ★ 僵尸面板看门狗 —— 所有 frame 都跑，不受闸门限制。
     引擎 frame 换页后会销毁，它的心跳停止；此时把面板标记为僵尸，
     下一个起来的引擎会把它拆掉重建（见 createUI）。 */
  setInterval(function () {
    try {
      const d = hostDoc();
      const u = d.getElementById(PANEL_ID);
      if (!u) return;
      if (Date.now() - (S().engineAt || 0) > 8000) {
        u.__dead__ = true;
        const s = d.getElementById("grab-status");
        if (s) { s.textContent = "⚠ 引擎已断开（当前 tab 不是选课列表页）"; s.style.color = "#f87171"; }
      }
    } catch (e) {}
  }, 2000);

  /* ============ 闸门 ============ */

  function gatesOk() {
    if (CFG.urlKeyword) {
      let hit = (location.href || "").indexOf(CFG.urlKeyword) >= 0;
      if (!hit) { try { hit = (W.top.location.href || "").indexOf(CFG.urlKeyword) >= 0; } catch (e) {} }
      if (!hit) return false;
    }
    // ★★ 引擎只跑在【最外层同源 frame】—— 修"切 tab 面板就死"的根本解
    //   事实：切 tab 时顶层 frame（newXsxkzx）根本不刷新，换的只是它里面的 iframe。
    //   以前把引擎放在"表格所在的 frame"，那个 frame 每次切 tab 都被销毁重建，
    //   于是面板（在顶层）与引擎（在子 frame）生命周期错位 → 僵尸面板。
    //   现在把引擎固定在顶层：它永不销毁，面板与它同生共死。
    //   表格在子 frame 完全没问题 —— findCtx / resolveTable / inject / submit
    //   本来就是跨同源 frame 操作的。
    try { if (topHost().win !== W) return false; } catch (e) { return false; }
    // ★ 等待页面（xklc_list）没有课程表，但有 jrxk 轮次入口 —— 这一页也要出面板，
    //   否则"到点自动进选课"就没地方放按钮了
    let hasRounds = false;
    try { hasRounds = roundsOf().length > 0; } catch (e) {}
    if (hasRounds) { S().mode = "rounds"; return true; }
    if (discoverTable()) {
      S().mode = "course";
      const ctx = findCtx();
      if (!ctx.none && resolveTable(ctx)) return true;
    }
    // ★ 只要还在教务系统里就出面板：进轮次后默认落在「选课学分情况」页，
    //   那页既没有轮次入口也没有课程表，面板不能因此消失（否则待命看不见、也没法再操作）
    if (CFG.panelEverywhere && /\/jsxsd\//.test(String(location.href || ""))) { S().mode = "idle"; return true; }
    return false;
  }

  function boot() {
    if (!gatesOk()) return;
    if (!createUI()) { setTimeout(function () { if (createUI()) { restore(); boot2(); } }, 500); return; }
    restore(); boot2();
  }

  function boot2() {
    if (booted) return;
    booted = true;
    const ctx = findCtx();
    // ★ 等待页面没有课程表，但面板照样要能用（轮次区块）→ 钩子能挂就挂，api 一定要注册
    if (!ctx.none) { hookNet(ctx.win); hookJq(ctx.win); hookMessages(ctx.win); }
    hookFetch(W);   // ★ 接口请求是从【本 frame】发的，钩这里才看得到
    S().engineFrame = location.href;
    S().engineFrameUrl = location.href;
    S().engineAt = Date.now();
    setInterval(function () {
      S().engineAt = Date.now();                                        // 心跳：告诉面板引擎还活着
      try { setLayout(); } catch (e) {}                                 // ★ 2 秒内自愈：页面能力变了就换版式
    }, 2000);
    // ★ 把自己注册成"当前引擎"，面板按钮通过 S().api 转发过来
    S().api = {
      start: start, stop: stop, debug: debug, net: net, probe: probe,
      addManual: addManual, addTarget: addTarget, scheduleAt: scheduleAt, enter: enterRound,
      inject: inject, render: render, renderCats: renderCats, buttons: buttons, updateStatus: updateStatus,
      enterRound: enterRound, scheduleEnter: scheduleEnter,
      armAndGrab: armAndGrab, gotoCourseTab: gotoCourseTab, bxList: bxList,
      xhr: xhrDump, hookAllFrames: hookAllFrames,
      setMode: setMode, setLayout: setLayout, applyCatsToPage: applyCatsToPage, submitBxByClick: submitBxByClick,
      catNames: catNames, learnCats: learnCats, catMap: function () { return S().catMap; },
      arm: function () { return S().arm; }, maybeArm: maybeArm
    };
    if (S().arm && !S().arm.done) setTimeout(maybeArm, 1200);
    learnCats();
    applyModeUI();
    console.log("%c[GRAB v" + VERSION + "] 引擎就绪（表 #" + tid() + "）\n" +
      "可用：GRAB.where() / GRAB.debug() / GRAB.facts() / GRAB.catState() / GRAB.probe() / GRAB.revive()",
      "color:#38bdf8;font-weight:bold");
  }

  /* ★ 启动重试循环 —— 修"切 tab 后一直死"
     真正原因：新页面（选修/必修）的表格是 JS 后渲染的，document-idle 时往往还没有 →
     第一次 gatesOk() 失败；而原来那个 2.5 秒的补试写的是
         if (!hostDoc().getElementById(PANEL_ID)) boot()
     —— 屏幕上恰好残留着旧面板时该判断为假，补试被跳过，新引擎永远起不来，面板永久僵死。
     现在改成"只要本 frame 还不是活引擎就每秒重试一次"，最多 20 次。 */
  let booted = false;
  let bootTries = 0;
  const bootTimer = setInterval(function () {
    // 非顶层 frame 不跑引擎（引擎固定在顶层），不必重试
    try { if (topHost().win !== W) { clearInterval(bootTimer); return; } } catch (e) { clearInterval(bootTimer); return; }
    let alive = false;
    try { alive = S().engineFrameUrl === location.href && Date.now() - (S().engineAt || 0) < 6000; } catch (e) {}
    if (alive || bootTries++ > 90) { clearInterval(bootTimer); return; }
    boot();
  }, 1000);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
