import * as fs from 'fs/promises';
import * as path from 'path';
import { IVideoProcessingService } from './interfaces/video-processing-service';
import { IAudioExtractor } from './interfaces/audio-extractor';
import { IFrameExtractor } from './interfaces/frame-extractor';
import { ITranscriptionService } from './interfaces/transcription-service';
import { IAiTestGenerator } from './interfaces/ai-test-generator';
import { VideoProcessResult } from '../models/video-process-result';
import { ScreenChangeFrame } from '../models/screen-change-frame';
import { hasSignificantChange } from '../helpers/frame-change-detector';

export class VideoProcessingService implements IVideoProcessingService {
  constructor(
    private readonly audioExtractor: IAudioExtractor,
    private readonly frameExtractor: IFrameExtractor,
    private readonly transcription: ITranscriptionService,
    private readonly ai: IAiTestGenerator,
    private readonly contentRootPath: string
  ) {}

  async processVideoAsync(videoPath: string): Promise<VideoProcessResult> {
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const baseName = path.basename(videoPath, path.extname(videoPath));
    const processingDirName = `${baseName}_${timestamp}`;
    const root = path.join(this.contentRootPath, 'processing', processingDirName);

    await fs.mkdir(root, { recursive: true });

    const audioDir = path.join(root, 'audio');
    const framesDir = path.join(root, 'frames');
    const transcriptDir = path.join(root, 'stt');
    const outDir = path.join(root, 'out');

    const audioPath = await this.audioExtractor.extractAudioAsync(videoPath, audioDir);

    const screenChangeFrames = await this.frameExtractor.extractScreenChangesAsync(
      videoPath,
      framesDir,
      0.0001,
      0.8
    );

    const filtered: ScreenChangeFrame[] = [];
    let lastKept: ScreenChangeFrame | null = null;

    for (const frame of screenChangeFrames) {
      if (lastKept === null) {
        filtered.push(frame);
        lastKept = frame;
        continue;
      }

      if (await hasSignificantChange(lastKept.framePath, frame.framePath)) {
        filtered.push(frame);
        lastKept = frame;
      } else {
        try {
          await fs.unlink(frame.framePath);
        } catch {
          // ignore
        }
      }
    }

    const framePaths = filtered.map(f => f.framePath);

    const transcriptPath = await this.transcription.transcribeAsync(audioPath, transcriptDir);

    const { testPlanPath, codePath, docPath } = await this.ai.generateTestsAsync(
      transcriptPath,
      filtered,
      outDir,
      processingDirName
    );

    return {
      inputVideoPath: videoPath,
      workingDirectory: root,
      audioPath,
      framePaths,
      transcriptPath,
      testPlanPath,
      generatedCodePath: codePath,
      documentationPath: docPath
    };
  }
}