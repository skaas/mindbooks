const { GoogleSpreadsheet } = require('google-spreadsheet');
const { Configuration, OpenAIApi } = require('openai');

module.exports = async (req, res) => {
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

  // 1. OpenAI로 책 추천 받기
  const openai = new OpenAIApi(new Configuration({ apiKey: process.env.OPENAI_API_KEY }));
  let aiResult;
  try {
    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: '너는 심리상담사이자 책 추천 전문가야. 사용자의 고민을 분석해서 감정 키워드, 개념 키워드, 그리고 책 2~4권을 추천해줘. 각 책은 제목, 저자, 요약, 추천 이유를 포함해야 해. 답변은 JSON 형식으로 해줘.' },
        { role: 'user', content: userInput }
      ],
      temperature: 0.7,
    });
    aiResult = completion.data.choices[0].message.content;
  } catch (e) {
    res.status(500).json({ error: 'OpenAI API 오류: ' + e.message });
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(aiResult);
  } catch (e) {
    res.status(500).json({ error: 'AI 응답 파싱 오류: ' + e.message, raw: aiResult });
    return;
  }

  // 2. Google Sheets에 기록
  try {
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID);
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    await sheet.addRow({
      timestamp: new Date().toISOString(),
      userInput,
      emotionKeywords: (parsed.emotionKeywords || []).join(', '),
      conceptKeywords: (parsed.conceptKeywords || []).join(', '),
      books: JSON.stringify(parsed.books || []),
    });
  } catch (e) {
    // 기록 실패는 에러로 처리하지 않고, 프론트엔드에는 결과만 전달
    console.error('Google Sheets 기록 오류:', e);
  }

  res.status(200).json(parsed);
}; 