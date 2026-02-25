// 预加载脚本：用于在安全的前提下将主进程能力暴露给渲染进程

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { contextBridge, ipcRenderer } = require('electron');

/**
 * 向渲染进程暴露一个只读的环境信息对象
 */
contextBridge.exposeInMainWorld('appEnv', {
  /** 是否为 Electron 环境 */
  isElectron: true,
});

/**
 * 向渲染进程暴露窗口控制相关 API
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * 最小化当前窗口
   */
  minimizeWindow: () => {
    ipcRenderer.send('window:minimize');
  },
  /**
   * 最大化/还原当前窗口
   */
  maximizeWindow: () => {
    ipcRenderer.send('window:maximize');
  },
  /**
   * 关闭当前窗口
   */
  closeWindow: () => {
    ipcRenderer.send('window:close');
  },
  /**
   * 退出应用
   */
  quitApp: () => {
    ipcRenderer.send('app:quit');
  },
  /**
   * 显示文件保存对话框
   * @param {Object} options - 对话框选项
   * @returns {Promise<{canceled: boolean, filePath?: string}>}
   */
  showSaveDialog: (options) => {
    return ipcRenderer.invoke('dialog:saveFile', options);
  },
  /**
   * 保存文件到指定路径
   * @param {string} filePath - 文件路径
   * @param {ArrayBuffer} data - 文件数据
   * @returns {Promise<{success: boolean, path?: string, error?: string}>}
   */
  writeFile: (filePath, data) => {
    return ipcRenderer.invoke('fs:writeFile', filePath, data);
  },
  /**
   * 读取 JSON 文件
   * @param {string} filePath - 文件路径
   * @returns {Promise<{success: boolean, data?: any, error?: string}>}
   */
  readJson: (filePath) => {
    return ipcRenderer.invoke('fs:readJson', filePath);
  },
  /**
   * 写入 JSON 文件
   * @param {string} filePath - 文件路径
   * @param {any} jsonData - JSON 数据
   * @returns {Promise<{success: boolean, path?: string, error?: string}>}
   */
  writeJson: (filePath, jsonData) => {
    return ipcRenderer.invoke('fs:writeJson', filePath, jsonData);
  },
  /**
   * 创建目录（如果不存在）
   * @param {string} dirPath - 目录路径
   * @returns {Promise<{success: boolean, path?: string, error?: string}>}
   */
  mkdir: (dirPath) => {
    return ipcRenderer.invoke('fs:mkdir', dirPath);
  },
  /**
   * 读取目录下的文件名列表
   * @param {string} dirPath - 目录路径
   * @returns {Promise<{ success: boolean, files?: string[], error?: string }>}
   */
  readdir: (dirPath) => {
    return ipcRenderer.invoke('fs:readdir', dirPath);
  },
  /**
   * 获取应用路径
   * @param {string} name - 路径名称 ('userData' | 'appData' | 其他)
   * @returns {Promise<{success: boolean, path?: string, error?: string}>}
   */
  getAppPath: (name) => {
    return ipcRenderer.invoke('app:getPath', name);
  },
  /**
   * 在文件管理器中显示文件或文件夹
   * @param {string} filePath - 文件或文件夹路径
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  showItemInFolder: (filePath) => {
    return ipcRenderer.invoke('shell:showItemInFolder', filePath);
  },
  /**
   * 打开目录（使用系统默认的文件管理器）
   * @param {string} dirPath - 目录路径
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  openPath: (dirPath) => {
    return ipcRenderer.invoke('shell:openPath', dirPath);
  },

  // ---------- 更新相关 API（electron-updater） ----------
  /**
   * 检查是否有新版本
   * @returns {Promise<void>}
   */
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  /**
   * 下载已发现的更新
   * @returns {Promise<void>}
   */
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  /**
   * 退出并安装已下载的更新（会重启应用）
   * @returns {Promise<void>}
   */
  quitAndInstall: () => ipcRenderer.invoke('updater:quitAndInstall'),
  /**
   * 订阅更新事件，callback 收到 { type, payload }
   * @param {(arg: { type: string; payload?: any }) => void} callback
   * @returns {() => void} 取消订阅函数
   */
  onUpdaterEvent: (callback) => {
    const channels = [
      'updater:checking',
      'updater:available',
      'updater:not-available',
      'updater:progress',
      'updater:downloaded',
      'updater:error',
    ];
    const handlers = channels.map((channel) => {
      const type = channel.replace('updater:', '');
      const handler = (event, payload) => callback({ type, payload });
      ipcRenderer.on(channel, handler);
      return { channel, handler };
    });
    return () => {
      handlers.forEach(({ channel, handler }) => ipcRenderer.removeListener(channel, handler));
    };
  },
});
