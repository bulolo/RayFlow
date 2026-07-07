import type { FlinkJobResponse } from '@/shared/api/generated';

/**
 * 扩展的 FlinkJobResponse 实体类型
 * 在原有的 FlinkJobResponse 自动生成类型（契约）之外，追加前端 UI 交互的独占状态（如按钮 Loading，行展开等），
 * 规约：严禁修改自动生成的 sdk.ts，任何 UI 自定义属性在此处通过 TS 交叉类型扩展。
 */
export type ExtendedFlinkJob = FlinkJobResponse & {
  _actionLoading?: boolean;
  _isExpanded?: boolean;
};
