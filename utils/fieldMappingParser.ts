/**
 * 字段映射解析器工具函数
 * 用于解析灵活的字段映射配置表达式
 */

/**
 * 查找字段在表头中的索引（优先精确匹配，再模糊匹配，避免短列名误匹配）
 * 例如配置「对方账号名称」时，若表头中先有「对方」会误匹配；现优先精确匹配再按最长匹配
 * @param headers - 表头数组
 * @param fieldName - 字段名
 * @returns 字段索引，如果找不到返回 -1
 */
export function findFieldIndex(headers: string[], fieldName: string): number {
  if (!fieldName || !fieldName.trim()) return -1;

  const fieldTrimmed = fieldName.trim();
  const fieldLower = fieldTrimmed.toLowerCase();

  // 1. 优先精确匹配（含 trim 后相等）
  const exactIndex = headers.findIndex((h) => {
    if (!h) return false;
    return String(h).trim().toLowerCase() === fieldLower;
  });
  if (exactIndex >= 0) return exactIndex;

  // 2. 模糊匹配：仅当「表头包含字段名」或「字段名包含表头」时匹配，且优先取「表头与字段名相等或更长」的项，避免「对方」抢配「对方账号名称」
  let bestIndex = -1;
  let bestHeaderLen = -1;
  headers.forEach((h, index) => {
    if (!h) return;
    const hTrimmed = String(h).trim();
    const hLower = hTrimmed.toLowerCase();
    const match =
      hLower === fieldLower ||
      hLower.includes(fieldLower) ||
      fieldLower.includes(hLower);
    if (!match) return;
    // 在多个匹配中优先选表头与字段名等长或更长的（更具体）
    if (hTrimmed.length >= bestHeaderLen) {
      bestHeaderLen = hTrimmed.length;
      bestIndex = index;
    }
  });
  return bestIndex;
}

/**
 * 获取字段值
 * @param headers - 表头数组
 * @param row - 行数据
 * @param fieldName - 字段名
 * @returns 字段值，如果找不到返回空字符串
 */
export function getFieldValue(headers: string[], row: any[], fieldName: string): string {
  const index = findFieldIndex(headers, fieldName);
  if (index !== -1 && row[index] !== undefined) {
    const value = row[index];
    return value !== null && value !== undefined ? String(value).trim() : '';
  }
  return '';
}

/**
 * 解析日期值（支持多种格式）
 * @param value - 日期值（可能是 Date 对象、数字、字符串等）
 * @returns Date 对象，如果解析失败返回 null
 */
