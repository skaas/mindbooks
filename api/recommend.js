import OpenAI from 'openai';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

console.log('OpenAI API Key 로드 확인:', process.env.OPENAI_API_KEY ? '성공' : '실패');

// JSON 파일을 동적으로 로드
let emotionData, conceptData;
try {
  console.log('=== JSON 파일 로드 시작 ===');
  
  // Vercel 환경에서는 __dirname을 사용하여 현재 파일 위치를 기준으로 경로를 잡는 것이 안정적입니다.
  const emotionPath = path.resolve(__dirname, 'emotion.json');
  const conceptPath = path.resolve(__dirname, 'concept.json');
  
  console.log('emotion.json 절대 경로:', emotionPath);
  console.log('concept.json 절대 경로:', conceptPath);

  if (!fs.existsSync(emotionPath)) {
    throw new Error(`emotion.json 파일을 찾을 수 없습니다: ${emotionPath}`);
  }
  if (!fs.existsSync(conceptPath)) {
    throw new Error(`concept.json 파일을 찾을 수 없습니다: ${conceptPath}`);
  }
  
  emotionData = JSON.parse(fs.readFileSync(emotionPath, 'utf8'));
  conceptData = JSON.parse(fs.readFileSync(conceptPath, 'utf8'));
  
  console.log('emotion data 로드됨:', emotionData.length, '개 항목');
  console.log('concept data 로드됨:', conceptData.length, '개 항목');
} catch (e) {
  console.error('JSON 파일 로드 중 심각한 오류 발생:', e);
  emotionData = [];
  conceptData = [];
}

export default async function handler(req, res) {
  // 핸들러 함수 시작 전 데이터 로드 확인
  if (!emotionData.length || !conceptData.length) {
    console.error('감정/개념 데이터가 로드되지 않아 API를 실행할 수 없습니다.');
    return res.status(500).json({ error: '서버 설정 오류: 데이터 파일을 로드할 수 없습니다.' });
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let userInput = '';
  let accumulatedTags = { emotions: [], concepts: [] };
  
  try {
    console.log('요청 본문 타입:', typeof req.body);
    console.log('요청 본문 내용:', req.body);
    
    // req.body가 이미 객체인 경우와 문자열인 경우를 모두 처리
    let body;
    if (typeof req.body === 'string') {
      body = JSON.parse(req.body);
    } else {
      body = req.body;
    }
    
    userInput = body.userInput || '';
    accumulatedTags = body.accumulatedTags || { emotions: [], concepts: [] };
    
    console.log('파싱된 userInput:', userInput);
    console.log('파싱된 accumulatedTags:', accumulatedTags);
  } catch (error) {
    console.error('요청 본문 파싱 오류:', error);
    res.status(400).json({ error: 'Invalid request body', detail: error.message });
    return;
  }

  console.log('API 호출 - 누적 태그:', accumulatedTags);
  console.log('사용자 입력:', userInput);

  // 채팅 분석 처리
  console.log('handleChatAnalysis 호출 직전');
  return await handleChatAnalysis(userInput, accumulatedTags, res);
}

/**
 * 채팅 분석: 감정/개념 태그 수집 및 대화 진행
 */
async function handleChatAnalysis(userInput, accumulatedTags, res) {
  console.log('=== handleChatAnalysis 함수 시작 ===');
  console.log('userInput:', userInput);
  console.log('accumulatedTags:', accumulatedTags);
  
  // 1단계: 벡터 유사도 기반 감정/개념 분석
  let analysisResult = null;
  try {
    console.log('벡터 유사도 분석 시작...');
    console.log('analyzeEmotionAndConcept 함수 호출 직전');
    analysisResult = await analyzeEmotionAndConcept(userInput);
    console.log('analyzeEmotionAndConcept 함수 호출 완료');
    console.log('벡터 분석 결과:', {
      emotionTags: analysisResult.selectedTags.emotions,
      conceptTags: analysisResult.selectedTags.concepts
    });
  } catch (e) {
    console.error('벡터 분석 오류:', e);
    console.error('오류 스택:', e.stack);
  }

  // 2단계: 새로운 태그를 누적 태그에 추가 (중복 제거)
  let newEmotionTags = [...accumulatedTags.emotions];
  let newConceptTags = [...accumulatedTags.concepts];

  if (analysisResult) {
    // 새로운 감정 태그 추가
    analysisResult.selectedTags.emotions.forEach(emotion => {
      if (!newEmotionTags.includes(emotion)) {
        newEmotionTags.push(emotion);
      }
    });

    // 새로운 개념 태그 추가  
    analysisResult.selectedTags.concepts.forEach(concept => {
      if (!newConceptTags.includes(concept)) {
        newConceptTags.push(concept);
      }
    });
  }

  const updatedTags = {
    emotions: newEmotionTags,
    concepts: newConceptTags
  };

  console.log('업데이트된 태그:', updatedTags);

  // 3단계: 마스터의 응답 생성
  let masterResponse = '';
  const hasEmotion = updatedTags.emotions.length > 0;
  const hasConcept = updatedTags.concepts.length > 0;
  const canRecommend = hasEmotion && hasConcept;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `당신은 조용한 책방의 마스터입니다. 손님과 대화하며 감정과 고민의 본질을 파악하려고 합니다.

현재 상황:
- 감지된 감정: ${updatedTags.emotions.join(', ') || '없음'}
- 감지된 개념: ${updatedTags.concepts.join(', ') || '없음'}
- 책 추천 가능 여부: ${canRecommend ? '가능' : '불가능 (감정과 개념이 모두 필요)'}

지침:
1. 감정과 개념이 모두 감지되면 "이제 책을 추천해드릴 준비가 되었습니다"라고 말하세요.
2. 감정만 있으면 구체적인 상황이나 고민을 더 물어보세요.
3. 개념만 있으면 그때의 감정을 더 자세히 물어보세요.
4. 둘 다 없으면 좀 더 구체적인 이야기를 유도하세요.
5. 항상 따뜻하고 이해하는 톤으로 대화하세요.
6. 50자 이내로 간결하게 답변하세요.`
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
    newTags: analysisResult ? {
      emotions: analysisResult.selectedTags.emotions,
      concepts: analysisResult.selectedTags.concepts
    } : { emotions: [], concepts: [] },
    canRecommend: canRecommend,
    hasEmotion: hasEmotion,
    hasConcept: hasConcept
  });
}



