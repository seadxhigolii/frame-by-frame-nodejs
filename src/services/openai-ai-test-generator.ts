import * as fs from 'fs/promises';
import * as path from 'path';
import { IAiTestGenerator } from './interfaces/ai-test-generator';
import { ScreenChangeFrame } from '../models/screen-change-frame';

interface AiResponsePayload {
  testPlanJson: string | object;
  codeTs: string;
  documentationMd: string;
}

interface Config {
  openAiApiKey: string;
}

const SYSTEM_PROMPT_PART1 = `You are a test-generation engine.

You receive a single JSON object with:
- "transcriptText": full product demo transcript as plain text
- "scenes": array of objects:
  - "frameId": screenshot file name
  - "startSeconds": start timestamp
  - "endSeconds": end timestamp

Use this JSON plus the attached screenshots to infer the user journey and UI interactions.`;

const SYSTEM_PROMPT_PART2 = `Identify URLs, buttons, fields, and expected results.

    When generating Playwright code:
    - Do NOT assume HTML tags, IDs, classes, or attributes
    - Use text-based selectors only: getByText(), getByRole(), getByLabel(), getByPlaceholder()
    - Never use tag selectors like 'nav', 'div', 'button' directly
    - Use { exact: true } for getByText() to avoid matching multiple elements
    - Add await page.waitForTimeout(2000) after navigation and clicks
    - Use what is visually seen on screen

    Example - CORRECT:
    await page.getByText('Activities', { exact: true }).hover();
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByPlaceholder('Username').fill('user');

    Start the test code like this:
    \`\`\`
    import { test, expect } from '@playwright/test';

    test('generated test', async ({ page }) => {
    \`\`\``;

const SYSTEM_PROMPT_PART3 = `You must respond ONLY with a single JSON object:
{
  "testPlanJson": "...",
  "codeTs": "...",
  "documentationMd": "..."
}`;

const SYSTEM_PROMPT = `${SYSTEM_PROMPT_PART1}\n${SYSTEM_PROMPT_PART2}\n${SYSTEM_PROMPT_PART3}`;

export class OpenAiAiTestGenerator implements IAiTestGenerator {
  private readonly apiKey: string;

  constructor(config: Config) {
    this.apiKey = config.openAiApiKey;
  }

async generateTestsAsync(
        transcriptPath: string,
        frames: readonly ScreenChangeFrame[],
        outputDir: string,
        processingDirName: string
    ): Promise<{ testPlanPath: string; codePath: string; docPath: string }> {
    await fs.mkdir(outputDir, { recursive: true });

    const transcriptJson = await fs.readFile(transcriptPath, 'utf-8');
    const transcriptDoc = JSON.parse(transcriptJson);
    const transcriptText: string = transcriptDoc.text ?? '';

    const scenes = frames.map((frame, i) => ({
      frameId: path.basename(frame.framePath),
      startSeconds: frame.timestampSeconds,
      endSeconds: i < frames.length - 1 ? frames[i + 1].timestampSeconds : null
    }));

    const structured = { transcriptText, scenes };

    const userContent: object[] = [
      { type: 'text', text: JSON.stringify(structured) }
    ];

    for (const f of frames) {
      const bytes = await fs.readFile(f.framePath);
      const b64 = bytes.toString('base64');
      userContent.push({
        type: 'image_url',
        image_url: { url: `data:image/png;base64,${b64}` }
      });
    }

    const requestBody = {
      model: 'gpt-4.1-mini',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: [{ type: 'text', text: SYSTEM_PROMPT }]
        },
        {
          role: 'user',
          content: userContent
        }
      ]
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const body = await response.json();
    const content = body.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Empty LLM response');
    }

    console.log('AI Response:', content.substring(0, 500));

    let ai: AiResponsePayload;
    try {
      ai = JSON.parse(content);
    } catch (e) {
      throw new Error(`Failed to parse AI response as JSON. Response started with: "${content.substring(0, 200)}..."`);
    }

    const testPlanPath = path.join(outputDir, 'test_plan.json');
    const docPath = path.join(outputDir, 'TestDocumentation.md');
    const testsDir = path.join(process.cwd(), 'tests');
    await fs.mkdir(testsDir, { recursive: true });
    const codePath = path.join(testsDir, `${processingDirName}.spec.ts`);

    await fs.writeFile(testPlanPath, typeof ai.testPlanJson === 'string' ? ai.testPlanJson : JSON.stringify(ai.testPlanJson, null, 2), 'utf-8');
    await fs.writeFile(docPath, ai.documentationMd ?? '', 'utf-8');
    await fs.writeFile(codePath, ai.codeTs ?? '', 'utf-8');

    return { testPlanPath, codePath, docPath };
  }
}