import * as XLSX from 'xlsx';
import { loadSummaryHeaders, getDefaultSummaryHeaders, loadFieldMapping, loadBankAccounts } from './configLoader';
import { parseFieldMapping } from './fieldMappingParser';

/**
 * 银行类型（从 fieldMapping.json 的 key 动态读取）
 */
export type BankType = string;

/**
 * 汇总表行数据接口
 */
export interface SummaryRow {
  [key: string]: string | number;
}

/**
 * 从配置中获取银行类型的字段列表
 * @param bankType - 银行类型
 * @param fieldMapping - 字段映射配置
 * @returns 该银行类型的字段列表（过滤掉空字符串）
 */
function getBankFieldsFromConfig(bankType: string, fieldMapping: Record<string, Record<string, string>>): string[] {
  const mapping = fieldMapping[bankType];
  if (!mapping) {
    return [];
  }
  
  // 提取所有映射值（原始 Excel 字段名），过滤掉空字符串
  return Object.values(mapping).filter((field: any) => field && field.trim() !== '') as string[];
}

/**
 * 检测银行类型
 * @param headers - Excel 表头数组
 * @param fieldMapping - 字段映射配置
 * @returns 检测到的银行类型，如果无法识别则返回 null
 */
export function detectBankType(headers: string[], fieldMapping: Record<string, Record<string, string>>): BankType | null {
  // 动态读取 fieldMapping 中的所有银行类型（key）
  const bankTypes = Object.keys(fieldMapping);
  
  if (bankTypes.length === 0) {
    return null;
  }
  
  // 计算每个银行类型的匹配度
  const bankMatches: Array<{ bankType: string; matchCount: number; threshold: number }> = [];
  
  for (const bankType of bankTypes) {
    const fields = getBankFieldsFromConfig(bankType, fieldMapping);
    const matchCount = headers.filter(h => fields.includes(h)).length;
    const threshold = Math.max(1, Math.ceil(fields.length / 2));
    
    bankMatches.push({ bankType, matchCount, threshold });
  }
  
  // 按匹配数量降序排序
  bankMatches.sort((a, b) => b.matchCount - a.matchCount);
  
  // 找到第一个满足阈值且匹配数量最高的银行类型
  const topMatch = bankMatches[0];
  if (topMatch && topMatch.matchCount >= topMatch.threshold) {
    return topMatch.bankType;
  }
  
  return null;
}

/**
 * 读取 Excel 文件
 * @param file - 文件对象
 * @param fieldMapping - 字段映射配置
 * @returns Promise<{ headers: string[], data: any[][], bankType: BankType | null }>
 */
export async function readExcelFile(file: File, fieldMapping: Record<string, Record<string, string>>): Promise<{ headers: string[], data: any[][], bankType: BankType | null }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // 读取第一个工作表
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // 转换为 JSON 格式
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
        
        if (jsonData.length === 0) {
          reject(new Error('Excel 文件为空'));
          return;
        }
        
        // 查找表头所在的行（最多查找前30行）
        const MAX_HEADER_SEARCH_ROWS = 30;
        let headerRowIndex = -1;
        let headers: string[] = [];
        let bankType: BankType | null = null;
        
        // 收集所有银行类型的所有字段映射值，用于匹配表头
        const allMappedFields = new Set<string>();
        Object.values(fieldMapping).forEach(mapping => {
          Object.values(mapping).forEach(field => {
            if (field && field.trim()) {
              allMappedFields.add(field.trim());
            }
          });
        });
        
        // 从前30行中查找表头
        for (let i = 0; i < Math.min(MAX_HEADER_SEARCH_ROWS, jsonData.length); i++) {
          const row = jsonData[i];
          const rowHeaders = row.map((h: any) => String(h).trim()).filter((h: string) => h);
          
          // 检查这一行是否包含足够的映射字段（至少匹配2个字段才认为是表头）
          const matchedFields = rowHeaders.filter(h => allMappedFields.has(h));
          
          if (matchedFields.length >= 2) {
            // 检测银行类型
            const detectedBankType = detectBankType(rowHeaders, fieldMapping);
            if (detectedBankType) {
              headerRowIndex = i;
              headers = rowHeaders;
              bankType = detectedBankType;
              break;
            }
          }
        }
        
        // 如果没找到表头，报错
        if (headerRowIndex === -1) {
          reject(new Error(`在前 ${MAX_HEADER_SEARCH_ROWS} 行中未找到有效的表头，无法识别银行类型`));
          return;
        }
        
        // 从表头行的下一行开始读取数据
        const dataRows = jsonData.slice(headerRowIndex + 1).filter(row => row.some(cell => cell !== ''));
        
        console.log(`文件 ${file.name}: 表头在第 ${headerRowIndex + 1} 行，银行类型=${bankType}，数据行数=${dataRows.length}`);
        
        resolve({ headers, data: dataRows, bankType });
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
 * 根据字段映射转换数据
 * @param headers - 原始表头
 * @param rowData - 原始行数据
 * @param bankType - 银行类型
 * @param summaryHeaders - 汇总表头数组
 * @returns 转换后的汇总表行数据
 */
