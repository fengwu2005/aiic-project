const state = {
  started: false,
  round: 0,
  maxRounds: 6,
  questions: [],
  answers: [],
  facts: null,
  scores: {
    authenticity: 0,
    depth: 0,
    metrics: 0,
    engineering: 0
  },
  risks: []
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const trackProfiles = {
  llm: {
    label: "大模型应用",
    keyTerms: ["rag", "agent", "llm", "大模型", "检索", "向量", "embedding", "rerank", "幻觉", "prompt", "工具调用"],
    questions: [
      "你为什么需要引入 RAG 或 Agent？如果只用普通检索加生成，哪里不够？",
      "你怎么评估检索质量和最终答案质量？请分别说出离线指标和线上观测指标。",
      "如果检索到了相关文档但答案仍然错，你会怎么定位是 chunk、召回、重排还是生成的问题？",
      "请写出 query 到 answer 的核心伪代码，包括检索、重排、生成、引用校验和失败回退。",
      "这个系统的延迟、token 成本和幻觉风险怎么控制？如果用户连续追问导致上下文漂移怎么办？"
    ]
  },
  backend: {
    label: "后端工程",
    keyTerms: ["接口", "缓存", "数据库", "并发", "队列", "限流", "事务", "索引", "服务", "监控"],
    questions: [
      "这个项目的核心链路是什么？如果流量突然放大 10 倍，瓶颈最可能出现在哪里？",
      "你为什么这样设计数据库表或接口边界？有没有考虑过替代方案？",
      "请说明一致性、幂等、异常重试和回滚是怎么处理的。",
      "请写出核心请求链路的伪代码，包含参数校验、业务逻辑、存储和异常处理。",
      "你怎么衡量这个系统做得好？除了功能可用，还有哪些稳定性和性能指标？"
    ]
  },
  algorithm: {
    label: "算法机器学习",
    keyTerms: ["模型", "特征", "训练", "损失", "准确率", "召回", "auc", "数据集", "实验", "消融"],
    questions: [
      "你为什么选择这个模型或方法？和更简单的 baseline 相比收益在哪里？",
      "训练数据怎么来，标签是否可靠，数据泄漏和分布偏移怎么处理？",
      "你怎么设计损失函数和评价指标？业务目标和离线指标有没有不一致？",
      "请写出训练或推理的核心伪代码，说明数据流、模型调用和后处理。",
      "你做过哪些消融实验？如果效果不涨，你会按什么顺序排查？"
    ]
  },
  data: {
    label: "数据平台",
    keyTerms: ["etl", "数仓", "指标", "数据质量", "调度", "血缘", "实时", "离线", "看板", "口径"],
    questions: [
      "这个项目解决的是数据生产、数据治理还是数据消费问题？核心用户是谁？",
      "指标口径怎么定义和保证一致？如果上下游口径冲突怎么办？",
      "数据质量怎么监控？延迟、重复、缺失、异常值分别怎么发现？",
      "请写出核心 ETL 或指标计算伪代码，说明输入、转换、输出和校验。",
      "如果任务失败或数据延迟，你的告警、补数和降级方案是什么？"
    ]
  },
  frontend: {
    label: "前端客户端",
    keyTerms: ["组件", "状态", "性能", "渲染", "缓存", "交互", "可访问", "首屏", "埋点", "错误"],
    questions: [
      "这个项目里最复杂的前端状态或交互是什么？你为什么这样拆组件？",
      "性能瓶颈在哪里？首屏、渲染、请求和资源加载分别怎么优化？",
      "异常状态、空状态、权限状态和弱网场景怎么处理？",
      "请写出核心交互或状态流转的伪代码，说明事件、状态更新和副作用。",
      "你怎么衡量前端体验做得好？有哪些埋点或可观测指标？"
    ]
  }
};

const commonQuestions = [
  "请用 90 秒讲清楚这个项目：背景、你的角色、核心方案、结果。不要复述简历。",
  "这个项目里哪一块最能证明是你亲手做的？请讲到实现粒度。",
  "如果让你现在重做一版，你会删掉什么、保留什么、改掉什么？为什么？",
  "项目里最失败或最不确定的地方是什么？你当时怎么判断和补救？",
  "如果面试官质疑这个项目只是调包，你会拿出哪三个证据反驳？"
];

const sampleProject = `基于 RAG 的课程资料问答系统。用户上传课程 PDF 后，系统将文档切分为 chunk，使用 embedding 写入向量数据库。学生提问时先检索相关片段，再调用大模型生成答案，并返回引用来源。我负责后端接口、检索链路、prompt 设计和基础评测。技术栈包括 Python、FastAPI、LangChain、向量数据库和大模型 API。当前在 50 份课程资料上做了测试，主观观察回答准确率有提升，但还没有系统化评估。`;

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

  const riskPoints = [];
  if (!hasRole) riskPoints.push("个人贡献边界不清，容易被问“这部分到底是不是你做的”。");
  if (!hasMetric) riskPoints.push("缺少量化指标，容易被追问“怎么证明方案变好了”。");
  if (!hasData) riskPoints.push("数据来源和质量没有讲清，容易被追问数据可信度。");
  if (!hasDeployment) riskPoints.push("工程落地信息不足，容易被追问上线、稳定性和成本。");
  if (matchedTerms.length === 0) riskPoints.push("技术关键词较少，面试官可能认为项目深度不足。");

  return {
    profile,
    matchedTerms,
    jdTerms,
    focusTerms,
    checks: { hasMetric, hasRole, hasData, hasDeployment },
    riskPoints
  };
}

