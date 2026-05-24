import json

from .config import MAX_SAFETY_ROUNDS, PROMPTS_ROOT, SKILLS_ROOT


INTERVIEWER_STYLES = {
    "professional": {
        "name": "专业型",
        "behavior": "追实现、证据、指标和取舍；语气克制但要求明确。",
        "language": "可以使用必要技术词，但每个问题都要可回答。",
    },
    "pressure": {
        "name": "压力型",
        "behavior": "敢于质疑真实性和方案漏洞；直接指出不合理假设。",
        "language": "语气更尖锐，但不做人身攻击。",
    },
    "friendly": {
        "name": "随和型",
        "behavior": "语气温和，先帮候选人澄清，再追关键证据。",
        "language": "少用压迫感表达，但仍然指出问题。",
    },
    "business": {
        "name": "业务落地型",
        "behavior": "追业务价值、用户场景、企业约束、成本和趋势。",
        "language": "少堆技术术语，多问真实落地和取舍。",
    },
    "fundamental": {
        "name": "基础盘型",
        "behavior": "少术语，追用户是否真的理解项目基本链路和自己的贡献。",
        "language": "用普通技术面试官能听懂的话问，不炫技。",
    },
    "mixed": {
        "name": "混合型",
        "behavior": "根据轮次和回答质量动态切换专业、压力、随和、业务落地视角。",
        "language": "自然变化，不要每轮都一个腔调。",
    },
}


INTENSITY_POLICIES = {
    "normal": {
        "name": "普通技术面",
        "pressure": "低",
        "question_style": "先澄清事实，再追一个关键细节；语气平稳，允许候选人补充。",
        "challenge_level": "少用质疑句，重点确认项目主线、个人职责和基本技术判断。",
        "scoring": "回答有基本事实和合理解释即可给中等分；不要过度苛刻。",
        "end_bias": "覆盖主要风险后及时收束。",
    },
    "senior": {
        "name": "深挖技术面",
        "pressure": "中",
        "question_style": "围绕上一轮回答追证据、取舍、边界、指标和工程落地。",
        "challenge_level": "要求候选人解释为什么这样做、替代方案是什么、失败时怎么兜底。",
        "scoring": "缺少具体实现、指标或失败案例要明显扣分。",
        "end_bias": "核心链路、指标、工程风险至少覆盖两类后再收束。",
    },
    "pressure": {
        "name": "压力拷问",
        "pressure": "高",
        "question_style": "直接指出疑点，要求候选人给可验证证据；可以使用“我不接受这个泛泛说法”“这听起来像包装”这类表达。",
        "challenge_level": "优先质疑真实性、个人贡献边界、是否只是调包、数据是否可靠、指标是否自洽、异常场景是否真的做过。",
        "scoring": "没有证据、跑题、概念化回答要低分；表达完整但没有真实证据也不能高分。",
        "end_bias": "连续两轮无法给证据时可以提前结束并指出项目需要重做材料。",
    },
}


def load_system_prompt():
    return (PROMPTS_ROOT / "system.md").read_text(encoding="utf-8").strip()


SYSTEM_PROMPT = load_system_prompt()


def load_task_instruction(task):
    return (PROMPTS_ROOT / f"{task}.md").read_text(encoding="utf-8").strip()


def load_skills():
    skills = {}
    for path in sorted(SKILLS_ROOT.rglob("*.json")):
        rel = str(path.relative_to(SKILLS_ROOT))
        skills[rel] = json.loads(path.read_text(encoding="utf-8"))
    return skills


def interviewer_style(context):
    style_key = str(context.get("interviewerStyle") or "mixed")
    return INTERVIEWER_STYLES.get(style_key, INTERVIEWER_STYLES["mixed"])


def intensity_policy(context):
    intensity = str(context.get("intensity") or "normal")
    return INTENSITY_POLICIES.get(intensity, INTENSITY_POLICIES["normal"])


def build_prompt(payload):
    task = payload.get("task")
    context = payload.get("context", {})
    skills = load_skills()
    style = interviewer_style(context)
    intensity = intensity_policy(context)

    if task == "questions":
        return {
            "instruction": load_task_instruction("questions"),
            "interviewer_style": style,
            "intensity_policy": intensity,
            "interviewer_skills": skills,
            "time_limit_policy": {
                "45-75": "事实确认、角色边界、简单澄清",
                "90-120": "项目介绍、方法选择、行业趋势、失败反思",
                "150-180": "指标评估、系统链路、工程落地、复杂取舍",
                "180-240": "伪代码、架构推演、复杂故障定位",
            },
            "schema": {
                "first_question": {
                    "question": "第一个自然追问",
                    "time_limit_seconds": 90,
                    "axis": "主要考察轴",
                },
                "questions": [
                    {
                        "question": "后续可能追问",
                        "time_limit_seconds": 90,
                        "axis": "主要考察轴",
                    }
                ],
            },
            "context": context,
        }

    if task == "agent_step":
        return {
            "instruction": load_task_instruction("agent_step"),
            "interviewer_style": style,
            "intensity_policy": intensity,
            "interviewer_skills": skills,
            "max_safety_rounds": MAX_SAFETY_ROUNDS,
            "scoring_policy": {
                "time_efficiency": "回答时长要纳入评分。前端会提供实际耗时 elapsedSeconds、按文本长度估算的口述耗时 estimatedSpokenSeconds、最终判定耗时 effectiveSeconds 和超时 overtimeSeconds。表达效率按 effectiveSeconds 判断；文本很长但提交很快不能高分。明显超时、拖沓或长时间没有结论，应降低表达效率分，并在反馈中指出超时多少。",
                "relevance_gate": "如果回答没有对应本轮问题，各项分数必须压低；不要因专业词汇多而高分。",
            },
            "schema": {
                "should_end": False,
                "end_reason": "如果结束，说明原因；否则为空",
                "next_probe": {
                    "question": "继续追问时的问题",
                    "time_limit_seconds": 120,
                    "axis": "主要考察轴",
                    "pressure_level": "normal/senior/pressure",
                },
                "diagnosis": ["本轮具体诊断"],
                "answer_relevance": {
                    "score": 0,
                    "verdict": "回答是否对应问题",
                    "missed_point": "如果不对应，具体漏掉了问题里的哪个点",
                },
                "feedback": {
                    "question_analysis": "分析这道问题到底在考什么",
                    "answer_analysis": "分析用户回答哪里好、哪里不够",
                    "pain_point": "指出本轮暴露的核心痛点",
                    "improvement": "给出具体改进方法",
                    "sample_answer": "给出一段更强的示例回答",
                },
                "scores": {
                    "authenticity": 0,
                    "depth": 0,
                    "metrics": 0,
                    "engineering": 0,
                    "industry": 0,
                    "time": 0,
                },
                "report_brief": {
                    "danger_points": ["如果结束，列出危险点"],
                    "practice_plan": ["如果结束，列出训练计划"],
                },
            },
            "context": context,
        }

    if task == "report":
        return {
            "instruction": load_task_instruction("report"),
            "interviewer_style": style,
            "intensity_policy": intensity,
            "interviewer_skills": skills,
            "schema": {
                "summary": "一句话总结",
                "danger_points": ["危险点"],
                "practice_plan": ["训练建议"],
                "stronger_pitch": "更强项目表达",
                "round_feedback": [
                    {
                        "round": 1,
                        "question_analysis": "问题分析",
                        "answer_analysis": "回答分析",
                        "pain_point": "痛点",
                        "improvement": "改进方法",
                        "sample_answer": "示例回答",
                    }
                ],
            },
            "context": context,
        }

    raise ValueError("unsupported task")
