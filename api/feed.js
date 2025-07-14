import { google } from 'googleapis';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // 환경 변수 체크
  if (!process.env.GOOGLE_SHEETS_CLIENT_EMAIL || !process.env.GOOGLE_SHEETS_PRIVATE_KEY || !process.env.GOOGLE_SHEET_ID) {
    console.error('환경 변수가 설정되지 않았습니다:', {
      hasClientEmail: !!process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      hasPrivateKey: !!process.env.GOOGLE_SHEETS_PRIVATE_KEY,
      hasSheetId: !!process.env.GOOGLE_SHEET_ID
    });
    
    // 개발 중에는 빈 피드를 반환
    res.status(200).json({ 
      feedItems: [],
      message: '환경 변수가 설정되지 않았습니다. Google Sheets 연동을 위해 환경 변수를 설정해주세요.'
    });
    return;
  }

  try {
    const spreadsheetData = await getSheetData();
    
    // 스프레드시트 데이터를 피드 형태로 변환
    const feedItems = spreadsheetData
      .filter(row => row[1] && row[2]) // Q(질문)과 A(답변) 모두 있는 행만 필터링
      .map((row, index) => {
        try {
          const question = row[1].trim();
          const answerData = JSON.parse(row[2]);
          
          return {
            id: `feed-${index}`,
            question: question,
            emotionKeywords: answerData["감정 키워드"] || [],
            conceptKeywords: answerData["인식/개념 키워드"] || [],
            books: answerData["실제 존재하는 추천 도서 목록"] || [],
            timestamp: new Date().toISOString() // 실제로는 스프레드시트에서 타임스탬프를 가져올 수 있음
          };
        } catch (e) {
          console.error('피드 아이템 파싱 오류:', e, '원본 데이터:', row[2]);
          return null;
        }
      })
      .filter(Boolean) // null 값 제거
      .reverse(); // 최신순으로 정렬 (실제로는 타임스탬프 기준으로 정렬)

    res.status(200).json({ feedItems });
  } catch (e) {
    console.error('피드 데이터 가져오기 오류:', e);
    res.status(200).json({ 
      feedItems: [],
      error: '피드 데이터를 가져오는 중 오류가 발생했습니다.',
      detail: e.message
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