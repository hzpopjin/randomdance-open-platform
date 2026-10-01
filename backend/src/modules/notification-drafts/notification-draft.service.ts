import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationDraft } from './notification-draft.entity';
import { content, exact, render, revision } from './notification-draft.validation';
export interface DraftActor { id: number; role: number; is_guest?: number }
@Injectable()
export class NotificationDraftService {
  constructor(@InjectRepository(NotificationDraft) private readonly repo: Repository<NotificationDraft>) {}
  private owner(actor: DraftActor) {
    if (!actor || ![1, 2].includes(actor.role) || actor.is_guest || !Number.isSafeInteger(actor.id) || actor.id < 1) throw new ForbiddenException();
    return actor.id;
  }
  list(actor: DraftActor) {
    return this.repo.find({ where: { organizer_id: this.owner(actor) }, order: { updated_at: 'DESC', id: 'DESC' } });
  }
  async get(id: number, actor: DraftActor) {
    const row = await this.repo.findOne({ where: { id, organizer_id: this.owner(actor) } });
    if (!row) throw new NotFoundException('草稿不存在');
    return row;
  }
  async create(input: unknown, actor: DraftActor) {
    const owner = this.owner(actor);
    const fields = content(exact(input, ['name', 'title', 'body', 'variables']));
    try {
      return await this.repo.save(this.repo.create({ ...fields, organizer_id: owner, status: 'draft', revision: 1, created_by: owner, updated_by: owner }));
    } catch (error) { this.databaseError(error); }
  }
  async update(id: number, input: unknown, actor: DraftActor) {
    const current = await this.get(id, actor);
    const raw = exact(input, ['name', 'title', 'body', 'variables', 'revision']);
    const expected = revision(raw.revision);
    if (current.status !== 'draft') throw new ConflictException('请先恢复已归档草稿');
    return this.change(current, expected, content(raw), actor);
  }
  async archive(id: number, input: unknown, actor: DraftActor, status: 'draft' | 'archived') {
    const current = await this.get(id, actor);
    const raw = exact(input, ['revision']);
    return this.change(current, revision(raw.revision), { status }, actor);
  }
  async preview(id: number, input: unknown, actor: DraftActor) {
    const row = await this.get(id, actor);
    const raw = exact(input, ['revision', 'values']);
    if (row.revision !== revision(raw.revision)) throw new ConflictException('草稿已变更，请刷新后重试');
    return render(row, raw.values);
  }
  private async change(current: NotificationDraft, expected: number, fields: Partial<NotificationDraft>, actor: DraftActor) {
    // CAS performed by one SQL UPDATE; a preceding read alone is not concurrency protection.
    try {
      const result = await this.repo.update({ id: current.id, organizer_id: this.owner(actor), revision: expected, status: current.status },
        { ...fields, updated_by: actor.id, revision: () => 'revision + 1' });
      if (result.affected !== 1) throw new ConflictException('草稿已变更，请刷新后重试');
      return this.get(current.id, actor);
    } catch (error) { this.databaseError(error); }
  }
  private databaseError(error: any): never {
    if (error?.code === 'ER_DUP_ENTRY' || error?.driverError?.code === 'ER_DUP_ENTRY') throw new ConflictException('已有同名草稿（含归档草稿）');
    throw error;
  }
}
