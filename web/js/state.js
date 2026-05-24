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
