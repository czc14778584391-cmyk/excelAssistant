
export interface Transaction {
  id: string;
  date: string;
  amount: number;
  description: string;
  bank: string;
  category1: string;
  category2: string;
  category3: string;
  status: 'classified' | 'ai-classified' | 'unclassified';
}

export interface BankFile {
  id: string;
  name: string;
  size: string;
  uploadTime: string;
  status: 'uploaded' | 'processing';
  file?: File; // 实际的 File 对象
  bankAccount?: string; // 银行账号
}

export interface MappingRule {
  sourceField: string;
  targetField: string;
}

export interface EntityMapping {
  entityName: string;
  mappings: MappingRule[];
}


export interface CategoryNode {
  id: string;
  name: string;
  children?: CategoryNode[];
}

export type PageType = 'home' | 'config' | 'config-json' | 'tool-split' | 'tool-merge' | 'help' | 'field-mapping-doc';
export type ConfigTab = 'mapping' | 'ai' | 'dictionary' | 'summaryHeader';
export type ToolType = 'split' | 'merge';
export type HelpTab = 'guide' | 'faq' | 'logs';

/**
 * 侧边栏菜单项类型
 */
export interface SidebarMenuItem {
  id: string;
  label: string;
  icon?: string;
  children?: SidebarMenuItem[];
  page?: PageType;
}
