import React, { useState } from 'react';
import ConfigJsonEditor from './ConfigJsonEditor';

/**
 * 字段映射配置使用文档页面
 */
const FieldMappingDoc: React.FC = () => {
  const [showConfigEditor, setShowConfigEditor] = useState(false);

  return (
    <div className="h-full flex flex-col bg-gray-50" style={{ height: '1050px', overflow: 'hidden' }}>
      <div className="flex-1 bg-white rounded-lg m-4 overflow-y-auto border shadow-sm" style={{ minHeight: 0 }}>
        <div className="max-w-5xl mx-auto px-8 py-10 space-y-10">
          {/* 编辑配置：固定视口右上角，滚动时不动（顶栏 80px 下） */}
          <button
            type="button"
            onClick={() => setShowConfigEditor(true)}
            className="fixed top-[150px] right-20 z-40 px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
          >
            编辑配置
          </button>

          {/* 标题 */}
          <div className="text-center border-b pb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-3">字段映射配置使用文档</h1>
            <p className="text-lg text-gray-600">灵活强大的字段映射配置，支持多种数据处理场景</p>
          </div>

          {/* 编辑配置弹框 */}
          {showConfigEditor && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
              <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full h-[85vh] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50 shrink-0">
                  <h2 className="text-lg font-bold text-gray-900">编辑配置</h2>
                  <button
                    type="button"
                    onClick={() => setShowConfigEditor(false)}
                    className="px-3 py-1.5 text-sm font-bold text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    关闭
                  </button>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <ConfigJsonEditor />
                </div>
              </div>
            </div>
          )}

          {/* 目录 */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100 shadow-sm">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              目录
            </h2>
            <ul className="grid grid-cols-2 md:grid-cols-3 gap-3 text-gray-700">
              <li><a href="#overview" className="hover:text-blue-600 hover:underline transition-colors flex items-center">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></span>概述
              </a></li>
              <li><a href="#basic-syntax" className="hover:text-blue-600 hover:underline transition-colors flex items-center">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></span>基础语法
              </a></li>
              <li><a href="#features" className="hover:text-blue-600 hover:underline transition-colors flex items-center">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></span>功能详解
              </a></li>
              <li><a href="#examples" className="hover:text-blue-600 hover:underline transition-colors flex items-center">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></span>使用示例
              </a></li>
              <li><a href="#faq" className="hover:text-blue-600 hover:underline transition-colors flex items-center">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></span>常见问题
              </a></li>
            </ul>
          </div>

          {/* 概述 */}
          <section id="overview" className="space-y-6 scroll-mt-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-1 h-8 bg-blue-600 rounded"></div>
              <h2 className="text-3xl font-bold text-gray-900">概述</h2>
            </div>
            <p className="text-gray-700 leading-relaxed text-lg">
              字段映射配置用于将源表格的字段映射到目标表格的字段，支持多种灵活的映射方式，包括字段查找、拼接、格式化、计算等功能。
            </p>
            
  

            <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
              <h3 className="font-bold text-gray-900 mb-3 text-lg">配置文件格式</h3>
              <pre className="bg-gray-900 text-green-400 p-5 rounded-lg overflow-x-auto text-sm font-mono leading-relaxed shadow-inner border border-gray-700">
{`{
  "表格名称": {
    "目标字段1": "映射表达式1",
    "目标字段2": "映射表达式2"
  }
}`}
              </pre>
            </div>
          </section>

          {/* 基础语法 */}
          <section id="basic-syntax" className="space-y-8 scroll-mt-4">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-1 h-8 bg-blue-600 rounded"></div>
              <h2 className="text-3xl font-bold text-gray-900">基础语法</h2>
            </div>
            
            <div className="space-y-6">
              <div className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center mb-3">
                  <span className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center font-bold mr-3 text-sm">1</span>
                  <h3 className="font-bold text-xl text-gray-900">单个字段映射</h3>
                </div>
                <p className="text-gray-700 mb-4">最简单的映射方式，直接指定源字段名：</p>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm font-mono mb-4 border border-gray-700">
{`{
  "*账号": "银行卡号"
}`}
                </pre>
                <div className="bg-gray-50 border-l-4 border-blue-500 p-3 rounded-r text-sm text-gray-700">
                  <strong>说明：</strong>目标字段 <code className="bg-gray-200 px-1.5 py-0.5 rounded font-mono text-blue-700">*账号</code> 的值来自源表格的 <code className="bg-gray-200 px-1.5 py-0.5 rounded font-mono text-blue-700">银行卡号</code> 字段。
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center mb-3">
                  <span className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center font-bold mr-3 text-sm">2</span>
                  <h3 className="font-bold text-xl text-gray-900">字段拼接（&）</h3>
                </div>
                <p className="text-gray-700 mb-4">使用 <code className="bg-gray-200 px-1.5 py-0.5 rounded font-mono text-blue-700">&</code> 连接多个字段或固定文字：</p>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm font-mono mb-4 border border-gray-700">
{`{
  "*用途": "付款申请单号&'这种用途'",
  "开户地": "省&'省'&市&'市'"
}`}
                </pre>
                <div className="bg-gray-50 border-l-4 border-blue-500 p-3 rounded-r text-sm text-gray-700">
                  <strong>说明：</strong><code className="bg-gray-200 px-1.5 py-0.5 rounded font-mono text-blue-700">付款申请单号&'这种用途'</code> 将 <code className="bg-gray-200 px-1.5 py-0.5 rounded font-mono text-blue-700">付款申请单号</code> 字段的值与固定文字 <code className="bg-gray-200 px-1.5 py-0.5 rounded font-mono text-blue-700">这种用途</code> 拼接。
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center mb-3">
                  <span className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center font-bold mr-3 text-sm">3</span>
                  <h3 className="font-bold text-xl text-gray-900">固定文字（单引号）</h3>
                </div>
                <p className="text-gray-700 mb-4">使用单引号 <code className="bg-gray-200 px-1.5 py-0.5 rounded font-mono text-blue-700">'</code> 包裹固定文字：</p>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm font-mono mb-4 border border-gray-700">
{`{
  "备注": "'固定备注文字'"
}`}
                </pre>
                <div className="bg-gray-50 border-l-4 border-blue-500 p-3 rounded-r text-sm text-gray-700">
                  <strong>说明：</strong>目标字段的值直接使用固定文字，不依赖源字段。
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center mb-3">
                  <span className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center font-bold mr-3 text-sm">4</span>
                  <h3 className="font-bold text-xl text-gray-900">或关系（|）</h3>
                </div>
                <p className="text-gray-700 mb-4">使用 <code className="bg-gray-200 px-1.5 py-0.5 rounded font-mono text-blue-700">|</code> 分隔多个可能的源字段，系统会查找第一个存在的字段：</p>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm font-mono mb-4 border border-gray-700">
{`{
  "*金额": "本次付款金额|支出|消费"
}`}
                </pre>
                <div className="bg-gray-50 border-l-4 border-blue-500 p-3 rounded-r text-sm text-gray-700">
                  <strong>说明：</strong>依次查找 <code className="bg-gray-200 px-1.5 py-0.5 rounded font-mono text-blue-700">本次付款金额</code>、<code className="bg-gray-200 px-1.5 py-0.5 rounded font-mono text-blue-700">支出</code>、<code className="bg-gray-200 px-1.5 py-0.5 rounded font-mono text-blue-700">消费</code> 字段，使用第一个找到的字段值。
                </div>
              </div>
            </div>
          </section>

          {/* 功能详解 */}
          <section id="features" className="space-y-8 scroll-mt-4">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-1 h-8 bg-blue-600 rounded"></div>
              <h2 className="text-3xl font-bold text-gray-900">功能详解</h2>
            </div>
            
            <div className="space-y-6">
              <div className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
                <h3 className="font-bold text-xl text-gray-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  日期格式化
                </h3>
                <p className="text-gray-700 mb-4">使用 <code className="bg-gray-200 px-1.5 py-0.5 rounded font-mono text-blue-700">:date('格式')</code> 对日期字段进行格式化。</p>
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 mb-4 border border-gray-200">
                  <p className="text-sm font-semibold mb-3 text-gray-800">支持的格式占位符：</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div className="flex items-center space-x-2">
                      <code className="bg-white px-2 py-1 rounded border border-gray-300 font-mono text-blue-700">YYYY</code>
                      <span className="text-gray-600">4位年份</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <code className="bg-white px-2 py-1 rounded border border-gray-300 font-mono text-blue-700">MM</code>
                      <span className="text-gray-600">2位月份</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <code className="bg-white px-2 py-1 rounded border border-gray-300 font-mono text-blue-700">DD</code>
                      <span className="text-gray-600">2位日期</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <code className="bg-white px-2 py-1 rounded border border-gray-300 font-mono text-blue-700">HH</code>
                      <span className="text-gray-600">2位小时</span>
                    </div>
                  </div>
                </div>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm font-mono border border-gray-700">
{`{
  "交易日期": "日期:date('YYYY-MM-DD')",
  "创建时间": "时间戳:date('YYYY/MM/DD HH:mm:ss')"
}`}
                </pre>
              </div>

              <div className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
                <h3 className="font-bold text-xl text-gray-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  数值计算
                </h3>
                <p className="text-gray-700 mb-4">使用 <code className="bg-gray-200 px-1.5 py-0.5 rounded font-mono text-blue-700">:calc('表达式')</code> 对数值字段进行数学运算。</p>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm font-mono mb-4 border border-gray-700">
{`{
  "总金额": "金额:calc('*1.1')",
  "含税金额": "金额:calc('*1.13')",
  "加手续费": "金额:calc('+手续费')"
}`}
                </pre>
                <div className="bg-gray-50 border-l-4 border-blue-500 p-3 rounded-r text-sm text-gray-700">
                  <strong>支持的运算符：</strong><code className="bg-gray-200 px-1.5 py-0.5 rounded font-mono text-blue-700 mx-1">+</code>、<code className="bg-gray-200 px-1.5 py-0.5 rounded font-mono text-blue-700 mx-1">-</code>、<code className="bg-gray-200 px-1.5 py-0.5 rounded font-mono text-blue-700 mx-1">*</code>、<code className="bg-gray-200 px-1.5 py-0.5 rounded font-mono text-blue-700 mx-1">/</code>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
                <h3 className="font-bold text-xl text-gray-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  条件判断
                </h3>
                <p className="text-gray-700 mb-4">使用 <code className="bg-gray-200 px-1.5 py-0.5 rounded font-mono text-blue-700">?:</code> 进行三元运算：</p>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm font-mono border border-gray-700">
{`{
  "状态": "是否通过?:'是':'否'",
  "类型": "类型字段?:'默认类型'"
}`}
                </pre>
              </div>

              <div className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
                <h3 className="font-bold text-xl text-gray-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  默认值
                </h3>
                <p className="text-gray-700 mb-4">使用 <code className="bg-gray-200 px-1.5 py-0.5 rounded font-mono text-blue-700">||</code> 当字段为空时使用默认值：</p>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm font-mono border border-gray-700">
{`{
  "名称": "字段名||'默认名称'",
  "备注": "备注字段||'无'"
}`}
                </pre>
              </div>

              <div className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
                <h3 className="font-bold text-xl text-gray-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                  </svg>
                  字符串操作
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-gray-700 mb-2 font-semibold">去除首尾空格：<code className="bg-gray-200 px-1.5 py-0.5 rounded font-mono text-blue-700 ml-1">:trim()</code></p>
                    <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs font-mono border border-gray-700">{`"代码": "代码:trim()"`}</pre>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-gray-700 mb-2 font-semibold">去掉全部空格（如银行卡号）：<code className="bg-gray-200 px-1.5 py-0.5 rounded font-mono text-blue-700 ml-1">:removeSpaces()</code></p>
                    <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs font-mono border border-gray-700">{`"银行卡号": "银行卡号:removeSpaces()"`}</pre>
                    <p className="text-gray-500 text-xs mt-1">6214 8309 3512 3983 → 6214830935123983</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-gray-700 mb-2 font-semibold">大小写转换：<code className="bg-gray-200 px-1.5 py-0.5 rounded font-mono text-blue-700 ml-1">:upper()</code> / <code className="bg-gray-200 px-1.5 py-0.5 rounded font-mono text-blue-700">:lower()</code></p>
                    <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs font-mono border border-gray-700">{`"代码": "代码:upper()"`}</pre>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-gray-700 mb-2 font-semibold">字符串替换：<code className="bg-gray-200 px-1.5 py-0.5 rounded font-mono text-blue-700 ml-1">:replace()</code></p>
                    <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs font-mono border border-gray-700">{`"备注": "原备注:replace('旧','新')"`}</pre>
                    <p className="text-gray-500 text-xs mt-1">去掉空格直接用 <code className="font-mono">:removeSpaces()</code></p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-gray-700 mb-2 font-semibold">字符串截取：<code className="bg-gray-200 px-1.5 py-0.5 rounded font-mono text-blue-700 ml-1">:substring()</code></p>
                    <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs font-mono border border-gray-700">{`"代码": "完整代码:substring(0,5)"`}</pre>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
                <h3 className="font-bold text-xl text-gray-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  链式调用
                </h3>
                <p className="text-gray-700 mb-4">可以连续使用多个函数，按顺序执行：</p>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm font-mono mb-4 border border-gray-700">
{`{
  "代码": "代码:trim():upper()",
  "备注": "备注:trim():replace('旧','新')"
}`}
                </pre>
                <div className="bg-gray-50 border-l-4 border-blue-500 p-3 rounded-r text-sm text-gray-700">
                  <strong>说明：</strong><code className="bg-gray-200 px-1.5 py-0.5 rounded font-mono text-blue-700">代码:trim():upper()</code> 先去除空格，再转大写。
                </div>
              </div>
            </div>
          </section>

          {/* 使用示例 */}
          <section id="examples" className="space-y-8 scroll-mt-4">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-1 h-8 bg-blue-600 rounded"></div>
              <h2 className="text-3xl font-bold text-gray-900">使用示例</h2>
            </div>
            
            <div className="space-y-6">
              <div className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center mb-4">
                  <span className="bg-green-100 text-green-700 w-8 h-8 rounded-full flex items-center justify-center font-bold mr-3 text-sm">1</span>
                  <h3 className="font-bold text-xl text-gray-900">基础映射</h3>
                </div>
                <pre className="bg-gray-900 text-green-400 p-5 rounded-lg overflow-x-auto text-sm font-mono border border-gray-700">
{`{
  "招行代发整理表": {
    "*账号": "银行卡号",
    "*户名": "收款账户",
    "*金额": "本次需打款金额"
  }
}`}
                </pre>
              </div>

              <div className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center mb-4">
                  <span className="bg-green-100 text-green-700 w-8 h-8 rounded-full flex items-center justify-center font-bold mr-3 text-sm">2</span>
                  <h3 className="font-bold text-xl text-gray-900">字段拼接</h3>
                </div>
                <pre className="bg-gray-900 text-green-400 p-5 rounded-lg overflow-x-auto text-sm font-mono border border-gray-700">
{`{
  "招行代发整理表": {
    "*账号": "银行卡号",
    "*户名": "收款账户",
    "*金额": "本次需打款金额",
    "汇款备注": "流程编号&报销",
    "辅助列": "付款主体"
  }
}`}
                </pre>
              </div>

              <div className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center mb-4">
                  <span className="bg-green-100 text-green-700 w-8 h-8 rounded-full flex items-center justify-center font-bold mr-3 text-sm">3</span>
                  <h3 className="font-bold text-xl text-gray-900">复杂混合场景</h3>
                </div>
                <pre className="bg-gray-900 text-green-400 p-5 rounded-lg overflow-x-auto text-sm font-mono border border-gray-700">
{`{
  "综合报表": {
    "*金额": "本次付款金额|支出|消费",
    "*用途": "付款申请单号&'这种用途'",
    "开户地": "省&'省'&市&'市'",
    "交易日期": "日期:date('YYYY-MM-DD')",
    "总金额": "金额:calc('*1.1')",
    "状态": "是否通过?:'是':'否'",
    "备注": "原备注:replace('旧','新')||'无备注'",
    "代码": "代码:trim():upper()"
  }
}`}
                </pre>
              </div>
            </div>
          </section>

          {/* 处理优先级 */}
          <section className="space-y-6 scroll-mt-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-1 h-8 bg-blue-600 rounded"></div>
              <h2 className="text-3xl font-bold text-gray-900">处理优先级</h2>
            </div>
            <p className="text-gray-700 text-lg">当映射表达式包含多个操作时，按以下优先级处理：</p>
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
              <ol className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold mr-3 flex-shrink-0 text-sm">1</span>
                  <div><strong className="text-gray-900">或关系（|）</strong> - 最高优先级</div>
                </li>
                <li className="flex items-start">
                  <span className="bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold mr-3 flex-shrink-0 text-sm">2</span>
                  <div><strong className="text-gray-900">条件判断（?:）</strong></div>
                </li>
                <li className="flex items-start">
                  <span className="bg-blue-400 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold mr-3 flex-shrink-0 text-sm">2</span>
                  <div><strong className="text-gray-900">默认值（||）</strong></div>
                </li>
                <li className="flex items-start">
                  <span className="bg-blue-300 text-gray-800 w-6 h-6 rounded-full flex items-center justify-center font-bold mr-3 flex-shrink-0 text-sm">3</span>
                  <div><strong className="text-gray-900">函数调用（:函数名）</strong></div>
                </li>
                <li className="flex items-start">
                  <span className="bg-blue-200 text-gray-800 w-6 h-6 rounded-full flex items-center justify-center font-bold mr-3 flex-shrink-0 text-sm">4</span>
                  <div><strong className="text-gray-900">字段拼接（&）</strong></div>
                </li>
                <li className="flex items-start">
                  <span className="bg-gray-300 text-gray-800 w-6 h-6 rounded-full flex items-center justify-center font-bold mr-3 flex-shrink-0 text-sm">5</span>
                  <div><strong className="text-gray-900">单个字段</strong> - 最低优先级</div>
                </li>
              </ol>
            </div>
          </section>

          {/* 常见问题 */}
          <section id="faq" className="space-y-6 scroll-mt-4">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-1 h-8 bg-blue-600 rounded"></div>
              <h2 className="text-3xl font-bold text-gray-900">常见问题</h2>
            </div>
            
            <div className="space-y-4">
              <div className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
                <h3 className="font-bold text-lg mb-3 text-gray-900 flex items-center">
                  <span className="bg-blue-100 text-blue-700 w-7 h-7 rounded-full flex items-center justify-center font-bold mr-3 text-sm">Q1</span>
                  字段名找不到怎么办？
                </h3>
                <p className="text-gray-700 ml-10">系统支持模糊匹配，会尝试以下方式查找字段：精确匹配（区分大小写）、忽略大小写匹配、包含匹配（字段名包含配置中的关键词）。如果所有方式都找不到，该字段的值将为空字符串。</p>
              </div>

              <div className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
                <h3 className="font-bold text-lg mb-3 text-gray-900 flex items-center">
                  <span className="bg-blue-100 text-blue-700 w-7 h-7 rounded-full flex items-center justify-center font-bold mr-3 text-sm">Q2</span>
                  日期格式化失败怎么办？
                </h3>
                <p className="text-gray-700 ml-10">如果日期解析失败，系统会尝试多种日期格式解析。如果都失败，返回原始值。如果原始值也为空，返回空字符串。</p>
              </div>

              <div className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
                <h3 className="font-bold text-lg mb-3 text-gray-900 flex items-center">
                  <span className="bg-blue-100 text-blue-700 w-7 h-7 rounded-full flex items-center justify-center font-bold mr-3 text-sm">Q3</span>
                  数值计算时字段不是数字怎么办？
                </h3>
                <p className="text-gray-700 ml-10">系统会尝试将字段值转换为数字：如果是数字字符串（如 "123"），会转换为数字；如果包含非数字字符，会尝试提取数字部分；如果无法转换，计算结果为 0 或返回原始值。</p>
              </div>

              <div className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
                <h3 className="font-bold text-lg mb-3 text-gray-900 flex items-center">
                  <span className="bg-blue-100 text-blue-700 w-7 h-7 rounded-full flex items-center justify-center font-bold mr-3 text-sm">Q4</span>
                  可以嵌套使用函数吗？
                </h3>
                <p className="text-gray-700 ml-10">支持链式调用，例如：<code className="bg-gray-200 px-1.5 py-0.5 rounded font-mono text-blue-700">"代码": "代码:trim():upper()"</code>。但不支持嵌套调用。</p>
              </div>
            </div>
          </section>

          {/* 最佳实践 */}
          <section className="space-y-6 scroll-mt-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-1 h-8 bg-blue-600 rounded"></div>
              <h2 className="text-3xl font-bold text-gray-900">最佳实践</h2>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div><strong className="text-gray-900">保持配置简洁</strong>：优先使用简单的映射，必要时再使用复杂功能</div>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div><strong className="text-gray-900">测试配置</strong>：在正式使用前，先用小样本测试配置是否正确</div>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div><strong className="text-gray-900">查看日志</strong>：处理过程中查看日志，了解字段匹配情况</div>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div><strong className="text-gray-900">备份配置</strong>：修改配置前先备份，避免配置丢失</div>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div><strong className="text-gray-900">命名规范</strong>：使用清晰的字段名，便于维护</div>
                </li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default FieldMappingDoc;
