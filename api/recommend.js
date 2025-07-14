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
  try {
    userInput = req.body.userInput || (typeof req.body === 'string' ? JSON.parse(req.body).userInput : '');
  } catch {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  // 1단계: gpt-4.1-nano로 감정 분석 (비용 절약)
  let emotionCheckResult;
  let emotionCheck; // 스코프 문제 해결을 위해 밖에서 선언
  try {
    emotionCheck = await openai.chat.completions.create({
      model: 'gpt-4.1-nano',
      messages: [
        {
          role: 'system',
          content: `당신은 말수가 적은 조용한 책방 마스터입니다. 방금 들어온 손님이 무언가 말을 건넸습니다.
손님의 말투를 억지로 파악하려 하지 않고, 말 속에 담긴 성격만 조용히 느껴봅니다.
조용한 마스터답게 말없이 받아주는 한 문장을 아래 예시와 비슷하게 대답하며 상대의 감점을 이끌어 낼 수 있는 유도 질문을 같이 합니다.

** 주의사항 **
단순히 힘들다, 외롭다는 감정은 감정으로 분류하지 않습니다. 왜 힘들었고, 어떤 고민을 하는지 다시 물어봅니다.
반드시 이래 JSON 형식으로만 응답하세요. 다른 설명은 절대 추가하지 마세요.

{"hasEmotion": true, "message": "고맙습니다. 이제 책을 꺼내보죠."}
{"hasEmotion": false, "message": "(상황에 맞는 메시지 출력)"}

`
        },
        { role: 'user', content: userInput }
      ],
      temperature: 0.0, // 더 일관된 결과를 위해 0으로 설정
    });
    
    emotionCheckResult = JSON.parse(emotionCheck.choices[0].message.content);
  } catch (e) {
    // 에러 발생 시 안전하게 감정 없음으로 처리
    res.status(200).json({ 
      hasEmotion: false, 
      message: "마스터가 고개를 저으며 당신의 이야기를 무시합니다.",
      rawResponse: emotionCheck ? emotionCheck.choices[0]?.message?.content : "API 호출 실패"
    });
    return;
  }

  // 감정이 확인되지 않으면 여기서 종료
  if (!emotionCheckResult.hasEmotion) {
    res.status(200).json({
      hasEmotion: false,
      message: emotionCheckResult.message,
      rawResponse: emotionCheck ? emotionCheck.choices[0]?.message?.content : "API 호출 실패" // 1단계에서 받은 원본 메시지
    });
    return;
  }

  // 2-1단계: 스프레드시트에서 사전 정의된 답변 찾아보기
  try {
    const spreadsheetData = await getSheetData();
    // 'Q' 컬럼(인덱스 1)이 userInput과 일치하는 행을 찾습니다.
    const matchedRow = spreadsheetData.find(row => row[1] && row[1].trim() === userInput.trim());

    if (matchedRow && matchedRow[2]) { // 'A' 컬럼(인덱스 2)에 데이터가 있는지 확인
      const sheetResult = JSON.parse(matchedRow[2]);
      res.status(200).json({
        hasEmotion: true,
        step1Response: emotionCheck ? emotionCheck.choices[0]?.message?.content : "API 호출 실패",
        fromSheet: true, // 답변 출처가 스프레드시트임을 명시
        ...sheetResult
      });
      return; // 스프레드시트에서 답변을 찾았으므로 여기서 종료
    }
  } catch (e) {
    console.error('스프레드시트 처리 중 오류 발생:', e);
    // 스프레드시트 오류가 발생해도 GPT 추천으로 넘어갈 수 있도록 계속 진행합니다.
  }


  // 2-2단계: gpt-4o로 책 추천 (스프레드시트에서 답변을 찾지 못한 경우)
  let aiResult;
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `당신은 감정과 개념을 분석하여 책을 추천하는 북 큐레이터입니다.
사용자가 남긴 짧은 문장을 분석해 주세요.

형식에 맞춰 응답하십시오:
1. 감정 키워드 (2~3개): 사용자가 느끼는 감정을 한두 단어로 정리
2. 인식/개념 키워드 (1~2개): 핵심 개념 (예: 확증편향, 세대 단절 등)
3. 실제 존재하는 추천 도서 목록 (3~5권):
  - 제목 (정확한 한글 번역명)
  - 작가 (한국어 표기)
  - 한 줄 요약
  - 추천 이유

**주의사항:**
- 실제 존재하는 책만 추천
- 가상의 책 생성 금지
- 결과는 반드시 올바른 JSON만 반환

예시:
{
  "감정 키워드": ["외로움", "고독"],
  "인식/개념 키워드": ["소외"],
  "실제 존재하는 추천 도서 목록": [
    {
      "제목": "외로움에 대하여",
      "작가": "인그리드 릴레",
      "한 줄 요약": "외로움의 본질을 탐구하는 인문학적 에세이",
      "추천 이유": "이 책은 외로움이라는 감정을 깊이 있게 다루며, 외로움이 인간에게 미치는 영향에 대해 고찰합니다."
    }
  ]
}
`
        },
        { role: 'user', content: userInput }
      ],
      temperature: 0.7,
    });

    aiResult = JSON.parse(completion.choices[0].message.content);
    
    // 성공적으로 2단계까지 완료된 경우
    res.status(200).json({
      hasEmotion: true,
      step1Response: emotionCheck ? emotionCheck.choices[0]?.message?.content : "API 호출 실패", // 1단계 응답 포함
      ...aiResult
    });
  } catch (e) {
    res.status(500).json({ 
      error: '책 추천 실패', 
      detail: e.message,
      step1Response: emotionCheck ? emotionCheck.choices[0]?.message?.content : "API 호출 실패" // 에러 시에도 1단계 응답 포함
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