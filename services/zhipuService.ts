/**
 * 智谱 AI 服务
 * 用于调用智谱大模型 API 进行交易分类
 */

import { HistoryCategoryData } from '../utils/historyProcessor';
import { getAllAvailableCategories, findBestMatchFromAvailableCategories } from '../utils/categoryMatcher';
import { loadCategoricalData } from '../utils/configLoader';

/**
 * 获取智谱 AI API 地址（可配置）
 * 优先从环境变量读取，如果没有则使用默认值
 * @returns API 地址字符串
 */
function getZhipuApiUrl(): string {
  return import.meta.env.VITE_ZHIPU_API_URL ||
    import.meta.env.ZHIPU_API_URL ||
    'https://api.silra.cn/v1/chat/completions';
}

/**
 * 获取智谱 AI 模型名称（可配置）
 * 优先从环境变量读取，如果没有则使用默认值
 * @param defaultModel - 默认模型名称（可选）
 * @returns 模型名称字符串
 */
function getZhipuModel(defaultModel: string = 'glm-4.6'): string {
  return import.meta.env.VITE_ZHIPU_MODEL ||
    import.meta.env.ZHIPU_MODEL ||
    defaultModel;
}

/**
 * 获取分类用的 systemPrompt（用于在 UI 中展示）
 * @param categoricalData - 分类数据数组
 * @param historySummary - 历史分类规律总结（可选）
 * @param historyData - 历史分类数据（可选）
 * @returns systemPrompt 字符串
 */
export function getClassificationSystemPrompt(
  categoricalData: any[],
  historySummary?: string,
  historyData?: HistoryCategoryData[]
): string {
  const availableCategories = getAllAvailableCategories(categoricalData);

  // 转换为紧凑格式（使用 1,2,3 代替 category1,category2,category3），减少 token 使用
  const compactCategories = availableCategories.map(cat => ({
    '1': cat.category1,
    '2': cat.category2,
    '3': cat.category3,
    '收/支': cat['收/支']
  }));

  // 使用紧凑 JSON 格式，减少 token 使用
  let prompt = `专业财务分类助手。根据费用明细(f)和收/支(d)进行三级分类。规则：1)从可用分类选择；2)内部交易可参考收或支。分类：${JSON.stringify(compactCategories)}`;

  if (historySummary) {
    prompt += `\n历史分类规律：${historySummary}`;
  }

  // 限制历史数据示例数量，最多取前 10 条，减少 token 消耗
  if (historyData && historyData.length > 0) {
    const limitedHistoryData = historyData.slice(0, 10);
    prompt += `\n历史数据示例：${JSON.stringify(limitedHistoryData)}`;
  }

  prompt += `\n返回紧凑JSON格式（无换行无缩进）,c为置信度返回0-1之间的小数：{"results":[{"id":"string","1":"string","2":"string","3":"string","c":"number"}]}`;

  return prompt;
}

/**
 * 获取分类用的 userPrompt（用于在 UI 中展示）
 * @param feeDetails - 费用明细数组（包含 id、费用明细、本期收入、本期支出字段）
 * @returns userPrompt 字符串
 */
export function getClassificationUserPrompt(
  feeDetails: Array<{ id: string; 费用明细: string; '本期收入'?: string | number; '本期支出'?: string | number; '收/支'?: string }>
): string {
  if (feeDetails.length === 0) {
    return '暂无需要分类的费用明细';
  }

  // 使用紧凑 JSON 格式，减少 token 使用（字段名使用单字符：f=费用明细，d=收/支）
  // 如果已有"收/支"字段则使用，否则根据"本期收入"和"本期支出"自动判断
  return `分类以下费用明细，f=费用明细，d=收/支：${JSON.stringify(feeDetails.map(item => {
    let typeOfIncomeAndExpenditure = item['收/支'] || '';
    // 如果没有"收/支"字段，根据"本期收入"和"本期支出"自动判断
    if (!typeOfIncomeAndExpenditure) {
      const income = item['本期收入'];
      const expenditure = item['本期支出'];
      if (income && (typeof income === 'number' ? income !== 0 : String(income).trim() !== '')) {
        typeOfIncomeAndExpenditure = '收';
      } else if (expenditure && (typeof expenditure === 'number' ? expenditure !== 0 : String(expenditure).trim() !== '')) {
        typeOfIncomeAndExpenditure = '支';
      }
    }
    return { id: item.id, f: item.费用明细, d: typeOfIncomeAndExpenditure };
  }))}`;
}

