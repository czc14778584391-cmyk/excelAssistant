
import React, { useState, useEffect } from 'react';
import { ConfigTab } from '../types';
import { loadSummaryHeaders, getDefaultSummaryHeaders, loadCategoricalData, getDefaultCategoricalData, loadFieldMapping, getDefaultFieldMapping } from '../utils/configLoader';

const Config: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ConfigTab>('summaryHeader');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'mapping': return <MappingManager />;
      // case 'ai': return <AITemplateManager />;
      case 'dictionary': return <DictionaryManager />;
      case 'summaryHeader': return <SummaryHeaderManager />;
    }
  };

  /**
   * 打开配置目录
   */
  const handleOpenConfigDirectory = async () => {
    try {
      const isElectron = window.appEnv?.isElectron;
      if (!isElectron) {
        alert('此功能仅在 Electron 环境中可用');
        return;
      }

      // 获取用户数据目录路径
      const result = await window.electronAPI?.getAppPath('userData');
      if (result && result.success && result.path) {
        // 构建 config 目录路径
        const separator = result.path.includes('\\') ? '\\' : '/';
        const configDirPath = `${result.path}${separator}config`;
        
        // 直接打开配置目录
        const openResult = await window.electronAPI?.openPath(configDirPath);
        
        if (openResult && !openResult.success) {
          console.error('打开配置目录失败:', openResult.error);
          alert(`打开配置目录失败: ${openResult.error}`);
        } else if (!openResult) {
          console.error('showItemInFolder API 不可用');
          alert('打开配置目录功能不可用，请确保在 Electron 环境中运行');
        }
      } else {
        alert('无法获取用户数据目录路径');
      }
    } catch (error) {
      console.error('打开配置目录失败:', error);
      alert(`打开配置目录失败: ${error}`);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b sticky top-[10px] z-40 rounded-t-lg">
        <div className="flex px-4 items-center justify-between">
          <div className="flex">
            {([ 'summaryHeader','mapping', 'dictionary'] as ConfigTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-8 py-4 font-bold text-sm transition-all border-b-2 ${
                  activeTab === tab 
                    ? 'border-blue-600 text-blue-600' 
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                {tab === 'mapping' ? '字段映射' : tab === 'ai' ? 'AI分类规则' : tab === 'dictionary' ? '分类字典维护' : '汇总表头'}
              </button>
            ))}
          </div>
          <button
            onClick={handleOpenConfigDirectory}
            className="px-3 py-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors border border-blue-200"
            title="在文件管理器中打开配置文件目录"
          >
            批量设置配置文件
          </button>
        </div>
      </div>
      <div className="flex-1 bg-white rounded-b-lg border border-t-0 p-8 shadow-sm overflow-auto">
        {renderTabContent()}
      </div>
    </div>
  );
};

/**
 * 银行代码到展示名称的映射
 */
const BANK_NAME_MAP: Record<string, string> = {
  ChinaMerchantsBank: '招商银行',
  IndustrialAndCommercialBank: '工商银行',
};

/**
 * 字段映射模板管理
 * 从 config/fieldMapping.json 和 config/summaryHeader.json 读取数据进行展示
 */
