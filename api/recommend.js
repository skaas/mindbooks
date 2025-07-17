import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 원본 감정/개념 데이터를 로드합니다.
let emotions, concepts;
try {
  const emotionPath = path.join(process.cwd(), 'api', 'emotion.json');
  const conceptPath = path.join(process.cwd(), 'api', 'concept.json');
  emotions = JSON.parse(fs.readFileSync(emotionPath, 'utf8'));
  concepts = JSON.parse(fs.readFileSync(conceptPath, 'utf8'));
} catch (e) {
  emotions = [];
  concepts = [];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!emotions.length || !concepts.length) {
    return res.status(500).json({ error: '서버 설정 오류: 데이터 파일을 로드할 수 없습니다.' });
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
  let analysisResult = { selectedTags: { emotions: [], concepts: [] } };
  try {
    analysisResult = await analyzeTextWithPrompt(userInput);
  } catch (e) {
    // 분석 실패 시에도 대화는 이어가도록 기본값 설정
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

async function analyzeTextWithPrompt(userInput) {
  const emotionLabels = emotions.map(item => ({ label: item.label, description: item.description }));
  const conceptLabels = concepts.map(item => ({ label: item.label, description: item.description }));

  const prompt = `당신은 인간의 대화 속에 숨겨진 진짜 감정과 의도를 파악하는 데 특화된, 매우 정교한 심리 분석 AI입니다.
당신의 임무는 사용자의 발화가 주어진 '감정'이나 '개념'을 **실제로 느끼고 표현하는 것인지**를 분석하여 점수를 매기는 것입니다.

### 핵심 분석 원칙 (매우 중요)
1.  **표현과 언급을 구분하라:** 사용자가 감정 단어를 단순히 '언급'하는 것과, 그 감정을 '표현'하는 것을 엄격하게 구분해야 합니다.
    - **나쁜 예 (점수가 0에 가까워야 함):** "슬픔에 대해 이야기해야 하나요?", "사람들은 왜 불안을 느끼죠?", "'권태감'이라는 단어가 무슨 뜻이에요?" -> 이런 문장들은 감정을 주제로 한 질문일 뿐, 화자가 그 감정을 느끼고 있는 것이 아닙니다.
    - **좋은 예 (점수가 높아야 함):** "요즘 너무 슬퍼요.", "미래를 생각하면 불안해서 잠이 안 와요.", "매일이 똑같아서 지겨워요." -> 화자가 자신의 상태를 직접적으로 묘사하고 있습니다.
2.  **문맥이 왕이다:** 모든 판단은 발화의 전체적인 문맥과 뉘앙스에 기반해야 합니다. 단어 하나에만 집중하지 마십시오.

### 지침
- 위의 핵심 분석 원칙을 반드시 따르십시오.
- 각 항목의 'description'을 참고하여 판단의 정확도를 높이십시오.
- 결과는 반드시 JSON 형식으로, 'emotions'와 'concepts'라는 두 개의 키를 가진 객체로 반환해주세요.
- 각 키의 값은 [{"tag": "태그명", "score": 점수}] 형태의 배열이어야 합니다.

### 분석할 발화
"${userInput}"

### 감정 목록
${JSON.stringify(emotionLabels, null, 2)}

### 개념 목록
${JSON.stringify(conceptLabels, null, 2)}
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: "You are a helpful assistant that analyzes text and returns results in JSON format."
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const content = JSON.parse(response.choices[0].message.content);
  
  console.log('LLM 분석 결과:', JSON.stringify(content, null, 2));

  const threshold = 0.9;
  const selectedEmotions = (content.emotions || [])
    .filter(item => typeof item.score === 'number' && item.score >= threshold)
    .map(item => item.tag);
  
  const selectedConcepts = (content.concepts || [])
    .filter(item => typeof item.score === 'number' && item.score >= threshold)
    .map(item => item.tag);

  console.log(`선택된 태그 (점수 ${threshold} 이상):`, { emotions: selectedEmotions, concepts: selectedConcepts });

  return {
    selectedTags: {
      emotions: selectedEmotions,
      concepts: selectedConcepts,
    },
  };
}