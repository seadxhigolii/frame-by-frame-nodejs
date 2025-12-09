import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load .env first
dotenv.config();

function loadJson(filePath: string): any {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const env = process.env.NODE_ENV || 'development';

const defaultConfigPath = path.join(__dirname, 'default.json');
const defaultConfig = loadJson(defaultConfigPath);

const envConfigPath = path.join(__dirname, `${env}.json`);
const envConfig = fs.existsSync(envConfigPath) ? loadJson(envConfigPath) : {};

const config = {
  ...defaultConfig,
  ...envConfig,
  OpenAI: {
    ...defaultConfig.OpenAI,
    ...envConfig.OpenAI,
    ApiKey: process.env.OPENAI_API_KEY || defaultConfig.OpenAI.ApiKey,
    RitechApiKey: process.env.RITECH_API_KEY || defaultConfig.OpenAI.RitechApiKey,
  },
  Tesseract: {
    ...defaultConfig.Tesseract,
    ...envConfig.Tesseract,
    TessDataPath: process.env.TESSDATA_PATH || envConfig.Tesseract?.TessDataPath,
  }
};

export default config;
