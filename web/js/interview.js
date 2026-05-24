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
    $("#answerHint").textContent = "诊断已生成，但反馈保存失败。请点击重新保存后继续。";
    showRetryableSubmitError(
      "反馈保存失败，本轮没有进入下一题。",
      "重新保存并继续",
      async () => {
        const ok = await saveMessage("feedback", state.round + 1, structuredFeedback.pain_point, structuredFeedback);
        if (ok) await finalizeSubmittedRound({ ...structuredFeedback, pressure_decision: pressureDecision }, shouldEnd, endReason);
        return ok;
      },
      "反馈仍然保存失败，请稍后再试。"
    );
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
    $("#answerHint").textContent = "本轮状态保存失败，已保留你的回答。请重新保存后继续。";
    showRetryableSubmitError(
      "会话状态保存失败，本轮没有进入下一题。",
      "重新保存并继续",
      async () => {
        const ok = await saveSessionState("active");
        if (ok) {
          state.pendingSubmit = null;
          continueAfterSuccessfulSubmit(shouldEnd, endReason);
        }
        return ok;
      },
      "会话状态仍然保存失败，请稍后再试。"
    );
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
    state.risks = item.risks || [];
    state.feedbackItems = item.report?.feedbackItems || [];
    state.answers = item.report?.answers || [];
    state.questions = item.report?.questions || [];
    state.scores = { authenticity: 0, depth: 0, metrics: 0, engineering: 0, industry: 0, time: 0, ...(item.scores || {}) };
    state.latestScores = state.feedbackItems.length
      ? { authenticity: 0, depth: 0, metrics: 0, engineering: 0, industry: 0, time: 0, ...(state.feedbackItems[state.feedbackItems.length - 1].scores || {}) }
      : { authenticity: 0, depth: 0, metrics: 0, engineering: 0, industry: 0, time: 0 };
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

