export interface IAudioExtractor {
  extractAudioAsync(videoPath: string, outputDir: string): Promise<string>;
}