/**
 * 天气工具
 * 示例：getWeather(city) -> 返回天气信息
 */

import type { RegisteredTool } from "../core/types.js";

export const getWeatherTool: RegisteredTool = {
  description: {
    name: "getWeather",
    description:
      "根据城市名称查询当前天气和未来预报，包括温度、降雨概率、风速和湿度。适用于判断出行、跑步、穿衣等场景。",
    parameters: [
      {
        name: "city",
        type: "string",
        description: "城市名称，例如：上海、北京、Tokyo",
        required: true,
      },
      {
        name: "days",
        type: "number",
        description: "预报天数，默认 1 天",
        required: false,
      },
    ],
  },
  execute: async (args) => {
    const city = String(args.city || "上海");
    const days = Number(args.days || 1);

    // 模拟天气数据（Day 2 先不接入真实 API，专注结构）
    const mockData: Record<string, { temp: number; rain: number; wind: number; humidity: number; condition: string }> = {
      "上海": { temp: 26, rain: 20, wind: 12, humidity: 65, condition: "多云" },
      "北京": { temp: 30, rain: 10, wind: 8, humidity: 40, condition: "晴" },
      "广州": { temp: 32, rain: 60, wind: 6, humidity: 80, condition: "雷阵雨" },
      "深圳": { temp: 31, rain: 50, wind: 10, humidity: 75, condition: "阴" },
      "杭州": { temp: 27, rain: 30, wind: 9, humidity: 70, condition: "小雨" },
    };

    const data = mockData[city] || {
      temp: 25,
      rain: 15,
      wind: 10,
      humidity: 60,
      condition: "未知",
    };

    // 跑步建议
    let runAdvice = "适合跑步";
    if (data.rain > 50) runAdvice = "不建议户外跑，考虑室内或休息";
    else if (data.temp > 32) runAdvice = "高温，建议晨跑/夜跑，注意补水";
    else if (data.temp < 5) runAdvice = "低温，充分热身，注意保暖";
    else if (data.wind > 20) runAdvice = "大风，逆风跑注意配速控制";

    return {
      city,
      days,
      current: data,
      runAdvice,
      summary: `${city}当前${data.condition}，温度${data.temp}°C，降雨概率${data.rain}%，风速${data.wind}km/h。${runAdvice}。`,
    };
  },
};
