import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function GET() {
  const { data } = await supabase
    .from('chapters')
    .select('id, title, order_num')
    .order('order_num');
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const { mode, chapterId, isCorrect, question, correctAnswer } = await req.json();

  // 챕터 내용 가져오기
  const { data: chapter } = await supabase
    .from('chapters')
    .select('title, content')
    .eq('id', chapterId)
    .single();

  if (!chapter) return NextResponse.json({ text: '챕터를 찾을 수 없습니다.' });

  const callAI = async (prompt: string) => {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await res.json();
    return data.content?.[0]?.text || '';
  };

  if (mode === 'summary') {
    const text = await callAI(`다음은 NCS 문화예술경영 학습모듈 "${chapter.title}"의 내용입니다:\n\n${chapter.content}\n\n위 내용을 학습자가 이해하기 쉽게 핵심 개념 위주로 요약해주세요. 다음 형식으로 작성하세요:\n1. 학습 목표 (2-3줄)\n2. 핵심 개념 (번호 목록)\n3. 반드시 기억할 포인트 (3가지)`);
    return NextResponse.json({ text });
  }

  if (mode === 'question') {
    const text = await callAI(`다음은 NCS 문화예술경영 학습모듈 "${chapter.title}"의 내용입니다:\n\n${chapter.content}\n\n위 내용을 바탕으로 NCS 시험에 출제될 수 있는 객관식 4지선다 문제 1개를 만들어주세요.\n\n반드시 아래 JSON 형식으로만 답하세요 (다른 텍스트 없이):\n{"type":"개념정의 또는 적용 또는 틀린것고르기","difficulty":"기본 또는 심화","question":"문제 텍스트","options":["①선택지","②선택지","③선택지","④선택지"],"answer_index":0,"explanation_correct":"정답 해설 2-3문장","explanation_wrong":"오답 해설 2-3문장"}`);
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('JSON 없음');
      return NextResponse.json(JSON.parse(match[0]));
    } catch {
      return NextResponse.json({ error: '문제 생성 실패' });
    }
  }

  if (mode === 'explain') {
    const prompt = isCorrect
      ? `NCS 문화예술경영 시험 문제 "${question}"에서 정답 "${correctAnswer}"을 맞혔습니다. 왜 정답인지 실제 문화재단 현장 맥락을 담아 2-3문장으로 설명해주세요.`
      : `NCS 문화예술경영 시험 문제 "${question}"에서 오답을 선택했습니다. 정답은 "${correctAnswer}"입니다. 왜 정답인지 문화재단 현장 사례를 담아 2-3문장으로 친절하게 설명해주세요.`;
    const text = await callAI(prompt);
    return NextResponse.json({ text });
  }

  return NextResponse.json({ text: '알 수 없는 요청' });
}