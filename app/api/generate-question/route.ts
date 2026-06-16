import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { mode, isCorrect, question, correctAnswer } = await req.json();

  if (mode === 'explain') {
    const prompt = isCorrect
      ? `NCS 문화예술경영 시험에서 정답을 맞혔습니다. 문제: "${question}" 정답: "${correctAnswer}" 왜 이것이 정답인지, 실제 문화재단 현장 맥락을 담아 2-3문장으로 설명해주세요.`
      : `NCS 문화예술경영 시험에서 오답을 선택했습니다. 문제: "${question}" 정답: "${correctAnswer}" 왜 이것이 정답인지, 실제 문화재단 현장 사례를 담아 2-3문장으로 친절하게 설명해주세요.`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY || '',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 400,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      const data = await res.json();
      const text = data.content?.[0]?.text || '해설을 불러오지 못했습니다.';
      return NextResponse.json({ text });
    } catch {
      return NextResponse.json({ text: '해설을 불러오지 못했습니다.' });
    }
  }

  return NextResponse.json({ text: '알 수 없는 요청입니다.' });
}