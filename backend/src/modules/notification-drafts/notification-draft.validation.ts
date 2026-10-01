import { BadRequestException } from '@nestjs/common';
import { DraftVariable } from './notification-draft.entity';
export interface DraftContent { name: string; title: string; body: string; variables: DraftVariable[] }
const KEY = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
const RESERVED = new Set(['__proto__', 'prototype', 'constructor', ...Object.getOwnPropertyNames(Object.prototype)]);
const PLACEHOLDER = /\{\{\s*([A-Za-z][A-Za-z0-9_]{0,39})\s*\}\}/g;
function bad(message: string): never { throw new BadRequestException(message); }
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))) bad('请求必须是普通对象');
  return value as Record<string, unknown>;
}
export function exact(value: unknown, keys: string[]): Record<string, unknown> {
  const input = object(value);
  if (Object.keys(input).some(key => !keys.includes(key))) bad('包含不允许的字段');
  return input;
}
export function revision(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) >= 4294967295) bad('版本号无效');
  return value as number;
}
function text(value: unknown, max: number, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) bad(`${label}不能为空且长度不能超过 ${max}`);
  return value;
}
export function content(input: Record<string, unknown>): DraftContent {
  const name = text(input.name, 80, '名称').trim();
  const title = text(input.title, 120, '标题');
  const body = text(input.body, 2000, '正文');
  if (!Array.isArray(input.variables) || input.variables.length > 30) bad('变量最多 30 个');
  const keys = new Set<string>();
  const variables = (input.variables as unknown[]).map(item => {
    const v = exact(item, ['name', 'required']);
    if (typeof v.name !== 'string' || !KEY.test(v.name) || RESERVED.has(v.name)) bad('变量名须是安全的字母、数字或下划线标识符');
    if (keys.has(v.name as string)) bad('变量声明不可重复');
    if (typeof v.required !== 'boolean') bad('变量 required 必须为布尔值');
    keys.add(v.name as string);
    return { name: v.name as string, required: v.required as boolean };
  });
  for (const source of [title, body]) {
    const remaining = source.replace(PLACEHOLDER, (_match, key: string) => {
      if (!keys.has(key)) bad('模板引用了未声明变量');
      return '';
    });
    if (remaining.includes('{{') || remaining.includes('}}')) bad('占位符格式无效；仅支持 {{variable}}');
  }
  return { name, title, body, variables };
}
// Adapted from the source notification-center's declared-placeholder interpolation.
// Deliberately excludes its object paths, recipients, channels and delivery pipeline.
export function render(draft: DraftContent, input: unknown) {
  const checked = content(draft as unknown as Record<string, unknown>);
  const values = exact(input, checked.variables.map(v => v.name));
  for (const variable of checked.variables) {
    const value = Object.prototype.hasOwnProperty.call(values, variable.name) ? values[variable.name] : undefined;
    if (value === undefined) { if (variable.required) bad('缺少必填变量'); continue; }
    if (!['string', 'number', 'boolean'].includes(typeof value) ||
      (typeof value === 'number' && !Number.isFinite(value)) || String(value).length > 2000) bad('变量值必须是长度不超过 2000 的标量');
    if (variable.required && typeof value === 'string' && !value.trim()) bad('必填变量不能为空');
  }
  const interpolate = (source: string) => source.replace(PLACEHOLDER, (_match, key: string) => Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : '');
  const title = interpolate(checked.title), body = interpolate(checked.body);
  if (title.length > 120 || body.length > 2000) bad('预览结果超过标题或正文长度限制');
  return { title, body, preview_only: true as const };
}
