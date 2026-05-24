const state = {
  started: false,
  round: 0,
  maxSafetyRounds: 10,
  questions: [],
  answers: [],
  facts: null,
  activeTimeLimit: 0,
  activeDeadline: null,
  timerId: null,
  feedbackMode: "realtime",
  feedbackItems: [],
  scores: {
    authenticity: 0,
    depth: 0,
    metrics: 0,
    engineering: 0,
    industry: 0
  },
  latestScores: {
    authenticity: 0,
    depth: 0,
    metrics: 0,
    engineering: 0,
    industry: 0
  },
  risks: [],
  authToken: localStorage.getItem("projectInterrogatorToken") || "",
  user: null,
  sessionId: null,
  sessionTitle: "",
  history: [],
  streamBuffer: ""
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const trackProfiles = {
  general: {
    label: "通用技术项目",
    keyTerms: ["系统", "代码", "接口", "数据", "模型", "服务", "指标", "部署", "用户", "业务"],
    questions: [
      "我们先收一下主线。这个项目从输入到输出，核心链路是怎么走的？",
      "你先挑一个最能代表你贡献的模块讲讲。这个模块具体是你怎么做的？",
      "我想听一下你的技术判断。你为什么选择现在这套方案？",
      "这个项目最后怎么证明它是有效的？先讲一个最核心的指标。",
      "如果给真实用户用，你觉得第一个会暴露出来的工程问题是什么？"
    ]
  },
  code: {
    label: "软件工程 / 代码项目",
    keyTerms: ["代码", "模块", "函数", "类", "测试", "重构", "插件", "工具", "sdk", "cli", "debug", "日志"],
    questions: [
      "先从代码讲起。用户触发一次功能后，最核心的代码路径是什么？",
      "你这个模块是怎么拆职责的？先讲一个你最关键的拆分决策。",
      "这里我追一个边界情况。如果输入不符合预期，你的代码怎么处理？",
      "你怎么证明核心逻辑没有被后续改动破坏？",
      "请写出核心流程伪代码，尤其是最容易出错的分支。"
    ]
  },
  ai: {
    label: "AI / 智能系统",
    keyTerms: ["ai", "智能", "模型", "大模型", "llm", "prompt", "推荐", "预测", "检索", "生成", "分类", "排序", "多模态", "agent", "rag"],
    questions: [
      "先别讲模型名。这个项目里 AI 模块具体承担什么职责？",
      "为什么这里需要 AI，而不是规则、搜索或传统算法？",
      "模型或 API 的输入是什么？先讲输入和上下文边界。",
      "如果模型输出错了，系统怎么兜底？",
      "你觉得这个项目里，哪些问题不是模型本身能解决的？"
    ]
  },
  backend: {
    label: "后端工程",
    keyTerms: ["接口", "缓存", "数据库", "并发", "队列", "限流", "事务", "索引", "服务", "监控"],
    questions: [
      "这个项目的核心请求链路是什么？先按一次请求讲清楚。",
      "如果流量突然放大 10 倍，你判断第一个瓶颈会在哪里？",
      "你为什么这样设计数据库表或接口边界？",
      "请说明一致性、幂等、异常重试和回滚是怎么处理的。",
      "请写出核心请求链路的伪代码，重点写异常处理。",
      "你怎么衡量这个系统做得好？先说一个最关键的稳定性指标。"
    ]
  },
  algorithm: {
    label: "算法机器学习",
    keyTerms: ["模型", "特征", "训练", "损失", "准确率", "召回", "auc", "数据集", "实验", "消融"],
    questions: [
      "你为什么选择这个模型或方法？先和一个更简单的 baseline 比。",
      "训练数据是怎么来的？先讲标签是否可靠。",
      "你最核心的评价指标是什么？先讲这个指标的定义。",
      "请写出训练或推理的核心伪代码，说明数据流、模型调用和后处理。",
      "如果效果不涨，你会先排查哪一个环节？"
    ]
  },
  data: {
    label: "数据平台",
    keyTerms: ["etl", "数仓", "指标", "数据质量", "调度", "血缘", "实时", "离线", "看板", "口径"],
    questions: [
      "这个项目主要解决数据生产、数据治理还是数据消费问题？",
      "你最核心的一个指标口径是怎么定义的？",
      "数据质量怎么监控？先讲一个你最常见的异常类型。",
      "请写出核心 ETL 或指标计算伪代码，说明输入、转换、输出和校验。",
      "如果任务失败，你第一步怎么发现并处理？"
    ]
  },
  frontend: {
    label: "前端客户端",
    keyTerms: ["组件", "状态", "性能", "渲染", "缓存", "交互", "可访问", "首屏", "埋点", "错误"],
    questions: [
      "这个项目里最复杂的前端状态或交互是什么？",
      "你为什么这样拆组件？先讲一个关键组件的边界。",
      "性能瓶颈在哪里？先说你实际测过的一个指标。",
      "异常状态、空状态、权限状态和弱网场景怎么处理？",
      "请写出核心交互或状态流转的伪代码，说明事件、状态更新和副作用。",
      "你怎么衡量前端体验做得好？先讲一个埋点或可观测指标。"
    ]
  },
  infra: {
    label: "基础设施 / DevOps",
    keyTerms: ["部署", "容器", "docker", "k8s", "ci", "cd", "流水线", "监控", "告警", "日志", "权限", "成本", "云"],
    questions: [
      "这个项目主要解决部署效率、稳定性、成本、权限还是可观测性问题？",
      "你的流水线或基础设施链路从提交代码到上线经过哪些步骤？",
      "如果部署失败，系统怎么发现并回滚？",
      "密钥和敏感配置是怎么管理的？",
      "你怎么衡量这个基础设施项目有效？先讲一个最核心的指标。"
    ]
  }
};

const commonQuestions = [
  "请用 90 秒讲清楚这个项目：背景、你的角色、核心方案、结果。不要复述简历。",
  "这个项目里哪一块最能证明是你亲手做的？请讲到实现粒度。",
  "如果让你现在重做一版，你最想改掉哪一块？",
  "项目里最失败或最不确定的地方是什么？先讲一个具体场景。",
  "如果面试官质疑这个项目只是调包，你会拿出哪三个证据反驳？"
];

const sampleProject = `智能代码评审助手。用户提交一段 Python 或 JavaScript 代码后，系统会解析代码结构，识别潜在 bug、复杂度过高的函数、缺失的异常处理和测试薄弱点，并生成修改建议。我负责核心分析链路、规则引擎、AI 评审提示词、前后端接口和评估集构建。技术栈包括 Python、FastAPI、AST 解析、规则检查、AI API 和简单前端页面。我用 80 个真实开源 issue 和人工构造样例做了初步评估，记录了误报率、漏报率和平均响应耗时。目前 demo 已能运行，但对复杂跨文件调用、第三方库语义和企业代码安全边界处理还不完整。`;

function estimateTimeLimit(question) {
  if (/90 秒|介绍|背景|角色|结果/.test(question)) return 90;
  if (/伪代码|核心流程|链路|架构|模块|数据流/.test(question)) return 180;
  if (/指标|评估|实验|baseline|失败样本|压测/.test(question)) return 150;
  if (/行业|企业|趋势|落地|合规|成本/.test(question)) return 120;
  if (/质疑|证明|trade-off|取舍|替代/.test(question)) return 120;
  return 90;
}

function normalizeQuestion(item) {
  if (typeof item === "string") {
    return {
      text: item,
      timeLimitSeconds: estimateTimeLimit(item),
      axis: "项目深挖"
    };
  }

  const text = String(item.question || item.text || item.content || "").trim();
  return {
    text,
    timeLimitSeconds: clampTimeLimit(item.time_limit_seconds || item.timeLimitSeconds || item.seconds, estimateTimeLimit(text)),
    axis: String(item.axis || item.focus || "项目深挖")
  };
}

function normalizeQuestions(items) {
  return items
    .map(normalizeQuestion)
    .filter((item) => item.text)
    .slice(0, state.maxSafetyRounds);
}

function clampTimeLimit(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(45, Math.min(240, Math.round(number)));
}

function questionText(question) {
  return normalizeQuestion(question).text;
}

function questionTimeLimit(question) {
  return normalizeQuestion(question).timeLimitSeconds;
}

function formatDuration(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (!min) return `${sec} 秒`;
  return `${min} 分 ${String(sec).padStart(2, "0")} 秒`;
}

async function requestAI(task, context) {
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ task, context })
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.error || `AI request failed: ${response.status}`);
  }

  const data = await response.json();
  if (!data.ok) throw new Error(data.error || "AI request failed");
  return data.result;
}

function authHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (state.authToken) headers.Authorization = `Bearer ${state.authToken}`;
  return headers;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }
  return data;
}

function setAuth(token, user) {
  state.authToken = token || "";
  state.user = user || null;
  if (token) {
    localStorage.setItem("projectInterrogatorToken", token);
  } else {
    localStorage.removeItem("projectInterrogatorToken");
  }
  renderAuth();
}

function ensureLoggedIn() {
  if (state.user && state.authToken) return true;
  alert("请先登录或注册，这样每次模拟和问答日志才能保存。");
  $("#loginUsername").focus();
  return false;
}

async function loadMe() {
  if (!state.authToken) {
    renderAuth();
    return;
  }
  try {
    const data = await apiRequest("/api/me");
    state.user = data.user;
    renderAuth();
    await loadHistory();
  } catch (error) {
    setAuth("", null);
  }
}

function renderAuth() {
  const authed = Boolean(state.user);
  $("#authForm").classList.toggle("hidden", authed);
  $("#userBox").classList.toggle("hidden", !authed);
  $("#historyBox").classList.toggle("hidden", !authed);
  $("#currentUser").textContent = authed ? state.user.username : "未登录";
}

async function handleAuth(mode) {
  const username = $("#loginUsername").value.trim();
  const password = $("#loginPassword").value;
  if (username.length < 3 || password.length < 6) {
    alert("用户名至少 3 位，密码至少 6 位。");
    return;
  }
  const data = await apiRequest(`/api/${mode}`, {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
  setAuth(data.token, data.user);
  $("#loginPassword").value = "";
  await loadHistory();
}

async function logout() {
  try {
    await apiRequest("/api/logout", { method: "POST", body: "{}" });
  } catch (error) {
    console.warn("logout failed:", error);
  }
  setAuth("", null);
  state.history = [];
  renderHistory();
  newSimulation();
}

async function loadHistory() {
  if (!state.user) return;
  try {
    const data = await apiRequest("/api/sessions");
    state.history = data.sessions || [];
    renderHistory();
  } catch (error) {
    console.warn("history failed:", error);
  }
}

function renderHistory() {
  const list = $("#historyList");
  if (!state.history.length) {
    list.innerHTML = "<li>还没有历史模拟。</li>";
    return;
  }
  list.innerHTML = state.history.map((item) => `
    <li>
      <button type="button" class="history-item" data-session-id="${item.id}">
        <strong>${sanitize(item.title || "项目拷问")}</strong>
        <span>${item.status === "active" ? "进行中" : "已结束"} · ${formatDate(item.updatedAt)}</span>
      </button>
    </li>
  `).join("");
  $$(".history-item").forEach((button) => {
    button.addEventListener("click", () => openHistorySession(Number(button.dataset.sessionId)));
  });
}

function formatDate(timestamp) {
  if (!timestamp) return "";
  return new Date(timestamp * 1000).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function makeSessionTitle(projectText) {
  return projectText.replace(/\s+/g, " ").slice(0, 28) || "新的项目拷问";
}

function sanitize(text) {
  return text.replace(/[<>&]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[char]));
}

function splitKeywords(text) {
  return text
    .toLowerCase()
    .split(/[\s,，、。；;:：/|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractFacts(projectText, track, jdKeywords, focusText) {
  const profile = trackProfiles[track];
  const lower = projectText.toLowerCase();
  const matchedTerms = profile.keyTerms.filter((term) => lower.includes(term.toLowerCase()));
  const jdTerms = splitKeywords(jdKeywords);
  const focusTerms = splitKeywords(focusText);

  const hasMetric = /%|准确|召回|延迟|耗时|成本|qps|auc|f1|指标|评估|ab|a\/b|loss|损失|成功率|错误率/.test(lower);
  const hasRole = /我负责|本人负责|主导|参与|实现|设计|搭建|优化/.test(projectText);
  const hasData = /数据|样本|日志|pdf|用户|标签|资料|数据库|文档|埋点/.test(projectText);
  const hasDeployment = /上线|部署|服务|接口|监控|告警|回滚|生产|docker|vercel|云/.test(lower);
  const hasIndustry = /行业|企业|业务|场景|趋势|竞品|客户|用户|商业|成本|合规|监管|落地|发展|脉络|价值/.test(projectText);

  const riskPoints = [];
  if (!hasRole) riskPoints.push("个人贡献边界不清，容易被问“这部分到底是不是你做的”。");
  if (!hasMetric) riskPoints.push("缺少量化指标，容易被追问“怎么证明方案变好了”。");
  if (!hasData) riskPoints.push("数据来源和质量没有讲清，容易被追问数据可信度。");
  if (!hasDeployment) riskPoints.push("工程落地信息不足，容易被追问上线、稳定性和成本。");
  if (!hasIndustry) riskPoints.push("行业和企业场景理解不足，容易被追问“这个项目为什么值得做、真实业务怎么落地”。");
  if (matchedTerms.length === 0) riskPoints.push("技术关键词较少，面试官可能认为项目深度不足。");

  return {
    profile,
    matchedTerms,
    jdTerms,
    focusTerms,
    checks: { hasMetric, hasRole, hasData, hasDeployment, hasIndustry },
    riskPoints
  };
}

function buildQuestions(track, intensity, facts) {
  const profile = trackProfiles[track];
  const selected = [commonQuestions[0]];

  if (facts.riskPoints.some((point) => point.includes("贡献"))) selected.push(commonQuestions[1]);
  if (!facts.checks.hasMetric) selected.push("你现在没有写清指标。你会用哪个指标证明这个项目有效？");
  if (!facts.checks.hasDeployment) selected.push("如果这个项目给真实用户使用，你觉得最先暴露的工程问题是什么？");
  if (!facts.checks.hasIndustry) selected.push("这个项目对应的真实行业或业务场景是什么？");

  selected.push(...profile.questions);

  if (facts.jdTerms.length) {
    selected.push(`结合你写的岗位关键词「${facts.jdTerms.slice(0, 4).join("、")}」，这个项目最能证明哪一项能力？`);
  }

  if (facts.focusTerms.length) {
    selected.push(`你说最想被追问「${facts.focusTerms.slice(0, 3).join("、")}」。请选一个点讲到可以现场实现的粒度。`);
  }

  selected.push(commonQuestions[2], commonQuestions[3], commonQuestions[4]);

  const unique = [...new Set(selected)];
  if (intensity === "pressure") {
    unique.splice(1, 0, "我先质疑一下：这个项目听起来像把现成框架串起来。你的技术判断体现在哪里？");
  }
  if (intensity === "senior") {
    unique.splice(2, 0, "请讲一个你做过的关键 trade-off：你牺牲了什么，换来了什么？");
  }
  return normalizeQuestions(unique);
}

async function requestAgentStep(context) {
  return requestAI("agent_step", context);
}

function normalizeFeedback(feedback, fallbackDiagnosis = []) {
  const source = feedback || {};
  return {
    answer_relevance: normalizeAssessment(source.answer_relevance, "未评估回答是否对题。"),
    question_analysis: limitText(source.question_analysis || "这题在验证你能否拿出项目证据。", 90),
    answer_analysis: limitText(source.answer_analysis || fallbackDiagnosis.join("；") || "回答信息不足，还缺少可验证细节。", 150),
    pain_point: limitText(source.pain_point || fallbackDiagnosis[0] || "缺少关键技术证据。", 80),
    improvement: limitText(source.improvement || "下一次先给结论，再补实现证据、指标和取舍。", 110),
    sample_answer: String(source.sample_answer || "我负责的是核心链路中的代码分析和评测部分。具体做法是先用 AST 抽取函数、调用和异常分支，再用规则筛出高风险代码片段，最后把结构化上下文交给模型生成审查意见。为了证明它有效，我用真实 issue 和人工样例做了评测，分别看漏报率、误报率和响应耗时；目前最大的不足是跨文件语义还不稳定，所以我会把这类场景标成低置信度，并要求人工复核。")
  };
}

function normalizeAssessment(value, fallback) {
  const source = value || {};
  return {
    score: clampScore(source.score, 5),
    verdict: limitText(source.verdict || fallback, 90),
    evidence: limitText(source.evidence || source.missed_point || "", 120)
  };
}

function limitText(text, maxLength) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function renderLatestFeedback(feedback) {
  if (state.feedbackMode !== "realtime") return;
  const parts = [
    ["是否答到问题", `${feedback.answer_relevance.verdict}${feedback.answer_relevance.evidence ? `：${feedback.answer_relevance.evidence}` : ""}`],
    ["问题分析", feedback.question_analysis],
    ["回答分析", feedback.answer_analysis],
    ["痛点", feedback.pain_point],
    ["如何改进", feedback.improvement],
    ["示例回答", feedback.sample_answer]
  ];
  $("#latestDiagnosis").innerHTML = parts
    .map(([label, value]) => `<li><strong>${label}：</strong>${sanitize(value)}</li>`)
    .join("");
}

function scoreAnswer(answer) {
  const lower = answer.toLowerCase();
  const lengthScore = Math.min(3, Math.floor(answer.length / 90));
  const concrete = /(我负责|我实现|我设计|具体|例如|当时|线上|实验|日志|代码|接口|表|模块)/.test(answer) ? 2 : 0;
  const metrics = /%|准确|召回|延迟|成本|qps|auc|f1|指标|评估|ab|a\/b|loss|损失|成功率|错误率|耗时|吞吐/.test(lower) ? 3 : 0;
  const engineering = /(部署|监控|告警|回滚|缓存|并发|异常|重试|降级|限流|成本|稳定|日志|链路|接口)/.test(answer) ? 3 : 0;
  const depth = /(为什么|取舍|trade|替代|baseline|消融|复杂度|瓶颈|边界|失败|风险|伪代码|流程)/i.test(answer) ? 3 : 0;
  const industry = /(行业|企业|业务|场景|趋势|竞品|客户|用户|商业|合规|监管|落地|发展|脉络|价值|成本|效率)/.test(answer) ? 3 : 0;

  return {
    authenticity: Math.min(10, lengthScore + concrete + (answer.includes("我") ? 2 : 0)),
    depth: Math.min(10, lengthScore + depth + concrete),
    metrics: Math.min(10, lengthScore + metrics),
    engineering: Math.min(10, lengthScore + engineering),
    industry: Math.min(10, lengthScore + industry)
  };
}

function diagnoseAnswer(answer, question) {
  const notes = [];
  const lower = answer.toLowerCase();

  if (answer.length < 90) notes.push("回答偏短，真实面试里会被继续要求展开实现细节。");
  if (!/(我负责|我实现|我设计|主导|我的部分|我做)/.test(answer)) notes.push("个人贡献不够明确，建议说清你亲手做了哪一层。");
  if (!/%|准确|召回|延迟|成本|qps|auc|f1|指标|评估|loss|损失|错误率|成功率/.test(lower)) notes.push("缺少指标或评估方式，容易被追问“怎么证明有效”。");
  if (/模型|方法|框架|rag|agent|检索|缓存|数据库/i.test(question + answer) && !/(为什么|因为|取舍|替代|baseline|相比|权衡)/i.test(answer)) {
    notes.push("方法选择理由不足，建议补充替代方案和 trade-off。");
  }
  if (/伪代码|核心流程|实现/.test(question) && !/(for|if|步骤|流程|先|然后|输入|输出|函数|接口|模块)/i.test(answer)) {
    notes.push("还不像能现场写出来，建议按输入、处理、输出讲清流程。");
  }
  if (!/(失败|问题|风险|不足|踩坑|瓶颈|限制)/.test(answer)) notes.push("没有暴露反思和失败处理，深挖面试中会显得过于包装。");
  if (!/(行业|企业|业务|场景|趋势|客户|用户|商业|合规|落地|价值)/.test(answer)) {
    notes.push("缺少行业和企业场景判断，建议补充这个项目为什么值得做、真实落地最关心什么。");
  }

  if (notes.length === 0) {
    notes.push("这一轮回答比较扎实。下一步可以继续补充更具体的数据、代码边界和失败案例。");
  }

  return notes.slice(0, 4);
}

function assessAnswerRelevance(answer, question) {
  const answerTokens = importantTokens(answer);
  const questionTokens = importantTokens(question);
  const overlap = questionTokens.filter((token) => answerTokens.includes(token));
  const score = questionTokens.length ? Math.round((overlap.length / Math.min(questionTokens.length, 8)) * 10) : 6;
  const asksMetric = /指标|数据|证明|评估|压测|监控|多少|占用|成本|qps|延迟|准确|召回/i.test(question);
  const asksCode = /代码|实现|流程|路径|伪代码|接口|函数|模块|controller|service/i.test(question);
  const asksWhy = /为什么|取舍|替代|相比|权衡|选择/i.test(question);
  const misses = [];
  if (asksMetric && !/%|qps|延迟|耗时|准确|召回|指标|评估|压测|监控|成本|内存|mb|gb|数量|阈值/i.test(answer)) misses.push("问题在追数据或指标，但回答没有给可验证数字");
  if (asksCode && !/代码|接口|函数|模块|流程|步骤|先|然后|controller|service|redis|mq|sql|if|for/i.test(answer)) misses.push("问题在追实现路径，但回答没有落到代码或流程");
  if (asksWhy && !/因为|所以|取舍|相比|替代|成本|收益|风险|选择/i.test(answer)) misses.push("问题在追选择理由，但回答没有讲取舍");
  if (misses.length) {
    return { score: Math.min(4, score), verdict: "没有完全答到问题", evidence: misses[0] };
  }
  if (score <= 3) return { score, verdict: "基本没对上问题", evidence: "回答和问题关键词重合很低，像是在背准备稿" };
  if (score <= 5) return { score, verdict: "只回答了一部分", evidence: "有相关内容，但没有覆盖问题里的核心追问点" };
  return { score: Math.max(6, score), verdict: "基本对应问题", evidence: "" };
}

function importantTokens(text) {
  const stop = new Set(["这个", "就是", "然后", "因为", "所以", "如果", "我们", "你们", "一个", "进行", "可以", "没有", "需要", "问题", "回答", "项目", "具体", "这里", "时候", "通过", "对于"]);
  return String(text || "")
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-z0-9_+.%/-]+/g, " ")
    .split(/\s+/)
    .flatMap((token) => {
      if (/^[\u4e00-\u9fa5]{5,}$/.test(token)) {
        const chunks = [];
        for (let i = 0; i <= token.length - 2; i += 2) chunks.push(token.slice(i, i + 2));
        return chunks;
      }
      return [token];
    })
    .filter((token) => token.length >= 2 && !stop.has(token));
}

function mergeScores(next) {
  const lastFeedback = state.feedbackItems[state.feedbackItems.length - 1];
  if (lastFeedback) {
    if (lastFeedback.answer_relevance?.score <= 4) {
      next.authenticity = Math.min(next.authenticity, 3);
      next.depth = Math.min(next.depth, 3);
      next.metrics = Math.min(next.metrics, 3);
      next.engineering = Math.min(next.engineering, 3);
      next.industry = Math.min(next.industry, 3);
    } else if (lastFeedback.answer_relevance?.score <= 6) {
      next.authenticity = Math.min(next.authenticity, 5);
      next.depth = Math.min(next.depth, 5);
      next.metrics = Math.min(next.metrics, 5);
      next.engineering = Math.min(next.engineering, 5);
      next.industry = Math.min(next.industry, 5);
    }
  }
  state.latestScores = { ...next };
  const count = state.answers.length;
  Object.keys(state.scores).forEach((key) => {
    state.scores[key] = Math.round(((state.scores[key] * (count - 1)) + next[key]) / count);
  });
}

function scoreAverage(scores) {
  const values = Object.values(scores || {});
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, item) => sum + Number(item || 0), 0) / values.length);
}