const MappingManager = () => {
  const [bankMappings, setBankMappings] = useState<Record<string, Record<string, string>>>({});
  const [unifiedHeaders, setUnifiedHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  const bankKeys = Object.keys(bankMappings);
  const [activeBank, setActiveBank] = useState<string>(bankKeys[0] || '');

  /**
   * 从用户数据目录加载数据
   */
  const loadData = async () => {
    setLoading(true);
    try {
      // 并行加载字段映射和汇总表头
      const [loadedFieldMapping, loadedHeaders] = await Promise.all([
        loadFieldMapping(),
        loadSummaryHeaders()
      ]);
      
      setBankMappings(loadedFieldMapping);
      setUnifiedHeaders(loadedHeaders);
      
      // 更新选中的银行（如果当前选中的银行不存在，选择第一个）
      const newBankKeys = Object.keys(loadedFieldMapping);
      if (newBankKeys.length > 0 && (!activeBank || !newBankKeys.includes(activeBank))) {
        setActiveBank(newBankKeys[0]);
      }
      
      console.log('从本地文件加载字段映射:', Object.keys(loadedFieldMapping).length, '个银行');
    } catch (error) {
      console.error('加载字段映射数据失败:', error);
      // 出错时使用空数据
      setBankMappings({});
      setUnifiedHeaders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 获取配置文件路径（保存在用户数据目录）
   */
  const getConfigPath = async (): Promise<string | null> => {
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
  };

  /**
   * 打开配置文件
   */
  const handleOpenConfigFile = async () => {
    try {
      console.log('开始打开字段映射配置文件...');
      const configPath = await getConfigPath();
      console.log('字段映射配置文件路径:', configPath);
      
      if (!configPath) {
        alert('无法获取配置文件路径，请确保在 Electron 环境中运行');
        return;
      }
      
      const result = await window.electronAPI?.showItemInFolder(configPath);
      console.log('打开文件结果:', result);
      
      if (result && !result.success) {
        console.error('打开配置文件失败:', result.error);
        alert(`打开配置文件失败: ${result.error}`);
      } else if (!result) {
        console.error('showItemInFolder API 不可用');
        alert('打开配置文件功能不可用，请确保在 Electron 环境中运行');
      }
    } catch (error) {
      console.error('打开配置文件失败:', error);
      alert(`打开配置文件失败: ${error}`);
    }
  };

  /**
   * 刷新配置文件
   */
  const handleRefreshConfig = async () => {
    await loadData();
  };

  const currentMapping = activeBank ? bankMappings[activeBank] || {} : {};

  /**
   * 仅展示 fieldMapping.json 中真实存在的映射关系（值非空）。
   * 优先按 summaryHeader.json 的顺序输出；若 mapping 里存在但不在 summaryHeader 的键，则追加到末尾。
   */
  const mappingRows: Array<{ summaryField: string; sourceField: string }> = (() => {
    const normalize = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

    const inHeaderOrder = unifiedHeaders
      .map((summaryField) => ({
        summaryField,
        sourceField: normalize(currentMapping[summaryField]),
      }))
      .filter((row) => row.sourceField);

    const headerSet = new Set(unifiedHeaders);
    const extra = Object.entries(currentMapping)
      .map(([summaryField, sourceField]) => ({
        summaryField,
        sourceField: normalize(sourceField),
      }))
      .filter((row) => row.sourceField && !headerSet.has(row.summaryField));

    return [...inHeaderOrder, ...extra];
  })();

  if (loading) {
    return (
      <div className="w-full mt-[50px] flex items-center justify-center py-12">
        <div className="text-center">
          <div className="text-gray-400 mb-2">加载中...</div>
          <div className="text-xs text-gray-400">正在从本地文件读取数据</div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-8 h-full">
      {/* 左侧银行列表 */}
      <div className="col-span-3 border-r pr-6">
        <h3 className="text-sm font-bold text-gray-500 mb-4 uppercase">银行</h3>
        <div className="space-y-2">
          {bankKeys.map((key) => {
            const isActive = key === activeBank;
            const label = BANK_NAME_MAP[key] || key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveBank(key)}
                className={`w-full text-left p-3 rounded-lg border cursor-pointer transition-all ${
                  isActive
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-gray-50 border-gray-100 text-gray-700 hover:border-blue-300'
                }`}
              >
                <p className="text-sm font-bold">{label}</p>
                <p className="text-[11px] text-gray-400 mt-1 break-all">{key}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 右侧字段映射表 */}
      <div className="col-span-9">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="font-bold text-lg">
              字段映射：{BANK_NAME_MAP[activeBank] || activeBank || '未选择银行'}
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              左侧为汇总表统一字段，右侧为该银行原始字段名称
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshConfig}
              className="px-3 py-1.5 text-xs font-bold text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors border border-green-200"
              title="重新加载配置文件"
            >
              刷新配置
            </button>
            <button
              onClick={handleOpenConfigFile}
              className="px-3 py-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors border border-blue-200"
              title="在文件管理器中打开配置文件"
            >
              打开配置文件
            </button>
          </div>
        </div>
        <div className="border rounded overflow-hidden">
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3 text-left">汇总表头（统一字段）</th>
                  <th className="px-6 py-3 text-left">银行原始字段</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {mappingRows.length > 0 ? (
                  mappingRows.map((row) => (
                    <tr key={row.summaryField} className="hover:bg-gray-50">
                      <td className="px-6 py-3 font-bold text-gray-700 whitespace-nowrap">
                        {row.summaryField}
                      </td>
                      <td className="px-6 py-3 text-gray-700 whitespace-nowrap">{row.sourceField}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-6 py-6 text-center text-gray-400" colSpan={2}>
                      当前银行暂无可展示的映射关系
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};


/**
 * 分类字典数据项接口
 */
interface CategoryDataItem {
  辅助: string;
  辅助判断收支相同的对应的类型: string;
  '类型（一级）': string;
  '类型（二级）': string;
  '类型（三级）': string;
}

const DictionaryManager = () => {
  /**
   * 默认分类字典数据（从导入的 JSON 文件）
   */
  const defaultData = getDefaultCategoricalData() as CategoryDataItem[];
  
  const [data, setData] = useState<CategoryDataItem[]>(defaultData);
  /**
   * 搜索关键词
   */
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  /**
   * 加载状态
   */
  const [loading, setLoading] = useState<boolean>(true);

  /**
   * 从本地文件加载分类字典数据
   */
  const loadData = async () => {
    setLoading(true);
    try {
      const loadedData = await loadCategoricalData();
      setData(loadedData as CategoryDataItem[]);
      console.log('从本地文件加载分类字典:', loadedData.length, '条');
    } catch (error) {
      console.error('加载分类字典数据失败:', error);
      // 出错时使用默认数据
      setData(defaultData);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 组件挂载时从本地文件加载数据
   */
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 获取配置文件路径（保存在用户数据目录）
   */
  const getConfigPath = async (): Promise<string | null> => {
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
  };

  /**
   * 打开本地配置文件
   */
  const handleOpenConfigFile = async () => {
    try {
      console.log('开始打开分类字典配置文件...');
      const configPath = await getConfigPath();
      console.log('分类字典配置文件路径:', configPath);
      
      if (!configPath) {
        alert('无法获取配置文件路径，请确保在 Electron 环境中运行');
        return;
      }
      
      const result = await window.electronAPI?.showItemInFolder(configPath);
      console.log('打开文件结果:', result);
      
      if (result && !result.success) {
        console.error('打开配置文件失败:', result.error);
        alert(`打开配置文件失败: ${result.error}`);
      } else if (!result) {
        console.error('showItemInFolder API 不可用');
        alert('打开配置文件功能不可用，请确保在 Electron 环境中运行');
      }
    } catch (error) {
      console.error('打开配置文件失败:', error);
      alert(`打开配置文件失败: ${error}`);
    }
  };

  /**
   * 刷新配置文件
   */
  const handleRefreshConfig = async () => {
    await loadData();
  };

  /**
   * 根据搜索关键词过滤数据
   */
  const filteredData = data.filter((item) => {
    if (!searchKeyword.trim()) {
      return true;
    }
    const keyword = searchKeyword.trim().toLowerCase();
    // 安全地获取字段值，处理 undefined 和 null
    const safeGetValue = (value: any): string => {
      return value != null ? String(value).trim() : '';
    };
    
    return (
      safeGetValue(item.辅助).toLowerCase().includes(keyword) ||
      safeGetValue(item.辅助判断收支相同的对应的类型).toLowerCase().includes(keyword) ||
      safeGetValue(item['类型（一级）']).toLowerCase().includes(keyword) ||
      safeGetValue(item['类型（二级）']).toLowerCase().includes(keyword) ||
      safeGetValue(item['类型（三级）']).toLowerCase().includes(keyword)
    );
  });

  if (loading) {
    return (
      <div className="w-full mt-[50px] flex items-center justify-center py-12">
        <div className="text-center">
          <div className="text-gray-400 mb-2">加载中...</div>
          <div className="text-xs text-gray-400">正在从本地文件读取数据</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
       <div className="flex justify-between items-center mb-8">
         <div>
           <h3 className="font-bold text-lg">分类字典</h3>
           <p className="text-xs text-gray-500 mt-1">维护三级科目映射</p>
         </div>
         <div className="flex items-center gap-2">
           <button
             onClick={handleRefreshConfig}
             className="px-3 py-1.5 text-xs font-bold text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors border border-green-200"
             title="重新加载配置文件"
           >
             刷新配置
           </button>
           <button
             onClick={handleOpenConfigFile}
             className="px-3 py-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors border border-blue-200"
             title="在文件管理器中打开配置文件"
           >
             打开配置文件
           </button>
         </div>
       </div>
       
       {/* 搜索框 */}
       <div className="mb-6">
         <div className="relative">
           <input
             type="text"
             value={searchKeyword}
             onChange={(e) => setSearchKeyword(e.target.value)}
             placeholder="搜索分类字典（支持搜索所有字段）..."
             className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
           />
           <svg
             className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
             fill="none"
             stroke="currentColor"
             viewBox="0 0 24 24"
           >
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
           </svg>
           {searchKeyword && (
             <button
               onClick={() => setSearchKeyword('')}
               className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
               title="清除搜索"
             >
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
               </svg>
             </button>
           )}
         </div>
         {searchKeyword && (
           <div className="mt-2 text-xs text-gray-500">
             找到 {filteredData.length} 条匹配结果
           </div>
         )}
       </div>

       <div className="border rounded-lg overflow-hidden shadow-sm">
         <div className="overflow-x-auto">
           <div className="max-h-[60vh] overflow-y-auto">
             <table className="w-full text-sm">
               <thead className="bg-gray-100 sticky top-0 z-10">
               <tr>
                 <th className="px-6 py-3 text-left font-bold text-gray-700">辅助</th>
                 <th className="px-6 py-3 text-left font-bold text-gray-700">收/支</th>
                 <th className="px-6 py-3 text-left font-bold text-gray-700">类型（一级）</th>
                 <th className="px-6 py-3 text-left font-bold text-gray-700">类型（二级）</th>
                 <th className="px-6 py-3 text-left font-bold text-gray-700">类型（三级）</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-gray-200 bg-white">
               {filteredData.length === 0 ? (
                 <tr>
                   <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                     {searchKeyword ? '未找到匹配的分类数据' : '暂无数据'}
                   </td>
                 </tr>
               ) : (
                 filteredData.map((item, index) => (
                 <tr key={index} className="hover:bg-gray-50 transition-colors">
                   <td className="px-6 py-4 text-gray-700">{item.辅助}</td>
                   <td className="px-6 py-4 text-gray-500 text-xs">{item['收/支']}</td>
                   <td className="px-6 py-4 text-gray-700">{item['类型（一级）']}</td>
                   <td className="px-6 py-4 text-gray-700">{item['类型（二级）'] || '-'}</td>
                   <td className="px-6 py-4 text-gray-700">{item['类型（三级）'] || '-'}</td>
                 </tr>
                 ))
               )}
             </tbody>
             </table>
           </div>
         </div>
       </div>
    </div>
  );
};

/**
 * 汇总表头模板管理器
 */
const SummaryHeaderManager = () => {
  /**
   * 默认表头数据（从导入的 JSON 文件）
   */
  const defaultHeaders = getDefaultSummaryHeaders();
  
  /**
   * 表头列表状态
   */
  const [headers, setHeaders] = useState<string[]>(defaultHeaders);
  /**
   * 新增表头输入框的值
   */
  const [newHeaderValue, setNewHeaderValue] = useState<string>('');
  /**
   * 正在编辑的表头索引
   */
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  /**
   * 编辑中的表头值
   */
  const [editingValue, setEditingValue] = useState<string>('');
  /**
   * 保存状态提示
   */
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  /**
   * 加载状态
   */
  const [loading, setLoading] = useState<boolean>(true);

  /**
   * 获取配置文件路径（保存在用户数据目录）
   */
  const getConfigPath = async (): Promise<string | null> => {
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
  };

  /**
   * 从本地文件加载表头数据
   */
  const loadHeaders = async () => {
    setLoading(true);
    try {
      const configPath = await getConfigPath();
      if (configPath) {
        const result = await window.electronAPI?.readJson(configPath);
        if (result && result.success && Array.isArray(result.data)) {
          // 成功读取本地文件，使用文件中的数据
          const loadedHeaders = result.data.filter((h: any) => typeof h === 'string' && h.trim());
          setHeaders(loadedHeaders.length > 0 ? loadedHeaders : defaultHeaders);
          console.log('从本地文件加载表头:', loadedHeaders.length, '个');
        } else if (result && (result as any).notFound) {
          // 文件不存在，使用默认数据（首次使用）
          console.log('配置文件不存在，使用默认数据');
          setHeaders(defaultHeaders);
        } else {
          // 读取失败（其他错误），使用默认数据
          console.warn('读取本地配置文件失败，使用默认数据:', result?.error);
          setHeaders(defaultHeaders);
        }
      } else {
        // 非 Electron 环境或无法获取路径，使用默认数据
        setHeaders(defaultHeaders);
      }
    } catch (error) {
      console.error('加载表头数据失败:', error);
      // 出错时使用默认数据
      setHeaders(defaultHeaders);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 组件挂载时从本地文件加载数据
   */
  useEffect(() => {
    loadHeaders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 保存表头到 JSON 文件
   * @param headersToSave - 要保存的表头数组，如果不提供则使用当前 state 中的 headers
   */
  const saveHeaders = async (headersToSave?: string[]) => {
    setSaveStatus('saving');
    try {
      const configPath = await getConfigPath();
      if (!configPath) {
        console.error('无法获取配置文件路径');
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 2000);
        return;
      }

      // 使用传入的 headersToSave，如果没有则使用当前的 headers state
      const headersToWrite = headersToSave !== undefined ? headersToSave : headers;
      console.log('保存表头到:', configPath, '数量:', headersToWrite.length);
      const result = await window.electronAPI?.writeJson(configPath, headersToWrite);
      if (result && result.success) {
        console.log('保存成功');
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        console.error('保存失败:', result?.error);
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 2000);
      }
    } catch (error) {
      console.error('保存表头失败:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  /**
   * 添加新表头
   */
  const handleAddHeader = () => {
    const trimmedValue = newHeaderValue.trim();
    if (!trimmedValue) {
      alert('请输入表头名称');
      return; // 空值不处理
    }
    
    // 检查是否已存在
    if (headers.includes(trimmedValue)) {
      alert(`表头 "${trimmedValue}" 已存在，请使用其他名称`);
      return;
    }
    
    // 添加新表头
    const newHeaders = [...headers, trimmedValue];
    setHeaders(newHeaders);
    setNewHeaderValue(''); // 清空输入框
    // 传递新的 headers 数组，确保保存的是最新值
    saveHeaders(newHeaders);
  };

  /**
   * 删除表头
   */
  const handleDeleteHeader = (index: number) => {
    const newHeaders = headers.filter((_, i) => i !== index);
    setHeaders(newHeaders);
    // 传递新的 headers 数组，确保保存的是最新值
    saveHeaders(newHeaders);
  };

  /**
   * 开始编辑表头
   */
  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditingValue(headers[index]);
  };

  /**
   * 保存编辑
   */
  const handleSaveEdit = () => {
    if (editingIndex !== null) {
      const trimmedValue = editingValue.trim();
      if (trimmedValue && !headers.some((h, i) => i !== editingIndex && h === trimmedValue)) {
        const newHeaders = [...headers];
        newHeaders[editingIndex] = trimmedValue;
        setHeaders(newHeaders);
        setEditingIndex(null);
        setEditingValue('');
        // 传递新的 headers 数组，确保保存的是最新值
        saveHeaders(newHeaders);
      }
    }
  };

  /**
   * 取消编辑
   */
  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingValue('');
  };

  /**
   * 上移表头
   */
  const handleMoveUp = (index: number) => {
    if (index === 0) return; // 已经在最顶部
    const newHeaders = [...headers];
    [newHeaders[index - 1], newHeaders[index]] = [newHeaders[index], newHeaders[index - 1]];
    setHeaders(newHeaders);
    saveHeaders(newHeaders);
  };

  /**
   * 下移表头
   */
  const handleMoveDown = (index: number) => {
    if (index === headers.length - 1) return; // 已经在最底部
    const newHeaders = [...headers];
    [newHeaders[index], newHeaders[index + 1]] = [newHeaders[index + 1], newHeaders[index]];
    setHeaders(newHeaders);
    saveHeaders(newHeaders);
  };

  /**
   * 打开本地配置文件
   */
  const handleOpenConfigFile = async () => {
    try {
      console.log('开始打开汇总表头配置文件...');
      const configPath = await getConfigPath();
      console.log('汇总表头配置文件路径:', configPath);
      
      if (!configPath) {
        alert('无法获取配置文件路径，请确保在 Electron 环境中运行');
        return;
      }
      
      const result = await window.electronAPI?.showItemInFolder(configPath);
      console.log('打开文件结果:', result);
      
      if (result && !result.success) {
        console.error('打开配置文件失败:', result.error);
        alert(`打开配置文件失败: ${result.error}`);
      } else if (!result) {
        console.error('showItemInFolder API 不可用');
        alert('打开配置文件功能不可用，请确保在 Electron 环境中运行');
      }
    } catch (error) {
      console.error('打开配置文件失败:', error);
      alert(`打开配置文件失败: ${error}`);
    }
  };

  /**
   * 刷新配置文件
   */
  const handleRefreshConfig = async () => {
    await loadHeaders();
  };

  if (loading) {
    return (
      <div className="w-full mt-[50px] flex items-center justify-center py-12">
        <div className="text-center">
          <div className="text-gray-400 mb-2">加载中...</div>
          <div className="text-xs text-gray-400">正在从本地文件读取数据</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h3 className="font-bold text-lg">汇总表头</h3>
          <p className="text-xs text-gray-500 mt-1">管理汇总表的表头字段，支持添加、删除和编辑。</p>
        </div>
        <div className="flex items-center gap-4">
          {saveStatus === 'saving' && (
            <span className="text-xs text-blue-500">保存中...</span>
          )}
          {saveStatus === 'success' && (
            <span className="text-xs text-green-500">保存成功</span>
          )}
          {saveStatus === 'error' && (
            <span className="text-xs text-red-500">保存失败</span>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshConfig}
              className="px-3 py-1.5 text-xs font-bold text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors border border-green-200"
              title="重新加载配置文件"
            >
              刷新配置
            </button>
            <button
              onClick={handleOpenConfigFile}
              className="px-3 py-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors border border-blue-200"
              title="在文件管理器中打开配置文件"
            >
              打开配置文件
            </button>
          </div>
        </div>
      </div>

      {/* 添加表头输入框 */}
      {/* <div className="mb-6 flex gap-2">
        <input
          type="text"
          value={newHeaderValue}
          onChange={(e) => setNewHeaderValue(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleAddHeader();
            }
          }}
          placeholder="输入新表头名称"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleAddHeader}
          disabled={!newHeaderValue.trim()}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          title={!newHeaderValue.trim() ? '请输入表头名称' : '点击添加表头'}
        >
          + 添加表头
        </button>
      </div> */}

      {/* 表头列表 */}
      <div className="border rounded-lg overflow-hidden shadow-sm">
        {headers.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400">
            <p>暂无表头，请添加表头</p>
          </div>
        ) : (
          <>
            {/* 表头预览表格 */}
            <div className="overflow-x-auto">
              <div className="max-h-[40vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 sticky top-0 z-10">
                    <tr>
                      {headers.map((h, i) => (
                        <th key={`${h}-${i}`} className="px-4 py-3 text-left font-bold text-gray-700 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    <tr>
                      {headers.map((_, i) => (
                        <td key={i} className="px-4 py-4 text-gray-300 whitespace-nowrap">
                          —
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* 表头管理列表 */}
            {/* <div className="border-t bg-gray-50">
              <div className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">表头管理</div>
              <div className="max-h-[30vh] overflow-y-auto">
                <div className="divide-y divide-gray-200">
                  {headers.map((h, i) => (
                    <div key={`${h}-${i}`} className="px-4 py-3 hover:bg-white transition-colors flex items-center justify-between">
                      {editingIndex === i ? (
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            type="text"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveEdit();
                              } else if (e.key === 'Escape') {
                                handleCancelEdit();
                              }
                            }}
                            autoFocus
                            className="flex-1 px-3 py-2 border border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          />
                          <button
                            onClick={handleSaveEdit}
                            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors"
                          >
                            保存
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-300 transition-colors"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1 flex items-center gap-3">
                            <span className="text-sm font-medium text-gray-700">{h}</span>
                            <span className="text-xs text-gray-400">位置: {i + 1}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleMoveUp(i)}
                                disabled={i === 0}
                                className="px-3 py-1.5 text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded text-xs font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                title="上移"
                              >
                                上移
                              </button>
                              <button
                                onClick={() => handleMoveDown(i)}
                                disabled={i === headers.length - 1}
                                className="px-3 py-1.5 text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded text-xs font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                title="下移"
                              >
                                下移
                              </button>
                            </div>
                            <button
                              onClick={() => handleStartEdit(i)}
                              className="px-3 py-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded text-xs font-bold transition-colors"
                              title="编辑"
                            >
                              编辑
                            </button>
                            <button
                              onClick={() => handleDeleteHeader(i)}
                              className="px-3 py-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 rounded text-xs font-bold transition-colors"
                              title="删除"
                            >
                              删除
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div> */}
          </>
        )}
      </div>
    </div>
  );
};

export default Config;
