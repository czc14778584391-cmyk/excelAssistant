import React, { useEffect, useMemo, useState } from 'react';

interface AiToolLink {
  id: string;
  name: string;
  url: string;
  scenario: string;
}

const DEFAULT_AI_TOOL_LINKS: AiToolLink[] = [
  { id: 'kimi', name: 'Kimi', url: 'https://kimi.moonshot.cn', scenario: '长文档总结、制度合同解读' },
  { id: 'doubao', name: '豆包', url: 'https://www.doubao.com', scenario: '日常问答、文案润色' },
  { id: 'tongyi', name: '通义', url: 'https://tongyi.aliyun.com', scenario: '写作、表格思路、代码辅助' },
  { id: 'yiyan', name: '文心一言', url: 'https://yiyan.baidu.com', scenario: '通用问答、知识检索' },
  { id: 'yuanbao', name: '腾讯元宝', url: 'https://yuanbao.tencent.com', scenario: '办公问答、资料整理' },
  { id: 'chatglm', name: '智谱清言', url: 'https://chatglm.cn', scenario: '专业问答、文本改写' },
  { id: 'xinghuo', name: '讯飞星火', url: 'https://xinghuo.xfyun.cn', scenario: '中文写作、总结提炼' },
  { id: 'metaso', name: '秘塔AI搜索', url: 'https://metaso.cn', scenario: '带来源检索、资料查证' },
  { id: 'tiangong', name: '天工AI', url: 'https://www.tiangong.cn', scenario: '信息整合、综合问答' },
  { id: 'wps-ai', name: 'WPS AI', url: 'https://ai.wps.cn', scenario: '文档与表格办公辅助' },
  { id: 'baidu-fanyi', name: '百度翻译AI', url: 'https://fanyi.baidu.com', scenario: '票据与对账中英翻译' },
  { id: 'youdao-fanyi', name: '有道翻译', url: 'https://fanyi.youdao.com', scenario: '术语翻译、邮件润色' },
];

/**
 * 读取并返回 AI 导航配置文件路径。
 */
const getAiNavConfigPath = async (): Promise<string | null> => {
  const appPathResult = await window.electronAPI?.getAppPath('userData');
  if (!appPathResult?.success || !appPathResult.path) {
    return null;
  }
  const separator = appPathResult.path.includes('\\') ? '\\' : '/';
  const configDir = `${appPathResult.path}${separator}config`;
  await window.electronAPI?.mkdir(configDir);
  return `${configDir}${separator}aiToolLinks.json`;
};

/**
 * 校验并规范化 URL，自动补齐协议。
 */