export function mapRowData(
  headers: string[],
  rowData: any[],
  bankType: BankType | null,
  summaryHeaders: string[],
  fieldMapping: Record<string, Record<string, string>>
): SummaryRow {
  const summaryRow: SummaryRow = {};
  
  // 如果没有检测到银行类型，返回空对象
  if (!bankType) {
    return summaryRow;
  }
  
  // 获取该银行类型的字段映射
  const mapping = fieldMapping[bankType];
  if (!mapping) {
    return summaryRow;
  }
  
  // 创建表头到索引的映射（同时支持原始值和 trim 后的值）
  const headerIndexMap: { [key: string]: number } = {};
  headers.forEach((header, index) => {
    const trimmedHeader = header.trim();
    // 同时存储原始值和 trim 后的值，确保都能匹配
    headerIndexMap[header] = index;
    if (trimmedHeader !== header) {
      headerIndexMap[trimmedHeader] = index;
    }
  });
  
  /**
   * 查找字段在表头中的索引（支持 trim 匹配）
   * @param fieldName - 字段名
   * @returns 字段索引，如果不存在返回 -1
   */
  const findFieldIndex = (fieldName: string): number => {
    
    const trimmedField = fieldName.trim();
    // 先尝试精确匹配
    if (headerIndexMap.hasOwnProperty(fieldName)) {
      return headerIndexMap[fieldName];
    }
    // 再尝试 trim 后的匹配
    if (headerIndexMap.hasOwnProperty(trimmedField)) {
      return headerIndexMap[trimmedField];
    }
    // 最后尝试在 headers 中查找（忽略前后空格）
    const index = headers.findIndex(h => h.trim() === trimmedField);
    return index >= 0 ? index : -1;
  };
  
  // 根据映射关系填充汇总表数据
  summaryHeaders.forEach((summaryHeaderName) => {
    const sourceField = mapping[summaryHeaderName];
    
    if (!sourceField) {
      // 如果映射字段不存在，设置为空字符串
      summaryRow[summaryHeaderName] = '';
      return;
    }
    
    // 使用新的字段映射解析器处理映射表达式
    const parsedValue = parseFieldMapping(sourceField, headers, rowData);
    
    // 处理数值字段
    if (summaryHeaderName === '本期收入' || summaryHeaderName === '本期支出' || summaryHeaderName === '余额') {
      // 尝试转换为数字
      const numValue = typeof parsedValue === 'string' 
        ? parseFloat(parsedValue.replace(/[^\d.-]/g, '')) || 0
        : (typeof parsedValue === 'number' ? parsedValue : 0);
      summaryRow[summaryHeaderName] = numValue;
    } else {
      // 其他字段保持字符串
      summaryRow[summaryHeaderName] = parsedValue || '';
    }
  });
  
  return summaryRow;
}

/** 辅助列名：用于在未选择文件级银行账号时，从该列取值到 bankAccounts 中查找账号信息 */
const AUX_ACCOUNT_HEADER = '辅助copy原数据账号';

/**
 * 根据账号值在 bankAccounts 中查找账号信息（支持按 key 或 银行账户 匹配，账号会去掉空格后比较）
 * @param rawAccount - 原始账号字符串（如表格中「辅助copy原数据账号」列的值）
 * @param bankAccounts - 银行账号配置
 * @returns 匹配到的账号信息，未找到返回 null
 */
function findAccountInfoByRawAccount(
  rawAccount: string,
  bankAccounts: Record<string, any>
): { key: string; info: any } | null {
  const normalized = String(rawAccount || '').trim().replace(/\s+/g, '');
  if (!normalized) return null;
  if (bankAccounts[normalized]) return { key: normalized, info: bankAccounts[normalized] };
  const entry = Object.entries(bankAccounts).find(([, v]) => {
    const account = (v && v['银行账户']) != null ? String(v['银行账户']).trim().replace(/\s+/g, '') : '';
    return account === normalized;
  });
  return entry ? { key: entry[0], info: entry[1] } : null;
}

