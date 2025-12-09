import { ScreenChangeFrame } from '../../models/screen-change-frame';

export interface IFrameExtractor {
  extractKeyFramesAsync(videoPath: string, outputDir: string): Promise<readonly string[]>;
  
  extractScreenChangesAsync(
    videoPath: string,
    outputDir: string,
    sceneThreshold: number,
    minIntervalSeconds: number
  ): Promise<readonly ScreenChangeFrame[]>;
}