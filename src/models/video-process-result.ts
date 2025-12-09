export interface VideoProcessResult {
  inputVideoPath: string;
  workingDirectory: string;
  audioPath: string;
  framePaths: readonly string[];
  transcriptPath: string;
  testPlanPath: string;
  generatedCodePath: string;
  documentationPath: string;
}