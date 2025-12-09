import * as fs from 'fs/promises';
import * as path from 'path';
import { ITranscriptionService } from './interfaces/transcription-service';

export class OpenAiTranscriptionService implements ITranscriptionService {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async transcribeAsync(audioPath: string, outputDir: string): Promise<string> {
    await fs.mkdir(outputDir, { recursive: true });
    const transcriptPath = path.join(outputDir, 'transcript.json');

    const audioBuffer = await fs.readFile(audioPath);
    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer], { type: 'audio/wav' }), path.basename(audioPath));
    formData.append('model', 'whisper-1');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const json = await response.text();
    await fs.writeFile(transcriptPath, json, 'utf-8');

    return transcriptPath;
  }
}