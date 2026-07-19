import { Injectable } from '@nestjs/common';
import { extname } from 'node:path';
import { EmbeddingChunk } from '../embeddings/embedding.service';
import { CSharpParserService } from '../csharp-parser/csharp-parser.service';

@Injectable()
export class CodeChunkerService {
  private static readonly maxLinesPerChunk = 100;
  private static readonly supportedExtensions = new Set([
    '.cs',
    '.sql',
    '.ts',
    '.tsx',
    '.js',
    '.json',
  ]);

  constructor(private readonly csharpParser: CSharpParserService) {}

  chunk(source: string, filePath: string): EmbeddingChunk[] {
    if (extname(filePath).toLowerCase() === '.cs') {
      return this.csharpParser.parse(source, filePath);
    }

    return this.chunkText(source, filePath);
  }

  supports(filePath: string): boolean {
    return CodeChunkerService.supportedExtensions.has(
      extname(filePath).toLowerCase(),
    );
  }

  private chunkText(source: string, filePath: string): EmbeddingChunk[] {
    if (!source) {
      return [];
    }

    const lines = source.split(/\r?\n/);
    const type = extname(filePath).slice(1).toLowerCase();
    const chunks: EmbeddingChunk[] = [];

    for (
      let startIndex = 0;
      startIndex < lines.length;
      startIndex += CodeChunkerService.maxLinesPerChunk
    ) {
      const endIndex = Math.min(
        startIndex + CodeChunkerService.maxLinesPerChunk,
        lines.length,
      );

      chunks.push({
        chunkKey: `text:${startIndex + 1}`,
        content: lines.slice(startIndex, endIndex).join('\n'),
        endLine: endIndex,
        filePath,
        startLine: startIndex + 1,
        type,
      });
    }

    return chunks;
  }
}
