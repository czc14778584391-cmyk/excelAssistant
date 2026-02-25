// 不再使用默认数据，所有数据都从用户数据目录读取

/**
 * 获取配置文件路径（保存在用户数据目录）
 */
async function getConfigPath(): Promise<string | null> {
  const isElectron = window.appEnv?.isElectron;
  if (isElectron) {
    try {
      // 获取用户数据目录路径
      const result = await window.electronAPI?.getAppPath('userData');
      if (result && result.success && result.path) {
        // 使用 path.join 的替代方案（在渲染进程中不能直接使用 path 模块）
        const separator = result.path.includes('\\') ? '\\' : '/';
        return `${result.path}${separator}config${separator}summaryHeader.json`;
      }
    } catch (error) {
      console.error('获取用户数据目录路径失败:', error);
    }
  }
  // 浏览器环境：无法直接保存，仅提示
  return null;
}

/**
 * 从用户数据目录读取汇总表头配置
 * 如果文件不存在或读取失败，返回空数组
 * @returns Promise<string[]> 表头数组
 */
export async function loadSummaryHeaders(): Promise<string[]> {
  try {
    const configPath = await getConfigPath();
    if (configPath) {
      const result = await window.electronAPI?.readJson(configPath);
      if (result && result.success && Array.isArray(result.data)) {
        // 成功读取本地文件，使用文件中的数据
        const loadedHeaders = result.data.filter((h: any) => typeof h === 'string' && h.trim());
        return loadedHeaders;
      }
    }
  } catch (error) {
    console.error('读取汇总表头配置失败:', error);
  }
  
  // 读取失败或文件不存在，返回空数组
  return [];
}

/**
 * 同步获取汇总表头（用于非异步场景，返回空数组）
 * 注意：此函数返回空数组，如果需要用户自定义数据，请使用 loadSummaryHeaders
 * @returns string[] 空表头数组
 */
export function getDefaultSummaryHeaders(): string[] {
  return [];
}

/**
 * 获取分类字典配置文件路径（保存在用户数据目录）
 */
async function getCategoricalDataPath(): Promise<string | null> {
  const isElectron = window.appEnv?.isElectron;
  if (isElectron) {
    try {
      // 获取用户数据目录路径
      const result = await window.electronAPI?.getAppPath('userData');
      if (result && result.success && result.path) {
        // 使用 path.join 的替代方案（在渲染进程中不能直接使用 path 模块）
        const separator = result.path.includes('\\') ? '\\' : '/';
        return `${result.path}${separator}config${separator}categoricalData.json`;
      }
    } catch (error) {
      console.error('获取用户数据目录路径失败:', error);
    }
  }
  // 浏览器环境：无法直接保存，仅提示
  return null;
}

/**
 * 从用户数据目录读取分类字典配置
 * 如果文件不存在或读取失败，返回空数组
 * @returns Promise<any[]> 分类字典数组
 */
export async function loadCategoricalData(): Promise<any[]> {
  try {
    const configPath = await getCategoricalDataPath();
    if (configPath) {
      const result = await window.electronAPI?.readJson(configPath);
      if (result && result.success && Array.isArray(result.data)) {
        // 成功读取本地文件，使用文件中的数据
        return result.data;
      }
    }
  } catch (error) {
    console.error('读取分类字典配置失败:', error);
  }
  
  // 读取失败或文件不存在，返回空数组
  return [];
}

/**
 * 同步获取分类字典（用于非异步场景，返回空数组）
 * 注意：此函数返回空数组，如果需要用户自定义数据，请使用 loadCategoricalData
 * @returns any[] 空分类字典数组
 */
export function getDefaultCategoricalData(): any[] {
  return [];
}

/**
 * 获取字段映射配置文件路径（保存在用户数据目录）
 */
async function getFieldMappingPath(): Promise<string | null> {
  const isElectron = window.appEnv?.isElectron;
  if (isElectron) {
    try {
      // 获取用户数据目录路径
      const result = await window.electronAPI?.getAppPath('userData');
      if (result && result.success && result.path) {
        // 使用 path.join 的替代方案（在渲染进程中不能直接使用 path 模块）
        const separator = result.path.includes('\\') ? '\\' : '/';
        return `${result.path}${separator}config${separator}fieldMapping.json`;
      }
    } catch (error) {
      console.error('获取用户数据目录路径失败:', error);
    }
  }
  // 浏览器环境：无法直接保存，仅提示
  return null;
}

/**
 * 从用户数据目录读取字段映射配置
 * 如果文件不存在或读取失败，返回空对象
 * @returns Promise<Record<string, Record<string, string>>> 字段映射对象
 */
export async function loadFieldMapping(): Promise<Record<string, Record<string, string>>> {
  try {
    const configPath = await getFieldMappingPath();
    if (configPath) {
      const result = await window.electronAPI?.readJson(configPath);
      if (result && result.success && result.data && typeof result.data === 'object') {
        // 成功读取本地文件，使用文件中的数据
        return result.data as Record<string, Record<string, string>>;
      }
    }
  } catch (error) {
    console.error('读取字段映射配置失败:', error);
  }
  
  // 读取失败或文件不存在，返回空对象
  return {};
}

/**
 * 同步获取字段映射（用于非异步场景，返回空对象）
 * 注意：此函数返回空对象，如果需要用户自定义数据，请使用 loadFieldMapping
 * @returns Record<string, Record<string, string>> 空字段映射对象
 */
export function getDefaultFieldMapping(): Record<string, Record<string, string>> {
  return {};
}

/**
 * 获取银行账号配置文件路径（保存在用户数据目录）
 */
async function getBankAccountPath(): Promise<string | null> {
  const isElectron = window.appEnv?.isElectron;
  if (isElectron) {
    try {
      // 获取用户数据目录路径
      const result = await window.electronAPI?.getAppPath('userData');
      if (result && result.success && result.path) {
        // 使用 path.join 的替代方案（在渲染进程中不能直接使用 path 模块）
        const separator = result.path.includes('\\') ? '\\' : '/';
        return `${result.path}${separator}config${separator}backAccount.json`;
      }
    } catch (error) {
      console.error('获取用户数据目录路径失败:', error);
    }
  }
  // 浏览器环境：无法直接保存，仅提示
  return null;
}

/**
 * 从用户数据目录读取银行账号配置
 * 如果文件不存在或读取失败，返回空对象
 * @returns Promise<Record<string, any>> 银行账号配置对象
 */
export async function loadBankAccounts(): Promise<Record<string, any>> {
  try {
    const configPath = await getBankAccountPath();
    if (configPath) {
      const result = await window.electronAPI?.readJson(configPath);
      if (result && result.success && result.data && typeof result.data === 'object') {
        // 成功读取本地文件，使用文件中的数据
        return result.data as Record<string, any>;
      }
    }
  } catch (error) {
    console.error('读取银行账号配置失败:', error);
  }
  
  // 读取失败或文件不存在，返回空对象
  return {};
}
