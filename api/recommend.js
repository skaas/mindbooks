import { Configuration, OpenAIApi } from 'openai';

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

  const openai = new OpenAIApi(new Configuration({ apiKey: process.env.OPENAI_API_KEY }));
  let aiResult;
  try {
    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: '너는 심리상담사이자 책 추천 전문가야. 사용자의 고민을 분석해서 감정 키워드, 개념 키워드, 그리고 고민에 맞는 책 3권을 추천해줘. 각 책은 제목, 저자, 요약, 추천 이유를 포함해야 해. JSON 형식으로만 답변해.' },
        { role: 'user', content: userInput },
      ],
      temperature: 0.7,
    });
    aiResult = completion.data.choices[0].message.content;
  } catch (e) {
    res.status(500).json({ error: 'OpenAI API 호출 실패', detail: e.message, raw: e.response?.data });
    return;
  }

  try {
    const parsed = JSON.parse(aiResult);
    res.status(200).json(parsed);
  } catch (e) {
    res.status(500).json({ error: 'AI 응답 파싱 실패', detail: e.message, raw: aiResult });
  }
} 