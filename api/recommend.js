import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 미리 계산된 임베딩 데이터를 로드합니다.
let emotionEmbeddings, conceptEmbeddings;
try {
  const emotionPath = path.join(process.cwd(), 'api', 'emotion_embeddings.json');
  const conceptPath = path.join(process.cwd(), 'api', 'concept_embeddings.json');
  emotionEmbeddings = JSON.parse(fs.readFileSync(emotionPath, 'utf8'));
  conceptEmbeddings = JSON.parse(fs.readFileSync(conceptPath, 'utf8'));
  console.log('사전 계산된 감정 임베딩 로드 성공:', emotionEmbeddings.length, '개');
  console.log('사전 계산된 개념 임베딩 로드 성공:', conceptEmbeddings.length, '개');
} catch (e) {
  console.error('임베딩 파일 로드 오류:', e);
  emotionEmbeddings = [];
  conceptEmbeddings = [];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!emotionEmbeddings.length || !conceptEmbeddings.length) {
    return res.status(500).json({ error: '서버 설정 오류: 임베딩 데이터를 로드할 수 없습니다.' });
  }

  let userInput = '';
  let accumulatedTags = { emotions: [], concepts: [] };
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    userInput = body.userInput || '';
    accumulatedTags = body.accumulatedTags || { emotions: [], concepts: [] };
  } catch (error) {
    return res.status(400).json({ error: '잘못된 요청 본문입니다.', detail: error.message });
  }

  return handleChatAnalysis(userInput, accumulatedTags, res);
}


async function handleChatAnalysis(userInput, accumulatedTags, res) {
  let analysisResult = null;
  try {
    analysisResult = await analyzeWithPrecomputedEmbeddings(userInput);
  } catch (e) {
    console.error('벡터 분석 중 오류 발생:', e);
    // 분석 실패 시에도 대화는 이어가도록 기본값 설정
    analysisResult = { selectedTags: { emotions: [], concepts: [] } };
  }

  const newEmotionTags = [...new Set([...accumulatedTags.emotions, ...analysisResult.selectedTags.emotions])];
  const newConceptTags = [...new Set([...accumulatedTags.concepts, ...analysisResult.selectedTags.concepts])];

  const updatedTags = { emotions: newEmotionTags, concepts: newConceptTags };
  const hasEmotion = updatedTags.emotions.length > 0;
  const hasConcept = updatedTags.concepts.length > 0;
  const canRecommend = hasEmotion && hasConcept;

  let masterResponse = '';
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `당신은 조용한 책방의 마스터입니다. 손님과 대화하며 감정과 고민의 본질을 파악합니다.
- 현재 감지된 감정: ${updatedTags.emotions.join(', ') || '없음'}
- 현재 감지된 개념: ${updatedTags.concepts.join(', ') || '없음'}
- 책 추천 가능 여부: ${canRecommend ? '가능' : '불가능'}
지침:
1. 감정과 개념이 모두 감지되면 "이제 책을 추천해드릴 준비가 되었습니다"라고 말하세요.
2. 감정만 있으면 구체적인 상황이나 고민을, 개념만 있으면 그때의 감정을 물어보세요.
3. 둘 다 없으면 좀 더 구체적인 이야기를 유도하세요.
4. 항상 따뜻하고 간결하게(50자 이내) 답변하세요.`
        },
        { role: 'user', content: userInput }
      ],
      temperature: 0.7,
      max_tokens: 150
    });
    masterResponse = completion.choices[0].message.content;
  } catch (e) {
    console.error('마스터 응답 생성 오류:', e);
    masterResponse = "잠시 생각을 정리하고 있습니다...";
  }

  res.status(200).json({
    message: masterResponse,
    accumulatedTags: updatedTags,
    newTags: analysisResult.selectedTags,
    canRecommend,
    hasEmotion,
    hasConcept,
  });
}

async function analyzeWithPrecomputedEmbeddings(userInput) {
  const userEmbedding = await getEmbedding(userInput);

  const findSimilarItems = (userVec, items) => {
    return items
      .map(item => ({
        label: item.label,
        similarity: cosineSimilarity(userVec, item.embedding),
      }))
      .sort((a, b) => b.similarity - a.similarity);
  };
  
  const emotionResults = findSimilarItems(userEmbedding, emotionEmbeddings);
  const conceptResults = findSimilarItems(userEmbedding, conceptEmbeddings);

  const threshold = 0.9;
  const selectedEmotions = emotionResults.filter(r => r.similarity >= threshold).map(r => r.label);
  const selectedConcepts = conceptResults.filter(r => r.similarity >= threshold).map(r => r.label);

  console.log('분석 결과(상위 5개 감정):', emotionResults.slice(0, 5));
  console.log('분석 결과(상위 5개 개념):', conceptResults.slice(0, 5));
  console.log(`선택된 태그 (유사도 ${threshold} 이상):`, { emotions: selectedEmotions, concepts: selectedConcepts });

  return {
    selectedTags: {
      emotions: selectedEmotions,
      concepts: selectedConcepts,
    },
  };
}

async function getEmbedding(text) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new Error('임베딩을 생성할 수 없는 입력값입니다.');
  }
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.trim(),
  });
  return response.data[0].embedding;
}

function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dotProduct / (magnitudeA * magnitudeB);
}