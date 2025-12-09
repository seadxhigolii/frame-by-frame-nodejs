import { VideoProcessResult } from '../../models/video-process-result';

export interface IVideoProcessingService {
  processVideoAsync(videoPath: string): Promise<VideoProcessResult>;
}