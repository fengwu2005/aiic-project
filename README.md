# 项目拷问官

面向技术岗项目深挖的 AI 训练器。它不做通用面试陪聊，而是围绕用户自己的简历项目，一轮一轮追问真实性、代码实现、方法选择、指标评估、工程落地、行业趋势和失败反思。

## 核心定位

项目拷问官解决一个窄问题：

> 技术岗同学的简历项目，能不能扛住真实面试官连续深挖？

它的差异点不是“也能问面试题”，而是：

- 先读项目材料，生成项目事实卡
- 根据缺失点和回答内容动态追问
- 每次只问一个问题，保持真实对话节奏
- 语气模仿真人技术面试官，不一次抛出一串问题
- 支持实时反馈和结束后总体反馈两种模式
- 每题由模型根据复杂度设置建议回答时长
- 按专业 rubric 评分，而不是只看表达流畅
- 输出最危险追问点和下一轮训练重点

## 项目结构

```text
project-interrogator/
  web/
    index.html                # 前端页面，由 server.py 统一托管
    styles.css                # UI 样式
    app.js                    # 一问一答训练逻辑、本地兜底规则
  server.py                   # 唯一启动入口，静态资源服务 + 阿里 API 代理
  config.yaml                 # API key、模型、端口等配置
  skills/
    core/                     # 通用原则、追问轴、评分 rubric
    tracks/                   # 不同技术方向能力
    agent/                    # 面试 agent 决策策略
  examples/
    *.md                      # 多技术方向测试案例
```

## 启动方式

只保留一种启动方式：

```bash
cd /root/aiic/project-interrogator
python3 server.py
```

然后访问：

```text
http://服务器IP:8000
```

本项目不再推荐直接打开 `index.html` 或使用 `python3 -m http.server`，因为正式版本需要后端代理调用模型，避免 API key 暴露在浏览器里。

## 配置 API

编辑 [config.yaml](config.yaml)：

```yaml
server:
  host: 0.0.0.0
  port: 8000

dashscope:
  api_key: "你的阿里百炼 DashScope API Key"
  model: "qwen-plus"
  url: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
  temperature: 0.35
  timeout_seconds: 45
```

也可以用环境变量临时覆盖配置：

```bash
export DASHSCOPE_API_KEY="你的 API Key"
export DASHSCOPE_MODEL="qwen-plus"
export PORT=8000
python3 server.py
```

环境变量优先级高于 `config.yaml`。

## 训练流程

1. 用户填写技术方向、面试强度、岗位关键词和项目描述。
2. 系统生成项目事实卡，识别贡献边界、指标、数据、工程落地和行业场景缺口。
3. 模型生成首轮追问和候选计划，每个问题包含建议回答时长。
4. 前端一次只展示一个问题，并启动建议时长倒计时。
5. 用户提交回答后，模型生成结构化反馈：问题分析、回答分析、痛点、改进建议、示例回答。
6. 如果选择实时反馈，逐轮展示；如果选择结束后反馈，最终统一展示。
7. 模型作为 agent 判断下一步：继续追问、换方向、加压、收束或结束。
8. 如果继续，模型返回下一问、时长、考察轴和压力级别。
9. 如果结束，前端生成抗拷问报告。

## 事实卡和报告

**事实卡** 是面试官读简历时的结构化草稿。它不负责打最终分，而是拆出项目里的关键信息和缺口，例如：个人贡献、技术路线、数据来源、指标评估、工程落地、行业场景。后续追问会根据这些缺口动态选择方向。

**报告** 是训练结束后的复盘。它会汇总每轮问题分析、回答分析、痛点、改进建议和示例回答，并指出这个项目最容易被问穿的地方。

## 评分维度

- 真实性：是否证明自己亲手做过，有明确个人贡献和实现证据
- 技术深度：是否讲清技术选择、替代方案、取舍、边界和失败原因
- 指标意识：是否讲清指标、采集方式、实验/线上评估和失败样本分析
- 工程落地：是否讲清部署、性能、稳定性、异常、监控、成本和回退
- 趋势判断：是否理解行业/企业场景、技术发展脉络、落地约束和趋势变化

## 专业技能包

`skills/` 是项目的核心专业资产，按能力拆成多个文件：

- [skills/core/global_principles.json](skills/core/global_principles.json)：全局原则和项目事实卡
- [skills/core/question_axes.json](skills/core/question_axes.json)：追问轴和问题生成规则
- [skills/core/scoring_rubric.json](skills/core/scoring_rubric.json)：评分标准和输出要求
- [skills/tracks/track_skills.json](skills/tracks/track_skills.json)：不同技术方向的深挖策略
- [skills/agent/interview_agent_policy.json](skills/agent/interview_agent_policy.json)：面试 agent 的决策策略

这些 skill 共同定义：

- 项目事实卡字段
- 追问轴
- 各技术方向深挖策略
- 问题生成原则
- 评分 rubric
- 报告输出要求

每次调用模型生成问题、决定下一步、诊断回答、生成报告时，后端都会递归加载这些 skill 并传给模型。

## 测试案例

[examples](examples/README.md) 目录提供多组案例，覆盖：

- 软件工程 / 代码项目
- AI / 智能系统
- 后端 / 工程系统
- 算法 / 机器学习
- 数据 / 数据平台
- 前端 / 客户端
- 基础设施 / DevOps

每个案例都包含项目描述、岗位关键词、重点追问方向、弱回答和强回答，适合测试追问和评分是否能拉开差距。