export function parseDateValue(value: any): Date | null {
  if (!value) return null;
  
  // 如果是 Date 对象
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  
  // 如果是数字（可能是 Excel 日期序列号）
  if (typeof value === 'number') {
    // Excel 日期序列号：1900-01-01 是 1
    if (value > 0 && value < 1000000) {
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    // 尝试作为时间戳
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  
  // 如果是字符串
  if (typeof value === 'string') {
    const str = value.trim();
    if (!str) return null;
    
    // 尝试 ISO 格式
    const isoDate = new Date(str);
    if (!isNaN(isoDate.getTime())) {
      return isoDate;
    }
    
    // 尝试常见格式：YYYY-MM-DD, YYYY/MM/DD, YYYY年MM月DD日
    const patterns = [
      /^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/,
      /^(\d{4})年(\d{1,2})月(\d{1,2})日/,
    ];
    
    for (const pattern of patterns) {
      const match = str.match(pattern);
      if (match) {
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1;
        const day = parseInt(match[3], 10);
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }
  }
  
  return null;
}

/**
 * 格式化日期
 * @param dateValue - 日期值
 * @param format - 格式字符串（如：YYYY-MM-DD）
 * @returns 格式化后的日期字符串
 */
export function formatDate(dateValue: any, format: string): string {
  const date = parseDateValue(dateValue);
  if (!date) return String(dateValue || '');
  
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  
  return format
    .replace(/YYYY/g, String(year).padStart(4, '0'))
    .replace(/YY/g, String(year % 100).padStart(2, '0'))
    .replace(/MM/g, String(month).padStart(2, '0'))
    .replace(/M/g, String(month))
    .replace(/DD/g, String(day).padStart(2, '0'))
    .replace(/D/g, String(day))
    .replace(/HH/g, String(hours).padStart(2, '0'))
    .replace(/H/g, String(hours))
    .replace(/mm/g, String(minutes).padStart(2, '0'))
    .replace(/m/g, String(minutes))
    .replace(/ss/g, String(seconds).padStart(2, '0'))
    .replace(/s/g, String(seconds));
}

/**
 * 计算数值表达式
 * @param value - 当前数值
 * @param expression - 表达式（如：*1.1, +100, -50, /2）
 * @returns 计算结果
 */
export function calculateValue(value: number, expression: string): number {
  if (isNaN(value)) return 0;
  
  try {
    // 移除表达式中的 $ 符号（如果存在）
    let expr = expression.trim().replace(/\$/g, String(value));
    
    // 如果表达式以运算符开头，表示对当前值进行操作
    if (/^[+\-*/]/.test(expr)) {
      expr = String(value) + expr;
    }
    
    // 检查是否包含其他字段名（非数字部分）
    // 如果包含，需要从 row 中获取值
    const fieldMatch = expr.match(/([a-zA-Z\u4e00-\u9fa5][a-zA-Z0-9\u4e00-\u9fa5]*)/);
    if (fieldMatch) {
      // 如果表达式包含字段名，暂时不支持，返回原值
      // 这需要在调用时传入 headers 和 row
      return value;
    }
    
    // 安全地计算表达式（只允许数字和基本运算符）
    if (!/^[0-9+\-*/.()\s]+$/.test(expr)) {
      return value;
    }
    
    // 使用 Function 构造函数安全计算
    const result = new Function('return ' + expr)();
    return typeof result === 'number' && !isNaN(result) ? result : value;
  } catch (error) {
    console.error('计算表达式失败:', expression, error);
    return value;
  }
}

/**
 * 应用字符串函数
 * @param value - 字符串值
 * @param funcName - 函数名（trim, upper, lower, replace, removeSpaces, substring）
 * @param params - 函数参数
 * @returns 处理后的字符串
 */
export function applyStringFunction(value: string, funcName: string, params: string[]): string {
  if (typeof value !== 'string') {
    value = String(value || '');
  }
  
  switch (funcName) {
    case 'trim':
      return value.trim();
    case 'removeSpaces':
      /** 去掉字符串中所有空白字符（空格、制表符、换行等），常用于银行卡号等 */
      return value.replace(/\s+/g, '');
    case 'upper':
      return value.toUpperCase();
    case 'lower':
      return value.toLowerCase();
    case 'replace': {
      if (params.length >= 2) {
        const search = params[0].replace(/^'|'$/g, '').replace(/''/g, "'");
        const replace = params[1].replace(/^'|'$/g, '').replace(/''/g, "'");
        return value.replace(new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replace);
      }
      return value;
    }
    case 'substring': {
      if (params.length >= 2) {
        const start = parseInt(params[0], 10);
        const end = parseInt(params[1], 10);
        if (!isNaN(start) && !isNaN(end)) {
          return value.substring(start, end);
        }
      }
      return value;
    }
    default:
      return value;
  }
}

/**
 * 解析字段映射表达式
 * 支持的功能：
 * - 或关系（|）：找到第一个存在的字段
 * - 条件判断（?:）：三元运算
 * - 默认值（||）：字段为空时使用默认值
 * - 函数调用（:函数名）：日期格式化、数值计算、字符串操作等
 * - 字段拼接（&）：连接多个字段和固定文字
 * - 固定文字（单引号）：直接使用固定文字
 * 
 * @param mappingString - 映射表达式字符串
 * @param headers - 表头数组
 * @param row - 行数据
 * @returns 解析后的字段值
 */
export function parseFieldMapping(
  mappingString: string,
  headers: string[],
  row: any[]
): string {
  if (!mappingString || !mappingString.trim()) {
    return '';
  }
  
  const expr = mappingString.trim();
  
  // 1. 处理或关系（|）- 最高优先级（但排除 || 的情况）
  // 先检查是否有 ||，如果有则跳过 | 的处理
  if (expr.includes('|') && !expr.includes('||')) {
    const parts = expr.split('|').map(p => p.trim()).filter(p => p);
    for (const part of parts) {
      const value = parseFieldMapping(part, headers, row);
      if (value) {
        return value;
      }
    }
    return '';
  }
  
  // 2. 处理条件判断（?:）- 第二优先级
  if (expr.includes('?:')) {
    // 找到第一个 ?: 的位置
    const questionIndex = expr.indexOf('?:');
    const condition = expr.substring(0, questionIndex).trim();
    const rest = expr.substring(questionIndex + 2).trim();
    
    // 解析条件部分
    const conditionValue = parseFieldMapping(condition, headers, row);
    if (conditionValue) {
      return conditionValue;
    }
    
    // 解析 else 部分
    if (rest.includes(':')) {
      const colonIndex = rest.indexOf(':');
      const elseValue = parseFieldMapping(rest.substring(0, colonIndex).trim(), headers, row);
      if (elseValue) {
        return elseValue;
      }
      // 使用默认值（可能是固定文字）
      return parseFieldMapping(rest.substring(colonIndex + 1).trim(), headers, row);
    }
    
    return parseFieldMapping(rest, headers, row);
  }
  
  // 3. 处理默认值（||）- 第三优先级
  if (expr.includes('||')) {
    const parts = expr.split('||').map(p => p.trim());
    if (parts.length >= 2) {
      const fieldValue = parseFieldMapping(parts[0], headers, row);
      if (fieldValue) {
        return fieldValue;
      }
      // 使用默认值
      return parseFieldMapping(parts.slice(1).join('||'), headers, row);
    }
  }
  
  // 4. 处理函数调用（:函数名）- 第四优先级，支持链式调用
  // 从右到左解析函数调用，以支持链式调用
  let currentExpr = expr;
  let result: string = '';
  
  // 检查是否包含函数调用
  while (currentExpr.includes(':')) {
    // 找到最后一个 : 的位置（避免与条件判断冲突）
    const lastColonIndex = currentExpr.lastIndexOf(':');
    if (lastColonIndex === -1) break;
    
    // 检查是否是函数调用格式 :函数名(参数)
    const afterColon = currentExpr.substring(lastColonIndex + 1);
    const funcMatch = afterColon.match(/^(\w+)\((.*?)\)(.*)$/);
    
    if (funcMatch) {
      const funcName = funcMatch[1].trim();
      const paramsStr = funcMatch[2].trim();
      const remaining = funcMatch[3].trim();
      
      // 解析参数
      const params: string[] = [];
      if (paramsStr) {
        // 简单解析参数（支持单引号包裹的字符串）
        let currentParam = '';
        let inQuotes = false;
        for (let i = 0; i < paramsStr.length; i++) {
          const char = paramsStr[i];
          if (char === "'" && (i === 0 || paramsStr[i - 1] !== "'")) {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            // 始终 push，保留空字符串或仅空格的参数（如 replace(' ','')）
            params.push(currentParam.trim());
            currentParam = '';
          } else {
            currentParam += char;
          }
        }
        params.push(currentParam.trim());
      }
      
      // 获取字段值（函数调用前的部分）
      const fieldPart = currentExpr.substring(0, lastColonIndex).trim();
      let value = fieldPart ? parseFieldMapping(fieldPart, headers, row) : result;
      
      // 应用函数
      switch (funcName) {
        case 'date': {
          if (params.length >= 1) {
            const format = params[0].replace(/^'|'$/g, '').replace(/''/g, "'");
            value = formatDate(value, format);
          }
          break;
        }
        case 'calc': {
          if (params.length >= 1) {
            const numValue = parseFloat(String(value).replace(/[^\d.-]/g, '')) || 0;
            const expression = params[0].replace(/^'|'$/g, '').replace(/''/g, "'");
            value = String(calculateValue(numValue, expression));
          }
          break;
        }
        default:
          value = applyStringFunction(value, funcName, params);
      }
      
      result = value;
      
      // 处理链式调用（剩余部分）
      if (remaining) {
        currentExpr = value + ':' + remaining;
      } else {
        break;
      }
    } else {
      // 不是函数调用，可能是普通字段名中的冒号，直接查找字段
      break;
    }
  }
  
  // 如果处理了函数调用，返回结果
  if (result) {
    return result;
  }
  
  // 5. 处理字段拼接（&）- 第五优先级
  if (expr.includes('&')) {
    const parts = expr.split('&').map(p => p.trim()).filter(p => p);
    const values: string[] = [];
    
    for (const part of parts) {
      // 检查是否是固定文字（单引号包裹）
      if (part.startsWith("'") && part.endsWith("'")) {
        const literal = part.slice(1, -1).replace(/''/g, "'");
        values.push(literal);
      } else {
        // 递归解析（可能是字段名或表达式）
        const value = parseFieldMapping(part, headers, row);
        if (value) {
          values.push(value);
        }
      }
    }
    
    return values.join('');
  }
  
  // 6. 处理单个字段 - 最后处理
  // 检查是否是固定文字
  if (expr.startsWith("'") && expr.endsWith("'")) {
    return expr.slice(1, -1).replace(/''/g, "'");
  }
  
  // 普通字段查找
  return getFieldValue(headers, row, expr);
}
