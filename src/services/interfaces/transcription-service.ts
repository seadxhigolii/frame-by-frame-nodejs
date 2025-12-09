export interface ITranscriptionService {
  transcribeAsync(audioPath: string, outputDir: string): Promise<string>;
}