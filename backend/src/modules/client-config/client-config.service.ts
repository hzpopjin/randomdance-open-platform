import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientConfig } from './entities/client-config.entity';

@Injectable()
export class ClientConfigService {
  constructor(@InjectRepository(ClientConfig) private configRepo: Repository<ClientConfig>) {}

  async get(key: string) {
    const config = await this.configRepo.findOne({ where: { config_key: key } });
    return config?.config_value || {};
  }

  async set(key: string, value: any) {
    let config = await this.configRepo.findOne({ where: { config_key: key } });
    if (config) {
      config.config_value = value;
    } else {
      config = this.configRepo.create({ config_key: key, config_value: value });
    }
    await this.configRepo.save(config);
    return { config_key: key, config_value: value };
  }

  async findAll() {
    const configs = await this.configRepo.find();
    return configs.map((c) => ({ config_key: c.config_key, config_value: c.config_value }));
  }
}
