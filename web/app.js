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
  intensity: "normal",
  interviewerStyle: "mixed",
  feedbackItems: [],
  scores: {
    authenticity: 0,
    depth: 0,
    metrics: 0,
    engineering: 0,
    industry: 0,
    time: 0
  },
  latestScores: {
    authenticity: 0,
    depth: 0,
    metrics: 0,
    engineering: 0,
    industry: 0,
    time: 0
  },
  risks: [],
  authToken: localStorage.getItem("projectInterrogatorToken") || "",
  user: null,
  sessionId: null,
  sessionTitle: "",
  history: [],
  streamBuffer: "",
  isSubmitting: false,
  pendingSubmit: null
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

function syncLiveOptions() {
  state.intensity = $("#intensity").value;
  state.interviewerStyle = $("#interviewerStyle").value;
  state.feedbackMode = $("#feedbackMode").value;
}

function setLockedProjectInputs(locked) {
  ["track", "jdKeywords", "projectText", "focusText"].forEach((id) => {
    $(`#${id}`).disabled = locked;
  });
  $("#loadSample").disabled = locked;
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
    riskPoints,
    evidenceChain: buildEvidenceChain(projectText, track, { hasMetric, hasRole, hasData, hasDeployment, hasIndustry }),
    trendCard: buildTrendCard(projectText, track, { hasMetric, hasDeployment, hasIndustry })
  };
}

function buildEvidenceChain(projectText, track, checks) {
  const profile = trackProfiles[track];
  const projectClaim = extractProjectClaim(projectText, profile.label);
  const proofItems = [];
  const riskItems = [];

  if (checks.hasRole) {
    proofItems.push("个人负责范围、模块边界、关键代码或实验脚本");
  } else {
    proofItems.push("需要补：你本人到底负责哪一层、哪几个文件/脚本/模块");
    riskItems.push("个人贡献边界不清，容易被质疑只是参与或包装");
  }
  if (checks.hasData) {
    proofItems.push("数据来源、样本构成、质量控制和失败样本");
  } else {
    proofItems.push("需要补：数据从哪里来、是否可靠、有没有坏样本");
    riskItems.push("数据可信度不足，指标和结论会被追问");
  }
  if (checks.hasMetric) {
    proofItems.push("核心指标、baseline、实验/线上观测和误差分析");
  } else {
    proofItems.push("需要补：用什么指标证明项目有效，和 baseline 怎么比");
    riskItems.push("没有量化证据，项目价值容易停留在 demo");
  }
  if (checks.hasDeployment) {
    proofItems.push("部署链路、日志监控、异常处理、成本和回滚");
  } else {
    riskItems.push("工程闭环不足，真实落地会被追稳定性和成本");
  }

  if (/vlm|robot|机器人|机械臂|多模态|视觉语言/i.test(projectText)) {
    riskItems.push("VLM/机器人项目要额外证明 sim-to-real gap、动作安全和闭环成功率");
  }
  if (/大模型|llm|agent|rag|prompt|模型/i.test(projectText)) {
    riskItems.push("AI 项目要证明不是只调 API：输入输出、后处理、评估和兜底必须说清");
  }

  return {
    claim: projectClaim,
    proofItems: proofItems.slice(0, 4),
    riskItems: [...new Set(riskItems)].slice(0, 4)
  };
}

function extractProjectClaim(projectText, fallbackLabel) {
  const compact = projectText.replace(/\s+/g, " ").trim();
  const firstSentence = compact.split(/[。！？!?；;]/)[0] || compact;
  if (firstSentence.length >= 12) return firstSentence.slice(0, 80);
  return `这是一个${fallbackLabel}项目，需要证明个人贡献、技术方案和结果有效。`;
}

