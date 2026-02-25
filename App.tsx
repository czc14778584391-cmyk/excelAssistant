import React, { useState, useEffect } from 'react';
import Home from './pages/Home';
import Config from './pages/Config';
import Help from './pages/Help';
import MultiTool from './pages/MultiTool';
import FieldMappingDoc from './pages/FieldMappingDoc';
import { PageType, SidebarMenuItem } from './types';
import { COLORS } from './constants';
import { useProcessing } from './contexts/ProcessingContext';
import MouseEffects from './components/MouseEffects';

/** 更新弹框状态 */
type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'no-update'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'error';

/** 带更新能力的 Electron API（与 preload 暴露一致） */
interface ElectronAPIWithUpdater {
  checkForUpdates?: () => Promise<void>;
  downloadUpdate?: () => Promise<void>;
  quitAndInstall?: () => Promise<void>;
  onUpdaterEvent?: (callback: (arg: { type: string; payload?: any }) => void) => () => void;
}

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageType>('home');
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(
    new Set(['分类'])
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const { isProcessing } = useProcessing();

  /** 更新弹框：显隐与状态 */
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');
  const [updateInfo, setUpdateInfo] = useState<{
    version?: string;
    releaseNotes?: string | string[];
    error?: string;
  }>({});
  const [downloadProgress, setDownloadProgress] = useState<{
    percent: number;
    transferred: number;
    total: number;
  } | null>(null);

  /**
   * 渲染菜单图标
   */
  const renderMenuIcon = (menuId: string) => {
    if (menuId === '分类') {
      return (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      );
    } else if (menuId === '工具箱') {
      return (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      );
    }
    return null;
  };

  /**
   * 侧边栏菜单配置
   */
  const sidebarMenus: SidebarMenuItem[] = [
    {
      id: '分类',
      label: 'AI智能分类',
      icon: '📊',
      children: [
        { id: 'home', label: '流水分类', page: 'home' },
        { id: 'config', label: '分类配置', page: 'config' },
      ],
    },
    {
      id: '工具箱',
      label: 'AI工具箱',
      icon: '🛠️',
      children: [
        { id: 'tool-split', label: '按公司主体拆分汇总', page: 'tool-split' },
        { id: 'tool-merge', label: '多表合规化合并', page: 'tool-merge' },
      ],
    },
  ];

  /**
   * 切换菜单展开/收起
   */
  const toggleMenu = (menuId: string) => {
    setExpandedMenus((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(menuId)) {
        newSet.delete(menuId);
      } else {
        newSet.add(menuId);
      }
      return newSet;
    });
  };

  /**
   * 处理页面切换
   */
  const handlePageChange = (page: PageType) => {
    if (isProcessing && currentPage !== page) {
      alert('任务正在处理中，请等待处理完成后再切换页面');
      return;
    }
    setCurrentPage(page);

    // 自动展开包含该页面的菜单
    const parentMenu = sidebarMenus.find((menu) =>
      menu.children?.some((child) => child.page === page)
    );
    if (parentMenu) {
      setExpandedMenus((prev) => new Set(prev).add(parentMenu.id));
    }
  };

  /**
   * 检查配置文件是否存在
   */
  useEffect(() => {
    const checkConfigFiles = async () => {
      // 仅在 Electron 环境中检查
      if (!window.appEnv?.isElectron) {
        return;
      }

      try {
        // 获取用户数据目录路径
        const result = await window.electronAPI?.getAppPath('userData');
        if (!result || !result.success || !result.path) {
          return;
        }

        const separator = result.path.includes('\\') ? '\\' : '/';
        const configDir = `${result.path}${separator}config`;

        // 确保配置目录存在
        await window.electronAPI?.mkdir(configDir);

        // 检查关键配置文件
        const configFiles = [
          'summaryHeader.json',
          'categoricalData.json',
          'fieldMapping.json',
          'backAccount.json',
        ];

        let hasAnyConfig = false;

        // 检查每个配置文件是否存在
        for (const fileName of configFiles) {
          const filePath = `${configDir}${separator}${fileName}`;
          const readResult = await window.electronAPI?.readJson(filePath);

          // 如果文件存在且读取成功（success 为 true），或者文件存在但读取失败（error 不是 ENOENT）
          // ENOENT 表示文件不存在，其他错误表示文件存在但可能格式有问题
          if (
            readResult &&
            (readResult.success ||
              (readResult.error && readResult.error !== 'ENOENT'))
          ) {
            hasAnyConfig = true;
            break;
          }
        }

        // 如果没有任何配置文件，显示提示
        if (!hasAnyConfig) {
          const confirmed = window.confirm(
            '检测到配置目录中没有配置文件。\n\n' +
              '请先设置以下配置文件：\n' +
              '• summaryHeader.json（汇总表头模板）\n' +
              '• categoricalData.json（分类字典）\n' +
              '• fieldMapping.json（字段映射模板）\n' +
              '• backAccount.json（银行账号配置）\n\n' +
              '点击"确定"打开配置目录,配置完成后重启应用。'
          );

          if (confirmed) {
            // 直接打开配置目录
            await window.electronAPI?.openPath(configDir);
            // 关闭应用进程
            setTimeout(() => {
              window.electronAPI?.quitApp();
            }, 3000);
          }
        }
      } catch (error) {
        console.error('检查配置文件失败:', error);
      }
    };

    // 延迟检查，确保应用完全加载后再检查
    const timer = setTimeout(() => {
      checkConfigFiles();
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  /**
   * 组件挂载后移除自动聚焦，防止首页 tab 被默认聚焦
   */
  useEffect(() => {
    // 延迟执行，确保 DOM 完全渲染后再移除焦点
    const timer = setTimeout(() => {
      // 移除任何被自动聚焦的元素
      if (
        document.activeElement &&
        document.activeElement instanceof HTMLElement
      ) {
        document.activeElement.blur();
      }
      // 将焦点移到 body 上
      document.body.focus();
      // 如果 body 不能聚焦，则移除所有焦点
      if (document.activeElement !== document.body) {
        (document.activeElement as HTMLElement)?.blur();
      }
    }, 0);

    // 监听窗口焦点事件，当窗口获得焦点时也移除自动聚焦
    const handleFocus = () => {
      if (
        document.activeElement &&
        document.activeElement instanceof HTMLElement
      ) {
        const tagName = document.activeElement.tagName.toLowerCase();
        // 如果聚焦的是按钮，立即移除焦点
        if (tagName === 'button') {
          document.activeElement.blur();
        }
      }
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  /**
   * 订阅 electron-updater 事件，更新弹框状态
   */
  useEffect(() => {
    const api = window.electronAPI as ElectronAPIWithUpdater | undefined;
    if (!window.appEnv?.isElectron || !api?.onUpdaterEvent) {
      return;
    }
    const unsubscribe = api.onUpdaterEvent(
      ({ type, payload }: { type: string; payload?: any }) => {
        switch (type) {
          case 'checking':
            setUpdateStatus('checking');
            setUpdateInfo({});
            setDownloadProgress(null);
            break;
          case 'available':
            setUpdateStatus('available');
            setUpdateInfo({
              version: payload?.version,
              releaseNotes: payload?.releaseNotes,
            });
            break;
          case 'not-available':
            setUpdateStatus('no-update');
            break;
          case 'progress':
            setUpdateStatus('downloading');
            setDownloadProgress(
              payload
                ? {
                    percent: payload.percent ?? 0,
                    transferred: payload.transferred ?? 0,
                    total: payload.total ?? 0,
                  }
                : null
            );
            break;
          case 'downloaded':
            setUpdateStatus('downloaded');
            setUpdateInfo((prev) => ({ ...prev, version: payload?.version }));
            setDownloadProgress(null);
            break;
          case 'error':
            setUpdateStatus('error');
            setUpdateInfo({ error: payload?.message ?? '检查更新失败' });
            break;
          default:
            break;
        }
      }
    );
    return unsubscribe;
  }, []);

  /**
   * 点击「检查更新」：打开弹框并触发检查
   */
  const handleCheckUpdate = () => {
    setUpdateModalOpen(true);
    setUpdateStatus('checking');
    setUpdateInfo({});
    setDownloadProgress(null);
    (window.electronAPI as ElectronAPIWithUpdater | undefined)?.checkForUpdates?.();
  };

  /**
   * 开始下载已发现的更新
   */
  const handleDownloadUpdate = () => {
    setUpdateStatus('downloading');
    setDownloadProgress({ percent: 0, transferred: 0, total: 0 });
    (window.electronAPI as ElectronAPIWithUpdater | undefined)?.downloadUpdate?.();
  };

  /**
   * 立即重启并安装更新
   */
  const handleQuitAndInstall = () => {
    (window.electronAPI as ElectronAPIWithUpdater | undefined)?.quitAndInstall?.();
  };

  /**
   * 最小化 Electron 窗口（仅在 Electron 环境下生效）
   */
  const handleMinimize = () => {
    // 在浏览器中点击不做窗口操作，避免报错
    if (!window.appEnv?.isElectron) {
      return;
    }
    if (window.electronAPI?.minimizeWindow) {
      window.electronAPI.minimizeWindow();
    }
  };

  /**
   * 最大化/还原 Electron 窗口（仅在 Electron 环境下生效）
   */
  const handleMaximize = () => {
    // 在浏览器中点击不做窗口操作，避免报错
    if (!window.appEnv?.isElectron) {
      return;
    }
    if (window.electronAPI?.maximizeWindow) {
      window.electronAPI.maximizeWindow();
    }
  };

  /**
   * 关闭 Electron 窗口（仅在 Electron 环境下生效）
   */
  const handleClose = () => {
    if (!window.appEnv?.isElectron) {
      return;
    }
    if (window.electronAPI?.closeWindow) {
      window.electronAPI.closeWindow();
    }
  };

  /**
   * 使用缓存机制，保持所有页面组件挂载，只通过 CSS 控制显示/隐藏
   * 这样可以避免切换页面时重新渲染，保持页面状态
   */
  const renderPage = () => {
    return (
      <>
        <div style={{ display: currentPage === 'home' ? 'block' : 'none' }}>
          <Home />
        </div>
        <div style={{ display: currentPage === 'config' ? 'block' : 'none' }}>
          <Config />
        </div>
        <div
          style={{ display: currentPage === 'tool-split' ? 'block' : 'none' }}
        >
          <MultiTool toolType="split" />
        </div>
        <div
          style={{ display: currentPage === 'tool-merge' ? 'block' : 'none' }}
        >
          <MultiTool toolType="merge" />
        </div>
        <div style={{ display: currentPage === 'help' ? 'block' : 'none' }}>
          <Help />
        </div>
        <div
          style={{
            display: currentPage === 'field-mapping-doc' ? 'block' : 'none',
          }}
        >
          <FieldMappingDoc />
        </div>
      </>
    );
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      {/* 更新弹框 */}
      {updateModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
          onClick={(e) => {
            if (updateStatus !== 'checking' && updateStatus !== 'downloading') {
              if (e.target === e.currentTarget) setUpdateModalOpen(false);
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="update-modal-title"
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#1E293B] text-white px-4 py-3 flex items-center justify-between">
              <h2 id="update-modal-title" className="text-base font-semibold">
                检查更新
              </h2>
              {updateStatus !== 'checking' && updateStatus !== 'downloading' && (
                <button
                  type="button"
                  onClick={() => setUpdateModalOpen(false)}
                  className="text-white/80 hover:text-white p-1 rounded"
                  aria-label="关闭"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <div className="p-4 text-gray-800">
              {updateStatus === 'checking' && (
                <p className="text-gray-600">正在检查更新…</p>
              )}
              {updateStatus === 'no-update' && (
                <>
                  <p className="text-gray-700">当前已是最新版本。</p>
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setUpdateModalOpen(false)}
                      className="px-4 py-2 bg-[#1E293B] text-white rounded hover:opacity-90"
                    >
                      确定
                    </button>
                  </div>
                </>
              )}
              {updateStatus === 'available' && (
                <>
                  <p className="text-gray-700">
                    发现新版本 {updateInfo.version ?? ''}，是否立即下载？
                  </p>
                  {updateInfo.releaseNotes && (
                    <div className="mt-2 text-sm text-gray-500 max-h-24 overflow-y-auto">
                      {Array.isArray(updateInfo.releaseNotes)
                        ? updateInfo.releaseNotes.map((note: string, i: number) => (
                            <div key={i}>{note}</div>
                          ))
                        : String(updateInfo.releaseNotes)}
                    </div>
                  )}
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setUpdateModalOpen(false)}
                      className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadUpdate}
                      className="px-4 py-2 bg-[#1E293B] text-white rounded hover:opacity-90"
                    >
                      下载
                    </button>
                  </div>
                </>
              )}
              {updateStatus === 'downloading' && (
                <>
                  <p className="text-gray-700 mb-2">正在下载更新…</p>
                  <div className="h-2 bg-gray-200 rounded overflow-hidden">
                    <div
                      className="h-full bg-[#1E293B] transition-all duration-300"
                      style={{
                        width: `${downloadProgress?.percent ?? 0}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {Math.round(downloadProgress?.percent ?? 0)}%
                  </p>
                </>
              )}
              {updateStatus === 'downloaded' && (
                <>
                  <p className="text-gray-700">
                    下载完成，是否立即重启以安装更新？
                  </p>
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setUpdateModalOpen(false)}
                      className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                    >
                      稍后
                    </button>
                    <button
                      type="button"
                      onClick={handleQuitAndInstall}
                      className="px-4 py-2 bg-[#1E293B] text-white rounded hover:opacity-90"
                    >
                      立即重启
                    </button>
                  </div>
                </>
              )}
              {updateStatus === 'error' && (
                <>
                  <p className="text-gray-700">
                    {updateInfo.error ?? '检查更新失败'}
                  </p>
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setUpdateModalOpen(false)}
                      className="px-4 py-2 bg-[#1E293B] text-white rounded hover:opacity-90"
                    >
                      关闭
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top Navbar */}
      <header
        className="h-[80px] bg-[#1E293B] text-white flex items-center justify-between px-8 shadow-md sticky top-0 z-50 select-none"
        style={{ WebkitAppRegion: 'drag' }}
      >
        <div
          className="flex items-center space-x-4"
          style={{ WebkitAppRegion: 'no-drag' }}
        >
          <span className="text-xl font-bold tracking-tight">银流AI助手</span>
        </div>

        <div
          className="flex items-center space-x-6"
          style={{ WebkitAppRegion: 'no-drag' }}
        >
          {/* 检查更新按钮（仅 Electron 环境） */}
          {window.appEnv?.isElectron && (
            <button
              type="button"
              onClick={handleCheckUpdate}
              className="px-3 py-1.5 text-sm text-white/80 hover:text-white hover:bg-white/20 rounded transition-colors"
              title="检查更新"
            >
              检查更新
            </button>
          )}
          {/* 字段映射文档按钮 */}
          <button
            onClick={() => handlePageChange('field-mapping-doc')}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/20 transition-colors text-white/80 hover:text-white"
            title="字段映射配置文档"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </button>
          {/* 自定义窗口控制按钮 */}
          <div className="flex items-center space-x-2 ml-4">
            <button
              type="button"
              onClick={handleMinimize}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-blue-700 transition-colors"
              title="最小化"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 12H4"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleMaximize}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-blue-700 transition-colors"
              title="最大化/还原"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4h16v16H4V4z"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-red-600 transition-colors"
              title="关闭"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout with Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`bg-white border-r border-gray-200 flex flex-col shadow-sm transition-all duration-300 relative ${
            sidebarCollapsed ? 'w-16' : 'w-64'
          }`}
        >
          <nav
            className={`flex-1 py-4 min-h-0 ${
              sidebarCollapsed ? 'overflow-hidden' : 'overflow-y-auto'
            }`}
          >
            {sidebarMenus.map((menu) => (
              <div key={menu.id} className="mb-2">
                {/* 一级菜单 */}
                <button
                  onClick={() => {
                    if (sidebarCollapsed) {
                      // 收起状态下点击图标，展开侧边栏并展开该菜单
                      setSidebarCollapsed(false);
                      setExpandedMenus((prev) => new Set(prev).add(menu.id));
                      // 如果该菜单有子项，自动切换到第一个子项
                      if (
                        menu.children &&
                        menu.children.length > 0 &&
                        menu.children[0].page
                      ) {
                        handlePageChange(menu.children[0].page);
                      }
                    } else {
                      toggleMenu(menu.id);
                    }
                  }}
                  className={`w-full flex items-center ${
                    sidebarCollapsed
                      ? 'justify-center px-0'
                      : 'justify-between px-4'
                  } py-3 text-gray-700 hover:bg-gray-100 transition-colors relative group`}
                  tabIndex={-1}
                  onFocus={(e) => e.currentTarget.blur()}
                  title={sidebarCollapsed ? menu.label : ''}
                >
                  <div
                    className={`flex items-center ${
                      sidebarCollapsed ? '' : 'space-x-3'
                    }`}
                  >
                    <span className="text-gray-600 flex-shrink-0">
                      {renderMenuIcon(menu.id)}
                    </span>
                    {!sidebarCollapsed && (
                      <span className="font-semibold text-sm">
                        {menu.label}
                      </span>
                    )}
                  </div>
                  {!sidebarCollapsed && (
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${
                        expandedMenus.has(menu.id) ? 'rotate-90' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  )}
                  {/* 收起状态下的工具提示 */}
                  {sidebarCollapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                      {menu.label}
                    </div>
                  )}
                </button>

                {/* 二级菜单 */}
                {!sidebarCollapsed &&
                  expandedMenus.has(menu.id) &&
                  menu.children && (
                    <div className="bg-gray-50">
                      {menu.children.map((child) => {
                        const isActive = currentPage === child.page;
                        return (
                          <button
                            key={child.id}
                            onClick={() =>
                              child.page && handlePageChange(child.page)
                            }
                            disabled={isProcessing && !isActive}
                            className={`w-full text-left px-8 py-2.5 text-sm transition-colors ${
                              isActive
                                ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600 font-semibold'
                                : 'text-gray-600 hover:bg-gray-100'
                            } ${
                              isProcessing && !isActive
                                ? 'opacity-50 cursor-not-allowed'
                                : ''
                            }`}
                            tabIndex={-1}
                            onFocus={(e) => e.currentTarget.blur()}
                            title={
                              isProcessing && !isActive
                                ? '任务正在处理中，无法切换页面'
                                : ''
                            }
                          >
                            {child.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
              </div>
            ))}
          </nav>

          {/* 展开/收起按钮 - 放在侧边栏右下角 */}
          <div className="p-4 border-t border-gray-200 flex justify-end flex-shrink-0">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={`w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition-colors ${
                sidebarCollapsed ? 'mx-auto' : ''
              }`}
              title={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
              tabIndex={-1}
              onFocus={(e) => e.currentTarget.blur()}
            >
              {sidebarCollapsed ? (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              )}
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-h-0 overflow-auto p-6 max-w-[1920px] mx-auto w-full">
          {renderPage()}
        </main>
      </div>

      {/* 鼠标特效 */}
      <MouseEffects />
    </div>
  );
};

export default App;
