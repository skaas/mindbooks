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

  let accumulatedTags = { emotions: [], concepts: [] };
  
  try {
    const body = req.body.accumulatedTags ? req.body : JSON.parse(req.body);
    accumulatedTags = body.accumulatedTags || { emotions: [], concepts: [] };
  } catch {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  console.log('책 추천 요청 - 누적 태그:', accumulatedTags);

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
    const searchKey = `${accumulatedTags.emotions.join(',')}_${accumulatedTags.concepts.join(',')}`;
    const matchedRow = spreadsheetData.find(row => row[1] && row[1].trim() === searchKey);

    if (matchedRow && matchedRow[2]) {
      const sheetResult = JSON.parse(matchedRow[2]);
      res.status(200).json({
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
 */
async function getSheetData() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const range = 'Demo!A2:C';

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  return response.data.values || [];
} 