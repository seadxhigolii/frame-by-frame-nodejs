import { ScreenChangeFrame } from '../../models/screen-change-frame';

export interface IAiTestGenerator {
  generateTestsAsync(
    transcriptPath: string,
    frames: readonly ScreenChangeFrame[],
    outputDir: string,
    processingDirName: string
  ): Promise<{ testPlanPath: string; codePath: string; docPath: string }>;
}