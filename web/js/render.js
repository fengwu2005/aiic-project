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

function showRetryableSubmitError(message, retryLabel, action, exhaustedMessage = message, attemptsLeft = 3) {
  lockAnswerUntilRetry();
  showSubmitError(message, async () => {
    clearSubmitError();
    setSubmitting(true);
    const ok = await action();
    setSubmitting(false);
    if (ok) return;
    if (attemptsLeft <= 1) {
      lockAnswerUntilRetry();
      showSubmitError(exhaustedMessage, null);
      return;
    }
    showRetryableSubmitError(exhaustedMessage, retryLabel, action, exhaustedMessage, attemptsLeft - 1);
  }, retryLabel);
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
