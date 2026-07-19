import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import { FSWatcher, watch } from 'chokidar';
import { CodeChunkerService } from '../code-chunker/code-chunker.service';
import { EmbeddingService } from '../embeddings/embedding.service';

@Injectable()
export class FileWatcherService implements OnModuleDestroy {
  private static readonly ignoredDirectories = new Set([
    'bin',
    'obj',
    '.git',
    'node_modules',
  ]);
  private readonly logger = new Logger(FileWatcherService.name);
  private readonly updates = new Map<string, Promise<void>>();
  private watcher?: FSWatcher;

  constructor(
    private readonly chunker: CodeChunkerService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async start(folderPath: string): Promise<void> {
    await this.watcher?.close();

    this.logger.log(`Starting code file watcher for ${folderPath}.`);
    this.watcher = watch(resolve(folderPath), {
      ignoreInitial: true,
      ignored: (path) => this.isIgnored(path),
      awaitWriteFinish: {
        stabilityThreshold: 250,
        pollInterval: 100,
      },
    });
    this.watcher
      .on('add', (filePath) => this.scheduleUpdate(filePath))
      .on('change', (filePath) => this.scheduleUpdate(filePath))
      .on('unlink', (filePath) => this.scheduleRemoval(filePath))
      .on('error', (error) => this.logger.error(error));
  }

  async onModuleDestroy(): Promise<void> {
    await this.watcher?.close();
  }

  private scheduleUpdate(filePath: string): void {
    if (this.chunker.supports(filePath)) {
      this.logger.log(`Detected code update: ${filePath}`);
      this.enqueue(filePath, async () => {
        const source = await fs.readFile(filePath, 'utf8');
        const chunks = this.chunker.chunk(source, filePath);

        await this.embeddingService.replaceFileChunks(filePath, chunks);
      });
    }
  }

  private scheduleRemoval(filePath: string): void {
    if (this.chunker.supports(filePath)) {
      this.logger.log(`Detected code deletion: ${filePath}`);
      this.enqueue(filePath, () =>
        this.embeddingService.replaceFileChunks(filePath, []),
      );
    }
  }

  private enqueue(filePath: string, update: () => Promise<void>): void {
    const previous = this.updates.get(filePath) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(update);

    this.updates.set(filePath, next);
    next.catch((error: unknown) => this.logger.error(error));
    void next.then(
      () => this.removeCompletedUpdate(filePath, next),
      () => this.removeCompletedUpdate(filePath, next),
    );
  }

  private removeCompletedUpdate(filePath: string, update: Promise<void>): void {
    if (this.updates.get(filePath) === update) {
      this.updates.delete(filePath);
    }
  }

  private isIgnored(path: string): boolean {
    return path
      .split(/[\\/]/)
      .some((segment) => FileWatcherService.ignoredDirectories.has(segment));
  }

}
