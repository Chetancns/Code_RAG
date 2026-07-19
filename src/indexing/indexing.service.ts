import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import { CodeChunkerService } from '../code-chunker/code-chunker.service';
import { EmbeddingService } from '../embeddings/embedding.service';
import { FolderScannerService } from '../folder-scanner/folder-scanner.service';
import { FileWatcherService } from '../watcher/file-watcher.service';

export interface IndexingResult {
  chunksIndexed: number;
  filesIndexed: number;
  folderPath: string;
}

@Injectable()
export class IndexingService {
  private readonly logger = new Logger(IndexingService.name);

  constructor(
    private readonly folderScanner: FolderScannerService,
    private readonly chunker: CodeChunkerService,
    private readonly embeddingService: EmbeddingService,
    private readonly watcher: FileWatcherService,
  ) {}

  async index(folderPath: string): Promise<IndexingResult> {
    const resolvedFolderPath = resolve(folderPath);
    const folderStats = await fs.stat(resolvedFolderPath);

    if (!folderStats.isDirectory()) {
      throw new Error(`Not a directory: ${resolvedFolderPath}`);
    }

    this.logger.log(`Scanning supported code files in ${resolvedFolderPath}`);
    const files = (await this.folderScanner.scan(resolvedFolderPath)).filter(
      (filePath) => this.chunker.supports(filePath),
    );
    let chunksIndexed = 0;

    this.logger.log(`Found ${files.length} supported code files to index.`);

    for (const [index, filePath] of files.entries()) {
      this.logger.log(`[${index + 1}/${files.length}] Reading ${filePath}`);
      const source = await fs.readFile(filePath, 'utf8');
      const chunks = this.chunker.chunk(source, filePath);

      this.logger.log(
        `[${index + 1}/${files.length}] Parsed ${chunks.length} chunks; updating embeddings.`,
      );
      await this.embeddingService.replaceFileChunks(filePath, chunks);
      chunksIndexed += chunks.length;
    }

    await this.watcher.start(resolvedFolderPath);
    this.logger.log(`Watching ${resolvedFolderPath} for supported code changes.`);

    return {
      folderPath: resolvedFolderPath,
      filesIndexed: files.length,
      chunksIndexed,
    };
  }
}
