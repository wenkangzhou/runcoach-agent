/**
 * 训练相关工具
 * 示例：calculate(expression)、parseRunLog(text)
 */

import type { RegisteredTool } from "../core/types.js";

/** 计算器工具 */
export const calculateTool: RegisteredTool = {
  description: {
    name: "calculate",
    description:
      "执行数学计算表达式，支持加减乘除和括号。适用于配速换算、距离计算、训练负荷估算等场景。",
    parameters: [
      {
        name: "expression",
        type: "string",
        description: "数学表达式，例如: '(5*60+40)/8'、'42.195 / 3.5'",
        required: true,
      },
    ],
  },
  execute: (args) => {
    const expression = String(args.expression || "");

    // 安全校验：只允许数字、运算符、括号、小数点、空格
    if (!/^[\d+\-*/().\s]+$/.test(expression)) {
      throw new Error("表达式包含非法字符，只允许数字和 +-*/().");
    }

    // 使用 Function 安全求值（仅数学计算）
    try {
      // eslint-disable-next-line no-new-func
      const result = new Function(`return (${expression})`)();
      return {
        expression,
        result: Number(result),
        formatted: `${expression} = ${Number(result).toFixed(2)}`,
      };
    } catch {
      throw new Error("表达式计算失败，请检查语法");
    }
  },
};

/** 跑步记录解析工具 */
export const parseRunLogTool: RegisteredTool = {
  description: {
    name: "parseRunLog",
    description:
      "从自然语言文本中提取跑步数据，包括距离、配速、心率、时间和主观感受。适用于解析用户的跑步日记或口述记录。",
    parameters: [
      {
        name: "text",
        type: "string",
        description: "用户输入的跑步记录文本，例如: '今天跑了 8km，配速 5:40，心率 145，感觉有点累'",
        required: true,
      },
    ],
  },
  execute: (args) => {
    const text = String(args.text || "");

    // 简单的正则提取（Day 2 先不接入 NLP 模型）
    const distanceMatch = text.match(/(\d+(?:\.\d+)?)\s*(km|公里)/i);
    const paceMatch = text.match(/配速\s*(\d+[:：]\d+)/i);
    const hrMatch = text.match(/心率\s*(\d+)/i);
    const timeMatch = text.match(/(\d+)\s*分钟/i);
    const feelingMatch = text.match(/感觉\s*(.+?)(?:，|。|$)/i);

    const distance = distanceMatch ? parseFloat(distanceMatch[1]) : null;
    const pace = paceMatch ? paceMatch[1].replace("：", ":") : null;
    const hr = hrMatch ? parseInt(hrMatch[1], 10) : null;
    const duration = timeMatch ? parseInt(timeMatch[1], 10) : null;
    const feeling = feelingMatch ? feelingMatch[1].trim() : null;

    // 额外提取身体信号（如果没有匹配到"感觉"）
    let bodySignal: string | null = null;
    if (!feeling) {
      const bodyMatch = text.match(/(小腿|膝盖|脚踝|腿|脚)\s*(有点|很|非常)?\s*(紧|酸|痛|累|不舒服)/i);
      if (bodyMatch) {
        bodySignal = `${bodyMatch[1]}${bodyMatch[3]}`;
      }
    }
    const finalFeeling = feeling || bodySignal;

    // 简单训练负荷估算 (距离 * 强度系数)
    let load = null;
    if (distance && pace) {
      const [min, sec] = pace.split(":").map(Number);
      const paceSec = min * 60 + sec;
      // 配速越快（秒数越少），强度越高
      const intensity = Math.max(0.8, Math.min(1.5, 300 / paceSec));
      load = Math.round(distance * intensity * 10);
    }

    return {
      raw: text,
      extracted: {
        distance,
        pace,
        hr,
        duration,
        feeling: finalFeeling,
        bodySignal,
      },
      estimatedLoad: load,
      isValid: distance !== null,
      summary: distance
        ? `提取到: ${distance}km, 配速${pace || "未知"}, 心率${hr || "未知"}, 感受: ${finalFeeling || "未知"}${bodySignal ? ` (身体信号: ${bodySignal})` : ""}`
        : "未能提取到跑步数据，请使用格式: '跑了 Xkm，配速 X:XX'",
    };
  },
};