function buildQuestions(track, intensity, facts) {
  const profile = trackProfiles[track];
  const selected = [commonQuestions[0]];

  if (facts.riskPoints.some((point) => point.includes("贡献"))) selected.push(commonQuestions[1]);
  if (!facts.checks.hasMetric) selected.push("你现在没有写清指标。请补充：你会用哪些指标证明这个项目有效？这些指标怎么采集？");
  if (!facts.checks.hasDeployment) selected.push("如果这个项目要给真实用户使用，部署、监控、失败回退和成本控制分别怎么做？");

  selected.push(...profile.questions);

  if (facts.jdTerms.length) {
    selected.push(`结合你写的岗位关键词「${facts.jdTerms.slice(0, 4).join("、")}」，这个项目最能对齐哪一项能力？证据是什么？`);
  }

  if (facts.focusTerms.length) {
    selected.push(`你说最想被追问「${facts.focusTerms.slice(0, 3).join("、")}」。请选一个点讲到可以现场实现的粒度。`);
  }

  selected.push(commonQuestions[2], commonQuestions[3], commonQuestions[4]);

  const unique = [...new Set(selected)];
  if (intensity === "pressure") {
    unique.splice(1, 0, "我先质疑一下：这个项目听起来像把现成框架串起来。你怎么证明里面有你的技术判断？");
  }
  if (intensity === "senior") {
    unique.splice(2, 0, "请讲一个你做过的关键 trade-off：你牺牲了什么，换来了什么？");
  }
  return unique.slice(0, state.maxRounds + 3);
}

