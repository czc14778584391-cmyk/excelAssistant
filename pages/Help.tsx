
import React, { useState } from 'react';
import { HelpTab } from '../types';

const Help: React.FC = () => {
  const [activeTab, setActiveTab] = useState<HelpTab>('guide');

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b rounded-t-lg shadow-sm mb-6">
        <div className="flex px-4">
          {(['guide', 'faq', 'logs'] as HelpTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-8 py-4 font-bold text-sm border-b-2 transition-all ${
                activeTab === tab 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab === 'guide' ? '操作指南' : tab === 'faq' ? '常见问题' : '任务日志查询'}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 bg-white rounded-b-lg p-8 overflow-auto border shadow-sm">
        {activeTab === 'guide' && <OperationGuide />}
        {activeTab === 'faq' && <FAQ />}
        {activeTab === 'logs' && <TaskLogs />}
      </div>
    </div>
  );
};

const OperationGuide = () => (
  <div className="max-w-4xl mx-auto space-y-12 pb-20">
    <div className="text-center">
      <h2 className="text-3xl font-bold text-gray-800 mb-4">欢迎使用银流智能助手</h2>
      <p className="text-gray-500">仅需 4 步，轻松完成复杂的银行流水分类汇总</p>
    </div>
    
    <div className="grid grid-cols-1 gap-10">
      {[
        { step: '01', title: '数据准备', desc: '上传您的银行流水 (xlsx) 和可选的历史分类汇总表，历史表越多 AI 越聪明。' },
        { step: '02', title: '规则确认', desc: '在中间区域确认字段映射是否正确，如有特殊需求可调整 AI 分类相似度阈值。' },
        { step: '03', title: '智能分类', desc: '点击“启动分类汇总”按钮，后台将自动进行清洗、去重和 AI 分类标注。' },
        { step: '04', title: '预览与导出', desc: '检查底部的分类结果，确认无误后点击“导出 Excel”保存结果。' }
      ].map((item, i) => (
        <div key={i} className="flex space-x-6 items-start group">
          <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-2xl font-black group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
            {item.step}
          </div>
          <div className="flex-1 pt-2">
             <h4 className="text-xl font-bold text-gray-800 mb-2">{item.title}</h4>
             <p className="text-gray-500 leading-relaxed">{item.desc}</p>
             <div className="mt-4 w-full h-48 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-center overflow-hidden">
                <img src={`https://picsum.photos/seed/guide${i}/800/200`} alt="step guide" className="object-cover w-full opacity-60" />
                <span className="absolute text-xs text-gray-400 font-bold uppercase tracking-widest">UI 演示截图</span>
             </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const FAQ = () => (
  <div className="max-w-4xl mx-auto">
     <div className="relative mb-10">
        <input type="text" placeholder="搜索问题关键字..." className="w-full border-2 rounded-xl py-3 px-12 outline-none focus:border-blue-500 shadow-sm" />
        <svg className="w-6 h-6 absolute left-4 top-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
     </div>
     <div className="space-y-4">
        {[
          '上传文件提示“格式错误”怎么办？',
          'AI 分类准确率不理想如何优化？',
          '如何定义自己的三级科目字典？',
          '支持处理多大的文件？',
          '处理失败重试次数上限是多少？'
        ].map((q, i) => (
          <div key={i} className="border rounded-lg overflow-hidden group">
             <div className="px-6 py-4 bg-gray-50 flex justify-between items-center cursor-pointer group-hover:bg-blue-50 transition-colors">
               <span className="font-bold text-gray-700">{q}</span>
               <span className="text-gray-400 group-hover:text-blue-500">▼</span>
             </div>
             {i === 1 && (
               <div className="px-6 py-4 bg-white text-sm text-gray-600 border-t">
                 建议：1. 增加历史样本数量；2. 在配置页适当降低“相似度阈值”；3. 检查银行流水中的“摘要”信息是否完整。
               </div>
             )}
          </div>
        ))}
     </div>
  </div>
);

const TaskLogs = () => (
  <div>
     <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-lg">历史任务执行日志</h3>
        <div className="flex space-x-2">
           <input type="date" className="border rounded px-3 py-1.5 text-sm" />
           <button className="bg-gray-800 text-white px-4 py-1.5 rounded text-sm font-bold">导出全局日志</button>
        </div>
     </div>
     <div className="border rounded overflow-hidden">
        <table className="w-full text-sm">
           <thead className="bg-gray-100">
             <tr>
               <th className="px-6 py-3 text-left">任务时间</th>
               <th className="px-6 py-3 text-left">状态</th>
               <th className="px-6 py-3 text-center">处理条数</th>
               <th className="px-6 py-3 text-center">耗时</th>
               <th className="px-6 py-3 text-center">操作</th>
             </tr>
           </thead>
           <tbody className="divide-y text-gray-600">
             {[...Array(8)].map((_, i) => (
               <tr key={i} className="hover:bg-gray-50">
                 <td className="px-6 py-4">2023-11-20 14:30:{i}2</td>
                 <td className="px-6 py-4">
                   <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">SUCCESS</span>
                 </td>
                 <td className="px-6 py-4 text-center">200 条</td>
                 <td className="px-6 py-4 text-center">15s</td>
                 <td className="px-6 py-4 text-center">
                    <button className="text-blue-600 hover:underline">查看详情</button>
                 </td>
               </tr>
             ))}
           </tbody>
        </table>
     </div>
  </div>
);

export default Help;
