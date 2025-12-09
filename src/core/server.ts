import fastify, { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { createVideoRoutes } from '../routes/video.route';
import { VideoProcessingService } from '../services/video-processing-service';
import { FfmpegService } from '../services/ffmpeg-service';
import { OpenAiTranscriptionService } from '../services/openai-transcription-service';
import { OpenAiAiTestGenerator } from '../services/openai-ai-test-generator';
import * as path from 'path';

export function buildServer(): FastifyInstance {
  
  const app = fastify({
    logger: true,
  });

  app.register(swagger, {
    openapi: {
      info: {
        title: 'Frame by Frame API',
        version: '1.0.0',
      },
    },
  });

  app.register(swaggerUi, {
    routePrefix: '/docs',
  });

  app.register(multipart, {
    limits: {
      fileSize: 500 * 1024 * 1024
    }
  });
  const contentRootPath = process.cwd();
  const openAiApiKey = process.env.OPENAI_API_KEY ?? '';

  console.log('API Key loaded:', openAiApiKey ? 'Yes (length: ' + openAiApiKey.length + ')' : 'No');

  const ffmpegPath = path.join(process.cwd(), 'src', 'tools', 'ffmpeg', 'ffmpeg.exe');
  const ffmpegService = new FfmpegService(ffmpegPath); 

  const transcription = new OpenAiTranscriptionService(openAiApiKey);
  const ai = new OpenAiAiTestGenerator({
    openAiApiKey
  });

  const videoProcessing = new VideoProcessingService(
    ffmpegService,
    ffmpegService,
    transcription,
    ai,
    contentRootPath
  );

  app.register(createVideoRoutes(videoProcessing, contentRootPath));

  return app;
}