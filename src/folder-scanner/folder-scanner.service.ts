import { Injectable } from '@nestjs/common';
import { Dirent, promises as fs } from 'node:fs';
import { extname, resolve } from 'node:path';

@Injectable()
export class FolderScannerService {
  private static readonly ignoredDirectories = new Set([
    'bin',
    'obj',
    '.git',
    'node_modules',
  ]);

  private static readonly includedExtensions = new Set([
    '.cs',
    '.sql',
    '.ts',
    '.tsx',
    'tsx',
    '.js',
    '.json',
  ]);

  async scan(folderPath: string): Promise<string[]> {
    return this.scanDirectory(resolve(folderPath));
  }

  private async scanDirectory(directoryPath: string): Promise<string[]> {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const entryPath = resolve(directoryPath, entry.name);

      if (entry.isDirectory()) {
        if (!FolderScannerService.ignoredDirectories.has(entry.name)) {
          files.push(...(await this.scanDirectory(entryPath)));
        }

        continue;
      }

      if (this.isIncludedFile(entry)) {
        files.push(entryPath);
      }
    }

    return files;
  }

  private isIncludedFile(entry: Dirent): boolean {
    return entry.isFile() &&
      FolderScannerService.includedExtensions.has(
        extname(entry.name).toLowerCase(),
      );
  }
}
