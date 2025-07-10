// pages/api/chat.js  (또는 app/api/chat/route.js)
export const runtime = 'edge';    // Edge Function 으로 동작

import OpenAI from 'openai-edge';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req) {
  // Edge 에선 (req, res) 대신 Web Fetch API 사용
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let userInput;
  try {
    const body = await req.json();
    userInput = body.userInput;
    if (typeof userInput !== 'string') throw new Error();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid request body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
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
`
        },
        { role: 'user', content: userInput }
      ],
      temperature: 0.9
    });

    aiResult = completion.choices[0].message.content;
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'OpenAI API 호출 실패', message: e.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const parsed = JSON.parse(aiResult);
    return new Response(
      JSON.stringify(parsed),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'AI 응답 파싱 실패', raw: aiResult }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}