/**
 * 分类交易数据
 * @param {any[]} transactions - 交易数据数组
 * @param {any[]} historyData - 历史分类数据
 * @param {number} threshold - 置信度阈值
 * @param {string} promptTemplate - 提示词模板
 * @returns {Promise<any[]>} 分类后的交易数据
 */
export const classifyTransactions = async (
  transactions: any[],
  historyData: any[],
  threshold: number,
  promptTemplate: string
) => {
  // 从环境变量中获取 API Key
  // 注意：Vite 只暴露以 VITE_ 开头的环境变量到客户端
  const apiKey = import.meta.env.VITE_ZHIPU_API_KEY || import.meta.env.ZHIPU_API_KEY;

  if (!apiKey) {
    const errorMsg = "Missing Zhipu API Key. 请在项目根目录创建 .env.local 文件，并添加: VITE_ZHIPU_API_KEY=your_api_key";
    console.error(errorMsg);
    alert(errorMsg + "\n\n获取 API Key: https://open.bigmodel.cn/");
    throw new Error(errorMsg);
  }

  // 构建提示词
  const prompt = promptTemplate
    .replace('{historyData}', JSON.stringify(historyData.slice(0, 50)))
    .replace('{feeDetail}', JSON.stringify(transactions));

  // 添加 JSON 格式要求到提示词中
  // 注意：当使用 response_format: { type: 'json_object' } 时，必须返回 JSON 对象
  const systemPrompt = `你是一个专业的财务分类助手。请根据历史分类数据对交易进行三级分类。
返回格式必须是一个 JSON 对象，包含一个 "results" 字段，该字段是一个数组。
每个数组元素包含以下字段：
- id: 交易ID（字符串）
- 1: 一级分类（字符串）
- 2: 二级分类（字符串）
- 3: 三级分类（字符串）
- c: 置信度（0-1之间的小数）

示例格式：
{
  "results": [
    {
      "id": "t-1",
      "1": "办公费",
      "2": "快递费",
      "3": "顺丰",
      "c": 0.95
    }
  ]
}

只返回 JSON 对象，不要包含任何其他文字说明。`;

  const fullPrompt = `${systemPrompt}\n\n${prompt}\n\n请返回 JSON 对象格式的分类结果：`;

  try {
    // 调用智谱 API
    const response = await fetch(getZhipuApiUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: getZhipuModel('glm-4'), // 使用智谱 GLM-4 模型，也可以使用 'glm-4-flash' 等
        messages: [
          {
            role: 'system',
            content: '你是一个专业的财务分类助手，擅长根据历史数据对交易进行分类。'
          },
          {
            role: 'user',
            content: fullPrompt
          }
        ],
        temperature: 0.3, // 降低温度以获得更稳定的结果
        thinking: {
          type: "disabled",
          clear_thinking: true
        },
        response_format: { type: 'json_object' } // 要求返回 JSON 格式
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Zhipu API Error: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();

    // 提取返回的内容
    const content = data.choices?.[0]?.message?.content || '';

    // 尝试解析 JSON
    let results: any[] = [];
    try {
      const parsed = JSON.parse(content);

      // 优先从 results 字段提取数组
      if (parsed.results && Array.isArray(parsed.results)) {
        results = parsed.results;
      }
      // 如果直接是数组
      else if (Array.isArray(parsed)) {
        results = parsed;
      }
      // 尝试从 data 字段提取
      else if (parsed.data && Array.isArray(parsed.data)) {
        results = parsed.data;
      }
      // 如果返回的是单个对象，转换为数组
      else if (parsed.id) {
        results = [parsed];
      }
      else {
        console.warn('Unexpected JSON format:', parsed);
        throw new Error('API 返回的 JSON 格式不符合预期');
      }
    } catch (parseError) {
      console.error('Failed to parse JSON response:', content);
      // 尝试从文本中提取 JSON 数组
      const arrayMatch = content.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        try {
          results = JSON.parse(arrayMatch[0]);
        } catch (e) {
          throw new Error('无法解析 API 返回的 JSON 数据');
        }
      } else {
        throw new Error('无法解析 API 返回的 JSON 数据: ' + (parseError as Error).message);
      }
    }

    // 映射结果到交易数据
    return transactions.map(t => {
      const match = results.find((r: any) => r.id === t.id);
      if (match && (match.c || match.confidence || 0) >= threshold) {
        return {
          ...t,
          // 支持新的紧凑格式（1,2,3）和旧格式（category1,category2,category3）兼容
          category1: match['1'] || match.category1 || '未分类',
          category2: match['2'] || match.category2 || '未分类',
          category3: match['3'] || match.category3 || '未分类',
          status: 'ai-classified' as const
        };
      }
      return { ...t, status: 'unclassified' as const };
    });
  } catch (error) {
    console.error("Zhipu AI Classification Error:", error);
    throw error;
  }
};