function buildTrendCard(projectText, track, checks) {
  const lower = projectText.toLowerCase();
  let scenario = "真实企业落地场景";
  let timing = "效率、成本和可靠性要求提高，使这个问题值得被重新做一遍";
  let enterpriseFocus = ["成本", "可靠性", "部署复杂度", "安全合规", "ROI"];
  let probe = "如果把这个项目放到真实企业里，第一个影响 ROI 的约束是什么？";

  if (/vlm|robot|机器人|机械臂|多模态|视觉语言/i.test(projectText)) {
    scenario = "机器人和具身智能落地场景";
    timing = "VLM、多模态感知和低成本硬件推进了自然语言控制机器人，但 sim-to-real、延迟和安全仍是瓶颈";
    enterpriseFocus = ["任务成功率", "动作安全", "推理延迟", "场景泛化", "人工接管成本"];
    probe = "为什么现在 VLM 机器人值得做？真实部署时你会先压成功率、延迟、安全还是人工接管成本？";
  } else if (/大模型|llm|agent|rag|prompt|模型/i.test(projectText)) {
    scenario = "AI 应用落地场景";
    timing = "大模型能力增强后，企业更关心稳定性、成本、数据边界和可控性，而不只是 demo 效果";
    enterpriseFocus = ["准确性", "稳定性", "调用成本", "数据安全", "人工兜底"];
    probe = "这个 AI 能力为什么现在适合落地？如果模型成本或错误率上升，你的方案怎么调整？";
  } else if (track === "backend" || /服务|接口|数据库|缓存|并发|队列/.test(projectText)) {
    scenario = "业务系统工程化场景";
    timing = "业务增长后，稳定性、可观测性和成本控制比单点功能更关键";
    enterpriseFocus = ["稳定性", "延迟", "扩展性", "数据一致性", "运维成本"];
    probe = "如果业务量增长 10 倍，企业会先关心稳定性、延迟、成本还是一致性？你怎么证明？";
  } else if (track === "frontend" || /前端|组件|页面|交互|渲染/.test(projectText)) {
    scenario = "用户体验和前端工程场景";
    timing = "产品体验竞争加剧，前端不只交付页面，还要负责性能、可观测性和转化效率";
    enterpriseFocus = ["首屏性能", "交互稳定性", "转化率", "埋点质量", "异常恢复"];
    probe = "这个前端项目对业务体验的核心贡献是什么？你怎么证明不是只做了页面？";
  }

  if (!checks.hasIndustry) {
    enterpriseFocus.unshift("业务价值");
  }

  return {
    scenario,
    timing,
    enterpriseFocus: [...new Set(enterpriseFocus)].slice(0, 5),
    probe
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
    unique.splice(
      1,
      0,
      "我先质疑一下：你这段项目描述听起来更像把现成组件串起来。请你拿一个最能证明是你亲手做的证据出来，具体到代码路径、参数选择或排查记录。",
      "如果我认为这个项目有包装嫌疑，你会用哪一个失败案例证明你真的做过？不要讲结果，讲当时哪里出错、你怎么定位。",
      "你刚才说的方案里，哪一个假设最脆弱？如果这个假设不成立，系统会怎么坏？"
    );
  }
  if (intensity === "senior") {
    unique.splice(
      2,
      0,
      "请讲一个你做过的关键取舍：你牺牲了什么，换来了什么？最好带上当时的指标或约束。",
      "你这个方案如果放到真实线上环境，第一个瓶颈会在哪里？你怎么验证过？"
    );
  }
  if (intensity === "normal") {
    unique.splice(1, 0, "我们先把事实对齐：这个项目里你本人负责的范围是什么，团队其他人负责什么？");
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

function buildPressureDecision(relevance, scores, diagnosis, answer, question) {
  const average = scoreAverage(scores);
  const shortOrVague = answer.length < 120 || diagnosis.some((item) => /偏短|缺少|不足|不够|没有/.test(item));
  const coreQuestion = limitText(question || "刚才的问题", 120);
  if (relevance.score <= 4) {
    return {
      level: "重答",
      action: "repeat",
      label: "跑题重答",
      reason: relevance.evidence || "回答没有对准本轮问题",
      nextQuestion: `我先打断一下，这个回答没有对上我刚才问的点。刚才的问题是：${coreQuestion} 请不要展开其他准备稿，先正面回答这一点：${relevance.evidence || "你漏掉了本轮核心追问"}。`,
      timeLimitSeconds: 75
    };
  }
  if (average >= 7 && !shortOrVague) {
    return {
      level: "加压",
      action: "deepen",
      label: "回答扎实，追更深",
      reason: "本轮有一定证据，可以继续追边界、成本、失败案例或行业约束",
      nextQuestion: "",
      timeLimitSeconds: 120
    };
  }
  return {
    level: "收窄",
    action: "narrow",
    label: "回答偏虚，收窄到证据",
    reason: diagnosis[0] || "回答还缺少可验证证据",
    nextQuestion: `我先把刚才的问题收窄。请只给一个最具体的证据：${diagnosis[0] || "你本人做过的代码路径、数据来源或指标"}。`,
    timeLimitSeconds: 90
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
    ["压力阶梯", `${feedback.pressure_decision?.label || "正常追问"}${feedback.pressure_decision?.reason ? `：${feedback.pressure_decision.reason}` : ""}`],
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
    industry: Math.min(10, lengthScore + industry),
    time: 8
  };
}

function scoreTimeEfficiency(elapsedSeconds, limitSeconds, answer) {
  const timeStats = computeTimeStats(elapsedSeconds, limitSeconds, answer);
  if (!timeStats.limitSeconds) return 7;
  const ratio = timeStats.effectiveSeconds / timeStats.limitSeconds;
  const tooShort = answer.length < 80;
  if (ratio <= 0.35 && tooShort) return 4;
  if (ratio <= 0.75) return 9;
  if (ratio <= 1) return 8;
  if (ratio <= 1.15) return 6;
  if (ratio <= 1.35) return 5;
  if (ratio <= 1.6) return 3;
  return 2;
}

function estimateSpokenSeconds(answer) {
  const value = String(answer || "").trim();
  if (!value) return 0;
  const chineseChars = (value.match(/[\u4e00-\u9fa5]/g) || []).length;
  const latinWords = (value.replace(/[\u4e00-\u9fa5]/g, " ").match(/[a-zA-Z0-9_+.%/-]+/g) || []).length;
  const punctuationPauses = (value.match(/[。！？!?；;：:\n]/g) || []).length;
  const chineseSeconds = chineseChars / 4.2;
  const latinSeconds = latinWords / 2.4;
  const pauseSeconds = Math.min(18, punctuationPauses * 0.55);
  return Math.max(1, Math.round(chineseSeconds + latinSeconds + pauseSeconds));
}

function computeTimeStats(elapsedSeconds, limitSeconds, answer) {
  const actualSeconds = Math.max(0, Math.round(Number(elapsedSeconds) || 0));
  const safeLimit = Math.max(0, Math.round(Number(limitSeconds) || 0));
  const estimatedSpokenSeconds = estimateSpokenSeconds(answer);
  const effectiveSeconds = Math.max(actualSeconds, estimatedSpokenSeconds);
  const overtimeSeconds = safeLimit ? Math.max(0, effectiveSeconds - safeLimit) : 0;
  const ratio = safeLimit ? effectiveSeconds / safeLimit : 0;
  return {
    actualSeconds,
    estimatedSpokenSeconds,
    effectiveSeconds,
    limitSeconds: safeLimit,
    overtimeSeconds,
    ratio
  };
}

function timeEfficiencyNote(elapsedSeconds, limitSeconds) {
  const timeStats = computeTimeStats(elapsedSeconds, limitSeconds, "");
  if (!timeStats.actualSeconds || !timeStats.limitSeconds) return "未记录实际答题时长。";
  if (timeStats.ratio <= 0.35) return "回答很快，若信息不足会显得没有展开。";
  if (timeStats.ratio <= 1) return "答题节奏基本合适。";
  if (timeStats.ratio <= 1.15) return `略超建议时长 ${formatDuration(timeStats.overtimeSeconds)}，真实面试中需要更快收束。`;
  if (timeStats.ratio <= 1.6) return `明显超时 ${formatDuration(timeStats.overtimeSeconds)}，容易影响面试官耐心和追问节奏。`;
  return "严重超时，真实面试中会显著扣分。";
}

function timeEfficiencyNoteFromStats(timeStats) {
  if (!timeStats?.limitSeconds) return "未记录时间信息。";
  const basis = timeStats.estimatedSpokenSeconds > timeStats.actualSeconds
    ? `按文本长度估算口述约 ${formatDuration(timeStats.estimatedSpokenSeconds)}`
    : `实际用时 ${formatDuration(timeStats.actualSeconds)}`;
  if (timeStats.ratio <= 0.35) return `${basis}，回答偏短；如果信息不足，会显得没有展开。`;
  if (timeStats.ratio <= 1) return `${basis}，节奏基本合适。`;
  if (timeStats.ratio <= 1.15) return `${basis}，超出建议时长 ${formatDuration(timeStats.overtimeSeconds)}，需要更快收束。`;
  if (timeStats.ratio <= 1.6) return `${basis}，明显超时 ${formatDuration(timeStats.overtimeSeconds)}，真实面试中会被扣表达效率。`;
  return `${basis}，严重超时 ${formatDuration(timeStats.overtimeSeconds)}，真实面试中会显著影响追问节奏。`;
}

function normalizeTimeStats(item) {
  const stats = item.timeStats || computeTimeStats(item.elapsedSeconds, item.timeLimitSeconds, item.answer || "");
  return {
    actualSeconds: Number(stats.actualSeconds) || 0,
    estimatedSpokenSeconds: Number(stats.estimatedSpokenSeconds) || 0,
    effectiveSeconds: Number(stats.effectiveSeconds) || 0,
    limitSeconds: Number(stats.limitSeconds) || Number(item.timeLimitSeconds) || 0,
    overtimeSeconds: Number(stats.overtimeSeconds) || 0,
    ratio: Number(stats.ratio) || 0
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
      next.time = Math.min(next.time, 5);
    } else if (lastFeedback.answer_relevance?.score <= 6) {
      next.authenticity = Math.min(next.authenticity, 5);
      next.depth = Math.min(next.depth, 5);
      next.metrics = Math.min(next.metrics, 5);
      next.engineering = Math.min(next.engineering, 5);
      next.industry = Math.min(next.industry, 5);
      next.time = Math.min(next.time, 7);
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

function average(values) {
  const clean = values.map(Number).filter((item) => Number.isFinite(item));
  if (!clean.length) return 0;
  return Math.round(clean.reduce((sum, item) => sum + item, 0) / clean.length);
}

function computeQuestionProjectRelevance(item, index) {
  const question = item.question || "";
  const projectText = $("#projectText").value || state.facts?.evidenceChain?.claim || "";
  const projectTokens = new Set([
    ...importantTokens(projectText),
    ...(state.facts?.matchedTerms || []).map((term) => term.toLowerCase()),
    ...(state.facts?.jdTerms || []),
    ...(state.facts?.focusTerms || [])
  ].filter(Boolean));
  const questionTokens = importantTokens(question);
  const overlapCount = questionTokens.filter((token) => projectTokens.has(token)).length;
  let score = Math.min(6, 3 + overlapCount);

  if (/代码|实现|伪代码|模块|链路|接口|函数|脚本/.test(question) && state.facts?.checks?.hasRole) score += 1;
  if (/指标|评估|baseline|实验|压测|证明|效果/.test(question)) score += 1;
  if (/失败|风险|边界|异常|兜底|回滚|瓶颈/.test(question)) score += 1;
  if (/行业|企业|业务|场景|趋势|成本|合规|部署|ROI|可靠/.test(question)) score += 1;

  const previousAnswer = index > 0 ? state.feedbackItems[index - 1]?.answer || "" : "";
  if (previousAnswer) {
    const previousTokens = new Set(importantTokens(previousAnswer));
    const carried = questionTokens.some((token) => previousTokens.has(token));
    if (carried) score += 1;
  }

  return Math.max(1, Math.min(10, score));
}

function computeProductMetrics() {
  const items = state.feedbackItems || [];
  if (!items.length) {
    return {
      questionRelevance: 0,
      probeDepth: 0,
      diagnosisAccuracy: 0,
      trainingGain: 0,
      reviewValue: 0
    };
  }

  const questionRelevance = average(items.map((item, index) => computeQuestionProjectRelevance(item, index)));
  const probeDepth = average(items.map((item) => {
    const text = `${item.question || ""} ${item.question_analysis || ""}`;
    let score = 3;
    if (/代码|实现|伪代码|模块|链路|数据来源|指标|baseline|失败|边界|成本|可靠|合规|ROI|部署/.test(text)) score += 4;
    if (item.pressure_decision?.action === "deepen") score += 2;
    if (item.pressure_decision?.action === "narrow") score += 1;
    return Math.min(10, score);
  }));
  const diagnosisAccuracy = average(items.map((item) => {
    const text = `${item.answer_analysis || ""} ${item.pain_point || ""} ${item.improvement || ""}`;
    let score = 4;
    if (item.answer_relevance?.score <= 5 && /没|漏|缺|没有|不够|跑题|没对上/.test(text)) score += 3;
    if (/指标|个人贡献|代码|实现|数据|工程|行业|时间|超时/.test(text)) score += 2;
    return Math.min(10, score);
  }));
  const trainingGain = computeTrainingGain(items);
  const reviewValue = average(items.map((item) => {
    let score = 3;
    if ((item.improvement || "").length >= 24) score += 3;
    if ((item.sample_answer || "").length >= 80) score += 3;
    if (/代码|指标|数据|失败|部署|成本|行业|结论/.test(`${item.improvement || ""} ${item.sample_answer || ""}`)) score += 1;
    return Math.min(10, score);
  }));

  return { questionRelevance, probeDepth, diagnosisAccuracy, trainingGain, reviewValue };
}

function computeTrainingGain(items) {
  const repeatPairs = [];
  for (let i = 1; i < items.length; i += 1) {
    if (items[i - 1].pressure_decision?.action === "repeat") {
      repeatPairs.push((items[i].averageScore || 0) - (items[i - 1].averageScore || 0));
    }
  }
  if (repeatPairs.length) {
    return Math.max(0, Math.min(10, 5 + Math.round(average(repeatPairs) / 2)));
  }
  if (items.length < 2) return 0;
  const first = items[0].averageScore || 0;
  const last = items[items.length - 1].averageScore || 0;
  return Math.max(0, Math.min(10, 5 + last - first));
}

function renderProductMetrics() {
  const metrics = computeProductMetrics();
  const rows = [
    ["问题相关度", metrics.questionRelevance, "追问是否紧扣项目和上轮回答"],
    ["追问深度", metrics.probeDepth, "是否追到代码、指标、失败和边界"],
    ["诊断准确度", metrics.diagnosisAccuracy, "是否识别跑题、空话和缺证据"],
    ["训练增益", metrics.trainingGain, "重答或后续回答是否变强"],
    ["复盘价值", metrics.reviewValue, "建议能否直接改回答和简历"]
  ];
  return `
    <article>
      <h3>训练有效性</h3>
      <p>这组指标衡量工具本身有没有帮你练到点上，不是候选人能力分。</p>
      <div class="product-metric-grid">
        ${rows.map(([label, value, desc]) => `
          <div>
            <strong>${value}</strong>
            <span>${label}</span>
            <small>${desc}</small>
          </div>
        `).join("")}
      </div>
    </article>
  `;
}

function renderScoreMini(scores) {
  const rows = [
    ["authenticity", "真实性"],
    ["depth", "技术深度"],
    ["metrics", "指标意识"],
    ["engineering", "工程落地"],
    ["industry", "趋势判断"],
    ["time", "表达效率"]
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
  const chain = facts.evidenceChain || { claim: "待补充项目主张", proofItems: [], riskItems: [] };
  const trend = facts.trendCard || { scenario: "真实企业落地场景", timing: "待补充行业发展脉络", enterpriseFocus: [], probe: "这个项目为什么现在值得做？" };
  grid.innerHTML = `
    <article class="wide-card">
      <h3>这张事实卡怎么用</h3>
      <p>事实卡相当于面试官读完项目后的“抓漏洞清单”。它不会给最终分，而是告诉你：你的材料目前更像哪个技术方向、哪些关键词能支撑岗位匹配、哪些关键信息没写清，以及第一轮应该优先被追问什么。</p>
      <p>如果这里显示缺少指标、数据来源、工程落地或行业场景，后面的追问会优先围绕这些缺口展开。</p>
    </article>
    <article class="wide-card">
      <h3>证据链拷问图</h3>
      <div class="evidence-chain">
        <div>
          <span>主张</span>
          <strong>${sanitize(chain.claim)}</strong>
        </div>
        <div>
          <span>需要证据</span>
          <ul>${(chain.proofItems.length ? chain.proofItems : ["个人贡献、实现细节、指标和失败样本"]).map((item) => `<li>${sanitize(item)}</li>`).join("")}</ul>
        </div>
        <div>
          <span>风险点</span>
          <ul>${(chain.riskItems.length ? chain.riskItems : ["当前主张比较完整，后续会继续追边界和反例。"]).map((item) => `<li>${sanitize(item)}</li>`).join("")}</ul>
        </div>
      </div>
    </article>
    <article class="wide-card trend-card">
      <h3>行业趋势追问卡</h3>
      <p><strong>${sanitize(trend.scenario)}</strong>：${sanitize(trend.timing)}</p>
      <ul class="pill-list">
        ${(trend.enterpriseFocus.length ? trend.enterpriseFocus : ["成本", "可靠性", "合规", "部署", "ROI"]).map((item) => `<li>${sanitize(item)}</li>`).join("")}
      </ul>
      <p class="probe-line">${sanitize(trend.probe)}</p>
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
    ["industry", "趋势判断"],
    ["time", "表达效率"]
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

function ensureSubmitErrorBox() {
  let box = $("#submitError");
  if (box) return box;
  box = document.createElement("div");
  box.id = "submitError";
  box.className = "submit-error hidden";
  $("#answerForm").insertBefore(box, $(".answer-actions"));
  return box;
}

function clearSubmitError() {
  const box = ensureSubmitErrorBox();
  box.classList.add("hidden");
  box.innerHTML = "";
}

function showSubmitError(message, retryHandler = null, buttonLabel = "重新提交回答") {
  const box = ensureSubmitErrorBox();
  box.classList.remove("hidden");
  box.innerHTML = `
    <span>${sanitize(message)}</span>
    ${retryHandler ? `<button class="secondary-button" type="button">${sanitize(buttonLabel)}</button>` : ""}
  `;
  const button = box.querySelector("button");
  if (button && retryHandler) button.addEventListener("click", retryHandler);
}

function retrySubmitAnswer() {
  clearSubmitError();
  if ($("#answerForm").requestSubmit) {
    $("#answerForm").requestSubmit();
  } else {
    $("#submitAnswer").click();
  }
}

function setSubmitting(submitting) {
  state.isSubmitting = submitting;
  const button = $("#submitAnswer");
  if (!button.dataset.defaultText) button.dataset.defaultText = button.textContent;
  button.textContent = submitting ? "提交中..." : button.dataset.defaultText;
  button.disabled = submitting || !state.started;
  $("#answerInput").disabled = submitting || !state.started;
}

function lockAnswerUntilRetry() {
  $("#answerInput").disabled = true;
  $("#submitAnswer").disabled = true;
}

async function saveMessage(role, round, content, meta = {}) {
  if (!state.sessionId) return true;
  try {
    await apiRequest(`/api/sessions/${state.sessionId}/message`, {
      method: "POST",
      body: JSON.stringify({ role, round, content, meta })
    });
    return true;
  } catch (error) {
    console.warn("save message failed:", error);
    return false;
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
  if (!state.sessionId) return true;
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
    return true;
  } catch (error) {
    console.warn("save session state failed:", error);
    return false;
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
  target.classList.toggle("time-warning", remaining > 0 && remaining <= 15);
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
  state.intensity = intensity;
  state.interviewerStyle = interviewerStyle;
  state.feedbackItems = [];
  stopTimer();
  state.activeDeadline = null;
  state.scores = { authenticity: 0, depth: 0, metrics: 0, engineering: 0, industry: 0, time: 0 };
  state.latestScores = { authenticity: 0, depth: 0, metrics: 0, engineering: 0, industry: 0, time: 0 };
  state.risks = [];
  state.facts = extractFacts(projectText, track, jdKeywords, focusText);
  state.questions = buildQuestions(track, intensity, state.facts);
  state.sessionId = null;
  state.sessionTitle = "";

  $("#chatLog").innerHTML = "";
  setLockedProjectInputs(true);
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
  if (state.isSubmitting) return;
  syncLiveOptions();

  const answer = $("#answerInput").value.trim();
  if (answer.length < 20) {
    $("#answerInput").focus();
    alert("回答再展开一点，至少写 20 个字。");
    return;
  }

  clearSubmitError();
  setSubmitting(true);
  stopTimer();
  const question = state.questions[state.round];
  const currentQuestionText = questionText(question);
  const timeLimitSeconds = questionTimeLimit(question);
  const elapsedSeconds = state.activeDeadline
    ? Math.max(1, Math.round((Date.now() - (state.activeDeadline - timeLimitSeconds * 1000)) / 1000))
    : 0;
  const timeStats = computeTimeStats(elapsedSeconds, timeLimitSeconds, answer);
  const timeNote = timeEfficiencyNoteFromStats(timeStats);
  if (!state.pendingSubmit || state.pendingSubmit.answer !== answer || state.pendingSubmit.question !== currentQuestionText) {
    addMessage("user", `回答 ${state.round + 1}`, answer);
  }
  state.pendingSubmit = { question: currentQuestionText, answer, timeLimitSeconds, elapsedSeconds, timeStats };
  const savedCandidate = await saveMessage("candidate", state.round + 1, answer, { question: currentQuestionText, timeLimitSeconds, elapsedSeconds, timeStats });
  if (!savedCandidate) {
    setSubmitting(false);
    $("#answerInput").disabled = false;
    $("#answerInput").value = answer;
    $("#answerHint").textContent = "回答保存失败，已保留文本。请检查网络或登录状态后重试。";
    showSubmitError("回答没有保存成功，为避免记录丢失，本轮不会继续。", retrySubmitAnswer);
    return;
  }
  state.answers.push({ question: currentQuestionText, timeLimitSeconds, elapsedSeconds, timeStats, answer });

  const scores = scoreAnswer(answer);
  scores.time = scoreTimeEfficiency(elapsedSeconds, timeLimitSeconds, answer);
  let finalScores = scores;
  let diagnosis = diagnoseAnswer(answer, question);
  const localRelevance = assessAnswerRelevance(answer, currentQuestionText);
  if (localRelevance.score <= 4) diagnosis.unshift(`没有正面回答问题：${localRelevance.evidence}`);
  let structuredFeedback = null;
  let shouldEnd = false;
  let endReason = "";
  let usedLocalFallback = false;
  $("#latestDiagnosis").innerHTML = state.feedbackMode === "realtime"
    ? "<li>正在诊断回答。如果 API 不可用，会自动使用本地规则。</li>"
    : "<li>本轮反馈已记录，将在最终报告中统一展示。</li>";

  try {
    const ai = await requestAgentStep({
      sessionId: state.sessionId,
      facts: state.facts,
      intensity: state.intensity,
      interviewerStyle: state.interviewerStyle,
      question: currentQuestionText,
      timeLimitSeconds,
      elapsedSeconds,
      estimatedSpokenSeconds: timeStats.estimatedSpokenSeconds,
      effectiveSeconds: timeStats.effectiveSeconds,
      overtimeSeconds: timeStats.overtimeSeconds,
      timeEfficiencyRatio: timeStats.ratio,
      timeEfficiencyNote: timeNote,
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
        industry: clampScore(ai.scores.industry, scores.industry),
        time: Math.min(clampScore(ai.scores.time, scores.time), scores.time)
      };
    }
    shouldEnd = Boolean(ai.should_end);
    endReason = ai.end_reason || "";
    if (ai.next_probe) {
      state.questions[state.round + 1] = normalizeQuestion(ai.next_probe);
    }
  } catch (error) {
    console.warn("AI agent fallback:", error);
    usedLocalFallback = true;
  }

  if (!structuredFeedback) structuredFeedback = normalizeFeedback({
    answer_relevance: localRelevance
  }, diagnosis);
  if (usedLocalFallback) {
    structuredFeedback.answer_analysis = `模型诊断暂不可用，已用本地规则给出临时判断。${structuredFeedback.answer_analysis}`;
    diagnosis.unshift("模型接口本轮不可用，系统使用本地规则完成临时诊断。");
  }
  if (structuredFeedback.answer_relevance.verdict.startsWith("未评估")) {
    structuredFeedback.answer_relevance = localRelevance;
  }
  const pressureDecision = buildPressureDecision(structuredFeedback.answer_relevance, finalScores, diagnosis, answer, currentQuestionText);
  state.feedbackItems.push({
    round: state.round + 1,
    question: currentQuestionText,
    answer,
    elapsedSeconds,
    timeLimitSeconds,
    timeStats,
    timeEfficiencyNote: timeNote,
    scores: { ...finalScores },
    averageScore: scoreAverage(finalScores),
    pressure_decision: pressureDecision,
    ...structuredFeedback
  });

  mergeScores(finalScores);
  state.risks.push(...diagnosis.filter((item) => !item.includes("比较扎实")));
  const savedFeedback = await saveMessage("feedback", state.round + 1, structuredFeedback.pain_point, structuredFeedback);
  if (!savedFeedback) {
    setSubmitting(false);
    lockAnswerUntilRetry();
    $("#answerHint").textContent = "诊断已生成，但反馈保存失败。请点击重新保存后继续。";
    showSubmitError("反馈保存失败，本轮没有进入下一题。", async () => {
      clearSubmitError();
      setSubmitting(true);
      const ok = await saveMessage("feedback", state.round + 1, structuredFeedback.pain_point, structuredFeedback);
      setSubmitting(false);
      if (ok) {
        await finalizeSubmittedRound({ ...structuredFeedback, pressure_decision: pressureDecision }, shouldEnd, endReason);
      } else {
        lockAnswerUntilRetry();
        showSubmitError("反馈仍然保存失败，请稍后再试。", async () => {
          clearSubmitError();
          setSubmitting(true);
          const retryOk = await saveMessage("feedback", state.round + 1, structuredFeedback.pain_point, structuredFeedback);
          setSubmitting(false);
          if (retryOk) {
            await finalizeSubmittedRound({ ...structuredFeedback, pressure_decision: pressureDecision }, shouldEnd, endReason);
          } else {
            lockAnswerUntilRetry();
            showSubmitError("反馈仍然保存失败，请稍后再试。", async () => {
              clearSubmitError();
              setSubmitting(true);
              const finalOk = await saveMessage("feedback", state.round + 1, structuredFeedback.pain_point, structuredFeedback);
              setSubmitting(false);
              if (finalOk) {
                await finalizeSubmittedRound({ ...structuredFeedback, pressure_decision: pressureDecision }, shouldEnd, endReason);
              } else {
                lockAnswerUntilRetry();
                showSubmitError("反馈仍然保存失败，请稍后再试。", null);
              }
            }, "重新保存并继续");
          }
        }, "重新保存并继续");
      }
    }, "重新保存并继续");
    renderScores();
    renderReport();
    return;
  }

  if (pressureDecision.action === "repeat") {
    shouldEnd = false;
    state.questions[state.round + 1] = normalizeQuestion({
      question: pressureDecision.nextQuestion,
      time_limit_seconds: pressureDecision.timeLimitSeconds,
      axis: "跑题重答"
    });
  } else if (pressureDecision.action === "narrow" && !state.questions[state.round + 1]) {
    state.questions[state.round + 1] = normalizeQuestion({
      question: pressureDecision.nextQuestion,
      time_limit_seconds: pressureDecision.timeLimitSeconds,
      axis: "证据收窄"
    });
  }
  await finalizeSubmittedRound({ ...structuredFeedback, pressure_decision: pressureDecision }, shouldEnd, endReason);
}

async function finalizeSubmittedRound(structuredFeedback, shouldEnd, endReason) {
  if (state.feedbackMode === "realtime") {
    renderLatestFeedback(structuredFeedback);
  } else {
    $("#latestDiagnosis").innerHTML = "<li>本轮反馈已记录，将在最终报告中统一展示。</li>";
  }
  renderScores();

  state.round += 1;
  $("#roundCounter").textContent = `${state.round}`;
  renderReport();
  const savedState = await saveSessionState("active");
  if (!savedState) {
    setSubmitting(false);
    lockAnswerUntilRetry();
    $("#answerHint").textContent = "本轮状态保存失败，已保留你的回答。请重新保存后继续。";
    showSubmitError("会话状态保存失败，本轮没有进入下一题。", async () => {
      clearSubmitError();
      setSubmitting(true);
      const ok = await saveSessionState("active");
      setSubmitting(false);
      if (ok) {
        state.pendingSubmit = null;
        continueAfterSuccessfulSubmit(shouldEnd, endReason);
      } else {
        lockAnswerUntilRetry();
        showSubmitError("会话状态仍然保存失败，请稍后再试。", async () => {
          clearSubmitError();
          setSubmitting(true);
          const retryOk = await saveSessionState("active");
          setSubmitting(false);
          if (retryOk) {
            state.pendingSubmit = null;
            continueAfterSuccessfulSubmit(shouldEnd, endReason);
          } else {
            lockAnswerUntilRetry();
            showSubmitError("会话状态仍然保存失败，请稍后再试。", async () => {
              clearSubmitError();
              setSubmitting(true);
              const finalOk = await saveSessionState("active");
              setSubmitting(false);
              if (finalOk) {
                state.pendingSubmit = null;
                continueAfterSuccessfulSubmit(shouldEnd, endReason);
              } else {
                lockAnswerUntilRetry();
                showSubmitError("会话状态仍然保存失败，请稍后再试。", null);
              }
            }, "重新保存并继续");
          }
        }, "重新保存并继续");
      }
    }, "重新保存并继续");
    renderReport();
    return;
  }
  state.pendingSubmit = null;
  setSubmitting(false);
  continueAfterSuccessfulSubmit(shouldEnd, endReason);
}

function continueAfterSuccessfulSubmit(shouldEnd, endReason) {
  if (shouldEnd) {
    finishSession(endReason);
  } else if (state.round >= state.maxSafetyRounds) {
    finishSession("已达到 10 轮安全上限，系统主动收束。");
  } else {
    if (!state.questions[state.round]) {
      const fallback = buildQuestions($("#track").value, state.intensity, state.facts)[state.round] || commonQuestions[3];
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
    industry: "补齐行业判断：真实业务场景、企业落地约束、技术趋势和未来变化下的取舍。",
    time: "练习表达效率：先给结论，再给两三个关键证据，避免铺垫过长或超时。"
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
    ${renderProductMetrics()}
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
          ${renderTimeSummary(item)}
          <p><strong>是否答到问题：</strong>${sanitize(item.answer_relevance?.verdict || "未评估")}${item.answer_relevance?.evidence ? `：${sanitize(item.answer_relevance.evidence)}` : ""}</p>
          <p><strong>压力阶梯：</strong>${sanitize(item.pressure_decision?.label || "正常追问")}${item.pressure_decision?.reason ? `：${sanitize(item.pressure_decision.reason)}` : ""}</p>
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

function renderTimeSummary(item) {
  const timeStats = normalizeTimeStats(item);
  const overtime = timeStats.overtimeSeconds
    ? `，超时 ${formatDuration(timeStats.overtimeSeconds)}`
    : "，未超时";
  return `
    <p><strong>答题时长：</strong>实际 ${formatDuration(timeStats.actualSeconds)} / 估算口述 ${formatDuration(timeStats.estimatedSpokenSeconds)} / 建议 ${formatDuration(timeStats.limitSeconds)}${overtime}。</p>
    <p><strong>表达效率：</strong>${sanitize(item.timeEfficiencyNote || timeEfficiencyNoteFromStats(timeStats))}</p>
  `;
}

async function enrichFinalReport(reason = "") {
  syncLiveOptions();
  let reportExtra = { endReason: reason };
  try {
    const ai = await requestAI("report", {
      sessionId: state.sessionId,
      facts: state.facts,
      interviewerStyle: state.interviewerStyle,
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
  setLockedProjectInputs(false);
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
  state.scores = { authenticity: 0, depth: 0, metrics: 0, engineering: 0, industry: 0, time: 0 };
  state.latestScores = { authenticity: 0, depth: 0, metrics: 0, engineering: 0, industry: 0, time: 0 };

  $("#sessionStatus").textContent = "待开始";
  setLockedProjectInputs(false);
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
    state.scores = { authenticity: 0, depth: 0, metrics: 0, engineering: 0, industry: 0, time: 0, ...(item.scores || {}) };
    state.latestScores = state.feedbackItems.length
      ? { ...state.scores }
      : { authenticity: 0, depth: 0, metrics: 0, engineering: 0, industry: 0, time: 0 };
    state.risks = item.risks || [];
    state.feedbackItems = item.report?.feedbackItems || [];
    state.answers = item.report?.answers || [];
    state.questions = item.report?.questions || [];
    state.round = item.report?.round || state.answers.length;
    $("#track").value = item.track || "general";
    $("#intensity").value = item.intensity || "normal";
    $("#interviewerStyle").value = "mixed";
    $("#feedbackMode").value = item.feedbackMode || "realtime";
    syncLiveOptions();
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
    setLockedProjectInputs(false);
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
$("#refreshHistory").addEventListener("click", (event) => {
  event.stopPropagation();
  loadHistory();
});
$("#loginButton").addEventListener("click", () => handleAuth("login").catch((error) => alert(error.message)));
$("#registerButton").addEventListener("click", () => handleAuth("register").catch((error) => alert(error.message)));
$("#logoutButton").addEventListener("click", logout);
$("#answerForm").addEventListener("submit", submitAnswer);
$("#intensity").addEventListener("change", syncLiveOptions);
$("#interviewerStyle").addEventListener("change", syncLiveOptions);
$("#feedbackMode").addEventListener("change", syncLiveOptions);
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
