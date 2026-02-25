import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ToolType, BankFile, EntityMapping, MappingRule } from '../types';
import { INITIAL_ENTITY_MAPPINGS, INITIAL_MAPPINGS } from '../constants';
import { loadBankAccounts } from '../utils/configLoader';
import { readExcelFile } from '../utils/excelProcessor';
import { parseFieldMapping } from '../utils/fieldMappingParser';
import { getBankLocation, getBankLocationsBatch } from '../services/zhipuService';
import * as XLSX from 'xlsx';

interface MultiToolProps {
  toolType: ToolType;
}

/**
 * 生成多表配置类型
 * 键为表格名称，值为字段映射（目标字段名 -> 源字段名）
 */
type GenerateMultipleConfig = Record<string, Record<string, string>>;

/**
 * 生成单表配置类型（多表合规化合并使用）
 * 键为表格名称，值为字段映射（目标字段名 -> 源字段名）
 */
type GenerateSingleConfig = Record<string, Record<string, string>>;

const MultiTool: React.FC<MultiToolProps> = ({ toolType }) => {
  const activeTool = toolType;
  const [files, setFiles] = useState<BankFile[]>([]);
  const [entityMappings, setEntityMappings] = useState<EntityMapping[]>(
    INITIAL_ENTITY_MAPPINGS
  );
  const [globalMappings, setGlobalMappings] =
    useState<MappingRule[]>(INITIAL_MAPPINGS);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [generateMultipleConfig, setGenerateMultipleConfig] =
    useState<GenerateMultipleConfig>({});
  const [generateSingleConfig, setGenerateSingleConfig] =
    useState<GenerateSingleConfig>({});
  const [selectedConfigNames, setSelectedConfigNames] = useState<string[]>([]);
  const [selectedSingleConfigName, setSelectedSingleConfigName] =
    useState<string>('');
  const [showEntityTableMapping, setShowEntityTableMapping] = useState(false);
  const [entityTableMapping, setEntityTableMapping] = useState<
    Record<string, string[]>
  >({});
  const [generatedTables, setGeneratedTables] = useState<
    Record<string, any[][]>
  >({});
  const [showPreview, setShowPreview] = useState(false);
  const [previewTableName, setPreviewTableName] = useState<string>('');
  const [showTableSelector, setShowTableSelector] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  /** 当前文件 id 列表，用于 useEffect 中异步读表头完成后判断是否仍有效 */
  const fileIdsRef = useRef<string[]>([]);

  /** 按文件 id 存储每个文件读取到的表头（用于去重列选择） */
  const [headersByFileId, setHeadersByFileId] = useState<Record<string, string[]>>({});
  /** 按文件 id 存储用户为该文件勾选的去重列 */
  const [dedupHeaderNamesByFileId, setDedupHeaderNamesByFileId] = useState<Record<string, string[]>>({});
  /** 按文件 id 标记该文件是否正在读表头 */
  const [headersLoadingByFileId, setHeadersLoadingByFileId] = useState<Record<string, boolean>>({});
  /** 当前展开的去重列下拉对应的文件 id，用于点击外部关闭 */
  const [openDedupFileId, setOpenDedupFileId] = useState<string | null>(null);
  /** 下拉框相对于 body 的定位（trigger 的 getBoundingClientRect 结果） */
  const [dedupDropdownRect, setDedupDropdownRect] = useState<{ left: number; top: number; width: number } | null>(null);
  const dedupDropdownRef = useRef<HTMLDivElement>(null);
  const dedupPortalRef = useRef<HTMLDivElement>(null);

  /**
   * 获取生成多表配置文件路径
   */
  const getGenerateMultipleConfigPath = async (): Promise<string | null> => {
    const isElectron = window.appEnv?.isElectron;
    if (isElectron) {
      try {
        // 获取用户数据目录路径
        const result = await window.electronAPI?.getAppPath('userData');
        if (result && result.success && result.path) {
          // 使用 path.join 的替代方案（在渲染进程中不能直接使用 path 模块）
          const separator = result.path.includes('\\') ? '\\' : '/';
          return `${result.path}${separator}config${separator}generateMultiple.json`;
        }
      } catch (error) {
        console.error('获取用户数据目录路径失败:', error);
      }
    }
    // 浏览器环境：无法直接保存，仅提示
    return null;
  };

  /**
   * 从用户数据目录读取生成多表配置
   * 如果文件不存在或读取失败，返回空对象
   */
  const loadGenerateMultipleConfig =
    async (): Promise<GenerateMultipleConfig> => {
      try {
        const configPath = await getGenerateMultipleConfigPath();
        if (configPath) {
          const result = await window.electronAPI?.readJson(configPath);
          if (
            result &&
            result.success &&
            result.data &&
            typeof result.data === 'object'
          ) {
            // 成功读取本地文件，使用文件中的数据
            return result.data as GenerateMultipleConfig;
          }
        }
      } catch (error) {
        console.error('读取生成多表配置失败:', error);
      }

      // 读取失败或文件不存在，返回空对象
      return {};
    };

  /**
   * 获取生成单表配置文件路径（多表合规化合并使用）
   */
  const getGenerateSingleConfigPath = async (): Promise<string | null> => {
    const isElectron = window.appEnv?.isElectron;
    if (isElectron) {
      try {
        // 获取用户数据目录路径
        const result = await window.electronAPI?.getAppPath('userData');
        if (result && result.success && result.path) {
          // 使用 path.join 的替代方案（在渲染进程中不能直接使用 path 模块）
          const separator = result.path.includes('\\') ? '\\' : '/';
          return `${result.path}${separator}config${separator}generateSingle.json`;
        }
      } catch (error) {
        console.error('获取用户数据目录路径失败:', error);
      }
    }
    // 浏览器环境：无法直接保存，仅提示
    return null;
  };

  /**
   * 从用户数据目录读取生成单表配置
   * 如果文件不存在或读取失败，返回空对象
   */
  const loadGenerateSingleConfig = async (): Promise<GenerateSingleConfig> => {
    try {
      const configPath = await getGenerateSingleConfigPath();
      if (configPath) {
        const result = await window.electronAPI?.readJson(configPath);
        if (
          result &&
          result.success &&
          result.data &&
          typeof result.data === 'object'
        ) {
          // 成功读取本地文件，使用文件中的数据
          return result.data as GenerateSingleConfig;
        }
      }
    } catch (error) {
      console.error('读取生成单表配置失败:', error);
    }

    // 读取失败或文件不存在，返回空对象
    return {};
  };

  /**
   * 打开配置文件
   */
  const handleOpenConfigFile = async () => {
    try {
      const isElectron = window.appEnv?.isElectron;
      if (!isElectron) {
        alert('打开配置文件功能仅在 Electron 环境中可用');
        return;
      }

      let configPath: string | null = null;
      if (activeTool === 'split') {
        configPath = await getGenerateMultipleConfigPath();
      } else {
        configPath = await getGenerateSingleConfigPath();
      }

      if (!configPath) {
        alert('无法获取配置文件路径');
        return;
      }

      const result = await window.electronAPI?.showItemInFolder(configPath);
      if (result && !result.success) {
        alert(`打开配置文件失败: ${result.error}`);
      }
    } catch (error) {
      console.error('打开配置文件失败:', error);
      alert(
        `打开配置文件失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  };

  /**
   * 刷新配置文件
   */
  const handleRefreshConfig = async () => {
    try {
      if (activeTool === 'split') {
        const config = await loadGenerateMultipleConfig();
        setGenerateMultipleConfig(config);
        const configKeys = Object.keys(config);
        if (configKeys.length > 0) {
          // 保持当前选中的配置，如果当前选中的配置不存在，则选择所有配置
          const validSelected = selectedConfigNames.filter((name) =>
            configKeys.includes(name)
          );
          if (validSelected.length > 0) {
            setSelectedConfigNames(validSelected);
          } else {
            setSelectedConfigNames(configKeys);
          }
          addLog('配置刷新成功');
        } else {
          setSelectedConfigNames([]);
          addLog('配置刷新成功（配置文件为空）');
        }
      } else {
        const config = await loadGenerateSingleConfig();
        setGenerateSingleConfig(config);
        const configKeys = Object.keys(config);
        if (configKeys.length > 0) {
          // 如果当前选中的配置不存在，则选择第一个配置
          if (
            !selectedSingleConfigName ||
            !configKeys.includes(selectedSingleConfigName)
          ) {
            setSelectedSingleConfigName(configKeys[0]);
          }
          addLog('配置刷新成功');
        } else {
          setSelectedSingleConfigName('');
          addLog('配置刷新成功（配置文件为空）');
        }
      }
    } catch (error) {
      console.error('刷新配置失败:', error);
      addLog(
        `刷新配置失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  };

  /**
   * 组件加载时读取配置文件
   */
  useEffect(() => {
    if (activeTool === 'split') {
      loadGenerateMultipleConfig()
        .then((config) => {
          setGenerateMultipleConfig(config);
          const configKeys = Object.keys(config);
          if (configKeys.length > 0) {
            console.log('成功加载生成多表配置:', config);
            // 自动选择所有配置
            setSelectedConfigNames(configKeys);
          } else {
            console.warn('生成多表配置文件不存在或为空');
            setSelectedConfigNames([]);
          }
        })
        .catch((error) => {
          console.error('加载生成多表配置失败:', error);
          setSelectedConfigNames([]);
        });
    } else if (activeTool === 'merge') {
      loadGenerateSingleConfig()
        .then((config) => {
          setGenerateSingleConfig(config);
          const configKeys = Object.keys(config);
          if (configKeys.length > 0) {
            console.log('成功加载生成单表配置:', config);
            // 自动选择第一个配置
            setSelectedSingleConfigName(configKeys[0]);
          } else {
            console.warn('生成单表配置文件不存在或为空');
            setSelectedSingleConfigName('');
          }
        })
        .catch((error) => {
          console.error('加载生成单表配置失败:', error);
          setSelectedSingleConfigName('');
        });
    }
  }, [activeTool]);

  /**
   * 处理配置选择变化
   */
  const handleConfigToggle = (configName: string) => {
    setSelectedConfigNames((prev) => {
      if (prev.includes(configName)) {
        // 取消选择
        return prev.filter((name) => name !== configName);
      } else {
        // 添加选择
        return [...prev, configName];
      }
    });
  };

  /**
   * 全选/取消全选
   */
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedConfigNames(Object.keys(generateMultipleConfig));
    } else {
      setSelectedConfigNames([]);
    }
  };

  /**
   * 获取银行账号配置文件路径
   */
  const getBankAccountConfigPath = async (): Promise<string | null> => {
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
  };

  /**
   * 加载并处理主体表格映射数据
   */
  const loadEntityTableMapping = async () => {
    try {
      const bankAccounts = await loadBankAccounts();

      // 按付款模板分组，收集每个模板对应的主体
      const mapping: Record<string, Set<string>> = {};

      Object.values(bankAccounts).forEach((account: any) => {
        if (account && account['付款模板'] && account['公司主体']) {
          const template = account['付款模板'];
          const entity = account['公司主体'];

          if (!mapping[template]) {
            mapping[template] = new Set();
          }
          mapping[template].add(entity);
        }
      });

      // 转换为数组格式
      const result: Record<string, string[]> = {};
      Object.keys(mapping).forEach((template) => {
        result[template] = Array.from(mapping[template]);
      });

      setEntityTableMapping(result);
      setShowEntityTableMapping(true);
    } catch (error) {
      console.error('加载主体表格映射失败:', error);
      alert('加载主体表格映射失败，请检查配置文件');
    }
  };

  /**
   * 打开银行账号配置文件
   */
  const handleOpenBankAccountConfigFile = async () => {
    try {
      const isElectron = window.appEnv?.isElectron;
      if (!isElectron) {
        alert('打开配置文件功能仅在 Electron 环境中可用');
        return;
      }

      const configPath = await getBankAccountConfigPath();
      if (!configPath) {
        alert('无法获取配置文件路径');
        return;
      }

      const result = await window.electronAPI?.showItemInFolder(configPath);
      if (result && !result.success) {
        alert(`打开配置文件失败: ${result.error}`);
      }
    } catch (error) {
      console.error('打开配置文件失败:', error);
      alert(
        `打开配置文件失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  };

  /**
   * 刷新银行账号配置
   */
  const handleRefreshBankAccountConfig = async () => {
    try {
      await loadEntityTableMapping();
      alert('配置刷新成功');
    } catch (error) {
      console.error('刷新配置失败:', error);
      alert(
        `刷新配置失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  };

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);
    setTimeout(
      () => logEndRef.current?.scrollIntoView({ behavior: 'smooth' }),
      50
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = Array.from(e.target.files || []) as File[];
    const newFiles: BankFile[] = uploaded.map((f) => ({
      id: Math.random().toString(36).substr(2, 9),
      name: f.name,
      size: (f.size / 1024).toFixed(1) + ' KB',
      uploadTime: new Date().toLocaleString(),
      status: 'uploaded',
      file: f, // 保存File对象
    }));
    setFiles((prev) => [...prev, ...newFiles]);
    addLog(`成功导入 ${uploaded.length} 个流水文件`);
    // 清空之前生成的数据
    setGeneratedTables({});
    // 重置 input，避免同一文件再次选择时不触发 onChange
    e.target.value = '';
  };

  /**
   * 根据银行开户行信息，调用智谱API获取户地并填充到表格中
   * @param tables - 生成的表格数据
   */
  const enrichBankLocationData = async (tables: Record<string, any[][]>) => {
    try {
      const apiKey = import.meta.env.VITE_ZHIPU_API_KEY || import.meta.env.ZHIPU_API_KEY;
      if (!apiKey) {
        addLog('警告: 未配置智谱API Key，跳过银行户地信息填充');
        return;
      }

      // 处理每个表格
      for (const [tableName, tableData] of Object.entries(tables)) {
        if (tableData.length <= 1) continue; // 只有表头，没有数据

        const headers = tableData[0];
        const dataRows = tableData.slice(1);

        // 检查是否是招行付款整理表
        const isCMBTable = tableName.includes('招行') || tableName.includes('招商');
        // 检查是否是工行付款整理表
        const isICBCTable = tableName.includes('工行') || tableName.includes('工商');

        if (isCMBTable) {
          // 招行付款整理表：根据"*收方开户行"填充"*收方开户地"
          const bankColumnIndex = headers.findIndex(h => 
            h && (h.includes('收方开户行') || h === '*收方开户行')
          );
          const locationColumnIndex = headers.findIndex(h => 
            h && (h.includes('收方开户地') || h === '*收方开户地')
          );

          if (bankColumnIndex !== -1 && locationColumnIndex !== -1) {
            addLog(`正在处理招行付款整理表：填充"*收方开户地"信息（共 ${dataRows.length} 行）`);
            
            // 收集所有需要查询的银行名称
            const bankNames = dataRows.map(row => row[bankColumnIndex]);
            
            try {
              // 批量调用API（支持分批并发）
              const locations = await getBankLocationsBatch(bankNames, (current, total) => {
                addLog(`  处理进度: ${current}/${total} 批`);
              });
              
              // 填充结果
              let successCount = 0;
              for (let i = 0; i < dataRows.length; i++) {
                if (locations[i] && locations[i].province && locations[i].city) {
                  dataRows[i][locationColumnIndex] = `${locations[i].province}省${locations[i].city}市`;
                  successCount++;
                }
              }
              
              addLog(`招行付款整理表处理完成：成功填充 ${successCount} 行`);
            } catch (error) {
              console.error('批量获取银行户地失败:', error);
              addLog(`  警告: 批量获取户地失败 - ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        } else if (isICBCTable) {
          // 工行付款整理表：根据"收款账号开户行"填充"收款账号省份"和"收款账号地市"
          const bankColumnIndex = headers.findIndex(h => 
            h && (h.includes('收款账号开户行') || h === '收款账号开户行')
          );
          const provinceColumnIndex = headers.findIndex(h => 
            h && (h.includes('收款账号省份') || h === '收款账号省份')
          );
          const cityColumnIndex = headers.findIndex(h => 
            h && (h.includes('收款账号地市') || h === '收款账号地市')
          );
          const regionCodeColumnIndex = headers.findIndex(h => 
            h && (h.includes('收款账号地区码') || h === '收款账号地区码')
          );

          if (bankColumnIndex !== -1 && provinceColumnIndex !== -1 && cityColumnIndex !== -1) {
            addLog(`正在处理工行付款整理表：填充"收款账号省份"和"收款账号地市"信息（共 ${dataRows.length} 行）`);
            
            // 收集所有需要查询的银行名称
            const bankNames = dataRows.map(row => row[bankColumnIndex]);
            
            try {
              // 批量调用API（支持分批并发）
              const locations = await getBankLocationsBatch(bankNames, (current, total) => {
                addLog(`  处理进度: ${current}/${total} 批`);
              });
              
              // 填充结果
              let successCount = 0;
              for (let i = 0; i < dataRows.length; i++) {
                if (locations[i]) {
                  if (locations[i].province) {
                    dataRows[i][provinceColumnIndex] = locations[i].province;
                  }
                  if (locations[i].city) {
                    dataRows[i][cityColumnIndex] = locations[i].city;
                  }
                  if (locations[i].q) {
                    dataRows[i][regionCodeColumnIndex] = locations[i].q;
                  }
                  if (locations[i].province || locations[i].city) {
                    successCount++;
                  }
                }
              }
              
              addLog(`工行付款整理表处理完成：成功填充 ${successCount} 行`);
            } catch (error) {
              console.error('批量获取银行户地失败:', error);
              addLog(`  警告: 批量获取户地失败 - ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        }
      }

      // 更新表格数据
      setGeneratedTables(tables);
      addLog('银行户地信息填充完成');
    } catch (error) {
      console.error('填充银行户地信息失败:', error);
      addLog(`警告: 填充银行户地信息失败 - ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  /**
   * 简单读取Excel文件（不识别银行类型）
   */
  const readExcelFileSimple = async (
    file: File
  ): Promise<{ headers: string[]; data: any[][] }> => {
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
          const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: '',
          }) as any[][];

          if (jsonData.length === 0) {
            reject(new Error('Excel 文件为空'));
            return;
          }

          // 默认第一行就是表头
          const headers = jsonData[0]
            .map((h: any) => String(h).trim())
            .filter((h: string) => h);

          // 从第二行开始读取数据
          const dataRows = jsonData
            .slice(1)
            .filter((row) => row.some((cell) => cell !== ''));

          resolve({ headers, data: dataRows });
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => {
        reject(new Error('读取文件失败'));
      };

      reader.readAsArrayBuffer(file);
    });
  };

  /**
   * 当 files 变化时按文件读取表头，并清理已移除文件的 state
   */
  useEffect(() => {
    const fileIds = new Set<string>(files.map((f) => f.id));
    fileIdsRef.current = files.map((f) => f.id);
    setHeadersByFileId((prev) => {
      const next: Record<string, string[]> = {};
      fileIds.forEach((id: string) => {
        if (prev[id]) next[id] = prev[id];
      });
      return next;
    });
    setDedupHeaderNamesByFileId((prev) => {
      const next: Record<string, string[]> = {};
      fileIds.forEach((id: string) => {
        if (prev[id]) next[id] = prev[id];
      });
      return next;
    });
    setHeadersLoadingByFileId((prev) => {
      const next: Record<string, boolean> = {};
      fileIds.forEach((id: string) => {
        if (prev[id]) next[id] = prev[id];
      });
      return next;
    });

    files.forEach((f) => {
      if (!f.file) return;
      const id = f.id;
      setHeadersLoadingByFileId((prev) => ({ ...prev, [id]: true }));
      readExcelFileSimple(f.file)
        .then(({ headers }) => {
          if (!fileIdsRef.current.includes(id)) return;
          setHeadersByFileId((prev) => ({ ...prev, [id]: headers }));
        })
        .catch(() => {
          if (!fileIdsRef.current.includes(id)) return;
          setHeadersByFileId((prev) => ({ ...prev, [id]: [] }));
        })
        .finally(() => {
          if (!fileIdsRef.current.includes(id)) return;
          setHeadersLoadingByFileId((prev) => ({ ...prev, [id]: false }));
        });
    });
  }, [files]);

  /** 点击页面其他区域时关闭去重列下拉（下拉已挂到 body，需同时判断触发区域与 portal 内容） */
  useEffect(() => {
    if (!openDedupFileId) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const inTrigger = dedupDropdownRef.current?.contains(target);
      const inPortal = dedupPortalRef.current?.contains(target);
      if (!inTrigger && !inPortal) {
        setOpenDedupFileId(null);
        setDedupDropdownRect(null);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [openDedupFileId]);

  /**
   * 根据当前行与表头计算去重键（所选去重列的值序列）；空串表示不去重
   * @param row - 当前行数据
   * @param headers - 当前文件表头
   * @param dedupHeaderNames - 用户选择的去重列名
   */
  const getDedupKey = (
    row: any[],
    headers: string[],
    dedupHeaderNames: string[]
  ): string => {
    if (!dedupHeaderNames.length) return '';
    const values = dedupHeaderNames.map((name) => {
      const idx = headers.indexOf(name);
      if (idx === -1) return '';
      const v = row[idx];
      return v === undefined || v === null ? '' : String(v).trim();
    });
    return JSON.stringify(values);
  };

  /**
   * 处理按公司主体拆分汇总
   */
  const processSplitByEntity = async () => {
    if (files.length === 0) {
      alert('请先上传流水表');
      return;
    }
    if (selectedConfigNames.length === 0) {
      alert('请至少选择一个表格配置');
      return;
    }

    setIsProcessing(true);
    setLogs([]);
    addLog(`启动任务: 按公司主体拆分汇总`);
    addLog(`已选择 ${selectedConfigNames.length} 个表格配置`);

    try {
      // 加载银行账号配置
      addLog('正在加载银行账号配置...');
      const bankAccounts = await loadBankAccounts();

      // 构建主体到付款模板的映射（支持一个主体对应多个模板）
      const entityToTemplateMap: Record<string, string[]> = {};
      const allEntities: string[] = []; // 保存所有配置中的主体名称，用于调试

      Object.values(bankAccounts).forEach((account: any) => {
        if (account && account['付款模板'] && account['公司主体']) {
          const entity = String(account['公司主体']).trim();
          const template = String(account['付款模板']).trim();

          if (!allEntities.includes(entity)) {
            allEntities.push(entity);
          }

          // 只处理在选择的配置中的模板
          if (selectedConfigNames.includes(template)) {
            if (!entityToTemplateMap[entity]) {
              entityToTemplateMap[entity] = [];
            }
            if (!entityToTemplateMap[entity].includes(template)) {
              entityToTemplateMap[entity].push(template);
            }
          }
        }
      });

      // 输出映射关系用于调试
      addLog(`配置中的所有主体列表: ${allEntities.join(', ')}`);
      Object.entries(entityToTemplateMap).forEach(([entity, templates]) => {
        addLog(`主体映射: "${entity}" -> ${templates.join(', ')}`);
      });

      addLog(
        `识别到 ${
          Object.keys(entityToTemplateMap).length
        } 个公司主体（在选择的配置中）`
      );

      // 初始化生成表格的数据结构
      const tables: Record<string, any[][]> = {};
      selectedConfigNames.forEach((configName) => {
        tables[configName] = [];
      });
      /** 按输出表记录已出现的去重键（用于按表头去重） */
      const seenKeysByTemplate: Record<string, Set<string>> = {};
      selectedConfigNames.forEach((configName) => {
        seenKeysByTemplate[configName] = new Set();
      });

      // 处理每个文件
      addLog(`开始处理 ${files.length} 个流水文件...`);
      for (let i = 0; i < files.length; i++) {
        const fileObj = files[i];
        if (!fileObj.file) {
          addLog(`跳过文件 ${fileObj.name}：缺少文件对象`);
          continue;
        }

        addLog(`正在处理文件 ${i + 1}/${files.length}: ${fileObj.name}`);

        try {
          // 读取Excel文件（不识别银行类型）
          const { headers, data } = await readExcelFileSimple(fileObj.file);

          // 查找"公司"列的索引
          const entityColumnIndex = headers.findIndex(
            (h) => h && (h === '公司' || h === '公司-X')
          );

          if (entityColumnIndex === -1) {
            addLog(`警告: 文件 ${fileObj.name} 中未找到"公司"列，跳过`);
            continue;
          }

          addLog(`在文件 ${fileObj.name} 中找到"公司"列`);

          // 处理每一行数据
          for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
            const row = data[rowIndex];
            const entityValue = row[entityColumnIndex]
              ? String(row[entityColumnIndex]).trim()
              : '';

            if (!entityValue) continue;

            // 查找该主体对应的付款模板（支持精确匹配和去除空格后匹配）
            let templates: string[] = [];
            let matchedEntity = '';

            // 先尝试精确匹配
            if (entityToTemplateMap[entityValue]) {
              templates = entityToTemplateMap[entityValue];
              matchedEntity = entityValue;
            } else {
              // 尝试去除空格后完全匹配（不区分大小写）
              const normalizedEntityValue = entityValue
                .replace(/\s+/g, '')
                .toLowerCase();

              for (const [entity, templateList] of Object.entries(
                entityToTemplateMap
              )) {
                const normalizedEntity = entity
                  .replace(/\s+/g, '')
                  .toLowerCase();

                if (normalizedEntity === normalizedEntityValue) {
                  templates = templateList;
                  matchedEntity = entity;
                  break;
                }
              }
            }

            if (templates.length === 0) {
              addLog(
                `警告: 主体"${entityValue}"未找到对应的付款模板。可用主体: ${allEntities.join(
                  ', '
                )}`
              );
              continue;
            }

            // 处理该主体对应的所有模板（通常只有一个，但支持多个）
            for (const template of templates) {
              // 检查该模板是否在选择的配置中
              if (!selectedConfigNames.includes(template)) {
                continue;
              }

              // 获取该模板的字段映射配置
              const fieldMapping = generateMultipleConfig[template];
              if (!fieldMapping) {
                addLog(`警告: 未找到模板"${template}"的字段映射配置`);
                continue;
              }

              // 根据字段映射生成新行数据
              const newRow: any[] = [];
              const targetHeaders = Object.keys(fieldMapping);

              // 生成表头（只在第一次添加）
              if (tables[template].length === 0) {
                tables[template].push(targetHeaders);
              }

              // 根据映射填充数据
              targetHeaders.forEach((targetField) => {
                const sourceField = fieldMapping[targetField];
                if (sourceField && sourceField.trim()) {
                  // 使用新的解析函数处理映射表达式
                  const value = parseFieldMapping(sourceField, headers, row);
                  newRow.push(value);
                } else {
                  newRow.push('');
                }
              });

              // 按当前文件所选去重列去重：键已出现过则跳过
              const dedupNames = dedupHeaderNamesByFileId[fileObj.id] ?? [];
              if (dedupNames.length > 0) {
                const key = getDedupKey(row, headers, dedupNames);
                if (seenKeysByTemplate[template].has(key)) continue;
                seenKeysByTemplate[template].add(key);
              }
              if (newRow.some((cell) => cell !== '')) {
                tables[template].push(newRow);
              }
            }
          }

          addLog(`文件 ${fileObj.name} 处理完成`);
        } catch (error) {
          console.error(`处理文件 ${fileObj.name} 时出错:`, error);
          addLog(
            `错误: 处理文件 ${fileObj.name} 失败 - ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }

      // 保存生成的数据
      setGeneratedTables(tables);

      // 统计结果
      let totalRows = 0;
      Object.entries(tables).forEach(([template, rows]) => {
        const dataRows = rows.length > 0 ? rows.length - 1 : 0; // 减去表头
        totalRows += dataRows;
        if (dataRows > 0) {
          addLog(`表格"${template}": 生成 ${dataRows} 行数据`);
        }
      });

      // 根据生成的表格，调用智谱API获取银行户地信息并填充
      await enrichBankLocationData(tables);

      addLog(`任务完成！共生成 ${totalRows} 行数据`);
      setIsProcessing(false);
    } catch (error) {
      console.error('处理过程中出错:', error);
      addLog(`错误: ${error instanceof Error ? error.message : String(error)}`);
      setIsProcessing(false);
    }
  };

  /**
   * 处理多表合规化合并
   */
  const processMergeCompliance = async () => {
    if (files.length === 0) {
      alert('请先上传流水表');
      return;
    }
    if (
      !selectedSingleConfigName ||
      !generateSingleConfig[selectedSingleConfigName]
    ) {
      alert('请先选择或配置表格映射关系');
      return;
    }

    setIsProcessing(true);
    setLogs([]);
    addLog(`启动任务: 多表合规化合并`);
    addLog(`使用配置: ${selectedSingleConfigName}`);

    try {
      // 获取选中的配置映射
      const fieldMapping = generateSingleConfig[selectedSingleConfigName];
      if (!fieldMapping) {
        throw new Error(`未找到配置"${selectedSingleConfigName}"的字段映射`);
      }

      // 获取目标表头（映射的键）
      const targetHeaders = Object.keys(fieldMapping);
      addLog(`目标表头: ${targetHeaders.join(', ')}`);

      // 初始化生成表格的数据结构
      const tableName = selectedSingleConfigName;
      const tableData: any[][] = [targetHeaders]; // 第一行是表头
      /** 已出现的去重键（用于按表头去重） */
      const seenKeys = new Set<string>();

      // 处理每个文件
      addLog(`开始处理 ${files.length} 个流水文件...`);
      for (let i = 0; i < files.length; i++) {
        const fileObj = files[i];
        if (!fileObj.file) {
          addLog(`跳过文件 ${fileObj.name}：缺少文件对象`);
          continue;
        }

        addLog(`正在处理文件 ${i + 1}/${files.length}: ${fileObj.name}`);

        try {
          // 读取Excel文件（不识别银行类型）
          const { headers, data } = await readExcelFileSimple(fileObj.file);
          addLog(`文件 ${fileObj.name} 包含 ${data.length} 行数据`);

          // 处理每一行数据
          for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
            const row = data[rowIndex];

            // 根据字段映射生成新行数据
            const newRow: any[] = [];

            // 根据映射填充数据
            targetHeaders.forEach((targetField) => {
              const sourceField = fieldMapping[targetField];
              if (sourceField && sourceField.trim()) {
                // 使用新的解析函数处理映射表达式
                const value = parseFieldMapping(sourceField, headers, row);
                newRow.push(value);
              } else {
                newRow.push('');
              }
            });

            // 按当前文件所选去重列去重：键已出现过则跳过
            const dedupNames = dedupHeaderNamesByFileId[fileObj.id] ?? [];
            if (dedupNames.length > 0) {
              const key = getDedupKey(row, headers, dedupNames);
              if (seenKeys.has(key)) continue;
              seenKeys.add(key);
            }
            // 只添加非空行
            if (newRow.some((cell) => cell !== '')) {
              tableData.push(newRow);
            }
          }

          addLog(`文件 ${fileObj.name} 处理完成`);
        } catch (error) {
          console.error(`处理文件 ${fileObj.name} 时出错:`, error);
          addLog(
            `错误: 处理文件 ${fileObj.name} 失败 - ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }

      // 保存生成的数据
      setGeneratedTables({ [tableName]: tableData });

      // 统计结果
      const dataRows = tableData.length > 1 ? tableData.length - 1 : 0; // 减去表头
      addLog(`表格"${tableName}": 生成 ${dataRows} 行数据`);
      addLog(`任务完成！共生成 ${dataRows} 行数据`);
      setIsProcessing(false);
    } catch (error) {
      console.error('处理过程中出错:', error);
      addLog(`错误: ${error instanceof Error ? error.message : String(error)}`);
      setIsProcessing(false);
    }
  };

  const runProcess = async () => {
    if (activeTool === 'split') {
      await processSplitByEntity();
    } else {
      await processMergeCompliance();
    }
  };

  return (
    <div className="flex h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Workspace */}
      <div className="flex-1 flex flex-col p-8 overflow-y-auto">
        <header className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {activeTool === 'split' ? '按公司主体拆分汇总' : '多表合规化合并'}
            </h1>
            <p className="text-slate-500 mt-1">
              {activeTool === 'split'
                ? '识别主体名称生成多份独立的汇总表,并支持AI智能填充银行户地信息'
                : '将不同格式的银行流水表统一转换为标准财务格式并合并为一个文件'}
            </p>
          </div>
          <button
            disabled={isProcessing}
            onClick={runProcess}
            className={`px-8 py-3 rounded-[0.25rem] font-bold text-white transition-all transform active:scale-95 shadow-lg ${
              isProcessing
                ? 'bg-slate-300'
                : 'bg-blue-500 hover:bg-blue-600 shadow-blue-100'
            }`}
          >
            {isProcessing ? '处理中...' : '开始执行任务'}
          </button>
        </header>

        <div className="grid grid-cols-12 gap-8 flex-1">
          {/* Left Panel: Configuration */}
          <div className="col-span-7 space-y-8">
            {/* File Zone */}
            <section className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-700 flex items-center">
                  <span className="w-1 h-4 bg-blue-500 rounded mr-2"></span>
                  待处理流水表 ({files.length})
                </h3>
                <label className="text-xs font-bold text-blue-600 cursor-pointer hover:underline">
                  + 批量上传文件
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto">
                {files.map((f) => (
                  <div
                    key={f.id}
                    className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm space-y-2"
                  >
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-green-50 text-green-600 rounded flex items-center justify-center mr-3 font-bold text-[10px]">
                        XLS
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-700 truncate">
                          {f.name}
                        </p>
                        <p className="text-[10px] text-slate-400">{f.size}</p>
                      </div>
                      <button
                        onClick={() =>
                          setFiles((prev) =>
                            prev.filter((file) => file.id !== f.id)
                          )
                        }
                        className="text-slate-300 hover:text-red-500 ml-2"
                      >
                        ×
                      </button>
                    </div>
                    {/* 按文件选择去重列 - 多选下拉 */}
                    <div
                      ref={openDedupFileId === f.id ? dedupDropdownRef : undefined}
                      className="border-t border-slate-100 pt-2 relative"
                    >
                      <p className="text-[10px] text-slate-500 mb-1">去重列（可选，仅保留所选列取值相同的第一行）</p>
                      {headersLoadingByFileId[f.id] ? (
                        <p className="text-[10px] text-slate-400 italic">读取表头中...</p>
                      ) : (headersByFileId[f.id]?.length ?? 0) > 0 ? (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              if (openDedupFileId === f.id) {
                                setOpenDedupFileId(null);
                                setDedupDropdownRect(null);
                              } else {
                                const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                setDedupDropdownRect({ left: rect.left, top: rect.bottom + 4, width: rect.width });
                                setOpenDedupFileId(f.id);
                              }
                            }}
                            className="w-full text-left text-[10px] px-2 py-1.5 rounded border border-slate-200 bg-white text-slate-600 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-400 flex items-center justify-between gap-1"
                          >
                            <span className="truncate">
                              {(dedupHeaderNamesByFileId[f.id] ?? []).length === 0
                                ? '请选择去重列'
                                : `已选 ${(dedupHeaderNamesByFileId[f.id] ?? []).length} 列`}
                            </span>
                            <span className="text-slate-400 shrink-0">{openDedupFileId === f.id ? '▲' : '▼'}</span>
                          </button>
                          {openDedupFileId === f.id && dedupDropdownRect &&
                            createPortal(
                              <div
                                ref={dedupPortalRef}
                                className="fixed z-[9999] bg-white border border-slate-200 rounded shadow-lg py-1 max-h-40 overflow-y-auto"
                                style={{
                                  left: dedupDropdownRect.left,
                                  top: dedupDropdownRect.top,
                                  width: dedupDropdownRect.width,
                                }}
                              >
                                {(headersByFileId[f.id] ?? []).map((h) => {
                                  const selected = (dedupHeaderNamesByFileId[f.id] ?? []).includes(h);
                                  return (
                                    <label
                                      key={h}
                                      className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 cursor-pointer text-[10px] text-slate-700"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={selected}
                                        onChange={() => {
                                          setDedupHeaderNamesByFileId((prev) => {
                                            const current = prev[f.id] ?? [];
                                            const next = selected
                                              ? current.filter((x) => x !== h)
                                              : [...current, h];
                                            return { ...prev, [f.id]: next };
                                          });
                                        }}
                                        className="rounded border-slate-300"
                                      />
                                      <span className="truncate" title={h}>{h}</span>
                                    </label>
                                  );
                                })}
                              </div>,
                              document.body
                            )}
                        </>
                      ) : (
                        <p className="text-[10px] text-slate-400 italic">无表头或读取失败</p>
                      )}
                    </div>
                  </div>
                ))}
                {files.length === 0 && (
                  <div className="col-span-2 text-center py-8 text-slate-400 text-sm italic">
                    暂无文件，请先上传
                  </div>
                )}
              </div>
            </section>

            {/* Config Zone */}
            <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-slate-700">
                  {activeTool === 'split' ? '主体映射配置' : '表格映射配置'}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleOpenConfigFile}
                    className="text-[11px] font-bold text-blue-600 border border-blue-200 px-3 py-1 rounded hover:bg-blue-50 transition-colors flex items-center gap-1"
                    title="在文件管理器中打开配置文件"
                  >
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                    打开配置文件
                  </button>
                  <button
                    onClick={handleRefreshConfig}
                    className="text-[11px] font-bold text-green-600 border border-green-200 px-3 py-1 rounded hover:bg-green-50 transition-colors flex items-center gap-1"
                    title="重新加载配置文件"
                  >
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    刷新配置
                  </button>
                  {activeTool === 'split' && (
                    <button
                      onClick={loadEntityTableMapping}
                      className="text-[11px] font-bold text-blue-600 border border-blue-200 px-3 py-1 rounded hover:bg-blue-50 transition-colors"
                    >
                      查看主体表格映射
                    </button>
                  )}
                </div>
              </div>

              {activeTool === 'split' ? (
                <div className="h-[600px] overflow-y-auto space-y-4 pr-2 custom-scrollbar relative">
                  {/* 配置选择复选框列表 - 固定在顶部 */}
                  {Object.keys(generateMultipleConfig).length > 0 && (
                    <div className="sticky top-0 z-10 mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-sm font-bold text-slate-700">
                          选择需要生成的表格 ({selectedConfigNames.length}/
                          {Object.keys(generateMultipleConfig).length})
                        </label>
                        <label className="flex items-center text-xs text-blue-600 cursor-pointer hover:text-blue-700">
                          <input
                            type="checkbox"
                            checked={
                              selectedConfigNames.length ===
                                Object.keys(generateMultipleConfig).length &&
                              Object.keys(generateMultipleConfig).length > 0
                            }
                            onChange={(e) => handleSelectAll(e.target.checked)}
                            className="mr-1"
                          />
                          全选
                        </label>
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {Object.keys(generateMultipleConfig).map(
                          (configName) => (
                            <label
                              key={configName}
                              className="flex items-center p-2 bg-white rounded border border-slate-200 hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={selectedConfigNames.includes(
                                  configName
                                )}
                                onChange={() => handleConfigToggle(configName)}
                                className="mr-3 w-4 h-4 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-700 flex-1">
                                {configName}
                              </span>
                            </label>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {/* 显示选中的配置映射 */}
                  {selectedConfigNames.length > 0 && (
                    <div className="space-y-4">
                      {selectedConfigNames.map(
                        (configName) =>
                          generateMultipleConfig[configName] && (
                            <div
                              key={configName}
                              className="border rounded-xl p-4 bg-slate-50/50"
                            >
                              <div className="flex justify-between mb-3 items-center">
                                <span className="text-sm font-black text-slate-700">
                                  {configName}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  字段映射配置
                                </span>
                              </div>
                              <div className="bg-white rounded-lg border">
                                <table className="w-full text-[11px]">
                                  <thead className="bg-slate-100 text-slate-500">
                                    <tr>
                                      <th className="px-3 py-2 text-left">
                                        目标输出表头
                                      </th>
                                      <th className="px-3 py-2 text-left">
                                        源表头关键词
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {Object.entries(
                                      generateMultipleConfig[configName]
                                    ).map(([targetField, sourceField], idx) => (
                                      <tr key={idx} className="border-t">
                                        <td className="px-3 py-2 font-bold text-blue-800">
                                          {targetField}
                                        </td>
                                        <td className="px-3 py-2 text-slate-600">
                                          {sourceField || ''}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )
                      )}
                    </div>
                  )}

                  {/* 如果没有选择配置，显示提示 */}
                  {selectedConfigNames.length === 0 &&
                    Object.keys(generateMultipleConfig).length > 0 && (
                      <div className="text-center py-8 text-slate-400 text-sm italic">
                        请从上方复选框中选择一个或多个表格配置
                      </div>
                    )}

                  {/* 如果配置为空，显示提示 */}
                  {Object.keys(generateMultipleConfig).length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-sm italic">
                      暂无配置数据，请先创建 generateMultiple.json 配置文件
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-[600px] overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                  {/* 配置选择下拉框 */}
                  {Object.keys(generateSingleConfig).length > 0 && (
                    <div className="sticky top-0 z-10 mb-4 p-3 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-lg border border-blue-200/60 shadow-sm backdrop-blur-sm">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          <div className="w-1 h-4 bg-gradient-to-b from-blue-500 to-indigo-500 rounded-full mr-2"></div>
                          <label className="text-xs font-bold text-slate-700">
                            选择表格配置
                          </label>
                        </div>
                        <span className="px-2 py-0.5 bg-white/80 backdrop-blur-sm text-blue-700 text-[9px] font-bold rounded-full border border-blue-200/50 shadow-sm">
                          {Object.keys(generateSingleConfig).length} 个可用
                        </span>
                      </div>
                      <div className="relative">
                        <select
                          value={selectedSingleConfigName}
                          onChange={(e) =>
                            setSelectedSingleConfigName(e.target.value)
                          }
                          className="w-full px-3 py-2 pr-8 text-sm border-2 border-blue-200/60 rounded-lg bg-white text-slate-700 font-medium shadow-sm hover:border-blue-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 appearance-none cursor-pointer"
                          style={{
                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%234F46E5' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 0.5rem center',
                            backgroundSize: '1em 1em',
                            paddingRight: '2rem',
                          }}
                        >
                          <option
                            value=""
                            disabled
                            className="text-slate-400 italic"
                          >
                            ─ 请选择配置 ─
                          </option>
                          {Object.keys(generateSingleConfig).map(
                            (configName) => (
                              <option
                                key={configName}
                                value={configName}
                                className="text-slate-700"
                              >
                                {configName}
                              </option>
                            )
                          )}
                        </select>
                        {selectedSingleConfigName && (
                          <div className="mt-2 flex items-center px-2 py-1 bg-white/80 backdrop-blur-sm rounded border border-green-200/50 shadow-sm">
                            <svg
                              className="w-3 h-3 mr-1.5 text-green-600 flex-shrink-0"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2.5}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            <span className="text-[10px] font-semibold text-green-700">
                              已选择:{' '}
                              <span className="text-slate-700">
                                {selectedSingleConfigName}
                              </span>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 显示选中的配置映射 */}
                  {selectedSingleConfigName &&
                    generateSingleConfig[selectedSingleConfigName] && (
                      <div className="border rounded-xl p-4 bg-slate-50/50">
                        <div className="flex justify-between mb-3 items-center">
                          <span className="text-sm font-black text-slate-700">
                            {selectedSingleConfigName}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            字段映射配置
                          </span>
                        </div>
                        <div className="bg-white rounded-lg border">
                          <table className="w-full text-[11px]">
                            <thead className="bg-slate-100 text-slate-500">
                              <tr>
                                <th className="px-3 py-2 text-left">
                                  目标输出表头
                                </th>
                                <th className="px-3 py-2 text-left">
                                  源表头关键词
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(
                                generateSingleConfig[selectedSingleConfigName]
                              ).map(([targetField, sourceField], idx) => (
                                <tr key={idx} className="border-t">
                                  <td className="px-3 py-2 font-bold text-blue-800">
                                    {targetField}
                                  </td>
                                  <td className="px-3 py-2 text-slate-600">
                                    {sourceField || ''}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                  {/* 如果没有选择配置，显示提示 */}
                  {(!selectedSingleConfigName ||
                    Object.keys(generateSingleConfig).length === 0) && (
                    <div className="text-center py-8 text-slate-400 text-sm italic">
                      {Object.keys(generateSingleConfig).length === 0
                        ? '暂无配置数据，请先创建 generateSingle.json 配置文件'
                        : '请从上方下拉框中选择一个表格配置'}
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>

          {/* Right Panel: Execution & Logs */}
          <div className="col-span-5 flex flex-col space-y-8 overflow-hidden">
            {/* Status Card */}
            <div className="bg-blue-900 text-white rounded-2xl p-6 shadow-xl shadow-blue-100 relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-blue-200 text-xs font-bold uppercase tracking-widest mb-1">
                  系统状态
                </p>
                <h4 className="text-xl font-bold mb-4">准备就绪</h4>
                <div className="flex justify-between items-center text-xs">
                  <div className="flex flex-col">
                    <span className="text-blue-300">预估耗时</span>
                    <span className="font-bold">~15 秒</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-blue-300">并发进程</span>
                    <span className="font-bold">2 线程</span>
                  </div>
                </div>
              </div>
              {/* Decorative Background */}
              <div className="absolute top-[-50px] right-[-50px] w-48 h-48 bg-blue-800 rounded-full blur-3xl opacity-50"></div>
            </div>

            {/* Terminal Logs */}
            <div className="h-96 bg-slate-900 rounded-2xl p-5 flex flex-col shadow-inner">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  任务执行终端
                </span>
                <div className="flex space-x-1">
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto font-mono text-[11px] space-y-2 text-slate-300 custom-scrollbar pr-2 min-h-0">
                {logs.length === 0 ? (
                  <div className="text-slate-600 italic">
                    等待用户点击执行...
                  </div>
                ) : (
                  logs.map((log, i) => <div key={i}>{log}</div>)
                )}
                <div ref={logEndRef} />
              </div>
            </div>

            {/* 操作按钮区域 */}
            {!isProcessing && logs.length > 0 && (
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col space-y-2">
                {Object.keys(generatedTables).length > 0 && (
                  <>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          if (Object.keys(generatedTables).length === 1) {
                            setPreviewTableName(
                              Object.keys(generatedTables)[0]
                            );
                            setShowPreview(true);
                          } else {
                            // 如果有多个表格，显示选择模态框
                            setShowTableSelector(true);
                          }
                        }}
                        className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-blue-700"
                      >
                        预览生成的表格
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const isElectron = window.appEnv?.isElectron;
                            if (!isElectron) {
                              alert('导出功能仅在 Electron 环境中可用');
                              return;
                            }

                            for (const [tableName, tableData] of Object.entries(
                              generatedTables
                            )) {
                              const data = tableData as any[][];
                              if (data.length === 0) continue;

                              // 空值（含数字 0）转为 null，避免导出后显示为 0
                              const sheetData = data.map((row) =>
                                row.map((cell: any) => {
                                  if (
                                    cell === '' ||
                                    cell === null ||
                                    cell === undefined ||
                                    (typeof cell === 'number' && cell === 0)
                                  )
                                    return null;
                                  return cell;
                                })
                              );

                              // 创建工作簿（sheetStubs: true 让 null 变为空白格）
                              const worksheet = XLSX.utils.aoa_to_sheet(
                                sheetData,
                                { sheetStubs: true }
                              );
                              const workbook = XLSX.utils.book_new();
                              XLSX.utils.book_append_sheet(
                                workbook,
                                worksheet,
                                'Sheet1'
                              );

                              // 转换为二进制数据
                              const excelBuffer = XLSX.write(workbook, {
                                type: 'array',
                                bookType: 'xlsx',
                              });
                              const arrayBuffer = new Uint8Array(excelBuffer)
                                .buffer;

                              // 显示保存对话框
                              const result =
                                await window.electronAPI?.showSaveDialog({
                                  defaultPath: `${tableName}.xlsx`,
                                  filters: [
                                    {
                                      name: 'Excel 文件',
                                      extensions: ['xlsx'],
                                    },
                                    { name: '所有文件', extensions: ['*'] },
                                  ],
                                });

                              if (
                                result &&
                                !result.canceled &&
                                result.filePath
                              ) {
                                await window.electronAPI?.writeFile(
                                  result.filePath,
                                  arrayBuffer
                                );
                                addLog(`已导出: ${tableName}.xlsx`);
                              }
                            }
                            alert('所有表格导出完成！');
                          } catch (error) {
                            console.error('导出失败:', error);
                            alert(
                              `导出失败: ${
                                error instanceof Error
                                  ? error.message
                                  : String(error)
                              }`
                            );
                          }
                        }}
                        className="flex-1 bg-green-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-green-700"
                      >
                        导出所有表格
                      </button>
                    </div>
                  </>
                )}
                <button
                  onClick={() => {
                    setLogs([]);
                    setGeneratedTables({});
                  }}
                  className="w-full bg-slate-800 text-slate-400 py-2 rounded-lg hover:bg-slate-700 text-xs font-bold"
                >
                  清空
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 主体表格映射模态框 */}
      {showEntityTableMapping && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowEntityTableMapping(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-3xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-slate-800">
                主体表格映射关系
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenBankAccountConfigFile}
                  className="text-[11px] font-bold text-blue-600 border border-blue-200 px-3 py-1 rounded hover:bg-blue-50 transition-colors flex items-center gap-1"
                  title="在文件管理器中打开 backAccount.json 配置文件"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                  打开配置文件
                </button>
                <button
                  onClick={handleRefreshBankAccountConfig}
                  className="text-[11px] font-bold text-green-600 border border-green-200 px-3 py-1 rounded hover:bg-green-50 transition-colors flex items-center gap-1"
                  title="重新加载 backAccount.json 配置文件"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  刷新配置
                </button>
                <button
                  onClick={() => setShowEntityTableMapping(false)}
                  className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {Object.keys(entityTableMapping).length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm italic">
                  暂无数据，请检查 backAccount.json 配置文件
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(entityTableMapping).map(
                    ([template, entities]) => (
                      <div
                        key={template}
                        className="border rounded-xl p-4 bg-slate-50"
                      >
                        <div className="mb-3">
                          <span className="text-sm font-bold text-blue-800">
                            {template}
                          </span>
                          <span className="text-xs text-slate-400 ml-2">
                            对应的主体：
                          </span>
                        </div>
                        <div className="bg-white rounded-lg p-3 border">
                          <div className="flex flex-wrap gap-2">
                            {(entities as string[]).map((entity, idx) => (
                              <span
                                key={idx}
                                className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium"
                              >
                                {entity}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 表格选择模态框 */}
      {showTableSelector && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowTableSelector(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-slate-800">
                选择要预览的表格
              </h2>
              <button
                onClick={() => setShowTableSelector(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {Object.keys(generatedTables).map((tableName) => (
                <button
                  key={tableName}
                  onClick={() => {
                    setPreviewTableName(tableName);
                    setShowTableSelector(false);
                    setShowPreview(true);
                  }}
                  className="w-full p-4 text-left bg-slate-50 hover:bg-blue-50 border border-slate-200 rounded-lg transition-colors"
                >
                  <div className="font-bold text-slate-700">{tableName}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {generatedTables[tableName].length > 1
                      ? `${generatedTables[tableName].length - 1} 行数据`
                      : '暂无数据'}
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowTableSelector(false)}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 text-sm font-bold"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 预览表格模态框 */}
      {showPreview && previewTableName && generatedTables[previewTableName] && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 overflow-hidden flex flex-col"
            style={{ width: '80vw', height: '80vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-slate-800">
                预览表格: {previewTableName}
              </h2>
              <button
                onClick={() => setShowPreview(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-auto border rounded-lg">
              <table className="w-full text-sm border-collapse table-fixed">
                <colgroup>
                  {generatedTables[previewTableName].length > 0 &&
                    generatedTables[previewTableName][0].map(
                      (_, idx: number) => (
                        <col key={idx} style={{ width: '150px' }} />
                      )
                    )}
                </colgroup>
                <thead className="bg-slate-100 sticky top-0">
                  {generatedTables[previewTableName].length > 0 && (
                    <tr>
                      {generatedTables[previewTableName][0].map(
                        (header: string, idx: number) => (
                          <th
                            key={idx}
                            className="px-4 py-2 text-left border border-slate-300 font-bold text-slate-700 overflow-hidden text-ellipsis whitespace-nowrap"
                            title={header}
                          >
                            {header}
                          </th>
                        )
                      )}
                    </tr>
                  )}
                </thead>
                <tbody>
                  {generatedTables[previewTableName]
                    .slice(1)
                    .map((row: any[], rowIdx: number) => (
                      <tr key={rowIdx} className="hover:bg-slate-50">
                        {row.map((cell: any, cellIdx: number) => {
                          const cellValue =
                            cell !== null && cell !== undefined
                              ? String(cell)
                              : '';
                          return (
                            <td
                              key={cellIdx}
                              className="px-4 py-2 border border-slate-200 text-slate-600 overflow-hidden text-ellipsis whitespace-nowrap"
                              title={cellValue}
                            >
                              {cellValue}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                </tbody>
              </table>
              {generatedTables[previewTableName].length <= 1 && (
                <div className="text-center py-8 text-slate-400 text-sm italic">
                  暂无数据
                </div>
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-bold"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiTool;
