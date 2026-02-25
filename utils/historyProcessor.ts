import * as XLSX from 'xlsx';

/**
 * 历史分类数据接口
 */
export interface HistoryCategoryData {
  费用明细: string;
  '类型（一级）': string;
  '类型（二级）': string;
  '类型（三级）': string;
  [key: string]: any; // 允许其他字段
}

/**
 * 从 Excel 文件读取历史分类数据
 * @param file - Excel 文件
 * @returns Promise<HistoryCategoryData[]>
 */
export async function readHistoryExcelFile(file: File): Promise<HistoryCategoryData[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // 读取第一个工作表
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // 转换为 JSON 格式，第一行作为表头
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as any[];
        
        // 查找费用明细和类型列
        const result: HistoryCategoryData[] = [];
        
        jsonData.forEach((row: any) => {
          // 尝试匹配不同的列名
          const feeDetail = row['费用明细'] || row['摘要'] || row['费用'] || row['明细'] || '';
          const category1 = row['类型（一级）'] || row['一级分类'] || row['一级'] || '';
          const category2 = row['类型（二级）'] || row['二级分类'] || row['二级'] || '';
          const category3 = row['类型（三级）'] || row['三级分类'] || row['三级'] || '';
          
          if (feeDetail) {
            result.push({
              费用明细: String(feeDetail).trim(),
              '类型（一级）': String(category1).trim(),
              '类型（二级）': String(category2).trim(),
              '类型（三级）': String(category3).trim()
            });
          }
        });
        
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('读取文件失败'));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

/**
 * 从 JSON 文件读取历史分类数据
 * @param file - JSON 文件
 * @returns Promise<HistoryCategoryData[]>
 */
export async function readHistoryJsonFile(file: File): Promise<HistoryCategoryData[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const jsonData = JSON.parse(text);
        
        // 处理数组格式
        if (Array.isArray(jsonData)) {
          const result: HistoryCategoryData[] = jsonData.map((item: any) => ({
            费用明细: String(item['费用明细'] || item['摘要'] || item['费用'] || '').trim(),
            '类型（一级）': String(item['类型（一级）'] || item['一级分类'] || '').trim(),
            '类型（二级）': String(item['类型（二级）'] || item['二级分类'] || '').trim(),
            '类型（三级）': String(item['类型（三级）'] || item['三级分类'] || '').trim()
          })).filter((item: HistoryCategoryData) => item.费用明细);
          
          resolve(result);
        } else {
          reject(new Error('JSON 文件格式错误：应为数组格式'));
        }
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('读取文件失败'));
    };
    
    reader.readAsText(file);
  });
}

/**
 * 从分类数据配置读取历史分类数据
 * @param categoricalData - 分类数据数组
 * @returns HistoryCategoryData[]
 */
export function getCategoricalDataFromConfig(categoricalData: any[]): HistoryCategoryData[] {
  return categoricalData.map((item: any) => ({
    费用明细: String(item['费用明细'] || item['辅助'] || '').trim(),
    '类型（一级）': String(item['类型（一级）'] || '').trim(),
    '类型（二级）': String(item['类型（二级）'] || '').trim(),
    '类型（三级）': String(item['类型（三级）'] || '').trim()
  })).filter((item: HistoryCategoryData) => item.费用明细);
}

/**
 * 处理多个历史分类文件
 * @param files - 文件列表
 * @returns Promise<HistoryCategoryData[]>
 */
export async function processHistoryFiles(files: File[]): Promise<HistoryCategoryData[]> {
  const allData: HistoryCategoryData[] = [];
  
  for (const file of files) {
    try {
      let fileData: HistoryCategoryData[] = [];
      
      if (file.name.endsWith('.json')) {
        fileData = await readHistoryJsonFile(file);
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        fileData = await readHistoryExcelFile(file);
      } else {
        console.warn(`不支持的文件类型: ${file.name}`);
        continue;
      }
      
      allData.push(...fileData);
    } catch (error) {
      console.error(`处理文件 ${file.name} 时出错:`, error);
      throw error;
    }
  }
  
  // 添加配置中的分类数据
  // const configData = getCategoricalDataFromConfig();
  // allData.push(...configData);
  
  // 去重：基于费用明细和分类组合
  const uniqueData = new Map<string, HistoryCategoryData>();
  allData.forEach(item => {
    const key = `${item.费用明细}|${item['类型（一级）']}|${item['类型（二级）']}|${item['类型（三级）']}`;
    if (!uniqueData.has(key)) {
      uniqueData.set(key, item);
    }
  });
  
  return Array.from(uniqueData.values());
}