/**
 * 获取总结历史分类规律的 systemPrompt（用于在 UI 中展示）
 * @param categoricalData - 分类数据数组
 * @param historyData - 历史分类数据
 * @returns systemPrompt 字符串
 */
export function getSummarySystemPrompt(categoricalData: any[], historyData: HistoryCategoryData[]): string {
  const availableCategories = getAllAvailableCategories(categoricalData);

  // 转换为紧凑格式（使用 1,2,3 代替 category1,category2,category3），减少 token 使用
  const compactCategories = availableCategories.map(cat => ({
    '1': cat.category1,
    '2': cat.category2,
    '3': cat.category3
  }));

  return `你是一个专业的财务分类分析助手。请分析历史分类数据，总结费用明细与三级分类（类型（一级）、类型（二级）、类型（三级））之间的规律和关系。

重要提示：分类结果必须从以下可用分类中选择，不能使用其他分类：
${JSON.stringify(compactCategories)}

请总结以下规律：
1. 费用明细中的关键词与分类的对应关系
2. 常见的分类模式和规则
3. 特殊情况的处理方式

请用简洁清晰的语言总结这些规律，以便后续用于自动分类。`;
}

/**
 * 获取总结历史分类规律的 userPrompt（用于在 UI 中展示）
 * @param historyData - 历史分类数据
 * @returns userPrompt 字符串
 */
export function getSummaryUserPrompt(historyData: HistoryCategoryData[]): string {
  if (historyData.length === 0) {
    return '暂无历史分类数据';
  }

  return `以下是历史分类数据（共 ${historyData.length} 条）：

${JSON.stringify(historyData, null, 2)}

请总结费用明细与三级分类之间的关系规律：`;
}

/**
 * 总结历史分类数据中费用明细与分类的关系
 * @param historyData - 历史分类数据
 * @returns Promise<string> 总结后的关系描述
 */
