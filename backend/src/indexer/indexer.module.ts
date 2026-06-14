import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { IndexerService } from './indexer.service';
import { IndexerController } from './indexer.controller';
import {
  IndexedIdentity,
  IndexedVerification,
  IndexedAccessControl,
  IndexedDataSharing,
} from './entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IndexedIdentity,
      IndexedVerification,
      IndexedAccessControl,
      IndexedDataSharing,
    ]),
    ScheduleModule.forRoot(),
    ConfigModule,
    CacheModule.register(),
  ],
  controllers: [IndexerController],
  providers: [IndexerService],
  exports: [IndexerService],
})
export class IndexerModule {}
