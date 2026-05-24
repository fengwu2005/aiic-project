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

function clampScore(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(10, Math.round(number)));
}
