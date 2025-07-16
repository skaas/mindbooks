import OpenAI from 'openai';
import emotionData from '../src/components/emotion.json';
import conceptData from '../src/components/concept.json';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let userInput = '';
  try {
    userInput = req.body.userInput || (typeof req.body === 'string' ? JSON.parse(req.body).userInput : '');
  } catch {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  if (!userInput.trim()) {
    res.status(400).json({ error: 'User input is required' });
    return;
  }

  try {
    console.log('감정/개념 분석 시작:', userInput);

    // 사용자 입력의 임베딩 생성
    const userEmbedding = await getEmbedding(userInput);
    
    // 감정 분석
    const emotionResults = await analyzeEmotions(userInput, userEmbedding);
    
    // 개념 분석
    const conceptResults = await analyzeConcepts(userInput, userEmbedding);

    // 0.9 이상 유사도를 가진 항목들을 태그로 선택
    const emotionTags = emotionResults.filter(item => item.similarity >= 0.9);
    const conceptTags = conceptResults.filter(item => item.similarity >= 0.9);

    console.log('분석 결과:', {
      emotionTags: emotionTags.map(t => ({ label: t.label, similarity: t.similarity })),
      conceptTags: conceptTags.map(t => ({ label: t.label, similarity: t.similarity }))
    });

    res.status(200).json({
      emotions: emotionResults,
      concepts: conceptResults,
      selectedTags: {
        emotions: emotionTags.map(t => t.label),
        concepts: conceptTags.map(t => t.label)
      },
      threshold: 0.9
    });

  } catch (error) {
    console.error('감정/개념 분석 오류:', error);
    res.status(500).json({ 
      error: '분석 중 오류가 발생했습니다.',
      detail: error.message 
    });
  }
}

/**
 * 텍스트의 임베딩을 생성합니다.
 */
async function getEmbedding(text) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

/**
 * 감정 분석을 수행합니다.
 */
async function analyzeEmotions(userInput, userEmbedding) {
  const results = [];
  
  for (const emotion of emotionData) {
    // 감정 라벨, 별칭, 설명을 조합하여 검색 텍스트 생성
    const searchText = [
      emotion.label,
      ...(emotion.aliases || []),
      emotion.description
    ].join(' ');
    
    const emotionEmbedding = await getEmbedding(searchText);
    const similarity = cosineSimilarity(userEmbedding, emotionEmbedding);
    
    results.push({
      label: emotion.label,
      aliases: emotion.aliases || [],
      description: emotion.description,
      cluster: emotion.cluster,
      similarity: similarity
    });
  }
  
  // 유사도 순으로 정렬
  return results.sort((a, b) => b.similarity - a.similarity);
}

/**
 * 개념 분석을 수행합니다.
 */
async function analyzeConcepts(userInput, userEmbedding) {
  const results = [];
  
  for (const concept of conceptData) {
    // 개념 라벨, 설명, 예시 프롬프트를 조합하여 검색 텍스트 생성
    const searchText = [
      concept.label,
      concept.description,
      ...(concept.example_prompts || [])
    ].join(' ');
    
    const conceptEmbedding = await getEmbedding(searchText);
    const similarity = cosineSimilarity(userEmbedding, conceptEmbedding);
    
    results.push({
      label: concept.label,
      description: concept.description,
      example_prompts: concept.example_prompts || [],
      similarity: similarity
    });
  }
  
  // 유사도 순으로 정렬
  return results.sort((a, b) => b.similarity - a.similarity);
}

/**
 * 코사인 유사도를 계산합니다.
 */
function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error('벡터의 길이가 다릅니다.');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
} 