export const summarizeHistoryCategories = async (
  historyData: HistoryCategoryData[]
): Promise<string> => {
  const apiKey = import.meta.env.VITE_ZHIPU_API_KEY || import.meta.env.ZHIPU_API_KEY;

  if (!apiKey) {
    throw new Error("Missing Zhipu API Key");
  }

  // 加载分类数据
  const categoricalData = await loadCategoricalData();
  const systemPrompt = getSummarySystemPrompt(categoricalData, historyData);
  const userPrompt = getSummaryUserPrompt(historyData);

  try {
    const response = await fetch(getZhipuApiUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: getZhipuModel('glm-4.6'),
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: getSummaryUserPrompt(historyData)
          }
        ],
        temperature: 0.3,
        thinking: {
          type: "disabled",
          clear_thinking: true
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Zhipu API Error: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (error) {
    console.error("Zhipu AI Summarization Error:", error);
    throw error;
  }
};

/**
 * 根据费用明细自动分类
 * @param feeDetails - 费用明细数组（包含 id、费用明细、本期收入、本期支出字段）
 * @param historySummary - 历史分类关系总结
 * @param historyData - 历史分类数据（用于匹配）
 * @param threshold - 置信度阈值
 * @param onBatchComplete - 每处理完一批时的回调函数，接收当前批次的结果
 * @returns Promise<Array<{id: string, category1: string, category2: string, category3: string, c: number}>>
 */
export const classifyByFeeDetail = async (
  feeDetails: Array<{ id: string; 费用明细: string; '本期收入'?: string | number; '本期支出'?: string | number; '收/支'?: string }>,
  historySummary: string,
  historyData: HistoryCategoryData[],
  threshold: number = 0.7,
  onBatchComplete?: (batchResults: Array<{ id: string, category1: string, category2: string, category3: string, c: number }>) => void
): Promise<Array<{ id: string, category1: string, category2: string, category3: string, c: number }>> => {
  const apiKey = import.meta.env.VITE_ZHIPU_API_KEY || import.meta.env.ZHIPU_API_KEY;

  if (!apiKey) {
    throw new Error("Missing Zhipu API Key");
  }

  // 先尝试精确匹配历史数据
  const matchedResults: Array<{ id: string, category1: string, category2: string, category3: string, c: number }> = [];
  const unmatchedItems: Array<{ id: string; 费用明细: string; '本期收入'?: string | number; '本期支出'?: string | number; '收/支'?: string }> = [];

  feeDetails.forEach(item => {
    // 精确匹配
    const exactMatch = historyData.find(h =>
      h.费用明细.toLowerCase().trim() === item.费用明细.toLowerCase().trim()
    );

    if (exactMatch) {
      matchedResults.push({
        id: item.id,
        category1: exactMatch['类型（一级）'],
        category2: exactMatch['类型（二级）'],
        category3: exactMatch['类型（三级）'],
        c: 1.0
      });
    } else {
      unmatchedItems.push(item);
    }
  });

  // 如果有历史匹配结果，立即调用回调函数
  if (onBatchComplete && matchedResults.length > 0) {
    console.log(`历史匹配完成，共 ${matchedResults.length} 条，立即更新汇总表`);
    onBatchComplete(matchedResults);
  }

  // 如果还有未匹配的，使用 AI 分类
  // 批量处理：将大量数据分成小批次，避免 API 响应被截断
  if (unmatchedItems.length > 0) {
    // 加载分类数据
    const categoricalData = await loadCategoricalData();
    // 使用统一的 systemPrompt 生成函数
    const systemPrompt = getClassificationSystemPrompt(categoricalData, historySummary, historyData);

    // 批量大小：每批处理 50 条数据，避免超过 API 输出限制
    const BATCH_SIZE = 50;
    const batches: Array<Array<{ id: string; 费用明细: string; '本期收入'?: string | number; '本期支出'?: string | number; '收/支'?: string }>> = [];

    // 将数据分成批次
    for (let i = 0; i < unmatchedItems.length; i += BATCH_SIZE) {
      batches.push(unmatchedItems.slice(i, i + BATCH_SIZE));
    }

    console.log(`开始批量处理 ${unmatchedItems.length} 条未匹配数据，共 ${batches.length} 批次，每批 ${BATCH_SIZE} 条`);

    /**
     * 处理单个批次的函数
     * @param batch - 批次数据
     * @param batchIndex - 批次索引
     * @returns 处理结果
     */
    const processBatch = async (
      batch: Array<{ id: string; 费用明细: string }>,
      batchIndex: number
    ): Promise<Array<{ id: string, category1: string, category2: string, category3: string, c: number }>> => {
      try {
        const userPrompt = getClassificationUserPrompt(batch);

        const response = await fetch(getZhipuApiUrl(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: getZhipuModel('glm-4.6'),
            messages: [
              {
                role: 'system',
                content: systemPrompt
              },
              {
                role: 'user',
                content: userPrompt
              }
            ],
            temperature: 0.3,
            thinking: {
              type: "disabled",
              clear_thinking: true
            },
            response_format: { type: 'json_object' }
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error(`批次 ${batchIndex + 1} API 错误:`, errorData);
          throw new Error(`Zhipu API Error: ${response.status} - ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';

        let aiResults: any[] = [];
        try {
          let parsed: any;

          // 如果 content 已经是对象，直接使用
          if (typeof content === 'object' && content !== null) {
            parsed = content;
          }
          // 如果是字符串，尝试解析
          else if (typeof content === 'string') {
            // 先尝试直接解析
            try {
              parsed = JSON.parse(content);
            } catch (e) {
              // 如果直接解析失败，尝试修复常见的 JSON 问题
              let jsonStr = content.trim();

              // 尝试提取 JSON 对象
              const firstBrace = jsonStr.indexOf('{');
              const lastBrace = jsonStr.lastIndexOf('}');
              if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
              }

              // 尝试修复不完整的 JSON（如果 results 数组被截断）
              try {
                parsed = JSON.parse(jsonStr);
              } catch (e2) {
                // 如果还是失败，尝试提取完整的 results 数组
                const resultsMatch = jsonStr.match(/"results"\s*:\s*\[([\s\S]*?)\]/);
                if (resultsMatch) {
                  // 尝试提取所有完整的对象
                  const objectMatches = jsonStr.matchAll(/\{[^{}]*"id"[^{}]*\}/g);
                  const extractedObjects: any[] = [];
                  for (const match of objectMatches) {
                    try {
                      extractedObjects.push(JSON.parse(match[0]));
                    } catch (e3) {
                      // 忽略无法解析的对象
                    }
                  }
                  if (extractedObjects.length > 0) {
                    parsed = { results: extractedObjects };
                  } else {
                    throw e2;
                  }
                } else {
                  throw e2;
                }
              }
            }
          } else {
            throw new Error('Unexpected content type');
          }

          // 提取结果数组
          if (parsed.results && Array.isArray(parsed.results)) {
            aiResults = parsed.results;
          } else if (Array.isArray(parsed)) {
            aiResults = parsed;
          } else if (parsed.data && Array.isArray(parsed.data)) {
            aiResults = parsed.data;
          }

          console.log(`批次 ${batchIndex + 1} 成功解析 AI 分类结果，共 ${aiResults.length} 条（期望 ${batch.length} 条）`);

          // 检查是否有数据丢失
          if (aiResults.length < batch.length) {
            console.warn(`警告：批次 ${batchIndex + 1} 返回结果数量 (${aiResults.length}) 少于请求数量 (${batch.length})，可能存在数据截断`);
          }
        } catch (parseError: any) {
          console.error(`批次 ${batchIndex + 1} JSON 解析失败`);
          console.error('Content length:', content?.length || 0);
          console.error('Content preview:', content?.substring(0, 500) || '');
          console.error('Parse error:', parseError?.message || parseError);

          // 尝试从截断的 JSON 中提取部分结果
          try {
            // 查找所有完整的 JSON 对象（支持新格式 1,2,3 和旧格式 category1,category2,category3，支持 c 和 confidence）
            const objectPattern = /\{\s*"id"\s*:\s*"[^"]+"\s*,\s*"(?:1|category1)"\s*:\s*"[^"]*"\s*,\s*"(?:2|category2)"\s*:\s*"[^"]*"\s*,\s*"(?:3|category3)"\s*:\s*"[^"]*"\s*,\s*"(?:c|confidence)"\s*:\s*[\d.]+\s*\}/g;
            const matches = content.matchAll(objectPattern);
            for (const match of matches) {
              try {
                const obj = JSON.parse(match[0]);
                aiResults.push(obj);
              } catch (e) {
                // 忽略无法解析的对象
              }
            }
            if (aiResults.length > 0) {
              console.log(`批次 ${batchIndex + 1} 从截断的 JSON 中提取到 ${aiResults.length} 条结果`);
            }
          } catch (extractError) {
            console.error(`批次 ${batchIndex + 1} 无法从错误内容中提取结果:`, extractError);
          }
        }

        // 处理 AI 返回的结果
        const batchResults: Array<{ id: string, category1: string, category2: string, category3: string, c: number }> = [];

        aiResults.forEach((r: any) => {
          // 支持新的紧凑格式（1,2,3）和旧格式（category1,category2,category3）兼容
          const cat1 = r['1'] || r.category1 || '';
          const cat2 = r['2'] || r.category2 || '';
          const cat3 = r['3'] || r.category3 || '';

          // 尝试从可用分类中找到匹配的分类
          const bestMatch = findBestMatchFromAvailableCategories(
            cat1,
            cat2,
            cat3,
            categoricalData
          );

          let result: { id: string, category1: string, category2: string, category3: string, c: number };

          if (bestMatch) {
            result = {
              id: r.id,
              category1: bestMatch.category1,
              category2: bestMatch.category2,
              category3: bestMatch.category3,
              c: r.c || r.confidence || 0
            };
          } else {
            // 如果找不到匹配，仍然添加结果，但记录警告
            console.warn(`AI 返回的分类不在可用分类中: ${cat1}/${cat2}/${cat3}，但仍会添加结果`);
            result = {
              id: r.id,
              category1: cat1,
              category2: cat2,
              category3: cat3,
              c: r.c || r.confidence || 0
            };
          }

          batchResults.push(result);
        });

        // 检查是否有未返回结果的数据
        const returnedIds = new Set(aiResults.map((r: any) => r.id));
        const missingItems = batch.filter(item => !returnedIds.has(item.id));
        if (missingItems.length > 0) {
          console.warn(`批次 ${batchIndex + 1} 有 ${missingItems.length} 条数据未返回结果:`, missingItems.map(i => i.id));
        }

        return batchResults;
      } catch (error) {
        console.error(`批次 ${batchIndex + 1} AI 分类失败:`, error);
        // 如果某批次失败，返回空数组
        console.warn(`批次 ${batchIndex + 1} 失败，跳过该批次`);
        return [];
      }
    };

    // 并发处理：每次处理 10 个批次
    const CONCURRENT_BATCHES = 10;
    for (let i = 0; i < batches.length; i += CONCURRENT_BATCHES) {
      const concurrentBatches = batches.slice(i, i + CONCURRENT_BATCHES);
      const batchIndices = concurrentBatches.map((_, idx) => i + idx);

      console.log(`正在并发处理第 ${i + 1}-${Math.min(i + CONCURRENT_BATCHES, batches.length)}/${batches.length} 批次（共 ${concurrentBatches.length} 个并发请求）`);

      // 并发发送请求
      const promises = concurrentBatches.map((batch, idx) =>
        processBatch(batch, batchIndices[idx])
      );

      // 等待所有并发请求完成
      const results = await Promise.allSettled(promises);

      // 处理结果
      results.forEach((result, idx) => {
        const batchIndex = batchIndices[idx];
        if (result.status === 'fulfilled') {
          const batchResults = result.value;
          // 添加到总结果中
          batchResults.forEach(r => matchedResults.push(r));

          // 每处理完一批，立即调用回调函数，实时更新汇总表
          if (onBatchComplete && batchResults.length > 0) {
            onBatchComplete(batchResults);
          }
        } else {
          console.error(`批次 ${batchIndex + 1} 处理失败:`, result.reason);
        }
      });

      // 如果不是最后一批，添加短暂延迟，避免 API 限流
      if (i + CONCURRENT_BATCHES < batches.length) {
        await new Promise(resolve => setTimeout(resolve, 200)); // 每轮并发之间延迟 200ms
      }
    }

    console.log(`批量处理完成，共处理 ${matchedResults.length} 条结果（包含历史匹配和 AI 分类）`);
  }

  return matchedResults;
};

/**
 * 批量获取银行户地信息（支持分批并发处理）
 * @param bankNames - 银行开户行名称数组
 * @param onProgress - 进度回调函数（可选）
 * @returns Promise<Array<{province: string, city: string, fullAddress: string}>> 返回地址信息数组
 */
export const getBankLocationsBatch = async (
  bankNames: string[],
  onProgress?: (current: number, total: number) => void
): Promise<Array<{ province: string; city: string; fullAddress: string; q?: string }>> => {
  const apiKey = import.meta.env.VITE_ZHIPU_API_KEY || import.meta.env.ZHIPU_API_KEY;

  if (!apiKey) {
    throw new Error("Missing Zhipu API Key");
  }

  if (!bankNames || bankNames.length === 0) {
    return [];
  }

  // 过滤空值，保留原始索引
  const validBankNames = bankNames
    .map((name, index) => ({
      originalIndex: index,
      name: name ? String(name).trim() : ''
    }))
    .filter(item => item.name);

  if (validBankNames.length === 0) {
    return bankNames.map(() => ({ province: '', city: '', fullAddress: '' }));
  }

  const BATCH_SIZE = 50; // 每批处理50个
  const CONCURRENT_BATCHES = 3; // 并发处理3批

  // 将有效银行名称分批
  const batches: Array<Array<{ originalIndex: number; name: string }>> = [];
  for (let i = 0; i < validBankNames.length; i += BATCH_SIZE) {
    batches.push(validBankNames.slice(i, i + BATCH_SIZE));
  }

  if (batches.length === 0) {
    return bankNames.map(() => ({ province: '', city: '', fullAddress: '' }));
  }

  const systemPrompt = `地址解析助手。从银行开户行名称提取省份、城市、完整地址、收款账号地区码。

返回结果格式为JSON对象：{"results":[{"id":0,"p":"北京","c":"海淀","f":"北京市海淀区","q":"110000"}]}

规则：
-p:省份名，无"省"字（如：北京、广东）
-c:城市/区名，无"市/区"字（如：海淀、浦东）
-f:完整地址（如：北京市海淀区）
-q:收款账号地区码，如：110000
-必须为每个银行返回结果，id对应输入索引`;

  /**
   * 处理单个批次
   */
  const processBatch = async (
    batch: Array<{ originalIndex: number; name: string }>,
    batchIndex: number
  ): Promise<Array<{ id: number; province: string; city: string; fullAddress: string; q?: string }>> => {
    const userPrompt = `解析银行名称列表，提取省份、城市、完整地址、收款账号地区码：
${JSON.stringify(batch.map(item => ({ id: item.originalIndex, name: item.name })))}

返回JSON，包含所有银行结果：`;

    try {
      const response = await fetch(getZhipuApiUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: getZhipuModel('glm-4.6'),
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: userPrompt
            }
          ],
          temperature: 0.3,
          thinking: {
            type: "disabled",
            clear_thinking: true
          },
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Zhipu API Error: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      try {
        const parsed = JSON.parse(content);
        const results = parsed.results || [];

        // 转换为标准格式
        return results.map((r: any) => ({
          id: r.id,
          province: r.province || r.p || '',
          city: r.city || r.c || '',
          fullAddress: r.fullAddress || r.f || '',
          q: r.q || ''
        }));
      } catch (parseError) {
        console.error(`批次 ${batchIndex + 1} 解析失败:`, parseError, content);
        // 使用备用方案
        return batch.map(item => {
          const location = extractLocationFromBankName(item.name);
          return {
            id: item.originalIndex,
            ...location
          };
        });
      }
    } catch (error) {
      console.error(`批次 ${batchIndex + 1} 处理失败:`, error);
      // 使用备用方案
      return batch.map(item => {
        const location = extractLocationFromBankName(item.name);
        return {
          id: item.originalIndex,
          ...location
        };
      });
    }
  };

  // 并发处理批次
  const allResults: Array<{ id: number; province: string; city: string; fullAddress: string; q?: string }> = [];

  for (let i = 0; i < batches.length; i += CONCURRENT_BATCHES) {
    const concurrentBatches = batches.slice(i, i + CONCURRENT_BATCHES);

    // 并发处理当前批次组
    const batchPromises = concurrentBatches.map((batch, idx) =>
      processBatch(batch, i + idx)
    );

    const batchResults = await Promise.all(batchPromises);

    // 合并结果
    batchResults.forEach(results => {
      allResults.push(...results);
    });

    // 更新进度
    if (onProgress) {
      onProgress(Math.min(i + CONCURRENT_BATCHES, batches.length), batches.length);
    }

    // 如果不是最后一批，添加短暂延迟，避免API限流
    if (i + CONCURRENT_BATCHES < batches.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  // 创建结果映射
  const resultMap = new Map<number, { province: string; city: string; fullAddress: string; q?: string }>();
  allResults.forEach(r => {
    resultMap.set(r.id, {
      province: r.province,
      city: r.city,
      fullAddress: r.fullAddress,
      q: r.q
    });
  });

  // 为所有银行名称返回结果（包括空值）
  return bankNames.map((name, index) => {
    if (!name || !String(name).trim()) {
      return { province: '', city: '', fullAddress: '', q: '' };
    }
    const result = resultMap.get(index);
    if (result) {
      return result;
    }
    // 如果API没有返回该结果，使用备用方案
    return extractLocationFromBankName(String(name).trim());
  });
};

/**
 * 根据银行开户行名称获取银行户地信息（单个）
 * @param bankName - 银行开户行名称（如：中国招商银行股份有限公司北京海淀支行）
 * @returns Promise<{province: string, city: string, fullAddress: string}> 返回省份、城市和完整地址
 */
export const getBankLocation = async (
  bankName: string
): Promise<{ province: string; city: string; fullAddress: string }> => {
  const apiKey = import.meta.env.VITE_ZHIPU_API_KEY || import.meta.env.ZHIPU_API_KEY;

  if (!apiKey) {
    throw new Error("Missing Zhipu API Key");
  }

  if (!bankName || !bankName.trim()) {
    return { province: '', city: '', fullAddress: '' };
  }

  const systemPrompt = `地址解析助手。从银行开户行名称提取省份、城市、完整地址。

返回JSON：{"p":"北京","c":"海淀","f":"北京市海淀区"}

规则：
-p:省份名，无"省"字（如：北京、广东）
-c:城市/区名，无"市/区"字（如：海淀、浦东）
-f:完整地址（如：北京市海淀区）`;

  const userPrompt = `解析银行名称，提取省份、城市、完整地址：
${bankName}

返回JSON：`;

  try {
    const response = await fetch(getZhipuApiUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: getZhipuModel('glm-4'),
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        temperature: 0.1, // 降低温度以获得更准确的结果
        thinking: {
          type: "disabled",
          clear_thinking: true
        },
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Zhipu API Error: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    try {
      const parsed = JSON.parse(content);
      return {
        province: parsed.province || parsed.p || '',
        city: parsed.city || parsed.c || '',
        fullAddress: parsed.fullAddress || parsed.f || ''
      };
    } catch (parseError) {
      console.error('解析银行户地信息失败:', parseError, content);
      // 如果解析失败，尝试从银行名称中提取
      return extractLocationFromBankName(bankName);
    }
  } catch (error) {
    console.error("获取银行户地信息失败:", error);
    // 如果API调用失败，尝试从银行名称中提取
    return extractLocationFromBankName(bankName);
  }
};

/**
 * 从银行名称中提取地址信息（备用方案）
 * @param bankName - 银行开户行名称
 * @returns 地址信息
 */
function extractLocationFromBankName(bankName: string): { province: string; city: string; fullAddress: string } {
  // 尝试匹配常见的地址模式
  const patterns = [
    // 匹配：XX省XX市XX区/县
    /([^省]+省)?([^市]+市)?([^区县]+[区县])/,
    // 匹配：XX市XX区
    /([^市]+市)([^区县]+[区县])/,
    // 匹配：XX区（直辖市）
    /([^区]+区)/,
  ];

  for (const pattern of patterns) {
    const match = bankName.match(pattern);
    if (match) {
      const province = match[1] ? match[1].replace('省', '') : '';
      const city = match[2] ? match[2].replace('市', '') : (match[3] ? match[3].replace(/[区县]$/, '') : '');
      const fullAddress = match[0] || '';

      return {
        province: province || city || '',
        city: city || '',
        fullAddress: fullAddress || bankName
      };
    }
  }

  return { province: '', city: '', fullAddress: bankName };
}