import React, { createContext, useContext, useState, ReactNode } from 'react';

/**
 * 处理状态上下文接口
 */
interface ProcessingContextType {
  /**
   * 是否正在处理
   */
  isProcessing: boolean;
  /**
   * 设置处理状态
   */
  setIsProcessing: (processing: boolean) => void;
}

/**
 * 处理状态上下文
 */
const ProcessingContext = createContext<ProcessingContextType | undefined>(undefined);

/**
 * 处理状态提供者组件
 */
export const ProcessingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  return (
    <ProcessingContext.Provider value={{ isProcessing, setIsProcessing }}>
      {children}
    </ProcessingContext.Provider>
  );
};

/**
 * 使用处理状态 Hook
 */
export const useProcessing = (): ProcessingContextType => {
  const context = useContext(ProcessingContext);
  if (context === undefined) {
    throw new Error('useProcessing must be used within a ProcessingProvider');
  }
  return context;
};
