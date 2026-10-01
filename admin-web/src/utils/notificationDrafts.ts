import type { NotificationDraftInput, NotificationVariable, PreviewValues } from '../types/notification-draft';
const reserved = new Set(['__proto__', 'prototype', 'constructor', ...Object.getOwnPropertyNames(Object.prototype)]);
export function isNotificationVariableName(name: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(name) && !reserved.has(name);
}
export function validateNotificationDraft(input: NotificationDraftInput): string | undefined {
  for (const [key, limit, label] of [['name', 80, '名称'], ['title', 120, '标题'], ['body', 2000, '正文']] as const) {
    if (!input[key]?.trim()) return `请填写${label}`;
    if (input[key].length > limit) return `${label}不能超过 ${limit} 字符`;
  }
  if ((input.variables || []).length > 30) return '变量最多 30 个';
  const names = new Set<string>();
  for (const variable of input.variables || []) {
    if (!isNotificationVariableName(variable.name)) return '变量名须以英文字母开头，仅含字母、数字或下划线，最多 40 字符，且不能使用保留名称';
    if (names.has(variable.name)) return `变量名重复：${variable.name}`;
    names.add(variable.name);
  }
  for (const source of [input.title, input.body]) {
    let undeclared = '';
    const remaining = source.replace(/\{\{\s*([A-Za-z][A-Za-z0-9_]{0,39})\s*\}\}/g, (_match, name: string) => {
      if (!names.has(name)) undeclared = name;
      return '';
    });
    if (undeclared) return `请先声明变量：${undeclared}`;
    if (remaining.includes('{{') || remaining.includes('}}')) return '占位符格式无效；仅支持 {{variable}}';
  }
}
export function buildPreviewValues(variables: NotificationVariable[], values: Record<string, unknown>): PreviewValues {
  const result: PreviewValues = Object.create(null);
  for (const variable of variables) {
    if (!isNotificationVariableName(variable.name)) throw new Error('变量名无效');
    const value = Object.prototype.hasOwnProperty.call(values, variable.name) ? values[variable.name] : undefined;
    if (variable.required && (value === undefined || value === null || (typeof value === 'string' && !value.trim()))) throw new Error(`请填写变量：${variable.name}`);
    if (value === undefined) continue;
    if (!['string', 'number', 'boolean'].includes(typeof value)) throw new Error('预览值必须为标量');
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('预览数值必须为有限数');
    if (String(value).length > 2000) throw new Error('预览值不能超过 2000 字符');
    result[variable.name] = value as string | number | boolean;
  }
  return result;
}
// Tokens invalidate pending results on dismissal, unmount, identity changes, or a newer request.
export function createDraftRequestGate() {
  let generation = 0;
  return { next: () => ++generation, invalidate: () => { ++generation; }, current: (ticket: number) => ticket === generation };
}
export function notificationDraftError(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败，请重试';
}
