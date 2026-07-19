import { DynamicModule, Module } from '@nestjs/common';
import { Pool } from 'pg';
import { POSTGRES_POOL } from './embedding.constants';
import { EmbeddingService } from './embedding.service';

export { POSTGRES_POOL } from './embedding.constants';

@Module({})
export class EmbeddingModule {
  static register(pool: Pool): DynamicModule {
    return {
      module: EmbeddingModule,
      providers: [
        { provide: POSTGRES_POOL, useValue: pool },
        EmbeddingService,
      ],
      exports: [EmbeddingService],
    };
  }
}
