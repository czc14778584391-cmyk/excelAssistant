/**
 * 配置 JSON 编辑页
 * 编辑并保存 userData/config 目录下的 JSON 文件，使用 jsoneditor 展示与编辑
 * @see https://github.com/josdejong/jsoneditor
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import JSONEditor from 'jsoneditor';
import 'jsoneditor/dist/jsoneditor.min.css';

const ConfigJsonEditor: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<{ set: (json: object) => void; get: () => unknown; destroy: () => void } | null>(null);

  const [configDirPath, setConfigDirPath] = useState<string | null>(null);
  const [jsonFiles, setJsonFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [editedJson, setEditedJson] = useState<object | unknown[]>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle');
  const [showSaveSuccessToast, setShowSaveSuccessToast] = useState(false);

  const isElectron = Boolean(window.appEnv?.isElectron);

  /**
   * 获取 config 目录路径（userData/config）
   */
  const getConfigDir = useCallback(async (): Promise<string | null> => {
    if (!window.electronAPI?.getAppPath) return null;
    const result = await window.electronAPI.getAppPath('userData');
    if (!result?.success || !result.path) return null;
    const separator = result.path.includes('\\') ? '\\' : '/';
    return `${result.path}${separator}config`;
  }, []);

  /**
   * 刷新 config 目录下的 .json 文件列表
   */
  const refreshFileList = useCallback(async () => {
    if (!isElectron || !window.electronAPI?.readdir) {
      setJsonFiles([]);
      setConfigDirPath(null);
      return;
    }
    const dir = await getConfigDir();
    setConfigDirPath(dir);
    if (!dir) {
      setJsonFiles([]);
      return;
    }
    const result = await window.electronAPI.readdir(dir);
    if (result.success && Array.isArray(result.files)) {
      const list = result.files.filter((f) => typeof f === 'string' && f.toLowerCase().endsWith('.json'));
      setJsonFiles(list);
      if (list.length > 0 && !list.includes(selectedFile)) {
        setSelectedFile(list[0]);
      }
    } else {
      setJsonFiles([]);
    }
  }, [isElectron, getConfigDir, selectedFile]);

  /**
   * 加载选中的 JSON 文件内容
   */
  const loadSelectedFile = useCallback(async () => {
    if (!configDirPath || !selectedFile || !window.electronAPI?.readJson) {
      setEditedJson({});
      setLoadError(null);
      return;
    }
    const separator = configDirPath.includes('\\') ? '\\' : '/';
    const filePath = `${configDirPath}${separator}${selectedFile}`;
    const result = await window.electronAPI.readJson(filePath);
    if (result.success && result.data !== undefined) {
      const data = result.data;
      if (typeof data === 'object' && data !== null) {
        setEditedJson(Array.isArray(data) ? data : (data as object));
      } else {
        setEditedJson({ value: data } as object);
      }
      setLoadError(null);
    } else {
      setEditedJson({});
      setLoadError(result?.error === 'ENOENT' ? '文件不存在' : result?.error || '读取失败');
    }
  }, [configDirPath, selectedFile]);

  useEffect(() => {
    refreshFileList();
  }, [refreshFileList]);

  useEffect(() => {
    if (selectedFile && configDirPath) {
      loadSelectedFile();
    } else {
      setEditedJson({});
      setLoadError(null);
    }
  }, [selectedFile, configDirPath, loadSelectedFile]);

  /** 创建/销毁 jsoneditor 实例，随 selectedFile 切换 */
  useEffect(() => {
    if (!containerRef.current || !selectedFile) {
      return;
    }
    const options: JSONEditorOptions = { mode: 'tree' };
    const editor = new (JSONEditor as any)(containerRef.current, options) as { set: (json: object) => void; get: () => unknown; destroy: () => void };
    editor.set(editedJson as object);
    editorRef.current = editor;
    // 加载完成后会由下方 useEffect 同步 editedJson 到编辑器
    return () => {
      editor.destroy();
      editorRef.current = null;
    };
  }, [selectedFile]);

  /** 加载完文件后把内容同步到编辑器 */
  useEffect(() => {
    if (!editorRef.current || !selectedFile) return;
    editorRef.current.set(editedJson as object);
  }, [editedJson, selectedFile]);

  /**
   * 保存当前编辑内容到选中文件
   */
  const handleSave = async () => {
    if (!isElectron || !window.electronAPI?.writeJson) {
      alert('此功能仅在 Electron 环境中可用');
      return;
    }
    if (!configDirPath || !selectedFile) {
      alert('请先选择要保存的配置文件');
      return;
    }
    let dataToWrite: object | unknown[];
    try {
      const current = editorRef.current?.get();
      dataToWrite = JSON.parse(JSON.stringify(current)) as object | unknown[];
    } catch {
      alert('JSON 格式不合法，请检查后再保存');
      return;
    }
    setSaveStatus('saving');
    const separator = configDirPath.includes('\\') ? '\\' : '/';
    const filePath = `${configDirPath}${separator}${selectedFile}`;
    const result = await window.electronAPI.writeJson(filePath, dataToWrite);
    if (result?.success) {
      setEditedJson(dataToWrite);
      setSaveStatus('ok');
      setShowSaveSuccessToast(true);
      setTimeout(() => {
        setSaveStatus('idle');
        setShowSaveSuccessToast(false);
      }, 2000);
    } else {
      setSaveStatus('error');
      alert(`保存失败: ${result?.error || '未知错误'}`);
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  /**
   * 打开 config 目录（仅 Electron）
   */
  const handleOpenConfigDir = async () => {
    if (!isElectron || !window.electronAPI?.openPath || !configDirPath) {
      alert('此功能仅在 Electron 环境中可用');
      return;
    }
    await window.electronAPI.openPath(configDirPath);
  };

  return (
    <div className="h-full flex flex-col relative">
      {/* 保存成功弹框提醒 */}
      {showSaveSuccessToast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-green-600 text-white px-6 py-4 rounded-lg shadow-lg text-base font-medium">
            保存成功
          </div>
        </div>
      )}
      <div className="bg-white border-b sticky top-[10px] z-40 rounded-t-lg shadow-sm">
        <div className="flex px-4 py-3 items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-xs font-bold text-gray-600">当前文件：</label>
            <select
              value={selectedFile}
              onChange={(e) => setSelectedFile(e.target.value)}
              className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800 min-w-[180px]"
            >
              <option value="">
                {isElectron ? '请选择配置文件' : '仅 Electron 可用'}
              </option>
              {jsonFiles.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={refreshFileList}
              className="px-3 py-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200"
            >
              刷新列表
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!selectedFile || saveStatus === 'saving'}
              className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {saveStatus === 'saving' ? '保存中…' : saveStatus === 'ok' ? '已保存' : '保存'}
            </button>
            {isElectron && (
              <button
                type="button"
                onClick={handleOpenConfigDir}
                className="px-3 py-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200"
                title="在文件管理器中打开配置文件目录"
              >
                打开 config 目录
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="flex-1 bg-white rounded-b-lg border border-t-0 p-6 shadow-sm overflow-auto min-h-0">
        {loadError && (
          <div className="mb-3 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            {loadError}
          </div>
        )}
        {!selectedFile ? (
          <div className="text-gray-500 text-sm">请在上方选择或刷新配置文件</div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden min-h-[400px]" style={{ height: '100%', minHeight: '400px' }}>
            <div ref={containerRef} className="h-full w-full" style={{ minHeight: '400px' }} />
          </div>
        )}
      </div>
    </div>
  );
};

/** jsoneditor 的 options 类型（仅用到的字段） */
interface JSONEditorOptions {
  mode?: 'tree' | 'view' | 'form' | 'code' | 'text';
  [key: string]: unknown;
}

export default ConfigJsonEditor;
