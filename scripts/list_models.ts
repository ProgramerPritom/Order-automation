import * as dotenv from 'dotenv';
dotenv.config();

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const data = await res.json();
  if (data.models) {
    const embedModels = data.models.filter((m: any) => m.supportedGenerationMethods?.includes('embedContent'));
    console.log('Embedding models:');
    embedModels.forEach((m: any) => console.log(' - ', m.name, m.supportedGenerationMethods));
  } else {
    console.error(data);
  }
}

listModels();
