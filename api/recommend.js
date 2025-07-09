import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

  let aiResult;
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content:  `당신은 감정과 개념을 분석하여 책을 추천하는 북 큐레이터입니다.\n사용자가 남긴 짧은 문장을 분석해 주세요.\n\n형식에 맞춰 응답하십시오:\n1. 감정 키워드 (2~3개): 사용자가 느끼는 감정을 추천은 감정적 공감 + 개념적 통찰을 모두 고려해 주세요.한두 단어로 정리\n2. 인식/개념 키워드 (1~2개): 심리학, 사회학, 철학 등에서 해당 문장을 해석할 수 있는 핵심 개념 (예: 확증편향, 세대 단절, 역할 상실 등)\n3. 실제 존재하는 추천 도서 목록 (3~5권):\n   - 제목 (정확한 한글 번역명)\n   - 작가 (한국어 표기)\n   - 한 줄 요약\n   - 추천 이유: 이 책이 해당 감정이나 개념과 어떻게 연결되는지 설명\n\n**주의사항:**\n- 반드시 실제 존재하는 책만 추천하십시오.\n- 가상의 제목이나 저자, 출판되지 않은 책을 생성하지 마십시오.\n- 추천은 감정적 공감 + 개념적 통찰을 모두 고려해 주세요.\n-응답은 json형식으로 주세요 `
        },
        { role: 'user', content: userInput },
      ],
      temperature: 0.7,
    });
    aiResult = completion.choices[0].message.content;
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