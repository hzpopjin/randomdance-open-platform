import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ClientEvent } from './entities/client-event.entity';

@Injectable()
export class ClientEventsService {
  constructor(@InjectRepository(ClientEvent) private eventRepo: Repository<ClientEvent>) {}

  async create(data: any) {
    const event = this.eventRepo.create({
      event_id: data.event_id || data.eventId,
      event_type: data.event_type || data.eventType,
      platform: data.platform,
      device_id: data.device_id || data.deviceId,
      request_id: data.request_id || data.requestId,
      uid: data.uid,
      auth_user_id: data.auth_user_id || data.authUserId,
      ip: data.ip,
      user_agent: data.user_agent || data.userAgent,
      resource_type: data.resource_type || data.resourceType,
      resource_id: data.resource_id || data.resourceId,
      context_payload: data.context_payload || data.contextPayload,
      app_version: data.app_version || data.appVersion,
      device_model: data.device_model || data.deviceModel,
      os_version: data.os_version || data.osVersion,
      occurred_at: data.occurred_at || data.occurredAt ? new Date(data.occurred_at || data.occurredAt) : new Date(),
    });
    await this.eventRepo.save(event);
    return { id: event.id };
  }

  async findAll(params: { page?: number; page_size?: number; event_type?: string; keyword?: string }) {
    const page = Number(params.page || 1);
    const pageSize = Number(params.page_size || 10);
    const qb = this.eventRepo.createQueryBuilder('e');
    if (params.event_type) qb.andWhere('e.event_type = :type', { type: params.event_type });
    if (params.keyword) {
      qb.andWhere('(e.event_id LIKE :kw OR e.device_id LIKE :kw OR e.event_type LIKE :kw)', { kw: `%${params.keyword}%` });
    }
    const [list, total] = await qb.orderBy('e.received_at', 'DESC')
      .skip((page - 1) * pageSize).take(pageSize).getManyAndCount();
    return { list, total, page, page_size: pageSize };
  }

  async findOne(id: number) { return this.eventRepo.findOne({ where: { id } }); }
  async remove(id: number) { await this.eventRepo.delete(id); return { id }; }
  async batchRemove(ids: number[]) { await this.eventRepo.delete({ id: In(ids) }); return { affected: ids.length }; }
}