function renderScoreMini(scores) {
  const rows = [
    ["authenticity", "真实性"],
    ["depth", "技术深度"],
    ["metrics", "指标意识"],
    ["engineering", "工程落地"],
    ["industry", "趋势判断"]
  ];
  const safeScores = scores || {};
  return `
    <div class="round-score-grid">
      ${rows.map(([key, label]) => `
        <div class="round-score">
          <span>${label}</span>
          <strong>${Number.isFinite(Number(safeScores[key])) ? safeScores[key] : 0}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function renderFacts() {
  const facts = state.facts;
  const grid = $("#factGrid");
  if (!facts) return;

  const riskClass = facts.riskPoints.length >= 3 ? "danger" : facts.riskPoints.length ? "warning" : "";
  grid.innerHTML = `
    <article class="wide-card">
      <h3>这张事实卡怎么用</h3>
      <p>事实卡相当于面试官读完项目后的“抓漏洞清单”。它不会给最终分，而是告诉你：你的材料目前更像哪个技术方向、哪些关键词能支撑岗位匹配、哪些关键信息没写清，以及第一轮应该优先被追问什么。</p>
      <p>如果这里显示缺少指标、数据来源、工程落地或行业场景，后面的追问会优先围绕这些缺口展开。</p>
    </article>
    <article>
      <h3>方向判断</h3>
      <p>${facts.profile.label}</p>
      <ul class="pill-list">
        ${(facts.matchedTerms.length ? facts.matchedTerms : ["待补充技术关键词"]).map((term) => `<li>${sanitize(term)}</li>`).join("")}
      </ul>
    </article>
    <article>
      <h3>岗位关键词</h3>
      <ul class="pill-list">
        ${(facts.jdTerms.length ? facts.jdTerms : ["未填写，保持通用技术岗训练"]).map((term) => `<li>${sanitize(term)}</li>`).join("")}
      </ul>
    </article>
    <article>
      <h3>简历完整度</h3>
      <ul>
        <li>${facts.checks.hasRole ? "已出现个人负责内容" : "缺少个人负责内容"}</li>
        <li>${facts.checks.hasMetric ? "已出现指标或评估" : "缺少指标或评估"}</li>
        <li>${facts.checks.hasData ? "已出现数据来源" : "缺少数据来源"}</li>
        <li>${facts.checks.hasDeployment ? "已出现工程落地信息" : "缺少工程落地信息"}</li>
        <li>${facts.checks.hasIndustry ? "已出现行业或企业场景理解" : "缺少行业或企业场景理解"}</li>
      </ul>
    </article>
    <article class="${riskClass}">
      <h3>初始风险点</h3>
      <ul>
        ${(facts.riskPoints.length ? facts.riskPoints : ["项目材料基础完整，可以进入深挖。"]).map((item) => `<li>${sanitize(item)}</li>`).join("")}
      </ul>
    </article>
    <article class="wide-card">
      <h3>和报告的区别</h3>
      <p>事实卡发生在面试前或面试刚开始，用来决定怎么问；报告发生在训练过程中和结束后，用来复盘你每一轮答得怎么样、哪里需要补。</p>
    </article>
  `;
}

function renderScores() {
  const rows = [
    ["authenticity", "真实性"],
    ["depth", "技术深度"],
    ["metrics", "指标意识"],
    ["engineering", "工程落地"],
    ["industry", "趋势判断"]
  ];
  $("#scoreStack").innerHTML = rows.map(([key, label]) => `
    <div class="score-row">
      <span>${label}</span>
      <meter min="0" max="10" value="${state.latestScores[key]}"></meter>
      <strong>${state.latestScores[key]}</strong>
    </div>
  `).join("");

  const latestAverage = Math.round(Object.values(state.latestScores).reduce((sum, item) => sum + item, 0) / Object.values(state.latestScores).length);
  const totalAverage = Math.round(Object.values(state.scores).reduce((sum, item) => sum + item, 0) / Object.values(state.scores).length);
  $("#scoreStack").innerHTML += state.answers.length
    ? `<p class="score-note">当前显示本轮分；累计均分 ${totalAverage}</p>`
    : `<p class="score-note">当前显示本轮分；开始后会计算累计均分。</p>`;
  const badge = $("#riskBadge");
  if (!state.answers.length) {
    badge.textContent = "未评估";
    badge.style.background = "var(--amber-2)";
    badge.style.color = "var(--amber)";
  } else if (latestAverage >= 7) {
    badge.textContent = "较能抗问";
    badge.style.background = "var(--green-2)";
    badge.style.color = "var(--green)";
  } else if (latestAverage >= 4) {
    badge.textContent = "存在漏洞";
    badge.style.background = "var(--amber-2)";
    badge.style.color = "var(--amber)";
  } else {
    badge.textContent = "高风险";
    badge.style.background = "var(--red-2)";
    badge.style.color = "var(--red)";
  }
}

function renderCurrentQuestion(question, status = "idle") {
  const box = $("#currentQuestionBox");
  if (!question) {
    const text = {
      idle: "等待开始。",
      loading: "正在生成第一轮追问，请稍等。",
      done: "本轮训练已结束，可以查看报告。"
    }[status] || "等待开始。";
    box.innerHTML = `<p>${text}</p>`;
    return;
  }

  const normalized = normalizeQuestion(question);
  box.innerHTML = `
    <p>${sanitize(normalized.text)}</p>
    <div class="pressure-meter" aria-label="时间压力">
      <span id="pressureFill"></span>
    </div>
    <div class="time-limit">
      <span>建议时长</span>
      <strong>${formatDuration(normalized.timeLimitSeconds)}</strong>
    </div>
    <div class="time-limit">
      <span>剩余时间</span>
      <strong id="timeRemaining">未开始</strong>
    </div>
  `;
}

function addMessage(role, title, body) {
  const chat = $("#chatLog");
  if (chat.querySelector(".empty-state")) chat.innerHTML = "";
  const div = document.createElement("div");
  div.className = `message ${role}`;
  div.innerHTML = `
    <div class="message-title">
      <span>${sanitize(title)}</span>
      <span>${role === "system" ? "项目拷问官" : "你的回答"}</span>
    </div>
    <p>${sanitize(body)}</p>
  `;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

function updateMessageBody(message, body) {
  if (!message) return;
  const target = message.querySelector("p");
  if (target) target.textContent = body;
  $("#chatLog").scrollTop = $("#chatLog").scrollHeight;
}

async function saveMessage(role, round, content, meta = {}) {
  if (!state.sessionId) return;
  try {
    await apiRequest(`/api/sessions/${state.sessionId}/message`, {
      method: "POST",
      body: JSON.stringify({ role, round, content, meta })
    });
  } catch (error) {
    console.warn("save message failed:", error);
  }
}

async function createSessionSnapshot(projectText, track, intensity, feedbackMode, jdKeywords, focusText) {
  const interviewerStyle = $("#interviewerStyle").value;
  const data = await apiRequest("/api/sessions", {
    method: "POST",
    body: JSON.stringify({
      title: makeSessionTitle(projectText),
      track,
      intensity,
      feedbackMode,
      projectText,
      jdKeywords,
      focusText,
      facts: state.facts,
      scores: state.scores,
      risks: state.risks
    })
  });
  state.sessionId = data.session.id;
  state.sessionTitle = data.session.title;
  await loadHistory();
}

async function saveSessionState(status = "active", extraReport = {}) {
  if (!state.sessionId) return;
  try {
    await apiRequest(`/api/sessions/${state.sessionId}/state`, {
      method: "POST",
      body: JSON.stringify({
        status,
        facts: state.facts,
        scores: state.scores,
        risks: state.risks,
        report: {
          answers: state.answers,
          feedbackItems: state.feedbackItems,
          questions: state.questions,
          round: state.round,
          ...extraReport
        }
      })
    });
    await loadHistory();
  } catch (error) {
    console.warn("save session state failed:", error);
  }
}

function stopTimer() {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

function startTimer(seconds) {
  stopTimer();
  state.activeTimeLimit = seconds;
  state.activeDeadline = Date.now() + seconds * 1000;
  updateTimer();
  state.timerId = setInterval(updateTimer, 1000);
}

function updateTimer() {
  const target = $("#timeRemaining");
  if (!target || !state.activeDeadline) return;
  const remaining = Math.max(0, Math.ceil((state.activeDeadline - Date.now()) / 1000));
  target.textContent = formatDuration(remaining);
  target.classList.toggle("time-over", remaining === 0);
  const fill = $("#pressureFill");
  if (fill && state.activeTimeLimit) {
    const elapsed = Math.min(state.activeTimeLimit, state.activeTimeLimit - remaining);
    const ratio = elapsed / state.activeTimeLimit;
    fill.style.width = `${Math.round(ratio * 100)}%`;
    fill.classList.toggle("pressure-hot", ratio >= 0.75);
  }
  if (remaining > 0 && remaining <= 15) {
    $("#answerHint").textContent = "最后 15 秒，优先给结论和最关键证据。";
  }
  if (remaining === 0) {
    $("#answerHint").textContent = "建议时长已到，可以提交当前版本，真实面试里也要学会收束。";
    stopTimer();
  }
}

async function askNextQuestion() {
  if (state.round >= state.maxSafetyRounds || state.round >= state.questions.length) {
    finishSession();
    return;
  }
  const question = state.questions[state.round];
  const text = questionText(question);
  const timeLimit = questionTimeLimit(question);
  renderCurrentQuestion(question);
  addMessage("system", `第 ${state.round + 1} 轮追问 · 建议 ${formatDuration(timeLimit)}`, text);
  await saveMessage("interviewer", state.round + 1, text, { timeLimitSeconds: timeLimit, question });
  $("#roundCounter").textContent = `${state.round + 1}`;
  $("#answerInput").value = "";
  $("#answerInput").disabled = false;
  $("#submitAnswer").disabled = false;
  $("#answerHint").textContent = `建议在 ${formatDuration(timeLimit)} 内回答：先结论，再证据，再取舍。`;
  $("#answerInput").focus();
  startTimer(timeLimit);
}

async function startSession() {
  if (!ensureLoggedIn()) return;
  const track = $("#track").value;
  const intensity = $("#intensity").value;
  const interviewerStyle = $("#interviewerStyle").value;
  const feedbackMode = $("#feedbackMode").value;
  const projectText = $("#projectText").value.trim();
  const jdKeywords = $("#jdKeywords").value.trim();
  const focusText = $("#focusText").value.trim();

  if (projectText.length < 40) {
    $("#projectText").focus();
    alert("项目描述至少写 40 个字，才能开始深挖。");
    return;
  }

  state.started = true;
  state.round = 0;
  state.answers = [];
  state.feedbackMode = feedbackMode;
  state.feedbackItems = [];
  stopTimer();
  state.activeDeadline = null;
  state.scores = { authenticity: 0, depth: 0, metrics: 0, engineering: 0, industry: 0 };
  state.latestScores = { authenticity: 0, depth: 0, metrics: 0, engineering: 0, industry: 0 };
  state.risks = [];
  state.facts = extractFacts(projectText, track, jdKeywords, focusText);
  state.questions = buildQuestions(track, intensity, state.facts);
  state.sessionId = null;
  state.sessionTitle = "";

  $("#chatLog").innerHTML = "";
  $("#sessionStatus").textContent = "训练中";
  $("#latestDiagnosis").innerHTML = feedbackMode === "realtime"
    ? "<li>先完成第一轮回答。</li>"
    : "<li>已切换为结束后反馈。过程中不会显示逐轮评价。</li>";
  renderFacts();
  renderScores();
  renderCurrentQuestion(null, "loading");
  $("#answerInput").disabled = true;
  $("#submitAnswer").disabled = true;
  $("#answerHint").textContent = "正在生成第一轮追问。";
  switchTab("interview");
  $("#sessionStatus").textContent = "生成追问";

  try {
    await createSessionSnapshot(projectText, track, intensity, feedbackMode, jdKeywords, focusText);
    const ai = await requestAI("questions", {
      sessionId: state.sessionId,
      track: state.facts.profile.label,
      intensity,
      interviewerStyle,
      projectText,
      jdKeywords,
      focusText,
      initialRisks: state.facts.riskPoints,
      maxSafetyRounds: state.maxSafetyRounds
    });
    if (ai.first_question) {
      const planned = Array.isArray(ai.questions) ? ai.questions : [];
      state.questions = normalizeQuestions([ai.first_question, ...planned]);
    } else if (Array.isArray(ai.questions) && ai.questions.length) {
      state.questions = normalizeQuestions(ai.questions);
    }
  } catch (error) {
    console.warn("AI questions/session fallback:", error);
    if (!state.sessionId) {
      alert(`无法创建模拟记录：${error.message}`);
      resetSession();
      return;
    }
  }

  $("#sessionStatus").textContent = "训练中";
  await askNextQuestion();
}

async function submitAnswer(event) {
  event.preventDefault();
  if (!state.started) return;

  const answer = $("#answerInput").value.trim();
  if (answer.length < 20) {
    $("#answerInput").focus();
    alert("回答再展开一点，至少写 20 个字。");
    return;
  }

  stopTimer();
  const question = state.questions[state.round];
  const currentQuestionText = questionText(question);
  addMessage("user", `回答 ${state.round + 1}`, answer);
  state.answers.push({ question: currentQuestionText, timeLimitSeconds: questionTimeLimit(question), answer });
  await saveMessage("candidate", state.round + 1, answer, { question: currentQuestionText, timeLimitSeconds: questionTimeLimit(question) });

  const scores = scoreAnswer(answer);
  let finalScores = scores;
  let diagnosis = diagnoseAnswer(answer, question);
  const localRelevance = assessAnswerRelevance(answer, currentQuestionText);
  if (localRelevance.score <= 4) diagnosis.unshift(`没有正面回答问题：${localRelevance.evidence}`);
  let structuredFeedback = null;
  let shouldEnd = false;
  let endReason = "";
  $("#latestDiagnosis").innerHTML = state.feedbackMode === "realtime"
    ? "<li>正在诊断回答。如果 API 不可用，会自动使用本地规则。</li>"
    : "<li>本轮反馈已记录，将在最终报告中统一展示。</li>";

  try {
    const ai = await requestAgentStep({
      sessionId: state.sessionId,
      facts: state.facts,
      interviewerStyle: $("#interviewerStyle").value,
      question: currentQuestionText,
      timeLimitSeconds: questionTimeLimit(question),
      answer,
      previousRounds: state.answers.slice(0, -1),
      previousFeedback: state.feedbackItems.slice(-3),
      currentRound: state.round + 1,
      maxSafetyRounds: state.maxSafetyRounds,
      currentScores: state.scores,
      risks: state.risks
    });
    if (Array.isArray(ai.diagnosis) && ai.diagnosis.length) {
      diagnosis = ai.diagnosis.slice(0, 5);
    }
    structuredFeedback = normalizeFeedback({
      ...(ai.feedback || {}),
      answer_relevance: ai.answer_relevance || ai.feedback?.answer_relevance
    }, diagnosis);
    if (ai.scores) {
      finalScores = {
        authenticity: clampScore(ai.scores.authenticity, scores.authenticity),
        depth: clampScore(ai.scores.depth, scores.depth),
        metrics: clampScore(ai.scores.metrics, scores.metrics),
        engineering: clampScore(ai.scores.engineering, scores.engineering),
        industry: clampScore(ai.scores.industry, scores.industry)
      };
    }
    shouldEnd = Boolean(ai.should_end);
    endReason = ai.end_reason || "";
    if (ai.next_probe) {
      state.questions[state.round + 1] = normalizeQuestion(ai.next_probe);
    }
  } catch (error) {
    console.warn("AI agent fallback:", error);
  }

  if (!structuredFeedback) structuredFeedback = normalizeFeedback({
    answer_relevance: localRelevance
  }, diagnosis);
  if (structuredFeedback.answer_relevance.verdict.startsWith("未评估")) {
    structuredFeedback.answer_relevance = localRelevance;
  }
  state.feedbackItems.push({
    round: state.round + 1,
    question: currentQuestionText,
    answer,
    scores: { ...finalScores },
    averageScore: scoreAverage(finalScores),
    ...structuredFeedback
  });

  mergeScores(finalScores);
  state.risks.push(...diagnosis.filter((item) => !item.includes("比较扎实")));
  await saveMessage("feedback", state.round + 1, structuredFeedback.pain_point, structuredFeedback);

  if (state.feedbackMode === "realtime") {
    renderLatestFeedback(structuredFeedback);
  } else {
    $("#latestDiagnosis").innerHTML = "<li>本轮反馈已记录，将在最终报告中统一展示。</li>";
  }
  renderScores();

  state.round += 1;
  $("#roundCounter").textContent = `${state.round}`;
  renderReport();
  await saveSessionState("active");

  if (shouldEnd) {
    finishSession(endReason);
  } else if (state.round >= state.maxSafetyRounds) {
    finishSession("已达到 10 轮安全上限，系统主动收束。");
  } else {
    if (!state.questions[state.round]) {
      const fallback = buildQuestions($("#track").value, $("#intensity").value, state.facts)[state.round] || commonQuestions[3];
      state.questions[state.round] = normalizeQuestion(fallback);
    }
    setTimeout(() => askNextQuestion(), 280);
  }
}

function clampScore(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(10, Math.round(number)));
}

function renderReport() {
  const report = $("#reportPanel");
  if (!state.answers.length) {
    report.innerHTML = `
      <article>
        <h3>抗拷问报告</h3>
        <p>这里是最终复盘区。无论你选择实时反馈还是结束后反馈，每一轮的问题分析、回答分析、是否答到问题、痛点、改进建议和示例回答都会汇总在这里。</p>
        <p>完成至少 1 轮回答后会先出现逐轮反馈；训练结束后会补充整场总结、高危追问和下一轮训练重点。</p>
      </article>
    `;
    return;
  }

  const average = Math.round(Object.values(state.scores).reduce((sum, item) => sum + item, 0) / Object.values(state.scores).length);
  const latestAverage = Math.round(Object.values(state.latestScores).reduce((sum, item) => sum + item, 0) / Object.values(state.latestScores).length);
  const uniqueRisks = [...new Set([...(state.facts?.riskPoints || []), ...state.risks])].slice(0, 6);
  const weakest = Object.entries(state.scores).sort((a, b) => a[1] - b[1])[0][0];
  const adviceMap = {
    authenticity: "补齐个人贡献边界：你亲手实现了什么、改了哪些关键代码、遇到什么具体问题。",
    depth: "补齐技术取舍：为什么不用更简单的方案，替代方案的成本和收益是什么。",
    metrics: "补齐评估指标：离线指标、线上指标、采集方式、失败样本分析。",
    engineering: "补齐工程闭环：部署、监控、异常、回滚、成本和性能瓶颈。",
    industry: "补齐行业判断：真实业务场景、企业落地约束、技术趋势和未来变化下的取舍。"
  };

  report.innerHTML = `
    <article>
      <h3>总览</h3>
      <p>总览展示整场训练的累计表现；右侧即时诊断展示最近一轮表现。两者用途不同。</p>
      <div class="metric-grid">
        <div class="metric"><strong>${average}</strong><span>抗拷问总分</span></div>
        <div class="metric"><strong>${latestAverage}</strong><span>最近一轮</span></div>
        <div class="metric"><strong>${state.answers.length}</strong><span>已完成轮次</span></div>
        <div class="metric"><strong>${uniqueRisks.length}</strong><span>危险点</span></div>
      </div>
    </article>
    <article>
      <h3>整场高危追问点</h3>
      <p>这些是面试官最可能继续深挖、也最容易把项目问穿的位置。</p>
      <ul>
        ${uniqueRisks.length ? uniqueRisks.map((item) => `<li>${sanitize(item)}</li>`).join("") : "<li>暂未发现明显高风险点，继续补充细节和指标。</li>"}
      </ul>
    </article>
    <article>
      <h3>下一轮训练重点</h3>
      <p>下一次练习优先补这些，不要平均用力。</p>
      <ul>
        <li>${adviceMap[weakest]}</li>
        <li>准备一段 90 秒项目介绍：背景、角色、技术路线、结果和反思。</li>
        <li>准备一个核心模块伪代码，证明不是只会调用框架。</li>
      </ul>
    </article>
    <article>
      <h3>项目表达骨架</h3>
      <p>这不是让你照读，而是提醒你最终需要补齐哪些信息：我负责的具体模块、要解决的问题、为什么选择这个方案、用了什么指标验证、遇到什么工程风险、如果真实落地最担心什么、如果重做优先改哪里。</p>
    </article>
    ${renderFeedbackSummary()}
  `;
}

function renderFeedbackSummary() {
  if (!state.feedbackItems.length) return "";
  return `
    <article>
      <h3>每轮复盘</h3>
      <p>${state.feedbackMode === "final" ? "你选择了结束后反馈，所以训练中不会展开评价；所有逐轮反馈会集中出现在这里。" : "你选择了实时反馈，所以右侧会显示最近一轮；这里会保留所有轮次，方便最后整体复盘。"}</p>
      ${state.feedbackItems.map((item) => `
        <div class="feedback-item">
          <h3>第 ${item.round} 轮 · 本轮 ${item.averageScore ?? scoreAverage(item.scores)} 分</h3>
          ${renderScoreMini(item.scores)}
          <p><strong>是否答到问题：</strong>${sanitize(item.answer_relevance?.verdict || "未评估")}${item.answer_relevance?.evidence ? `：${sanitize(item.answer_relevance.evidence)}` : ""}</p>
          <p><strong>问题分析：</strong>${sanitize(item.question_analysis)}</p>
          <p><strong>回答分析：</strong>${sanitize(item.answer_analysis)}</p>
          <p><strong>痛点：</strong>${sanitize(item.pain_point)}</p>
          <p><strong>如何改进：</strong>${sanitize(item.improvement)}</p>
          <p><strong>示例回答：</strong>${sanitize(item.sample_answer)}</p>
        </div>
      `).join("")}
    </article>
  `;
}

async function enrichFinalReport(reason = "") {
  let reportExtra = { endReason: reason };
  try {
    const ai = await requestAI("report", {
      sessionId: state.sessionId,
      facts: state.facts,
      interviewerStyle: $("#interviewerStyle").value,
      answers: state.answers,
      scores: state.scores,
      risks: state.risks,
      feedbackMode: state.feedbackMode,
      feedbackItems: state.feedbackItems,
      endReason: reason
    });
    reportExtra.aiReport = ai;
    const dangerPoints = Array.isArray(ai.danger_points) ? ai.danger_points : [];
    const practicePlan = Array.isArray(ai.practice_plan) ? ai.practice_plan : [];
    const strongerPitch = ai.stronger_pitch || "";
    const summary = ai.summary || "";
    if (!dangerPoints.length && !practicePlan.length && !strongerPitch && !summary) return;

    $("#reportPanel").innerHTML += `
      <article>
        <h3>整场总结</h3>
        <p>这部分由模型在训练结束后汇总，重点看整场共性问题和下一轮准备方向。</p>
        ${summary ? `<p>${sanitize(summary)}</p>` : ""}
        ${dangerPoints.length ? `<h3>高危追问</h3><ul>${dangerPoints.map((item) => `<li>${sanitize(item)}</li>`).join("")}</ul>` : ""}
        ${practicePlan.length ? `<h3>训练计划</h3><ul>${practicePlan.map((item) => `<li>${sanitize(item)}</li>`).join("")}</ul>` : ""}
        ${strongerPitch ? `<h3>更强表达</h3><p>${sanitize(strongerPitch)}</p>` : ""}
      </article>
    `;
  } catch (error) {
    console.warn("AI report fallback:", error);
  } finally {
    await saveSessionState(reason === "用户手动终止" ? "stopped" : "ended", reportExtra);
  }
}

function finishSession(reason = "") {
  if (!state.started && !state.answers.length) return;
  state.started = false;
  $("#sessionStatus").textContent = "已生成报告";
  $("#roundCounter").textContent = `${Math.min(state.round, state.maxSafetyRounds)}`;
  $("#answerInput").disabled = true;
  $("#submitAnswer").disabled = true;
  $("#answerHint").textContent = "训练结束，查看报告继续补漏洞。";
  stopTimer();
  renderCurrentQuestion(null, "done");
  renderReport();
  enrichFinalReport(reason);
  if (!$("#chatLog").dataset.finished) {
    const message = reason ? `这一轮项目拷问结束。结束原因：${reason}` : "这一轮项目拷问结束。现在去报告页看最危险的追问点和下一轮训练重点。";
    addMessage("system", "训练结束", message);
    saveMessage("system", state.round, message, { reason });
    $("#chatLog").dataset.finished = "true";
  }
}

function stopInterview() {
  if (!state.started || !state.answers.length) {
    alert("至少完成一轮回答后，才能终止并生成报告。");
    return;
  }
  finishSession("用户手动终止");
  switchTab("report");
}

function resetSession() {
  state.started = false;
  state.round = 0;
  state.questions = [];
  state.answers = [];
  state.facts = null;
  state.risks = [];
  state.feedbackMode = $("#feedbackMode").value;
  state.feedbackItems = [];
  state.sessionId = null;
  state.sessionTitle = "";
  stopTimer();
  state.activeDeadline = null;
  state.scores = { authenticity: 0, depth: 0, metrics: 0, engineering: 0, industry: 0 };
  state.latestScores = { authenticity: 0, depth: 0, metrics: 0, engineering: 0, industry: 0 };

  $("#sessionStatus").textContent = "待开始";
  $("#roundCounter").textContent = "0";
  $("#chatLog").innerHTML = `
    <div class="empty-state">
      <h2>把项目交给它，然后准备被追问。</h2>
      <p>它会围绕真实性、方法选择、指标、工程落地、伪代码、前沿理解和行业趋势连续发问。</p>
    </div>
  `;
  $("#chatLog").dataset.finished = "";
  $("#factGrid").innerHTML = `
    <article>
      <h3>项目事实卡</h3>
      <p>开始后自动生成，用来模拟面试官读简历时抓重点的过程。</p>
    </article>
  `;
  $("#latestDiagnosis").innerHTML = "<li>还没有回答。开始后这里会显示哪里虚、哪里会被继续追。</li>";
  renderCurrentQuestion(null, "idle");
  $("#answerInput").value = "";
  $("#answerInput").disabled = true;
  $("#submitAnswer").disabled = true;
  $("#answerHint").textContent = "回答越具体，诊断越准。";
  renderScores();
  renderReport();
  switchTab("interview");
}

function newSimulation() {
  resetSession();
  $("#projectText").focus();
}

async function openHistorySession(sessionId) {
  try {
    const data = await apiRequest(`/api/sessions/${sessionId}`);
    const item = data.session;
    resetSession();
    state.sessionId = item.id;
    state.sessionTitle = item.title;
    state.facts = item.facts;
    state.scores = { authenticity: 0, depth: 0, metrics: 0, engineering: 0, industry: 0, ...(item.scores || {}) };
    state.latestScores = state.feedbackItems.length
      ? { ...state.scores }
      : { authenticity: 0, depth: 0, metrics: 0, engineering: 0, industry: 0 };
    state.risks = item.risks || [];
    state.feedbackItems = item.report?.feedbackItems || [];
    state.answers = item.report?.answers || [];
    state.questions = item.report?.questions || [];
    state.round = item.report?.round || state.answers.length;
    $("#track").value = item.track || "general";
    $("#intensity").value = item.intensity || "normal";
    $("#interviewerStyle").value = "mixed";
    $("#feedbackMode").value = item.feedbackMode || "realtime";
    $("#projectText").value = item.projectText || "";
    $("#jdKeywords").value = item.jdKeywords || "";
    $("#focusText").value = item.focusText || "";
    $("#sessionStatus").textContent = item.status === "active" ? "历史记录" : "历史报告";
    $("#roundCounter").textContent = `${state.round}`;
    $("#chatLog").innerHTML = "";
    (item.messages || []).forEach((message) => {
      if (message.role === "candidate") addMessage("user", `回答 ${message.round}`, message.content);
      else if (message.role === "interviewer") addMessage("system", `第 ${message.round} 轮追问`, message.content);
      else if (message.role === "system") addMessage("system", "训练结束", message.content);
    });
    if (!(item.messages || []).length) {
      $("#chatLog").innerHTML = "<div class=\"empty-state\"><h2>这条历史记录还没有问答内容。</h2><p>可以点击“新模拟”重新开始。</p></div>";
    }
    renderFacts();
    renderScores();
    renderReport();
    renderCurrentQuestion(null, "done");
    $("#answerInput").disabled = true;
    $("#submitAnswer").disabled = true;
    $("#answerHint").textContent = "正在查看历史记录。点击“新模拟”开启新对话。";
    switchTab("report");
  } catch (error) {
    alert(`读取历史失败：${error.message}`);
  }
}

function switchTab(tabName) {
  $$(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === tabName));
  $$(".tab-view").forEach((view) => view.classList.remove("active"));
  $(`#${tabName}View`).classList.add("active");
}

$("#startSession").addEventListener("click", startSession);
$("#resetSession").addEventListener("click", resetSession);
$("#stopSession").addEventListener("click", stopInterview);
$("#newSession").addEventListener("click", newSimulation);
$("#refreshHistory").addEventListener("click", () => loadHistory());
$("#loginButton").addEventListener("click", () => handleAuth("login").catch((error) => alert(error.message)));
$("#registerButton").addEventListener("click", () => handleAuth("register").catch((error) => alert(error.message)));
$("#logoutButton").addEventListener("click", logout);
$("#answerForm").addEventListener("submit", submitAnswer);
$("#loadSample").addEventListener("click", () => {
  $("#track").value = "code";
  $("#intensity").value = "senior";
  $("#interviewerStyle").value = "mixed";
  $("#jdKeywords").value = "代码质量、AI 评审、服务稳定性、Python、评测";
  $("#focusText").value = "代码实现、误报漏报、工程落地、行业趋势";
  $("#projectText").value = sampleProject;
});

$$(".tab").forEach((tab) => {
  tab.addEventListener("click", () => switchTab(tab.dataset.tab));
});

renderScores();
renderAuth();
loadMe();
