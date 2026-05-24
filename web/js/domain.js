function sanitize(text) {
  return String(text ?? "").replace(/[<>&]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[char]));
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
