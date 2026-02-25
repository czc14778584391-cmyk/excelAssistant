/**
 * 分类数据项接口
 */
interface CategoricalDataItem {
  辅助: string;
  '收/支': string;
  '类型（一级）': string;
  '类型（二级）': string;
  '类型（三级）': string;
}

/**
 * 分类结果接口
 */
export interface CategoryMatchResult {
  category1: string;
  category2: string;
  category3: string;
  matched: boolean;
}

/**
 * 根据费用明细从分类数据中匹配分类
 * @param feeDetail - 费用明细
 * @param categoricalData - 分类数据数组
 * @returns CategoryMatchResult
 */
export function matchCategoryFromConfig(feeDetail: string, categoricalData: CategoricalDataItem[]): CategoryMatchResult {
  if (!feeDetail || !feeDetail.trim()) {
    return {
      category1: '',
      category2: '',
      category3: '',
      matched: false
    };
  }

  const normalizedFeeDetail = feeDetail.trim();
  const data = categoricalData;

  // 按"辅助"字段长度降序排序，优先匹配更长的模式
  const sortedData = [...data].sort((a, b) => {
    const lenA = (a.辅助 || '').length;
    const lenB = (b.辅助 || '').length;
    return lenB - lenA;
  });

  // 精确匹配：查找"辅助"字段完全匹配的项
  let exactMatch = sortedData.find(item => {
    const pattern = item.辅助?.trim();
    if (!pattern) return false;
    // 移除末尾的斜杠进行比较
    const normalizedPattern = pattern.replace(/\/+$/, '');
    return normalizedFeeDetail === normalizedPattern;
  });

  // 如果精确匹配失败，尝试部分匹配
  if (!exactMatch) {
    // 查找包含费用明细关键词的项
    exactMatch = sortedData.find(item => {
      const pattern = item.辅助?.trim();
      if (!pattern) return false;
      
      // 将"辅助"字段按斜杠分割，检查是否所有部分都在费用明细中
      const patternParts = pattern.split('/').filter(p => p.trim());
      if (patternParts.length === 0) return false;
      
      // 所有部分都必须在费用明细中
      return patternParts.every(part => normalizedFeeDetail.includes(part.trim()));
    });
  }

  if (exactMatch) {
    return {
      category1: String(exactMatch['类型（一级）'] || '').trim(),
      category2: String(exactMatch['类型（二级）'] || '').trim(),
      category3: String(exactMatch['类型（三级）'] || '').trim(),
      matched: true
    };
  }

  return {
    category1: '',
    category2: '',
    category3: '',
    matched: false
  };
}

/**
 * 批量匹配费用明细的分类
 * @param feeDetails - 费用明细数组（包含 id 和 费用明细字段）
 * @param categoricalData - 分类数据数组
 * @returns Array<{id: string, category1: string, category2: string, category3: string, matched: boolean}>
 */
export function batchMatchCategories(
  feeDetails: Array<{ id: string; 费用明细: string }>,
  categoricalData: CategoricalDataItem[]
): Array<{id: string, category1: string, category2: string, category3: string, matched: boolean}> {
  return feeDetails.map(item => {
    const matchResult = matchCategoryFromConfig(item.费用明细, categoricalData);
    return {
      id: item.id,
      category1: matchResult.category1,
      category2: matchResult.category2,
      category3: matchResult.category3,
      matched: matchResult.matched
    };
  });
}

/**
 * 获取所有可用的分类组合
 * @param categoricalData - 分类数据数组
 * @returns Array<{category1: string, category2: string, category3: string, '收/支': string}>
 */
export function getAllAvailableCategories(categoricalData: CategoricalDataItem[]): Array<{category1: string, category2: string, category3: string, '收/支': string}> {
  const data = categoricalData;
  const categorySet = new Set<string>();
  const categories: Array<{category1: string, category2: string, category3: string, '收/支': string}> = [];
  
  data.forEach(item => {
    const key = `${item['类型（一级）']}|${item['类型（二级）']}|${item['类型（三级）']}`;
    if (!categorySet.has(key)) {
      categorySet.add(key);
      categories.push({
        category1: String(item['类型（一级）'] || '').trim(),
        category2: String(item['类型（二级）'] || '').trim(),
        category3: String(item['类型（三级）'] || '').trim(),
        '收/支': String(item['收/支'] || '').trim()
      });
    }
  });
  
  return categories;
}

/**
 * 从可用分类中找到最匹配的分类
 * @param aiCategory1 - AI 返回的一级分类
 * @param aiCategory2 - AI 返回的二级分类
 * @param aiCategory3 - AI 返回的三级分类
 * @param categoricalData - 分类数据数组
 * @returns {category1: string, category2: string, category3: string} | null
 */
export function findBestMatchFromAvailableCategories(
  aiCategory1: string,
  aiCategory2: string,
  aiCategory3: string,
  categoricalData: CategoricalDataItem[]
): {category1: string, category2: string, category3: string} | null {
  const availableCategories = getAllAvailableCategories(categoricalData);
  
  // 精确匹配
  let match = availableCategories.find(cat => 
    cat.category1 === aiCategory1 && 
    cat.category2 === aiCategory2 && 
    cat.category3 === aiCategory3
  );
  
  if (match) return match;
  
  // 一级和二级匹配，三级可以为空
  match = availableCategories.find(cat => 
    cat.category1 === aiCategory1 && 
    cat.category2 === aiCategory2 && 
    (cat.category3 === '' || cat.category3 === aiCategory3)
  );
  
  if (match) return match;
  
  // 只匹配一级分类
  match = availableCategories.find(cat => 
    cat.category1 === aiCategory1 && 
    cat.category2 === '' && 
    cat.category3 === ''
  );
  
  if (match) return match;
  
  // 模糊匹配：找到一级分类相同，二级分类最接近的
  const sameLevel1 = availableCategories.filter(cat => cat.category1 === aiCategory1);
  if (sameLevel1.length > 0) {
    // 返回第一个匹配的一级分类（二级和三级为空或最接近）
    return sameLevel1[0];
  }
  
  return null;
}
