import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const sourceDir = path.join(process.cwd(), 'api');
const outputDir = path.join(process.cwd(), 'api');

const filesToProcess = [
  {
    input: 'emotion.json',
    output: 'emotion_embeddings.json',
    descriptionKey: 'description'
  },
  {
    input: 'concept.json',
    output: 'concept_embeddings.json',
    descriptionKey: 'description'
  },
];

async function getEmbedding(text, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text.trim(),
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error(`'${text}' 임베딩 생성 오류 (시도 ${i + 1}/${retries}):`, error.message);
      if (i < retries - 1) {
        await new Promise(res => setTimeout(res, delay));
      } else {
        throw error;
      }
    }
  }
}

async function generateEmbeddings() {
  console.log('임베딩 생성을 시작합니다...');
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY가 설정되지 않았습니다. .env 파일을 확인해주세요.');
    return;
  }
  console.log('OpenAI API 키가 성공적으로 로드되었습니다.');


  for (const file of filesToProcess) {
    const inputFile = path.join(sourceDir, file.input);
    const outputFile = path.join(outputDir, file.output);

    try {
      const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
      console.log(`'${file.input}' 파일 로드 성공. ${data.length}개의 항목 처리 시작.`);

      const embeddings = [];
      for (const item of data) {
        const textToEmbed = [
          item.label,
          item.description,
          ...(item.example_prompts || [])
        ].join(' ').trim();
        
        console.log(`임베딩 생성 중: [${item.label}] -> "${textToEmbed}"`);
        
        const embedding = await getEmbedding(textToEmbed);
        
        embeddings.push({
          label: item.label,
          embedding: embedding,
        });
      }

      fs.writeFileSync(outputFile, JSON.stringify(embeddings, null, 2));
      console.log(`'${file.output}' 파일에 임베딩 저장 완료! 총 ${embeddings.length}개.`);

    } catch (error) {
      console.error(`'${file.input}' 파일 처리 중 오류 발생:`, error);
    }
  }
  console.log('모든 임베딩 생성이 완료되었습니다.');
}

generateEmbeddings(); 