/**
 * Google Sheets API를 사용하여 스프레드시트에서 데이터를 가져옵니다.
 * 인증 정보는 환경 변수에서 읽어옵니다.
 */
async function getSheetData() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      // Vercel 등 배포 환경의 환경 변수에서 줄바꿈 문자를 처리하기 위해 \\n을 \n으로 변환합니다.
      private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  // 데이터 범위: 'Demo' 시트의 A2부터 C열 끝까지
  const range = 'Demo!A2:C';

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  return response.data.values || [];
}

/**
 * 감정과 개념을 분석하는 함수
 */
async function analyzeEmotionAndConcept(userInput) {
  console.log('=== analyzeEmotionAndConcept 함수 시작 ===');
  console.log('감정/개념 분석 시작:', userInput);

  try {
    // 사용자 입력의 임베딩 생성
    console.log('getEmbedding 함수 호출 직전');
    const userEmbedding = await getEmbedding(userInput);
    console.log('사용자 임베딩 생성 완료, 길이:', userEmbedding.length);
    
    // 감정 분석
    console.log('analyzeEmotions 함수 호출 직전');
    const emotionResults = await analyzeEmotions(userInput, userEmbedding);
    console.log('감정 분석 완료, 결과 개수:', emotionResults.length);
    
    // 개념 분석
    console.log('analyzeConcepts 함수 호출 직전');
    const conceptResults = await analyzeConcepts(userInput, userEmbedding);
    console.log('개념 분석 완료, 결과 개수:', conceptResults.length);

    // 0.9 이상 유사도를 가진 항목들을 태그로 선택
    const emotionTags = emotionResults.filter(item => item.similarity >= 0.9);
    const conceptTags = conceptResults.filter(item => item.similarity >= 0.9);

    console.log('=== 전체 감정 분석 결과 ===');
    console.log('상위 10개 감정:', emotionResults.slice(0, 10).map(t => ({ 
      label: t.label, 
      similarity: t.similarity.toFixed(4) 
    })));
    
    console.log('=== 전체 컨셉 분석 결과 ===');
    console.log('상위 10개 컨셉:', conceptResults.slice(0, 10).map(t => ({ 
      label: t.label, 
      similarity: t.similarity.toFixed(4) 
    })));
    
    console.log('=== 최종 선택된 태그 (0.9 이상) ===');
    console.log('선택된 감정 태그:', emotionTags.map(t => ({ label: t.label, similarity: t.similarity.toFixed(4) })));
    console.log('선택된 컨셉 태그:', conceptTags.map(t => ({ label: t.label, similarity: t.similarity.toFixed(4) })));

    return {
      emotions: emotionResults,
      concepts: conceptResults,
      selectedTags: {
        emotions: emotionTags.map(t => t.label),
        concepts: conceptTags.map(t => t.label)
      },
      threshold: 0.9
    };
  } catch (error) {
    console.error('=== analyzeEmotionAndConcept 함수 오류 ===');
    console.error('오류 메시지:', error.message);
    console.error('오류 스택:', error.stack);
    throw error;
  }
}

/**
 * 텍스트의 임베딩을 생성합니다.
 */
async function getEmbedding(text) {
  // 입력값 유효성 검사
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    console.error('getEmbedding 오류: 유효하지 않은 입력 텍스트입니다.', text);
    throw new Error('임베딩을 생성할 수 없는 입력값입니다.');
  }

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.trim(), // 앞뒤 공백 제거
    });
    // 임베딩 결과가 비어있는지 확인
    if (!response.data || !response.data[0] || !response.data[0].embedding) {
      throw new Error('OpenAI API가 유효한 임베딩을 반환하지 않았습니다.');
    }
    return response.data[0].embedding;
  } catch (error) {
    console.error(`getEmbedding 함수에서 오류 발생 (입력: "${text}"):`, error);
    // 오류를 다시 던져서 상위 호출자(analyzeEmotionAndConcept)가 처리하도록 함
    throw error;
  }
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
  
  return results.sort((a, b) => b.similarity - a.similarity);
}

/**
 * 개념 분석을 수행합니다.
 */
async function analyzeConcepts(userInput, userEmbedding) {
  const results = [];
  
  for (const concept of conceptData) {
    // 개념 라벨, 별칭, 설명을 조합하여 검색 텍스트 생성
    const searchText = [
      concept.label,
      ...(concept.aliases || []),
      concept.description
    ].join(' ');
    
    const conceptEmbedding = await getEmbedding(searchText);
    const similarity = cosineSimilarity(userEmbedding, conceptEmbedding);
    
    results.push({
      label: concept.label,
      aliases: concept.aliases || [],
      description: concept.description,
      cluster: concept.cluster,
      similarity: similarity
    });
  }
  
  return results.sort((a, b) => b.similarity - a.similarity);
}

/**
 * 코사인 유사도를 계산합니다.
 */
function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  
  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dotProduct / (magnitudeA * magnitudeB);
}