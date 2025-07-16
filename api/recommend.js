import OpenAI from 'openai';
import { google } from 'googleapis';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let userInput = '';
  let mode = 'analyze'; // 'analyze' or 'recommend'
  let accumulatedTags = { emotions: [], concepts: [] };
  
  try {
    const body = req.body.userInput ? req.body : JSON.parse(req.body);
    userInput = body.userInput || '';
    mode = body.mode || 'analyze';
    accumulatedTags = body.accumulatedTags || { emotions: [], concepts: [] };
  } catch {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  console.log('API 호출 모드:', mode, '누적 태그:', accumulatedTags);

  // 분석 모드: 감정/개념 태그 수집
  if (mode === 'analyze') {
    return await handleAnalyzeMode(userInput, accumulatedTags, res);
  }
  
  // 추천 모드: 책 추천 생성
  if (mode === 'recommend') {
    return await handleRecommendMode(userInput, accumulatedTags, res);
  }

  res.status(400).json({ error: 'Invalid mode' });
}

/**
 * 분석 모드: 감정/개념 태그 수집 및 대화 진행
 */
async function handleAnalyzeMode(userInput, accumulatedTags, res) {
  // 1단계: 벡터 유사도 기반 감정/개념 분석
  let analysisResult = null;
  try {
    console.log('벡터 유사도 분석 시작...');
    const analysisResponse = await fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/analyze-emotion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userInput }),
    });
    
    if (analysisResponse.ok) {
      analysisResult = await analysisResponse.json();
      console.log('벡터 분석 결과:', {
        emotionTags: analysisResult.selectedTags.emotions,
        conceptTags: analysisResult.selectedTags.concepts
      });
    } else {
      const errorText = await analysisResponse.text();
      console.error('벡터 분석 API 오류:', {
        status: analysisResponse.status,
        statusText: analysisResponse.statusText,
        error: errorText
      });
    }
  } catch (e) {
    console.error('벡터 분석 오류:', e);
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
    mode: 'analyze',
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
 * 추천 모드: 수집된 태그를 바탕으로 책 추천
 */
async function handleRecommendMode(userInput, accumulatedTags, res) {
  // 감정과 개념이 모두 있는지 확인
  if (accumulatedTags.emotions.length === 0 || accumulatedTags.concepts.length === 0) {
    res.status(400).json({ 
      error: '감정과 개념 태그가 모두 필요합니다.',
      accumulatedTags 
    });
    return;
  }

  try {
    // 스프레드시트에서 사전 정의된 답변 찾아보기
    const spreadsheetData = await getSheetData();
    const matchedRow = spreadsheetData.find(row => row[1] && row[1].trim() === userInput.trim());

    if (matchedRow && matchedRow[2]) {
      const sheetResult = JSON.parse(matchedRow[2]);
      res.status(200).json({
        mode: 'recommend',
        fromSheet: true,
        accumulatedTags: accumulatedTags,
        ...sheetResult
      });
      return;
    }

    // GPT를 사용한 책 추천
    const enhancedPrompt = `당신은 감정과 개념을 분석하여 책을 추천하는 북 큐레이터입니다.

** 분석된 태그 **
감정 태그: ${accumulatedTags.emotions.join(', ')}
개념 태그: ${accumulatedTags.concepts.join(', ')}

위 태그들을 바탕으로 정확한 책 추천을 해주세요.

형식에 맞춰 응답하십시오:
{
  "감정 키워드": ${JSON.stringify(accumulatedTags.emotions)},
  "인식/개념 키워드": ${JSON.stringify(accumulatedTags.concepts)},
  "실제 존재하는 추천 도서 목록": [
    {
      "제목": "책 제목",
      "작가": "작가명",
      "한 줄 요약": "요약",
      "추천 이유": "추천 이유"
    }
  ]
}

**주의사항:**
- 실제 존재하는 책만 추천
- 가상의 책 생성 금지
- 분석된 태그와 관련성이 높은 책을 추천`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: enhancedPrompt },
        { role: 'user', content: `다음 태그들에 맞는 책을 추천해주세요: ${[...accumulatedTags.emotions, ...accumulatedTags.concepts].join(', ')}` }
      ],
      temperature: 0.7,
    });

    const aiResult = JSON.parse(completion.choices[0].message.content);
    
    res.status(200).json({
      mode: 'recommend',
      accumulatedTags: accumulatedTags,
      ...aiResult
    });

  } catch (e) {
    console.error('책 추천 오류:', e);
    res.status(500).json({ 
      error: '책 추천 실패', 
      detail: e.message,
      accumulatedTags: accumulatedTags
    });
  }
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