import { google } from 'googleapis';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // 페이지네이션 파라미터 추출
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 3;
  const offset = (page - 1) * limit;

  console.log('페이지네이션 파라미터:', { page, limit, offset });

  // 환경 변수 체크
  console.log('환경 변수 확인:', {
    hasClientEmail: !!process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
    hasPrivateKey: !!process.env.GOOGLE_SHEETS_PRIVATE_KEY,
    hasSheetId: !!process.env.GOOGLE_SHEET_ID,
    clientEmail: process.env.GOOGLE_SHEETS_CLIENT_EMAIL ? process.env.GOOGLE_SHEETS_CLIENT_EMAIL.substring(0, 20) + '...' : 'undefined',
    sheetId: process.env.GOOGLE_SHEET_ID
  });

  if (!process.env.GOOGLE_SHEETS_CLIENT_EMAIL || !process.env.GOOGLE_SHEETS_PRIVATE_KEY || !process.env.GOOGLE_SHEET_ID) {
    console.error('환경 변수가 설정되지 않았습니다:', {
      hasClientEmail: !!process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      hasPrivateKey: !!process.env.GOOGLE_SHEETS_PRIVATE_KEY,
      hasSheetId: !!process.env.GOOGLE_SHEET_ID
    });
    
    // 개발 중에는 빈 피드를 반환
    res.status(200).json({ 
      feedItems: [],
      pagination: { page, limit, total: 0, hasMore: false },
      message: '환경 변수가 설정되지 않았습니다. Google Sheets 연동을 위해 환경 변수를 설정해주세요.'
    });
    return;
  }

  try {
    console.log('스프레드시트 데이터 가져오기 시작...');
    const spreadsheetData = await getSheetData();
    console.log('스프레드시트 원본 데이터:', {
      totalRows: spreadsheetData.length,
      firstFewRows: spreadsheetData.slice(0, 3),
      sampleRow: spreadsheetData[0] ? {
        columnCount: spreadsheetData[0].length,
        columns: spreadsheetData[0].map((col, idx) => `Column ${idx}: ${col ? col.substring(0, 50) + '...' : 'empty'}`)
      } : 'no data'
    });
    
    // 스프레드시트 데이터를 피드 형태로 변환
    const allFeedItems = spreadsheetData
      .filter(row => {
        const hasQuestionAndAnswer = row[1] && row[2];
        if (!hasQuestionAndAnswer) {
          console.log('필터링된 행 (Q 또는 A 없음):', row);
        }
        return hasQuestionAndAnswer;
      })
      .map((row, index) => {
        try {
          const question = row[1].trim();
          console.log(`행 ${index} 처리 중:`, {
            question: question.substring(0, 100) + '...',
            answerDataLength: row[2] ? row[2].length : 0,
            answerDataPreview: row[2] ? row[2].substring(0, 200) + '...' : 'empty'
          });
          
          const answerData = JSON.parse(row[2]);
          console.log(`행 ${index} JSON 파싱 성공:`, {
            emotionKeywords: answerData["감정 키워드"],
            conceptKeywords: answerData["인식/개념 키워드"],
            booksCount: answerData["실제 존재하는 추천 도서 목록"] ? answerData["실제 존재하는 추천 도서 목록"].length : 0
          });
          
          return {
            id: `feed-${index}`,
            question: question,
            emotionKeywords: answerData["감정 키워드"] || [],
            conceptKeywords: answerData["인식/개념 키워드"] || [],
            books: answerData["실제 존재하는 추천 도서 목록"] || [],
            timestamp: new Date().toISOString()
          };
        } catch (e) {
          console.error(`행 ${index} 파싱 오류:`, {
            error: e.message,
            question: row[1] ? row[1].substring(0, 100) + '...' : 'empty',
            answerData: row[2] ? row[2].substring(0, 500) + '...' : 'empty'
          });
          return null;
        }
      })
      .filter(Boolean)
      .reverse(); // 최신순으로 정렬

    // 페이지네이션 적용
    const total = allFeedItems.length;
    const paginatedItems = allFeedItems.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    console.log('페이지네이션 결과:', {
      total,
      page,
      limit,
      offset,
      returnedItems: paginatedItems.length,
      hasMore
    });

    res.status(200).json({ 
      feedItems: paginatedItems,
      pagination: {
        page,
        limit,
        total,
        hasMore,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (e) {
    console.error('피드 데이터 가져오기 오류:', {
      message: e.message,
      stack: e.stack,
      name: e.name
    });
    res.status(200).json({ 
      feedItems: [],
      pagination: { page, limit, total: 0, hasMore: false },
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
  console.log('Google Sheets API 인증 시작...');
  
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    console.log('Google Sheets API 클라이언트 생성...');
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // 먼저 스프레드시트 메타데이터를 가져와서 시트 이름들을 확인
    console.log('스프레드시트 메타데이터 가져오기...');
    const spreadsheetInfo = await sheets.spreadsheets.get({
      spreadsheetId,
    });

    const sheetNames = spreadsheetInfo.data.sheets.map(sheet => sheet.properties.title);
    console.log('사용 가능한 시트 이름들:', sheetNames);

    // 가능한 시트 이름들을 순서대로 시도
    const possibleSheetNames = ['log', 'Demo', '시트1', 'Sheet1', sheetNames[0]]; // 첫 번째 시트도 시도
    let range = null;
    let response = null;

    for (const sheetName of possibleSheetNames) {
      try {
        range = `${sheetName}!A2:C`;
        console.log(`시트 "${sheetName}" 시도 중... (범위: ${range})`);
        
        response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range,
        });
        
        console.log(`시트 "${sheetName}" 성공!`);
        break;
      } catch (e) {
        console.log(`시트 "${sheetName}" 실패:`, e.message);
        continue;
      }
    }

    if (!response) {
      throw new Error(`사용 가능한 시트를 찾을 수 없습니다. 사용 가능한 시트: ${sheetNames.join(', ')}`);
    }

    console.log('Google Sheets API 응답:', {
      statusCode: response.status,
      hasData: !!response.data,
      hasValues: !!response.data.values,
      valuesLength: response.data.values ? response.data.values.length : 0,
      range: response.data.range,
      majorDimension: response.data.majorDimension,
      usedSheetName: range
    });

    return response.data.values || [];
  } catch (e) {
    console.error('Google Sheets API 오류:', {
      message: e.message,
      code: e.code,
      status: e.status,
      details: e.details
    });
    throw e;
  }
} 