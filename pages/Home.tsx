
import React, { useState, useEffect, useRef } from 'react';
import { BankFile, Transaction } from '../types';
import { COLORS } from '../constants';
import { processBankFiles, exportToExcel, SummaryRow } from '../utils/excelProcessor';
import { classifyByFeeDetail, summarizeHistoryCategories, getClassificationSystemPrompt, getClassificationUserPrompt, getSummarySystemPrompt, getSummaryUserPrompt } from '../services/zhipuService';
import { loadCategoricalData } from '../utils/configLoader';
import { processHistoryFiles, HistoryCategoryData } from '../utils/historyProcessor';
import { loadSummaryHeaders, getDefaultSummaryHeaders, loadBankAccounts } from '../utils/configLoader';
import { useProcessing } from '../contexts/ProcessingContext';

const Home: React.FC = () => {
  // Data Source State
  const [bankFiles, setBankFiles] = useState<BankFile[]>([]);
  const [historyFiles, setHistoryFiles] = useState<BankFile[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyCount, setHistoryCount] = useState(0);
  const [historyData, setHistoryData] = useState<HistoryCategoryData[]>([]);
  const [historySummary, setHistorySummary] = useState<string>('');
  const [pendingFeeDetails, setPendingFeeDetails] = useState<Array<{ id: string; 费用明细: string }>>([]);

  // Configuration State
  const [threshold, setThreshold] = useState(0.8);

  // 使用全局处理状态
  const { setIsProcessing } = useProcessing();
  
  // Execution State
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<Transaction[]>([]);
  const [summaryData, setSummaryData] = useState<SummaryRow[]>([]);
  const [aiClassificationRate, setAiClassificationRate] = useState<number>(0);
  const [unclassifiedRate, setUnclassifiedRate] = useState<number>(0);
  const [isTableExpanded, setIsTableExpanded] = useState<boolean>(false);
  const [summaryHeaders, setSummaryHeaders] = useState<string[]>(getDefaultSummaryHeaders());
  const [categoricalData, setCategoricalData] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<Record<string, any>>({});

  const logEndRef = useRef<HTMLDivElement>(null);
  
  // 同步本地 processing 状态到全局状态
  useEffect(() => {
    setIsProcessing(processing);
  }, [processing, setIsProcessing]);

  // 从用户数据目录加载汇总表头、分类数据和银行账号配置
  useEffect(() => {
    Promise.all([
      loadSummaryHeaders(),
      loadCategoricalData(),
      loadBankAccounts()
    ]).then(([headers, categorical, accounts]) => {
      setSummaryHeaders(headers);
      setCategoricalData(categorical);
      setBankAccounts(accounts);
    });
  }, []);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // ESC 键关闭全屏表格
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isTableExpanded) {
        setIsTableExpanded(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isTableExpanded]);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `${time} ${msg}`]);
  };

  /**
   * 处理文件上传
   * @param e - 文件输入事件
   * @param isBank - 是否为银行流水文件
   */
  /**
   * 处理文件上传
   * @param e - 文件输入事件
   * @param isBank - 是否为银行流水文件
   */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isBank: boolean) => {
    // Fix: Explicitly cast Array.from result to File[] to avoid 'unknown' type errors for f.name and f.size
    const files = Array.from(e.target.files || []) as File[];
    if (isBank) {
      const newFiles: BankFile[] = files.map(f => ({
        id: Math.random().toString(36).substr(2, 9),
        name: f.name,
        size: (f.size / 1024).toFixed(2) + ' KB',
        uploadTime: new Date().toLocaleString(),
        status: 'uploaded',
        file: f, // 保存 File 对象
        bankAccount: '' // 初始为空，用户需要选择
      }));
      setBankFiles(prev => [...prev, ...newFiles]);
    } else {
      // 历史分类表文件
      const newFiles: BankFile[] = files.map(f => ({
        id: Math.random().toString(36).substr(2, 9),
        name: f.name,
        size: (f.size / 1024).toFixed(2) + ' KB',
        uploadTime: new Date().toLocaleString(),
        status: 'uploaded',
        file: f
      }));
      setHistoryFiles(prev => [...prev, ...newFiles]);
      
      // 处理历史分类文件
      try {
        const validFiles = newFiles.filter(bf => bf.file).map(bf => bf.file!);
        if (validFiles.length > 0) {
          const data = await processHistoryFiles(validFiles);
          setHistoryData(data);
          setHistoryCount(data.length);
          setHistoryLoaded(true);
          addLog(`已加载历史分类数据：${data.length} 条`);
        }
      } catch (error: any) {
        console.error('处理历史分类文件失败:', error);
        alert(`处理历史分类文件失败: ${error.message}`);
      }
    }
    // 清空 input 值，允许重复选择同一文件
    e.target.value = '';
  };

  /**
   * 启动处理流程
   */
  const startProcessing = async () => {
    if (bankFiles.length === 0) {
      alert("请先上传银行流水文件");
      return;
    }

    // 银行账号为可选：未选择时将用汇总表中「辅助copy原数据账号」列到 bankAccounts 中查找并回填

    // 检查是否有有效的文件对象
    const validFiles = bankFiles.filter(bf => bf.file).map(bf => bf.file!);
    if (validFiles.length === 0) {
      alert("请上传有效的 Excel 文件");
      return;
    }

    setProcessing(true);
    setProgress(0);
    setLogs([]);
    setSummaryData([]);
    setAiClassificationRate(0);
    setUnclassifiedRate(0);
    addLog("开始处理银行流水文件...");
    
    try {
      // 第一步：处理银行流水文件，生成汇总表
      setProgress(10);
      addLog(`开始读取 ${validFiles.length} 个银行流水文件...`);
      
      // 构建文件与银行账号的映射关系
      const fileAccountMap: Record<string, string> = {};
      bankFiles.forEach(bf => {
        if (bf.file && bf.bankAccount) {
          fileAccountMap[bf.file.name] = bf.bankAccount;
        }
      });
      
      const summaryRows = await processBankFiles(validFiles, fileAccountMap);
      
      setProgress(50);
      addLog(`成功生成汇总表，共 ${summaryRows.length} 条数据`);
      
      // 保存汇总数据
      setSummaryData(summaryRows);
      
      // 转换为 Transaction 格式用于显示（如果需要）
      const transactions: Transaction[] = summaryRows.map((row, index) => ({
        id: `t-${index}`,
        date: String(row['日期'] || ''),
        amount: (typeof row['本期收入'] === 'number' ? row['本期收入'] : 0) || 
                (typeof row['本期支出'] === 'number' ? Math.abs(row['本期支出']) : 0),
        description: String(row['费用明细'] || ''),
        bank: String(row['银行账户'] || ''),
        category1: String(row['类型（一级）'] || '未分类'),
        category2: String(row['类型（二级）'] || '未分类'),
        category3: String(row['类型（三级）'] || '未分类'),
        status: 'unclassified'
      }));
      
      setResults(transactions);
      
      // 第二步：使用 AI 进行分类（分类结果限制在 categoricalData.json 中）
      // 提取需要分类的费用明细
      const feeDetailsToClassify = summaryRows
        .map((row, index) => {
          const income = row['本期收入'];
          const expenditure = row['本期支出'];
          // 根据"本期收入"和"本期支出"自动判断"收/支"
          let typeOfIncomeAndExpenditure = '';
          if (income && (typeof income === 'number' ? income !== 0 : String(income).trim() !== '')) {
            typeOfIncomeAndExpenditure = '收';
          } else if (expenditure && (typeof expenditure === 'number' ? expenditure !== 0 : String(expenditure).trim() !== '')) {
            typeOfIncomeAndExpenditure = '支';
          }
          
          return {
            id: `row-${index}`,
            费用明细: String(row['费用明细'] || '').trim(),
            '本期收入': income,
            '本期支出': expenditure,
            '收/支': typeOfIncomeAndExpenditure
          };
        })
        .filter(item => item.费用明细);
      
      // 保存待分类的费用明细，用于展示 userPrompt
      setPendingFeeDetails(feeDetailsToClassify);
      
      // 如果上传了历史分类表，先总结历史分类规律
      if (historyFiles.length > 0 && historyLoaded && historyData.length > 0) {
        setProgress(60);
        addLog("开始使用 AI 总结历史分类规律...");
        
        try {
          // 总结历史分类关系
          const summary = await summarizeHistoryCategories(historyData);
          setHistorySummary(summary);
          addLog("AI 总结历史分类规律完成");
        } catch (error: any) {
          console.error('AI 总结失败:', error);
          addLog(`AI 总结失败: ${error.message || '未知错误'}`);
          // 即使总结失败，也继续执行分类
        }
      } else {
        setProgress(60);
        addLog("未上传历史分类表，跳过 AI 总结步骤");
        addLog("提示：上传历史分类表可以获得更准确的 AI 分类结果");
      }
      
      // 无论是否上传历史分类表，都执行 AI 分类
      if (feeDetailsToClassify.length > 0) {
        setProgress(70);
        addLog("开始使用 AI 对费用明细进行自动分类...");
        addLog("请稍等...");
        try {
          // 用于实时更新汇总表的回调函数
          const updateSummaryWithBatchResults = (batchResults: Array<{id: string, category1: string, category2: string, category3: string, c: number}>) => {
            setSummaryData(prevSummaryRows => {
              // 基于当前汇总表数据更新
              const updatedRows = prevSummaryRows.map((row, index) => {
                const rowId = `row-${index}`;
                const classification = batchResults.find(r => r.id === rowId);
                
                if (classification && ((classification as any).c || (classification as any).confidence || 0) >= threshold) {
                  return {
                    ...row,
                    '类型（一级）': classification.category1,
                    '类型（二级）': classification.category2,
                    '类型（三级）': classification.category3
                  };
                }
                return row;
              });
              
              // 同时更新显示用的 transactions
              const updatedTransactions: Transaction[] = updatedRows.map((row, index) => ({
                id: `t-${index}`,
                date: String(row['日期'] || ''),
                amount: (typeof row['本期收入'] === 'number' ? row['本期收入'] : 0) || 
                        (typeof row['本期支出'] === 'number' ? Math.abs(row['本期支出']) : 0),
                description: String(row['费用明细'] || ''),
                bank: String(row['银行账户'] || ''),
                category1: String(row['类型（一级）'] || '未分类'),
                category2: String(row['类型（二级）'] || '未分类'),
                category3: String(row['类型（三级）'] || '未分类'),
                status: row['类型（一级）'] && row['类型（一级）'] !== '未分类' ? 'ai-classified' : 'unclassified'
              }));
              
              setResults(updatedTransactions);
              
              return updatedRows;
            });
            
            addLog(`实时更新：已处理 ${batchResults.length} 条分类结果`);
          };
          
          // 使用 AI 进行分类（结果会限制在 categoricalData.json 中）
          // 如果没有历史总结，传入空字符串
          // 传入回调函数，每处理完一批就实时更新汇总表
          const classificationResults = await classifyByFeeDetail(
            feeDetailsToClassify,
            historySummary || '',
            historyData,
            threshold,
            updateSummaryWithBatchResults
          );
          
          setProgress(85);
          addLog(`AI 分类完成，共处理 ${classificationResults.length} 条费用明细`);
          
          // 最终检查：确保所有结果都已更新到汇总表
          setSummaryData(prevSummaryRows => {
            const updatedRows = prevSummaryRows.map((row, index) => {
              const rowId = `row-${index}`;
              const classification = classificationResults.find(r => r.id === rowId);
              
              if (classification && ((classification as any).c || (classification as any).confidence || 0) >= threshold) {
                return {
                  ...row,
                  '类型（一级）': classification.category1,
                  '类型（二级）': classification.category2,
                  '类型（三级）': classification.category3
                };
              }
              return row;
            });
            
            // 更新显示用的 transactions
            const updatedTransactions: Transaction[] = updatedRows.map((row, index) => ({
              id: `t-${index}`,
              date: String(row['日期'] || ''),
              amount: (typeof row['本期收入'] === 'number' ? row['本期收入'] : 0) || 
                      (typeof row['本期支出'] === 'number' ? Math.abs(row['本期支出']) : 0),
              description: String(row['费用明细'] || ''),
              bank: String(row['银行账户'] || ''),
              category1: String(row['类型（一级）'] || '未分类'),
              category2: String(row['类型（二级）'] || '未分类'),
              category3: String(row['类型（三级）'] || '未分类'),
              status: row['类型（一级）'] && row['类型（一级）'] !== '未分类' ? 'ai-classified' : 'unclassified'
            }));
            
            setResults(updatedTransactions);
            
            // 计算AI分类率和未分类率（基于更新后的数据）
            const totalCount = updatedRows.length;
            if (totalCount > 0) {
              // 统计已分类的数量（有类型（一级）且不为空）
              const classifiedCount = updatedRows.filter(row => {
                const category1 = String(row['类型（一级）'] || '').trim();
                return category1 && category1 !== '未分类' && category1 !== '';
              }).length;
              
              const aiRate = (classifiedCount / totalCount) * 100;
              const unclassifiedRate = ((totalCount - classifiedCount) / totalCount) * 100;
              setAiClassificationRate(Math.round(aiRate * 100) / 100);
              setUnclassifiedRate(Math.round(unclassifiedRate * 100) / 100);
            }
            
            return updatedRows;
          });
          
          const matchedCount = classificationResults.filter(r => ((r as any).c || (r as any).confidence || 0) >= threshold).length;
          addLog(`成功匹配并填回 ${matchedCount} 条分类结果`);
        } catch (error: any) {
          console.error('AI 分类失败:', error);
          addLog(`AI 分类失败: ${error.message || '未知错误'}`);
          // 即使 AI 分类失败，也继续使用原始汇总数据
        }
      } else {
        addLog("没有需要分类的费用明细");
        // 如果没有需要分类的数据，基于当前 summaryData 计算统计数据
        setSummaryData(prevSummaryRows => {
          const totalCount = prevSummaryRows.length;
          if (totalCount > 0) {
            // 统计已分类的数量（有类型（一级）且不为空）
            const classifiedCount = prevSummaryRows.filter(row => {
              const category1 = String(row['类型（一级）'] || '').trim();
              return category1 && category1 !== '未分类' && category1 !== '';
            }).length;
            
            const aiRate = (classifiedCount / totalCount) * 100;
            const unclassifiedRate = ((totalCount - classifiedCount) / totalCount) * 100;
            setAiClassificationRate(Math.round(aiRate * 100) / 100);
            setUnclassifiedRate(Math.round(unclassifiedRate * 100) / 100);
          }
          return prevSummaryRows;
        });
      }

      setProgress(100);
      addLog(`处理完成！共生成 ${summaryRows.length} 条汇总数据。`);
    } catch (error: any) {
      console.error('处理失败:', error);
      addLog(`处理失败: ${error.message || '未知错误'}`);
      alert(`处理失败: ${error.message || '请检查文件格式是否正确'}`);
    } finally {
      setProcessing(false);
    }
  };

  /**
   * 导出汇总表为 Excel
   */
  const handleExportExcel = async () => {
    if (summaryData.length === 0) {
      alert("暂无数据可导出");
      return;
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `银行流水汇总表_${timestamp}.xlsx`;
    
    try {
      await exportToExcel(summaryData, filename);
      addLog(`已导出汇总表：${filename}`);
    } catch (error: any) {
      console.error('导出失败:', error);
      addLog(`导出失败: ${error.message || '未知错误'}`);
      alert(`导出失败: ${error.message || '请重试'}`);
    }
  };

  return (
    <div className="grid grid-cols-12 gap-6 h-full pb-10">
      {/* Left: Data Source Config (Col 3) */}
      <div className="col-span-3 space-y-6">
        {/* Bank Upload */}
        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm flex flex-col min-h-[400px]">
          <h2 className="text-[16px] font-bold mb-4 flex items-center">
            <span className="w-1.5 h-6 bg-blue-600 mr-2 rounded-full"></span>
            银行流水上传区
          </h2>
          <div className="flex-1 flex flex-col">
            <label className="border-2 border-dashed border-blue-200 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 transition-colors bg-blue-50/20 mb-4">
              <svg className="w-12 h-12 text-blue-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="text-sm text-gray-500 text-center">拖拽 xlsx 文件到此处 / 点击选择文件</span>
              <input type="file" multiple className="hidden" onChange={(e) => handleFileUpload(e, true)} accept=".xlsx" />
            </label>
            <div className="overflow-y-auto max-h-[300px] space-y-2">
              {bankFiles.map(file => (
                <div key={file.id} className="text-xs p-2 bg-gray-50 border rounded group">
                  <div className="flex justify-between items-start mb-2">
                    <div className="truncate flex-1 pr-2">
                      <p className="font-medium truncate">{file.name}</p>
                      <p className="text-[10px] text-gray-400">{file.size} - {file.uploadTime}</p>
                    </div>
                    <button onClick={() => setBankFiles(prev => prev.filter(f => f.id !== file.id))} className="text-red-400 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <div className="mt-2">
                    <label className="block text-[10px] text-gray-600 mb-1">银行账号（可选）：</label>
                    <select
                      value={file.bankAccount || ''}
                      onChange={(e) => {
                        setBankFiles(prev => prev.map(f => 
                          f.id === file.id ? { ...f, bankAccount: e.target.value } : f
                        ));
                      }}
                      className="w-full text-xs px-2 py-1 border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">按「辅助copy原数据账号」列匹配</option>
                      {Object.keys(bankAccounts).map(accountKey => (
                        <option key={accountKey} value={accountKey}>
                          {accountKey} - {bankAccounts[accountKey]?.银行账户 || accountKey}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
              {bankFiles.length === 0 && <p className="text-center text-gray-400 text-xs py-4">暂无上传文件</p>}
            </div>
          </div>
        </div>

        {/* History Upload */}
        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm flex flex-col min-h-[300px]">
          <h2 className="text-[16px] font-bold mb-4 flex items-center">
            <span className="w-1.5 h-6 bg-gray-400 mr-2 rounded-full"></span>
            历史分类表上传区
          </h2>
          <div className="flex-1 flex flex-col">
            <label 
              htmlFor="history-file-input"
              className={`border-2 border-dashed ${historyFiles.length > 0 ? 'border-green-200 bg-green-50/10' : 'border-gray-200'} rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors mb-4`}
            >
              <span className="text-xs text-gray-500 mb-2">支持多文件上传（Excel 和 JSON），历史数据提升 AI 准确率</span>
              <span className="px-4 py-1.5 bg-gray-600 text-white rounded text-sm font-medium hover:bg-gray-700 pointer-events-none">选择文件</span>
              <input 
                id="history-file-input"
                type="file" 
                multiple 
                className="hidden" 
                onChange={(e) => handleFileUpload(e, false)} 
                accept=".xlsx,.xls,.json" 
              />
            </label>
            <div className="overflow-y-auto max-h-[120px] space-y-2">
              {historyFiles.map(file => (
                <div key={file.id} className="text-xs p-2 bg-gray-50 border rounded flex justify-between items-center group">
                  <div className="truncate flex-1 pr-2">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-[10px] text-gray-400">{file.size} - {file.uploadTime}</p>
                  </div>
                  <button onClick={() => {
                    setHistoryFiles(prev => prev.filter(f => f.id !== file.id));
                    if (historyFiles.length === 1) {
                      setHistoryLoaded(false);
                      setHistoryCount(0);
                      setHistoryData([]);
                      setHistorySummary('');
                    }
                  }} className="text-red-400 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
              {historyFiles.length === 0 && <p className="text-center text-gray-400 text-xs py-4">暂无上传文件</p>}
            </div>
            {historyLoaded && (
              <div className="mt-3 flex items-center space-x-2 text-xs text-green-600 font-medium">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                <span>历史表状态：已加载 ({historyCount} 条数据)</span>
              </div>
            )}
            <div className="mt-2 flex items-center space-x-2 text-xs text-blue-600 font-medium">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
              <span>提示：AI 分类结果限制在 分类字典 中</span>
            </div>
          </div>
        </div>

        {/* Stats Card */}
        <div className="bg-[#F0FDF4] border border-[#DCFCE7] rounded-lg p-5">
          <p className="text-xs font-semibold text-gray-500 mb-2">数据源状态提示</p>
          <div className="space-y-1">
            <p className="text-sm font-bold text-green-700">银行流水：{bankFiles.length} 份</p>
            <p className="text-sm font-bold text-green-700">历史数据：{historyCount} 条</p>
          </div>
        </div>
      </div>

      {/* Middle: Rules & Task (Col 9) */}
      <div className="col-span-9 flex flex-col space-y-6">
        <div className="grid grid-cols-12 gap-6 flex-1">
          {/* Rule Configs */}
          <div className="col-span-8 flex flex-col space-y-6">
            {/* AI Classification Rules */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 flex-1 flex flex-col">
              <h2 className="text-[16px] font-bold mb-4">AI 分类规则配置</h2>
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600 font-medium">相似度阈值</span>
                  <span className="text-blue-600 font-bold">当前阈值 {threshold.toFixed(1)}</span>
                </div>
                <input 
                  type="range" min="0" max="1" step="0.1" 
                  value={threshold} 
                  onChange={(e) => setThreshold(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
              <div className="flex-1 flex flex-col space-y-4 overflow-auto">
                {/* 分类费用明细的 Prompts */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">User Prompt</h3>
                  <div className="space-y-3">
                    {/* <div className="flex-1 flex flex-col">
                      <label className="text-xs font-medium text-gray-600 mb-1">System Prompt</label>
                      <div className="relative">
                        <textarea 
                          readOnly
                          rows={12}
                          className="w-full border rounded-lg p-3 text-xs bg-gray-100 text-gray-700 resize-none font-mono"
                          value={getClassificationSystemPrompt(historySummary, historyData)}
                        />
                        <div className="absolute top-3 right-3">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold">只读</span>
                        </div>
                      </div>
                    </div> */}
                    <div className="flex-1 flex flex-col">
                      <div className="relative">
                        <textarea 
                          readOnly
                          rows={22}
                          className="w-full border rounded-lg p-3 text-xs bg-gray-100 text-gray-700 resize-none font-mono"
                          value={getClassificationUserPrompt(pendingFeeDetails)}
                        />
                        <div className="absolute top-3 right-3">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold">只读</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Execution Zone (Col 4) */}
          <div className="col-span-4 bg-white rounded-lg border border-gray-200 shadow-sm p-5 flex flex-col">
            <h2 className="text-[16px] font-bold mb-4">任务执行区</h2>
            <button 
              onClick={startProcessing}
              disabled={processing}
              className={`w-full py-3 rounded text-white font-bold text-lg mb-6 transition-all shadow-lg ${
                processing ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600 transform active:scale-95'
              }`}
            >
              {processing ? '处理中...' : '启动分类汇总'}
            </button>
            
            <div className="mb-6">
              <div className="flex justify-between text-xs mb-1 font-medium text-gray-500">
                <span>处理进度</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }}></div>
              </div>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              <h3 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider flex-shrink-0">实时执行日志</h3>
              <div className="flex-1 bg-gray-900 rounded p-3 font-mono text-[11px] overflow-y-auto custom-scrollbar border border-gray-800 min-h-0" style={{ maxHeight: '400px' }}>
                {logs.length === 0 ? (
                  <p className="text-gray-600 italic">等待任务启动...</p>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="mb-1">
                      <span className="text-gray-500 mr-2">[{log.split(' ')[0]}]</span>
                      <span className={log.includes('完成') ? 'text-green-400 font-bold' : 'text-gray-300'}>
                        {log.split(' ').slice(1).join(' ')}
                      </span>
                    </div>
                  ))
                )}
                <div ref={logEndRef} />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom: Results Preview */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 flex flex-col h-[400px] relative">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-[16px] font-bold">汇总表预览</h2>
            <div className="flex items-center space-x-6">
              <div className="flex space-x-4 text-xs">
                <div className="flex flex-col items-center px-3 border-r">
                   <span className="text-gray-500 mb-0.5 font-medium">AI 分类率</span>
                   <span className="text-lg font-bold text-orange-600">{aiClassificationRate.toFixed(1)}%</span>
                </div>
                <div className="flex flex-col items-center px-3">
                   <span className="text-gray-500 mb-0.5 font-medium">未分类</span>
                   <span className="text-lg font-bold text-red-500">{unclassifiedRate.toFixed(1)}%</span>
                </div>
              </div>
              <div className="flex space-x-2">
                <button 
                  onClick={handleExportExcel}
                  disabled={summaryData.length === 0}
                  className={`px-6 py-2 text-white rounded text-sm font-bold shadow-sm ${
                    summaryData.length === 0 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-[#10B981] hover:bg-[#059669]'
                  }`}
                >
                  导出 Excel
                </button>
              </div>
            </div>
          </div>

          {/* 放大按钮 - 固定在表格区域的右上角，不随内容滚动 */}
          <button
            onClick={() => setIsTableExpanded(true)}
            className="absolute top-20 right-10 z-30 p-2 bg-white rounded shadow-md hover:bg-gray-50 border border-gray-200 transition-all"
            title="放大表格"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>

          <div className="flex-1 overflow-auto border rounded relative">
            <table className="w-full text-sm border-collapse min-w-[1200px]">
              <thead className="bg-[#F9FAFB] border-b sticky top-0 z-10">
                <tr>
                  {summaryHeaders.map(h => (
                    <th key={h} className="px-4 py-3 text-left font-bold text-gray-700 whitespace-nowrap cursor-pointer hover:bg-gray-100 group">
                      {h}
                      <svg className="w-3 h-3 inline-block ml-1 opacity-0 group-hover:opacity-100" fill="currentColor" viewBox="0 0 20 20"><path d="M5 10l5 5 5-5H5z"/></svg>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summaryData.length === 0 ? (
                  <tr>
                    <td colSpan={summaryHeaders.length} className="px-4 py-20 text-center text-gray-400 italic">暂无处理结果，请上传数据并点击启动。</td>
                  </tr>
                ) : (
                  summaryData.map((row, i) => (
                    <tr key={i} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50/30 border-b last:border-0`}>
                      {summaryHeaders.map(header => {
                        const value = row[header];
                        // 处理数值字段的显示
                        if (header === '本期收入' || header === '本期支出' || header === '余额') {
                          const numValue = typeof value === 'number' ? value : 0;
                          return (
                            <td key={header} className="px-4 py-3 font-mono text-gray-900">
                              {numValue !== 0 ? numValue.toFixed(2) : ''}
                            </td>
                          );
                        }
                        return (
                          <td key={header} className="px-4 py-3 max-w-[200px] truncate" title={String(value || '')}>
                            {String(value || '')}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 放大表格模态框 - 占据屏幕80% */}
      {isTableExpanded && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={() => setIsTableExpanded(false)}
        >
          <div 
            className="bg-white flex flex-col w-[80vw] h-[80vh] rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
          {/* 放大表格头部 */}
          <div className="flex justify-between items-center p-4 border-b bg-white shadow-sm rounded-t-lg">
            <h2 className="text-xl font-bold">汇总表 - 放大视图</h2>
            <div className="flex items-center space-x-4">
              <div className="flex space-x-4 text-sm">
                <div className="flex flex-col items-center px-3 border-r">
                  <span className="text-gray-500 mb-0.5 font-medium">AI 分类率</span>
                  <span className="text-lg font-bold text-orange-600">{aiClassificationRate.toFixed(1)}%</span>
                </div>
                <div className="flex flex-col items-center px-3">
                  <span className="text-gray-500 mb-0.5 font-medium">未分类</span>
                  <span className="text-lg font-bold text-red-500">{unclassifiedRate.toFixed(1)}%</span>
                </div>
              </div>
              <button
                onClick={handleExportExcel}
                disabled={summaryData.length === 0}
                className={`px-6 py-2 text-white rounded text-sm font-bold shadow-sm ${
                  summaryData.length === 0 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-[#10B981] hover:bg-[#059669]'
                }`}
              >
                导出 Excel
              </button>
              <button
                onClick={() => setIsTableExpanded(false)}
                className="p-2 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                title="关闭全屏"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* 放大表格内容 */}
          <div className="flex-1 overflow-auto p-4 rounded-b-lg">
            <table className="w-full text-sm border-collapse min-w-[1200px]">
              <thead className="bg-[#F9FAFB] border-b sticky top-0 z-10">
                <tr>
                  {summaryHeaders.map(h => (
                    <th key={h} className="px-4 py-3 text-left font-bold text-gray-700 whitespace-nowrap cursor-pointer hover:bg-gray-100 group">
                      {h}
                      <svg className="w-3 h-3 inline-block ml-1 opacity-0 group-hover:opacity-100" fill="currentColor" viewBox="0 0 20 20"><path d="M5 10l5 5 5-5H5z"/></svg>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summaryData.length === 0 ? (
                  <tr>
                    <td colSpan={summaryHeaders.length} className="px-4 py-20 text-center text-gray-400 italic">暂无处理结果，请上传数据并点击启动。</td>
                  </tr>
                ) : (
                  summaryData.map((row, i) => (
                    <tr key={i} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50/30 border-b last:border-0`}>
                      {summaryHeaders.map(header => {
                        const value = row[header];
                        // 处理数值字段的显示
                        if (header === '本期收入' || header === '本期支出' || header === '余额') {
                          const numValue = typeof value === 'number' ? value : 0;
                          return (
                            <td key={header} className="px-4 py-3 font-mono text-gray-900">
                              {numValue !== 0 ? numValue.toFixed(2) : ''}
                            </td>
                          );
                        }
                        return (
                          <td key={header} className="px-4 py-3 max-w-[200px] truncate" title={String(value || '')}>
                            {String(value || '')}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
