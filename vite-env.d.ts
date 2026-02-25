/// <reference types="vite/client" />

/**
 * Vite 环境变量类型定义
 */
interface ImportMetaEnv {
  readonly VITE_ZHIPU_API_KEY?: string;
  readonly ZHIPU_API_KEY?: string;
  readonly GEMINI_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * JSON 模块类型声明
 */
declare module '*.json' {
  const value: any;
  export default value;
}

/**
 * Electron API 类型定义
 */
declare global {
  interface Window {
    appEnv?: {
      isElectron: boolean;
    };
    electronAPI?: {
      minimizeWindow: () => void;
      maximizeWindow: () => void;
      closeWindow: () => void;
      quitApp: () => void;
      showSaveDialog: (options: any) => Promise<{ canceled: boolean; filePath?: string }>;
      writeFile: (filePath: string, data: ArrayBuffer) => Promise<{ success: boolean; path?: string; error?: string }>;
      readJson: (filePath: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      writeJson: (filePath: string, jsonData: any) => Promise<{ success: boolean; path?: string; error?: string }>;
      mkdir: (dirPath: string) => Promise<{ success: boolean; path?: string; error?: string }>;
      readdir: (dirPath: string) => Promise<{ success: boolean; files?: string[]; error?: string }>;
      getAppPath: (name?: string) => Promise<{ success: boolean; path?: string; error?: string }>;
      showItemInFolder: (filePath: string) => Promise<{ success: boolean; error?: string }>;
      openPath: (dirPath: string) => Promise<{ success: boolean; error?: string }>;
      /** 检查更新（electron-updater） */
      checkForUpdates?: () => Promise<void>;
      /** 下载已发现的更新 */
      downloadUpdate?: () => Promise<void>;
      /** 退出并安装更新（会重启应用） */
      quitAndInstall?: () => Promise<void>;
      /** 订阅更新事件，返回取消订阅函数 */
      onUpdaterEvent?: (callback: (arg: { type: string; payload?: any }) => void) => () => void;
    };
  }
}

export {};