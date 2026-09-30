import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { OrganizerController } from './organizer.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [OrganizerController],
  exports: [TypeOrmModule],
})
export class UserModule {}
