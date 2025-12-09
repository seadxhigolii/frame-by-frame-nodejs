import 'dotenv/config';
import { buildServer } from './core/server';

const app = buildServer();

async function start() {
    
  const port = 3000;
  await app.listen({ port });
  console.log(`Server running on http://localhost:${port}`);
}

start();