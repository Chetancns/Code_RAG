import { Module } from '@nestjs/common';
import { FolderScannerService } from './folder-scanner.service';

@Module({
  providers: [FolderScannerService],
  exports: [FolderScannerService],
})
export class FolderScannerModule {}