function scoreAnswer(answer) {
  const lower = answer.toLowerCase();
  const lengthScore = Math.min(3, Math.floor(answer.length / 90));
  const concrete = /(我负责|我实现|我设计|具体|例如|当时|线上|实验|日志|代码|接口|表|模块)/.test(answer) ? 2 : 0;
  const metrics = /%|准确|召回|延迟|成本|qps|auc|f1|指标|评估|ab|a\/b|loss|损失|成功率|错误率|耗时|吞吐/.test(lower) ? 3 : 0;
  const engineering = /(部署|监控|告警|回滚|缓存|并发|异常|重试|降级|限流|成本|稳定|日志|链路|接口)/.test(answer) ? 3 : 0;
  const depth = /(为什么|取舍|trade|替代|baseline|消融|复杂度|瓶颈|边界|失败|风险|伪代码|流程)/i.test(answer) ? 3 : 0;

  return {
    authenticity: Math.min(10, lengthScore + concrete + (answer.includes("我") ? 2 : 0)),
    depth: Math.min(10, lengthScore + depth + concrete),
    metrics: Math.min(10, lengthScore + metrics),
    engineering: Math.min(10, lengthScore + engineering)
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

  if (notes.length === 0) {
    notes.push("这一轮回答比较扎实。下一步可以继续补充更具体的数据、代码边界和失败案例。");
  }

  return notes.slice(0, 4);
}

function mergeScores(next) {
  const count = state.answers.length;
  Object.keys(state.scores).forEach((key) => {
    state.scores[key] = Math.round(((state.scores[key] * (count - 1)) + next[key]) / count);
  });
}

function renderFacts() {
  const facts = state.facts;
  const grid = $("#factGrid");
  if (!facts) return;

  const riskClass = facts.riskPoints.length >= 3 ? "danger" : facts.riskPoints.length ? "warning" : "";
  grid.innerHTML = `
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
      </ul>
    </article>
    <article class="${riskClass}">
      <h3>初始风险点</h3>
      <ul>
        ${(facts.riskPoints.length ? facts.riskPoints : ["项目材料基础完整，可以进入深挖。"]).map((item) => `<li>${sanitize(item)}</li>`).join("")}
      </ul>
    </article>
  `;
}

function renderScores() {
  const rows = [
    ["authenticity", "真实性"],
    ["depth", "技术深度"],
    ["metrics", "指标意识"],
    ["engineering", "工程落地"]
  ];
  $("#scoreStack").innerHTML = rows.map(([key, label]) => `
    <div class="score-row">
      <span>${label}</span>
      <meter min="0" max="10" value="${state.scores[key]}"></meter>
      <strong>${state.scores[key]}</strong>
    </div>
  `).join("");

  const average = Math.round(Object.values(state.scores).reduce((sum, item) => sum + item, 0) / 4);
  const badge = $("#riskBadge");
  if (!state.answers.length) {
    badge.textContent = "未评估";
    badge.style.background = "var(--amber-2)";
    badge.style.color = "var(--amber)";
  } else if (average >= 7) {
    badge.textContent = "较能抗问";
    badge.style.background = "var(--green-2)";
    badge.style.color = "var(--green)";
  } else if (average >= 4) {
    badge.textContent = "存在漏洞";
    badge.style.background = "var(--amber-2)";
    badge.style.color = "var(--amber)";
  } else {
    badge.textContent = "高风险";
    badge.style.background = "var(--red-2)";
    badge.style.color = "var(--red)";
  }
}

function renderQueue() {
  const current = state.questions.slice(state.round, state.round + 4);
  $("#questionQueue").innerHTML = current.length
    ? current.map((item) => `<li>${sanitize(item)}</li>`).join("")
    : "<li>本轮训练问题已结束，可以查看报告。</li>";
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
}

function askNextQuestion() {
  if (state.round >= state.maxRounds || state.round >= state.questions.length) {
    finishSession();
    return;
  }
  const question = state.questions[state.round];
  addMessage("system", `第 ${state.round + 1} 轮追问`, question);
  $("#roundCounter").textContent = `${state.round + 1} / ${state.maxRounds}`;
  $("#answerInput").value = "";
  $("#answerInput").disabled = false;
  $("#submitAnswer").disabled = false;
  $("#answerInput").focus();
  renderQueue();
}

function startSession() {
  const track = $("#track").value;
  const intensity = $("#intensity").value;
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
  state.scores = { authenticity: 0, depth: 0, metrics: 0, engineering: 0 };
  state.risks = [];
  state.facts = extractFacts(projectText, track, jdKeywords, focusText);
  state.questions = buildQuestions(track, intensity, state.facts);

  $("#chatLog").innerHTML = "";
  $("#sessionStatus").textContent = "训练中";
  $("#latestDiagnosis").innerHTML = "<li>先完成第一轮回答。</li>";
  renderFacts();
  renderScores();
  renderQueue();
  switchTab("interview");
  askNextQuestion();
}

function submitAnswer(event) {
  event.preventDefault();
  if (!state.started) return;

  const answer = $("#answerInput").value.trim();
  if (answer.length < 20) {
    $("#answerInput").focus();
    alert("回答再展开一点，至少写 20 个字。");
    return;
  }

  const question = state.questions[state.round];
  addMessage("user", `回答 ${state.round + 1}`, answer);
  state.answers.push({ question, answer });

  const scores = scoreAnswer(answer);
  mergeScores(scores);
  const diagnosis = diagnoseAnswer(answer, question);
  state.risks.push(...diagnosis.filter((item) => !item.includes("比较扎实")));

  $("#latestDiagnosis").innerHTML = diagnosis.map((item) => `<li>${sanitize(item)}</li>`).join("");
  renderScores();

  state.round += 1;
  $("#roundCounter").textContent = `${state.round} / ${state.maxRounds}`;
  renderReport();

  if (state.round >= state.maxRounds) {
    finishSession();
  } else {
    setTimeout(askNextQuestion, 280);
  }
}

function renderReport() {
  const report = $("#reportPanel");
  if (!state.answers.length) {
    report.innerHTML = `
      <article>
        <h3>抗拷问报告</h3>
        <p>完成至少 3 轮回答后，会生成薄弱点、危险追问和下一轮训练建议。</p>
      </article>
    `;
    return;
  }

  const average = Math.round(Object.values(state.scores).reduce((sum, item) => sum + item, 0) / 4);
  const uniqueRisks = [...new Set([...state.facts.riskPoints, ...state.risks])].slice(0, 6);
  const weakest = Object.entries(state.scores).sort((a, b) => a[1] - b[1])[0][0];
  const adviceMap = {
    authenticity: "补齐个人贡献边界：你亲手实现了什么、改了哪些关键代码、遇到什么具体问题。",
    depth: "补齐技术取舍：为什么不用更简单的方案，替代方案的成本和收益是什么。",
    metrics: "补齐评估指标：离线指标、线上指标、采集方式、失败样本分析。",
    engineering: "补齐工程闭环：部署、监控、异常、回滚、成本和性能瓶颈。"
  };

  report.innerHTML = `
    <article>
      <h3>总览</h3>
      <div class="metric-grid">
        <div class="metric"><strong>${average}</strong><span>抗拷问总分</span></div>
        <div class="metric"><strong>${state.answers.length}</strong><span>已完成轮次</span></div>
        <div class="metric"><strong>${uniqueRisks.length}</strong><span>危险点</span></div>
        <div class="metric"><strong>${state.questions.length}</strong><span>题库追问</span></div>
      </div>
    </article>
    <article>
      <h3>最危险的追问点</h3>
      <ul>
        ${uniqueRisks.length ? uniqueRisks.map((item) => `<li>${sanitize(item)}</li>`).join("") : "<li>暂未发现明显高风险点，继续补充细节和指标。</li>"}
      </ul>
    </article>
    <article>
      <h3>下一轮训练重点</h3>
      <ul>
        <li>${adviceMap[weakest]}</li>
        <li>准备一段 90 秒项目介绍：背景、角色、技术路线、结果和反思。</li>
        <li>准备一个核心模块伪代码，证明不是只会调用框架。</li>
      </ul>
    </article>
    <article>
      <h3>更强项目表达模板</h3>
      <p>我在这个项目里负责「具体模块」，为了解决「明确问题」，选择「技术方案」而不是「替代方案」，原因是「取舍」。我用「指标」验证效果，同时处理了「工程风险」。如果重做，我会优先改「最薄弱环节」。</p>
    </article>
  `;
}

function finishSession() {
  $("#sessionStatus").textContent = "已生成报告";
  $("#roundCounter").textContent = `${Math.min(state.round, state.maxRounds)} / ${state.maxRounds}`;
  $("#answerInput").disabled = true;
  $("#submitAnswer").disabled = true;
  $("#answerHint").textContent = "训练结束，查看报告继续补漏洞。";
  renderQueue();
  renderReport();
  if (!$("#chatLog").dataset.finished) {
    addMessage("system", "训练结束", "这一轮项目拷问结束。现在去报告页看最危险的追问点和下一轮训练重点。");
    $("#chatLog").dataset.finished = "true";
  }
}

function resetSession() {
  state.started = false;
  state.round = 0;
  state.questions = [];
  state.answers = [];
  state.facts = null;
  state.risks = [];
  state.scores = { authenticity: 0, depth: 0, metrics: 0, engineering: 0 };

  $("#sessionStatus").textContent = "待开始";
  $("#roundCounter").textContent = "0 / 6";
  $("#chatLog").innerHTML = `
    <div class="empty-state">
      <h2>把项目交给它，然后准备被追问。</h2>
      <p>它会围绕真实性、方法选择、指标、工程落地、伪代码和前沿理解连续发问。</p>
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
  $("#questionQueue").innerHTML = "<li>等待生成。</li>";
  $("#answerInput").value = "";
  $("#answerInput").disabled = true;
  $("#submitAnswer").disabled = true;
  $("#answerHint").textContent = "回答越具体，诊断越准。";
  renderScores();
  renderReport();
  switchTab("interview");
}

function switchTab(tabName) {
  $$(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === tabName));
  $$(".tab-view").forEach((view) => view.classList.remove("active"));
  $(`#${tabName}View`).classList.add("active");
}

$("#startSession").addEventListener("click", startSession);
$("#resetSession").addEventListener("click", resetSession);
$("#answerForm").addEventListener("submit", submitAnswer);
$("#loadSample").addEventListener("click", () => {
  $("#track").value = "llm";
  $("#intensity").value = "senior";
  $("#jdKeywords").value = "RAG、检索、服务稳定性、Python、评测";
  $("#focusText").value = "指标设计、伪代码、工程落地";
  $("#projectText").value = sampleProject;
});

$$(".tab").forEach((tab) => {
  tab.addEventListener("click", () => switchTab(tab.dataset.tab));
});

renderScores();