/**
 * 处理多个银行流水文件并生成汇总表
 * @param files - 文件列表
 * @param fileAccountMap - 文件与银行账号的映射关系 { fileName: bankAccount }，可不选；未选时按行用「辅助copy原数据账号」在 bankAccounts 中查找
 * @returns Promise<SummaryRow[]>
 */
export async function processBankFiles(files: File[], fileAccountMap: Record<string, string> = {}): Promise<SummaryRow[]> {
  const allSummaryRows: SummaryRow[] = [];
  
  const [summaryHeaders, fieldMapping, bankAccounts] = await Promise.all([
    loadSummaryHeaders(),
    loadFieldMapping(),
    loadBankAccounts()
  ]);

  for (const file of files) {
    try {
      const fileLevelAccountKey = fileAccountMap[file.name] || '';
      const useFileLevelAccount = Boolean(fileLevelAccountKey && bankAccounts[fileLevelAccountKey]);
      
      const { headers, data, bankType } = await readExcelFile(file, fieldMapping);
      
      if (!bankType) {
        console.warn(`无法识别文件 ${file.name} 的银行类型，跳过处理`);
        continue;
      }
      
      data.forEach((rowData) => {
        const summaryRow = mapRowData(headers, rowData, bankType, summaryHeaders, fieldMapping);
        
        let accountInfo: any = null;
        if (useFileLevelAccount) {
          accountInfo = bankAccounts[fileLevelAccountKey];
        } else {
          const rawAccount = summaryRow[AUX_ACCOUNT_HEADER];
          if (rawAccount != null && String(rawAccount).trim() !== '') {
            const found = findAccountInfoByRawAccount(String(rawAccount), bankAccounts);
            if (found) accountInfo = found.info;
          }
        }
        
        if (accountInfo) {
          if (accountInfo['公司主体']) summaryRow['公司主体'] = accountInfo['公司主体'];
          if (accountInfo['银行账户']) summaryRow['银行账户'] = accountInfo['银行账户'];
          if (accountInfo['币别']) summaryRow['币别'] = accountInfo['币别'];
          if (accountInfo['境内外资金']) summaryRow['境内外资金'] = accountInfo['境内外资金'];
        }
        
        if (Object.values(summaryRow).some(v => v !== '' && v !== 0)) {
          allSummaryRows.push(summaryRow);
        }
      });
    } catch (error) {
      console.error(`处理文件 ${file.name} 时出错:`, error);
      throw error;
    }
  }
  
  return allSummaryRows;
}

/**
 * 导出汇总表为 Excel 文件
 * @param data - 汇总表数据
 * @param filename - 文件名
 */
export async function exportToExcel(data: SummaryRow[], filename: string = '汇总表.xlsx'): Promise<void> {
  // 从用户数据目录加载汇总表表头
  const allHeaders = await loadSummaryHeaders();
  
  // 过滤掉"辅助copy原数据账号"列
  // const headers = allHeaders.filter(header => header !== '辅助copy原数据账号');
  
  // 空值（含数字 0）用 null，避免导出后显示为 0；sheetStubs 写出类型 z 的空白格
  const worksheetData = [
    allHeaders, // 表头
    ...data.map(row =>
      allHeaders.map(header => {
        const val = row[header];
        if (
          val === '' ||
          val === null ||
          val === undefined ||
          (typeof val === 'number' && val === 0)
        )
          return null;
        return val;
      })
    )
  ];
  
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData, { sheetStubs: true });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '汇总表');
  
  // 检查是否在 Electron 环境中
  const isElectron = window.appEnv?.isElectron;
  
  if (isElectron) {
    // Electron 环境：使用原生文件保存对话框
    try {
      const result = await window.electronAPI?.showSaveDialog({
        defaultPath: filename,
        filters: [
          { name: 'Excel 文件', extensions: ['xlsx'] },
          { name: '所有文件', extensions: ['*'] }
        ]
      });
      
      if (result && !result.canceled && result.filePath) {
        // 将工作簿转换为二进制数据
        const excelBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
        
        const writeResult = await window.electronAPI?.writeFile(result.filePath, excelBuffer);
        
        if (writeResult && writeResult.success) {
          console.log(`文件已保存到: ${result.filePath}`);
        } else {
          throw new Error(writeResult?.error || '保存文件失败');
        }
      }
    } catch (error) {
      console.error('保存文件失败:', error);
      // 如果 Electron API 失败，回退到浏览器方式
      XLSX.writeFile(workbook, filename);
    }
  } else {
    // 浏览器环境：直接下载到默认下载目录
    XLSX.writeFile(workbook, filename);
  }
}
