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

--- 예시 응답 ---
(인사일 경우) "어서 오세요. 편한 자리에 앉으세요. 오늘 기분은 어떠세요?"
(이곳에 관한 질문일 경우) "이곳은 한 문장에 책으로 답하는 곳입니다. 요즘 힘든 일을 이야기해줄 수 있나요?"
(어떤것을 해야하는 질문일 경우) "당신에 힘든 일을 알려주세요. 위로 받을 수 있는 책을 추천해드립니다."
(테스트 문장일 경우) "이 곳은 조용한 공간입니다. 마음이 준비되면 말씀주세요. 간단하게 오늘 기분이나 불안함을 이야기해주셔도 좋아요."
(어색한 시도일 경우) "조심스러운 말도, 잘 들립니다."
(감정 있는 문장일 경우) "고맙습니다. 이제 책을 꺼내보죠."

응답 형식은 다음과 같습니다:

{"hasEmotion": true, "message": "고맙습니다. 이제 책을 꺼내보죠."}
{"hasEmotion": false, "message": "(상황에 맞는 메시지 출력)"}

반드시 위 JSON 형식으로만 응답하세요. 다른 설명은 절대 추가하지 마세요.`
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

  // 2단계: gpt-4o로 책 추천
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