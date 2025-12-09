import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import { IFrameExtractor } from './interfaces/frame-extractor';
import { IAudioExtractor } from './interfaces/audio-extractor';
import { ScreenChangeFrame } from '../models/screen-change-frame';

export class FfmpegService implements IFrameExtractor, IAudioExtractor {
  private readonly ffmpegPath: string;

  constructor(ffmpegPath?: string) {
    this.ffmpegPath = ffmpegPath ?? 'ffmpeg';
  }

  private runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`[ffmpeg] Running: ${this.ffmpegPath} ${args.join(' ')}`);
    
    const proc = spawn(this.ffmpegPath, ['-y', ...args]);
    let stderr = '';

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      console.log(`[ffmpeg] ${data.toString().trim()}`);
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        console.error(`[ffmpeg] Full stderr:\n${stderr}`);
        reject(new Error(`ffmpeg exited with code ${code}`));
      } else {
        resolve();
      }
    });

    proc.on('error', (err) => {
      console.error(`[ffmpeg] Spawn error:`, err);
      reject(err);
    });
  });
}

  private runFfmpegAndCaptureStderr(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn(this.ffmpegPath, ['-y', ...args]);
      let stderr = '';

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`ffmpeg exited with code ${code}. stderr: ${stderr}`));
        } else {
          resolve(stderr);
        }
      });

      process.on('error', reject);
    });
  }

  async extractAudioAsync(videoPath: string, outputDir: string): Promise<string> {
    await fs.mkdir(outputDir, { recursive: true });
    const audioPath = path.join(outputDir, 'audio.wav');
    
    const args = [
      '-i', videoPath,
      '-vn', '-ac', '1', '-ar', '16000',
      '-acodec', 'pcm_s16le',
      audioPath
    ];
    
    await this.runFfmpeg(args);
    return audioPath;
  }

  async extractKeyFramesAsync(videoPath: string, outputDir: string): Promise<readonly string[]> {
    await fs.mkdir(outputDir, { recursive: true });
    const pattern = path.join(outputDir, 'frame_%05d.png');
    
    const args = [
      '-i', videoPath,
      '-vf', "select='gt(scene,0.3)',showinfo",
      '-vsync', 'vfr',
      pattern
    ];
    
    await this.runFfmpeg(args);
    
    const files = await fs.readdir(outputDir);
    return files
      .filter(f => f.startsWith('frame_') && f.endsWith('.png'))
      .sort()
      .map(f => path.join(outputDir, f));
  }

  async extractScreenChangesAsync(
    videoPath: string,
    outputDir: string,
    sceneThreshold: number,
    minIntervalSeconds: number
  ): Promise<readonly ScreenChangeFrame[]> {
    await fs.mkdir(outputDir, { recursive: true });
    const pattern = path.join(outputDir, 'screen_%05d.png');

    const vf = `select='isnan(prev_selected_t)+gt(scene,${sceneThreshold})*gt(t-prev_selected_t,${minIntervalSeconds})',scale=1280:-1,showinfo`;
    
    const args = [
      '-i', videoPath,
      '-vf', vf,
      '-vsync', 'vfr',
      pattern
    ];

    const stderr = await this.runFfmpegAndCaptureStderr(args);

    const showinfoRegex = /showinfo.*n:\s*(?<n>\d+).*pts_time:(?<pts>[\d.]+)/g;
    const frames: ScreenChangeFrame[] = [];
    let frameIndex = 1;

    for (const match of stderr.matchAll(showinfoRegex)) {
      const pts = parseFloat(match.groups!.pts);
      if (isNaN(pts)) continue;

      const fileName = `screen_${String(frameIndex).padStart(5, '0')}.png`;
      const framePath = path.join(outputDir, fileName);

      frames.push(new ScreenChangeFrame(framePath, pts, 0));
      frameIndex++;
    }

    return frames;
  }
}