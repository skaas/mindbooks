import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// .env 파일에서 환경 변수를 로드합니다.
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY가 설정되지 않았습니다. .env 파일을 확인하세요.');
  process.exit(1);
}

// 헬퍼 함수: 텍스트 임베딩 생성
async function getEmbedding(text, model = 'text-embedding-3-small') {
  if (!text || typeof text !== 'string' || !text.trim()) {
    console.warn(`경고: 비어있는 텍스트에 대한 임베딩을 건너뜁니다.`);
    return null;
  }
  try {
    const response = await openai.embeddings.create({
      input: text.trim(),
      model,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error(`임베딩 생성 오류 (텍스트: "${text}"):`, error);
    throw error;
  }
}

// 메인 로직: JSON 파일을 읽어 임베딩을 추가하고 새 파일에 저장
async function processFile(inputPath, outputPath) {
  try {
    console.log(`파일 처리 시작: ${inputPath}`);
    const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    
    const processedData = [];
    for (const item of data) {
      console.log(`  - "${item.label}" 항목 처리 중...`);
      const searchText = [
        item.label,
        ...(item.aliases || []),
        item.description,
        ...(item.example_prompts || [])
      ].join(' ').trim();

      const embedding = await getEmbedding(searchText);
      if (embedding) {
        processedData.push({
          ...item,
          embedding,
        });
      }
      // API 속도 제한을 피하기 위해 약간의 딜레이 추가
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    fs.writeFileSync(outputPath, JSON.stringify(processedData, null, 2));
    console.log(`성공: 처리된 데이터가 ${outputPath}에 저장되었습니다. (총 ${processedData.length}개 항목)`);
  } catch (error) {
    console.error(`${inputPath} 파일 처리 중 오류 발생:`, error);
  }
}

// 스크립트 실행
async function main() {
  const apiDir = path.resolve(process.cwd(), 'api');

  if (!fs.existsSync(apiDir)) {
    fs.mkdirSync(apiDir, { recursive: true });
  }

  // emotion.json과 concept.json에 대한 처리 실행
  await processFile(
    path.join(apiDir, 'emotion.json'),
    path.join(apiDir, 'emotion_embeddings.json')
  );
  
  await processFile(
    path.join(apiDir, 'concept.json'),
    path.join(apiDir, 'concept_embeddings.json')
  );
}

main().catch(error => {
  console.error("스크립트 실행 중 심각한 오류 발생:", error);
}); 