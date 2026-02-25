import { EntityMapping } from './types';
export const COLORS = {
  primary: '#1E40AF',
  secondary: '#3B82F6',
  accent: '#F97316',
  success: '#10B981',
  bgGray: '#F9FAFB',
  border: '#E5E7EB',
  text: '#374151',
  error: '#EF4444',
};

export const INITIAL_MAPPINGS = [
  { sourceField: '交易时间', targetField: '交易日期' },
  { sourceField: '记账金额', targetField: '交易金额' },
  { sourceField: '摘要', targetField: '费用明细' },
];


export const INITIAL_ENTITY_MAPPINGS: EntityMapping[] = [
  {
    entityName: '阿里巴巴',
    mappings: [
      { sourceField: 'Alipay_Time', targetField: '交易时间' },
      { sourceField: 'Amount_CNY', targetField: '汇总金额' }
    ]
  },
  {
    entityName: '腾讯科技',
    mappings: [
      { sourceField: 'WeChat_Date', targetField: '交易时间' },
      { sourceField: 'Fee', targetField: '汇总金额' }
    ]
  }
];