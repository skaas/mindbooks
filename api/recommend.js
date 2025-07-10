import OpenAI from 'openai';

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