const normalizeAndValidateUrl = (rawUrl: string): string | null => {
  const normalized = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  try {
    const url = new URL(normalized);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
};

/**
 * 过滤为可用的链接结构，避免损坏配置导致页面报错。
 */
const sanitizeLinks = (input: unknown): AiToolLink[] => {
  if (!Array.isArray(input)) {
    return [];
  }
  return input
    .map((item) => {
      const record = item as Partial<AiToolLink>;
      if (!record || typeof record.name !== 'string' || typeof record.url !== 'string') {
        return null;
      }
      const url = normalizeAndValidateUrl(record.url.trim());
      if (!url) {
        return null;
      }
      return {
        id: typeof record.id === 'string' && record.id ? record.id : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: record.name.trim(),
        url,
        scenario: typeof record.scenario === 'string' ? record.scenario.trim() : '',
      };
    })
    .filter((item): item is AiToolLink => Boolean(item && item.name));
};

/**
 * 提取 URL 的域名，用于列表展示。
 */
const getDomain = (targetUrl: string): string => {
  try {
    return new URL(targetUrl).hostname.replace(/^www\./i, '');
  } catch {
    return targetUrl;
  }
};

const AiNavPage: React.FC = () => {
  const [links, setLinks] = useState<AiToolLink[]>([]);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [scenario, setScenario] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [compactMode, setCompactMode] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [tips, setTips] = useState('');

  const openExternal = async (targetUrl: string) => {
    if (window.appEnv?.isElectron && window.electronAPI?.openExternal) {
      await window.electronAPI.openExternal(targetUrl);
      return;
    }
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const saveLinks = async (nextLinks: AiToolLink[]) => {
    const configPath = await getAiNavConfigPath();
    if (!configPath) {
      return;
    }
    await window.electronAPI?.writeJson(configPath, nextLinks);
  };

  useEffect(() => {
    const loadLinks = async () => {
      if (!window.appEnv?.isElectron) {
        setLinks(DEFAULT_AI_TOOL_LINKS);
        return;
      }
      const configPath = await getAiNavConfigPath();
      if (!configPath) {
        setLinks(DEFAULT_AI_TOOL_LINKS);
        return;
      }
      const readResult = await window.electronAPI?.readJson(configPath);
      if (readResult?.success) {
        const validLinks = sanitizeLinks(readResult.data);
        if (validLinks.length > 0) {
          setLinks(validLinks);
          return;
        }
      }
      setLinks(DEFAULT_AI_TOOL_LINKS);
      await window.electronAPI?.writeJson(configPath, DEFAULT_AI_TOOL_LINKS);
    };
    loadLinks();
  }, []);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-action-menu-root="true"]')) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, []);

  const linkCountText = useMemo(() => `已收录 ${links.length} 个工具`, [links.length]);

  const handleAdd = async () => {
    const trimmedName = name.trim();
    const normalizedUrl = normalizeAndValidateUrl(url.trim());
    if (!trimmedName || !normalizedUrl) {
      setTips('请填写有效的名称和链接（支持自动补全 https://）');
      return;
    }
    const nextLinks = [
      ...links,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: trimmedName,
        url: normalizedUrl,
        scenario: scenario.trim(),
      },
    ];
    setLinks(nextLinks);
    setName('');
    setUrl('');
    setScenario('');
    setTips('');
    setIsAddModalOpen(false);
    await saveLinks(nextLinks);
  };

  const handleDelete = async (id: string) => {
    const nextLinks = links.filter((item) => item.id !== id);
    setLinks(nextLinks);
    await saveLinks(nextLinks);
  };

  const handleDrop = async (targetId: string) => {
    if (!draggingId || draggingId === targetId) {
      return;
    }
    const draggingIndex = links.findIndex((item) => item.id === draggingId);
    const targetIndex = links.findIndex((item) => item.id === targetId);
    if (draggingIndex < 0 || targetIndex < 0) {
      return;
    }
    const nextLinks = [...links];
    const [dragItem] = nextLinks.splice(draggingIndex, 1);
    nextLinks.splice(targetIndex, 0, dragItem);
    setLinks(nextLinks);
    setDraggingId(null);
    setDragOverId(null);
    await saveLinks(nextLinks);
  };

  return (
    <div className="flex h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex-1 flex flex-col p-8 overflow-y-auto">
        <header className="mb-8 flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-slate-800">AI导航</h1>
          <p className="text-sm text-slate-600">
            快计场景推荐：对账说明、凭证摘要、制度问答、翻译润色。点击工具会使用系统默认浏览器打开。
          </p>
          <p className="text-xs text-slate-500">{linkCountText}</p>
        </header>

        <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700">工具列表（支持拖拽排序）</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setTips('');
                  setIsAddModalOpen(true);
                }}
                className="text-[11px] font-bold px-3 py-1 rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
              >
                新增工具链接
              </button>
              <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-1 rounded">
                拖动左侧手柄可排序
              </span>
              <button
                type="button"
                onClick={() => setCompactMode((prev) => !prev)}
                className={`text-[11px] font-bold px-3 py-1 rounded border transition-colors ${
                  compactMode
                    ? 'text-blue-700 border-blue-200 bg-blue-50 hover:bg-blue-100'
                    : 'text-slate-600 border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                {compactMode ? '紧凑模式：开' : '紧凑模式：关'}
              </button>
            </div>
          </div>
          <div
            className={`grid gap-3 ${
              compactMode
                ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4'
                : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
            }`}
          >
            {links.map((item) => (
              <div
                key={item.id}
                draggable
                onDragStart={() => setDraggingId(item.id)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverId(item.id);
                }}
                onDragEnd={() => {
                  setDraggingId(null);
                  setDragOverId(null);
                }}
                onDrop={() => handleDrop(item.id)}
                onClick={async (e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest('[data-action-menu-root="true"]')) {
                    return;
                  }
                  await openExternal(item.url);
                }}
                className={`rounded-xl border shadow-sm flex items-center gap-3 min-w-0 transition-all relative ${
                  draggingId === item.id
                    ? 'opacity-60 border-blue-200 bg-blue-50/40'
                    : dragOverId === item.id
                    ? 'border-blue-300 bg-blue-50/60'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-md'
                } ${compactMode ? 'px-3 py-2' : 'p-4'}`}
              >
                <span
                  className="text-slate-400 hover:text-slate-600 cursor-move select-none text-lg leading-none"
                  title="拖动排序"
                >
                  ≡
                </span>
                <div className="flex-1 min-w-0">
                  {compactMode ? (
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{item.name}</p>
                      <span className="text-[10px] text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded shrink-0">
                        {getDomain(item.url)}
                      </span>
                      <p className="text-xs text-emerald-600 truncate min-w-0">
                        {item.scenario || '通用办公与问答'}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{item.name}</p>
                        <span className="text-[10px] text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded shrink-0">
                          {getDomain(item.url)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-1">{item.url}</p>
                      <p className="text-xs text-emerald-600 truncate mt-1">
                        快计场景：{item.scenario || '通用办公与问答'}
                      </p>
                    </>
                  )}
                </div>
                <div data-action-menu-root="true" className="relative shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuId((prev) => (prev === item.id ? null : item.id));
                    }}
                    className="w-8 h-8 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                    title="更多操作"
                  >
                    ...
                  </button>
                  {activeMenuId === item.id && (
                    <div className="absolute right-0 top-9 z-10 w-24 bg-white border border-slate-200 rounded-lg shadow-lg py-1">
                      <button
                        type="button"
                        onClick={async () => {
                          await openExternal(item.url);
                          setActiveMenuId(null);
                        }}
                        className="w-full text-left px-3 py-1.5 text-[12px] font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        打开
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await handleDelete(item.id);
                          setActiveMenuId(null);
                        }}
                        className="w-full text-left px-3 py-1.5 text-[12px] font-semibold text-red-600 hover:bg-red-50 transition-colors"
                      >
                        删除
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {links.length === 0 && (
              <div className="text-sm text-slate-500 border border-dashed border-slate-300 rounded-lg p-6 text-center">
                暂无工具链接，请先新增。
              </div>
            )}
          </div>
        </section>

        {isAddModalOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsAddModalOpen(false);
              }
            }}
          >
            <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
              <div className="bg-[#1E293B] px-5 py-3 flex items-center justify-between">
                <h3 className="text-white text-sm font-bold">新增工具链接</h3>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="w-7 h-7 rounded text-white/80 hover:text-white hover:bg-white/20 transition-colors"
                  aria-label="关闭弹框"
                >
                  ×
                </button>
              </div>
              <div className="p-5">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">工具名称</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="例如：Kimi"
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">工具链接</label>
                    <input
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="例如：kimi.moonshot.cn"
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">适用场景</label>
                    <textarea
                      value={scenario}
                      onChange={(e) => setScenario(e.target.value)}
                      placeholder="例如：长文档总结、对账说明、制度问答"
                      rows={3}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 resize-y"
                    />
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-xs text-red-500">{tips}</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddModalOpen(false)}
                      className="px-4 py-2 text-[12px] font-semibold text-slate-600 border border-slate-200 rounded hover:bg-slate-50 transition-colors"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={handleAdd}
                      className="px-4 py-2 text-[12px] font-bold text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
                    >
                      确认新增
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AiNavPage;
