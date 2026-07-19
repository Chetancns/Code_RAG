import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  FeatureExtractionPipeline,
  pipeline,
} from '@huggingface/transformers';
import { Pool } from 'pg';
import { POSTGRES_POOL } from './embedding.constants';

export interface EmbeddingChunk {
  chunkKey: string;
  content: string;
  endLine: number;
  filePath: string;
  startLine: number;
  type: string;
}

@Injectable()
export class EmbeddingService {
  private static readonly model = 'Xenova/all-MiniLM-L6-v2';
  private extractor?: Promise<FeatureExtractionPipeline>;
  private initialization?: Promise<void>;
  private readonly logger = new Logger(EmbeddingService.name);

  constructor(@Inject(POSTGRES_POOL) private readonly pool: Pool) {}

  async embedAndStore(chunk: EmbeddingChunk): Promise<number> {
    await this.initialize();

    this.logger.log(`Embedding ${chunk.chunkKey} from ${chunk.filePath}.`);
    const embedding = await this.embed(chunk.content);
    const result = await this.pool.query<{ id: number }>(
      `INSERT INTO document_embeddings
        (file_path, chunk_key, chunk_type, start_line, end_line, content, embedding)
       VALUES ($1, $2, $3, $4, $5, $6, $7::vector)
       RETURNING id`,
      [
        chunk.filePath,
        chunk.chunkKey,
        chunk.type,
        chunk.startLine,
        chunk.endLine,
        chunk.content,
        this.toVectorLiteral(embedding),
      ],
    );

    return result.rows[0].id;
  }

  async replaceFileChunks(
    filePath: string,
    chunks: EmbeddingChunk[],
  ): Promise<void> {
    await this.initialize();
    this.logger.log(`Checking indexed chunks for ${filePath}.`);
    const existing = await this.pool.query<StoredChunk>(
      `SELECT
        chunk_key AS "chunkKey",
        chunk_type AS type,
        start_line AS "startLine",
        end_line AS "endLine",
        content
       FROM document_embeddings
       WHERE file_path = $1`,
      [filePath],
    );
    const existingByKey = new Map(
      existing.rows.map((chunk) => [chunk.chunkKey, chunk]),
    );
    const incomingKeys = new Set<string>();
    const chunksToEmbed: EmbeddingChunk[] = [];
    const chunksWithUpdatedLocations: EmbeddingChunk[] = [];

    for (const chunk of chunks) {
      if (incomingKeys.has(chunk.chunkKey)) {
        throw new Error(`Duplicate chunk key: ${chunk.chunkKey}`);
      }

      incomingKeys.add(chunk.chunkKey);
      const stored = existingByKey.get(chunk.chunkKey);

      if (!stored || stored.content !== chunk.content || stored.type !== chunk.type) {
        chunksToEmbed.push(chunk);
      } else if (
        stored.startLine !== chunk.startLine ||
        stored.endLine !== chunk.endLine
      ) {
        chunksWithUpdatedLocations.push(chunk);
      }
    }

    this.logger.log(
      `${chunksToEmbed.length} chunks need embeddings; ${chunksWithUpdatedLocations.length} only need line updates.`,
    );
    const embeddedChunks: Array<{
      chunk: EmbeddingChunk;
      embedding: number[];
    }> = [];

    for (const chunk of chunksToEmbed) {
      this.logger.log(`Generating embedding for ${chunk.chunkKey}.`);
      embeddedChunks.push({
        chunk,
        embedding: await this.embed(chunk.content),
      });
    }

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(
        `DELETE FROM document_embeddings
         WHERE file_path = $1
           AND NOT (chunk_key = ANY($2::text[]))`,
        [filePath, [...incomingKeys]],
      );

      for (const { chunk, embedding } of embeddedChunks) {
        await client.query(
          `INSERT INTO document_embeddings
            (file_path, chunk_key, chunk_type, start_line, end_line, content, embedding)
           VALUES ($1, $2, $3, $4, $5, $6, $7::vector)
           ON CONFLICT (file_path, chunk_key) DO UPDATE SET
             chunk_type = EXCLUDED.chunk_type,
             start_line = EXCLUDED.start_line,
             end_line = EXCLUDED.end_line,
             content = EXCLUDED.content,
             embedding = EXCLUDED.embedding`,
          [
            chunk.filePath,
            chunk.chunkKey,
            chunk.type,
            chunk.startLine,
            chunk.endLine,
            chunk.content,
            this.toVectorLiteral(embedding),
          ],
        );
      }

      for (const chunk of chunksWithUpdatedLocations) {
        await client.query(
          `UPDATE document_embeddings
           SET start_line = $3, end_line = $4
           WHERE file_path = $1 AND chunk_key = $2`,
          [chunk.filePath, chunk.chunkKey, chunk.startLine, chunk.endLine],
        );
      }

      await client.query('COMMIT');
      this.logger.log(`Updated indexed chunks for ${filePath}.`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async embed(text: string): Promise<number[]> {
    const extractor = await this.getExtractor();
    const output = await extractor(text, {
      pooling: 'mean',
      normalize: true,
    });

    return Array.from(output.data);
  }

  private initialize(): Promise<void> {
    this.initialization ??= this.createSchema();

    return this.initialization;
  }

  private async createSchema(): Promise<void> {
    this.logger.log('Ensuring the pgvector schema is available.');
    await this.pool.query('CREATE EXTENSION IF NOT EXISTS vector');
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS document_embeddings (
        id BIGSERIAL PRIMARY KEY,
        file_path TEXT NOT NULL,
        chunk_key TEXT NOT NULL,
        chunk_type TEXT NOT NULL,
        start_line INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        content TEXT NOT NULL,
        embedding VECTOR(384) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.pool.query(
      'ALTER TABLE document_embeddings ADD COLUMN IF NOT EXISTS chunk_key TEXT',
    );
    await this.pool.query(
      `UPDATE document_embeddings
       SET chunk_key = CONCAT('legacy:', id)
       WHERE chunk_key IS NULL`,
    );
    await this.pool.query(
      'ALTER TABLE document_embeddings ALTER COLUMN chunk_key SET NOT NULL',
    );
    await this.pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS document_embeddings_file_chunk_idx
      ON document_embeddings (file_path, chunk_key)
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS document_embeddings_embedding_idx
      ON document_embeddings
      USING hnsw (embedding vector_cosine_ops)
    `);
    this.logger.log('pgvector schema is ready.');
  }

  private getExtractor(): Promise<FeatureExtractionPipeline> {
    if (!this.extractor) {
      this.logger.log(`Loading embedding model ${EmbeddingService.model}.`);
    }

    this.extractor ??= pipeline<'feature-extraction'>(
      'feature-extraction',
      EmbeddingService.model,
      {
        dtype: 'q8',
      },
    );

    return this.extractor;
  }

  private toVectorLiteral(embedding: number[]): string {
    if (embedding.some((value) => !Number.isFinite(value))) {
      throw new Error('Embedding contains a non-finite value.');
    }

    return `[${embedding.join(',')}]`;
  }
}

interface StoredChunk {
  chunkKey: string;
  content: string;
  endLine: number;
  startLine: number;
  type: string;
}
