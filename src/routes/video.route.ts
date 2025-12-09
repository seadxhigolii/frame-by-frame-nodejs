import { FastifyInstance, FastifyPluginCallback } from 'fastify';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { createWriteStream } from 'fs';
import { IVideoProcessingService } from '../services/interfaces/video-processing-service';

export function createVideoRoutes(
  videoProcessing: IVideoProcessingService,
  contentRootPath: string
): FastifyPluginCallback {
  return (instance: FastifyInstance, _opts, done) => {
    instance.post('/api/video/process', {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              inputVideoPath: { type: 'string' },
              workingDirectory: { type: 'string' },
              audioPath: { type: 'string' },
              framePaths: { type: 'array', items: { type: 'string' } },
              transcriptPath: { type: 'string' },
              testPlanPath: { type: 'string' },
              generatedCodePath: { type: 'string' },
              documentationPath: { type: 'string' }
            }
          }
        }
      }
    }, async (request, reply) => {
      const data = await request.file();

      if (!data) {
        return reply.status(400).send({ error: 'No video uploaded.' });
      }

      const uploadsRoot = path.join(contentRootPath, 'uploads');
      await fs.mkdir(uploadsRoot, { recursive: true });

      const videoPath = path.join(uploadsRoot, `${randomUUID()}_${data.filename}`);
      
      // Read entire buffer first, then write
      const buffer = await data.toBuffer();
      await fs.writeFile(videoPath, buffer);

      const result = await videoProcessing.processVideoAsync(videoPath);
      return reply.send(result);
    });

    done();
  };
}