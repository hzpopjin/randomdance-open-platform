import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Between, LessThan } from 'typeorm';
import { SystemLog } from './entities/system-log.entity';
import { Request } from 'express';

const SENSITIVE_KEYS = ['password', 'token', 'authorization', 'secret', 'cookie'];

function sanitizePayload(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  const result: any = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k))) {
      result[key] = '***';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizePayload(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function truncatePayload(obj: any, maxLen = 2000): any {
  try {
    const str = JSON.stringify(obj);
    if (str.length <= maxLen) return obj;
    return JSON.parse(str.substring(0, maxLen) + '...[truncated]');
  } catch {
    return String(obj).substring(0, maxLen);
  }
}

@Injectable()
export class SystemLogService {
  constructor(@InjectRepository(SystemLog) private logRepo: Repository<SystemLog>) {}

  async createFromRequest(req: Request, data: {
    level: string; type: string; status_code?: number; business_code?: number;
    message: string; duration_ms?: number; response_payload?: any; error_stack?: string;
  }) {
    try {
      const log = this.logRepo.create({
        level: data.level,
        type: data.type,
        method: req.method,
        path: (req.originalUrl || req.url || '').substring(0, 512),
        status_code: data.status_code,
        business_code: data.business_code,
        message: (data.message || '').substring(0, 512),
        duration_ms: data.duration_ms,
        ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.headers['x-real-ip'] as string || req.ip || '',
        user_agent: (req.headers['user-agent'] || '').substring(0, 512),
        user_id: (req as any).user?.id ? String((req as any).user.id) : null,
        request_id: req.headers['x-request-id'] as string || null,
        query_payload: req.query && Object.keys(req.query).length > 0 ? truncatePayload(sanitizePayload(req.query)) : null,
        request_payload: req.body && Object.keys(req.body).length > 0 ? truncatePayload(sanitizePayload(req.body)) : null,
        response_payload: data.response_payload ? truncatePayload(sanitizePayload(data.response_payload)) : null,
        error_stack: data.error_stack?.substring(0, 60000) || null,
      });
      await this.logRepo.save(log);
    } catch (err) {
      console.error('Failed to save system log:', err);
    }
  }

  async findAll(params: { page?: number; page_size?: number; level?: string; type?: string; keyword?: string }) {
    const page = Number(params.page || 1);
    const pageSize = Number(params.page_size || 10);
    const qb = this.logRepo.createQueryBuilder('l');
    if (params.level) qb.andWhere('l.level = :level', { level: params.level });
    if (params.type) qb.andWhere('l.type = :type', { type: params.type });
    if (params.keyword) {
      qb.andWhere('(l.message LIKE :kw OR l.path LIKE :kw)', { kw: `%${params.keyword}%` });
    }
    const [list, total] = await qb.orderBy('l.created_at', 'DESC')
      .skip((page - 1) * pageSize).take(pageSize).getManyAndCount();
    return { list, total, page, page_size: pageSize };
  }

  async findOne(id: number) {
    return this.logRepo.findOne({ where: { id } });
  }

  async remove(id: number) {
    await this.logRepo.delete(id);
    return { id };
  }

  async batchRemove(ids: number[]) {
    const result = await this.logRepo.delete(ids);
    return { affected: result.affected || 0 };
  }

  async clearAll() {
    await this.logRepo.clear();
    return { cleared: true };
  }

  async clearByFilter(filter: { level?: string; type?: string }) {
    const qb = this.logRepo.createQueryBuilder().delete();
    if (filter.level) qb.andWhere('level = :level', { level: filter.level });
    if (filter.type) qb.andWhere('type = :type', { type: filter.type });
    const result = await qb.execute();
    return { affected: result.affected || 0 };
  }
}
