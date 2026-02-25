// Electron 主进程入口文件（CommonJS，方便直接用 node 运行）
// 使用 JSDoc 进行类型提示

/**
 * @typedef {import('electron').BrowserWindow} BrowserWindow
 */
/**
 * @typedef {import('electron').Tray} Tray
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog, shell } = require('electron');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');

/** 仅打包后启用自动更新；开发环境仍注册 IPC，但检查时返回无更新 */
const isPackaged = app.isPackaged;

/**
 * 创建主窗口
 * @returns {BrowserWindow}
 */
function createMainWindow() {
  // 加载应用图标
  const iconPath = path.join(__dirname, 'icon.png');
  let appIcon = null;
  if (fs.existsSync(iconPath)) {
    appIcon = nativeImage.createFromPath(iconPath);
  }

  /** @type {BrowserWindow} */
  const mainWindow = new BrowserWindow({
    width: 2080,
    height: 1200,
    minWidth: 1024,
    minHeight: 640,
    frame: false, // 隐藏标题栏，使用自定义标题栏
    icon: appIcon, // 设置窗口图标
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  const isDev = process.env.VITE_DEV_SERVER_URL || process.env.ELECTRON_START_URL;

  if (!isDev) {
    // 生产环境：直接加载打包后的 index.html
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    console.log('生产环境，加载文件:', indexPath);
    mainWindow.loadFile(indexPath);
  }
  // 开发环境：不在创建窗口时立即加载，等待 app.whenReady 中处理
  // 这样可以确保 Vite 服务器已经启动

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 拦截窗口关闭事件，隐藏到托盘而不是真正关闭
  mainWindow.on('close', (event) => {
    // 如果正在退出，允许关闭
    if (isQuitting) {
      return;
    }
    // 阻止默认关闭行为
    event.preventDefault();
    // 隐藏窗口到托盘
    mainWindow.hide();
  });

  return mainWindow;
}

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {Tray | null} */
let tray = null;
/** @type {boolean} */
let isQuitting = false;

/**
 * 创建系统托盘
 * @param {BrowserWindow} win
 */
function createTray(win) {
  // 加载托盘图标
  const iconPath = path.join(__dirname, 'icon.png');
  let trayIcon = null;
  
  if (fs.existsSync(iconPath)) {
    trayIcon = nativeImage.createFromPath(iconPath);
    // 根据系统托盘图标大小调整
    // Windows 通常需要 16x16，但高 DPI 屏幕可能需要 32x32
    // macOS 需要 22x22（Retina 显示）
    // Linux 通常需要 24x24
    if (process.platform === 'win32') {
      // Windows: 创建多个尺寸的图标对象，系统会自动选择合适的大小
      const sizes = [16, 32];
      const images = sizes.map(size => {
        const img = nativeImage.createFromPath(iconPath);
        return img.resize({ width: size, height: size });
      });
      // 使用模板图像（适用于深色/浅色主题）
      trayIcon = images[0]; // 使用 16x16 作为基础
    } else if (process.platform === 'darwin') {
      // macOS: 使用 22x22（Retina 显示会自动使用 44x44）
      trayIcon = trayIcon.resize({ width: 22, height: 22 });
      trayIcon.setTemplateImage(true); // 设置为模板图像，适配系统主题
    } else {
      // Linux: 使用 24x24
      trayIcon = trayIcon.resize({ width: 24, height: 24 });
    }
  } else {
    // 如果没有图标文件，使用默认图标
    console.warn('图标文件 icon.png 不存在，使用默认图标');
    trayIcon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
    trayIcon.resize({ width: 16, height: 16 });
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('银流智能助手');

  const showWindow = () => {
    if (win) {
      if (win.isMinimized()) {
        win.restore();
      }
      win.show();
      win.focus();
    }
  };

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开主界面',
      click: showWindow,
    },
    {
      label: '退出',
      click: () => {
        // 设置退出标志
        isQuitting = true;
        // 销毁托盘
        if (tray) {
          tray.destroy();
          tray = null;
        }
        // 关闭所有窗口
        if (mainWindow) {
          mainWindow.removeAllListeners('close');
          mainWindow.destroy();
          mainWindow = null;
        }
        // 直接退出进程
        process.exit(0);
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // 左键单击托盘图标打开/激活主窗口
  tray.on('click', showWindow);
}

/**
 * 向渲染进程发送更新相关事件（仅当主窗口存在且未销毁时）
 * @param {string} channel - IPC 通道名
 * @param {any} [payload] - 可选载荷
 */
function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    if (payload !== undefined) {
      mainWindow.webContents.send(channel, payload);
    } else {
      mainWindow.webContents.send(channel);
    }
  }
}

/**
 * 配置 electron-updater 并注册 IPC，仅在打包环境下真正检查更新
 */
function setupUpdater() {
  if (!isPackaged) {
    // 开发环境：注册空实现，避免渲染进程 invoke 报错
    ipcMain.handle('updater:check', async () => {
      sendToRenderer('updater:not-available');
    });
    ipcMain.handle('updater:download', async () => {});
    ipcMain.handle('updater:quitAndInstall', async () => {});
    return;
  }

  const { autoUpdater } = require('electron-updater');
  autoUpdater.autoDownload = false;
  autoUpdater.logger = console;

  autoUpdater.on('checking-for-update', () => sendToRenderer('updater:checking'));
  autoUpdater.on('update-available', (info) => {
    sendToRenderer('updater:available', {
      version: info.version,
      releaseNotes: info.releaseNotes,
    });
  });
  autoUpdater.on('update-not-available', () => sendToRenderer('updater:not-available'));
  autoUpdater.on('download-progress', (progress) => {
    sendToRenderer('updater:progress', {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
    });
  });
  autoUpdater.on('update-downloaded', (info) => {
    sendToRenderer('updater:downloaded', { version: info.version });
  });
  autoUpdater.on('error', (err) => {
    sendToRenderer('updater:error', { message: err.message || String(err) });
  });

  ipcMain.handle('updater:check', async () => {
    await autoUpdater.checkForUpdates();
  });
  ipcMain.handle('updater:download', async () => {
    await autoUpdater.downloadUpdate();
  });
  ipcMain.handle('updater:quitAndInstall', async () => {
    isQuitting = true;
    autoUpdater.quitAndInstall(true, true);
  });
}

app.whenReady().then(() => {
  mainWindow = createMainWindow();
  createTray(mainWindow);
  setupUpdater();

  // 如果是开发环境，等待 Vite 服务器启动
  const isDev = process.env.VITE_DEV_SERVER_URL || process.env.ELECTRON_START_URL;
  if (isDev) {
    // 等待 Vite 服务器启动
    const waitForServer = async () => {
      const http = require('http');
      const url = require('url');
      const devUrl = new URL(isDev);
      
      const checkServer = () => {
        return new Promise((resolve) => {
          const req = http.get({
            hostname: devUrl.hostname,
            port: devUrl.port,
            path: '/',
            timeout: 1000
          }, (res) => {
            resolve(true);
          });
          
          req.on('error', () => {
            resolve(false);
          });
          
          req.on('timeout', () => {
            req.destroy();
            resolve(false);
          });
        });
      };
      
      // 最多等待 10 秒
      for (let i = 0; i < 20; i++) {
        const isReady = await checkServer();
        if (isReady) {
          console.log('Vite 服务器已就绪');
          if (mainWindow) {
            mainWindow.loadURL(isDev);
          }
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      console.warn('等待 Vite 服务器超时，尝试直接加载');
      if (mainWindow) {
        mainWindow.loadURL(isDev);
        mainWindow.webContents.openDevTools();
      }
    };
    
    waitForServer();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
      createTray(mainWindow);
    }
  });
});

/**
 * 处理来自渲染进程的窗口控制事件
 */
ipcMain.on('window:minimize', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.on('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window:close', () => {
  // 点击关闭按钮时，隐藏窗口到托盘
  if (mainWindow) {
    mainWindow.hide();
  }
});

/**
 * 退出应用
 */
ipcMain.on('app:quit', () => {
  // 设置退出标志
  isQuitting = true;
  // 销毁托盘
  if (tray) {
    tray.destroy();
    tray = null;
  }
  // 关闭所有窗口
  if (mainWindow) {
    mainWindow.removeAllListeners('close');
    mainWindow.destroy();
    mainWindow = null;
  }
  // 直接退出进程
  process.exit(0);
});

app.on('window-all-closed', () => {
  // 不退出应用，保留托盘运行
  // 用户可以通过托盘菜单的"退出"选项来真正退出应用
});

/**
 * 处理文件保存对话框
 */
ipcMain.handle('dialog:saveFile', async (event, options) => {
  const { defaultPath, filters } = options || {};
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '保存汇总表',
    defaultPath: defaultPath || '汇总表.xlsx',
    filters: filters || [
      { name: 'Excel 文件', extensions: ['xlsx'] },
      { name: '所有文件', extensions: ['*'] }
    ],
  });
  
  return result;
});

/**
 * 保存文件到指定路径
 */
ipcMain.handle('fs:writeFile', async (event, filePath, data) => {
  try {
    fs.writeFileSync(filePath, Buffer.from(data));
    return { success: true, path: filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/**
 * 读取 JSON 文件
 */
ipcMain.handle('fs:readJson', async (event, filePath) => {
  try {
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'ENOENT', notFound: true };
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    const jsonData = JSON.parse(data);
    return { success: true, data: jsonData };
  } catch (error) {
    return { success: false, error: error.message, notFound: error.code === 'ENOENT' };
  }
});

/**
 * 写入 JSON 文件
 */
ipcMain.handle('fs:writeJson', async (event, filePath, jsonData) => {
  try {
    // 确保目录存在
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const jsonString = JSON.stringify(jsonData, null, 2);
    fs.writeFileSync(filePath, jsonString, 'utf-8');
    return { success: true, path: filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/**
 * 读取目录下的文件名列表
 * @param {string} dirPath - 目录路径
 * @returns {Promise<{ success: boolean, files?: string[], error?: string }>}
 */
ipcMain.handle('fs:readdir', async (event, dirPath) => {
  try {
    const files = await fs.promises.readdir(dirPath);
    return { success: true, files };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/**
 * 创建目录（如果不存在）
 */
ipcMain.handle('fs:mkdir', async (event, dirPath) => {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    return { success: true, path: dirPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/**
 * 获取应用根目录路径
 */
ipcMain.handle('app:getPath', async (event, name) => {
  try {
    if (name === 'userData') {
      return { success: true, path: app.getPath('userData') };
    } else if (name === 'appData') {
      return { success: true, path: app.getPath('appData') };
    } else {
      // 返回应用根目录（开发环境是项目根目录，生产环境是资源目录）
      const isDev = process.env.VITE_DEV_SERVER_URL || process.env.ELECTRON_START_URL;
      const appPath = isDev ? process.cwd() : app.getAppPath();
      return { success: true, path: appPath };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/**
 * 在文件管理器中显示文件或文件夹
 */
ipcMain.handle('shell:showItemInFolder', async (event, filePath) => {
  try {
    shell.showItemInFolder(filePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/**
 * 打开目录（使用系统默认的文件管理器）
 */
ipcMain.handle('shell:openPath', async (event, dirPath) => {
  try {
    await shell.openPath(dirPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});