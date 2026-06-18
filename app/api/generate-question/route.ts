import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const track = searchParams.get('track');
  const moduleId = searchParams.get('moduleId');

  if (moduleId) {
    // 특정 모듈의 챕터 목록 반환
    const { data } = await supabase
      .from('chapters')
      .select('id, title, order_num')
      .eq('module_id', moduleId)
      .order('order_num');
    return NextResponse.json(data || []);
  }

  if (track) {
    // 특정 트랙의 모듈 목록 반환
    const { data } = await supabase
      .from('modules')
      .select('id, title, track, order_num')
      .eq('track', track)
      .order('order_num');
    return NextResponse.json(data || []);
  }

  // 트랙 목록 반환
  const { data } = await supabase
    .from('modules')
    .select('track')
    .order('track');
  const tracks = [...new Set((data || []).map((d: {track: string}) => d.track))];
  return NextResponse.json(tracks);
}

export async function POST(req: NextRequest) {
  const { mode, chapterId, isCorrect, question, correctAnswer, streak, usedTypes } = await req.json();

  const { data: chapter } = await supabase
    .from('chapters')
    .select('title, content')
    .eq('id', chapterId)
    .single();

  if (!chapter) return NextResponse.json({ text: '챕터를 찾을 수 없습니다.' });

  const callAI = async (prompt: string, maxTokens = 1000) => {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || '';
};

  if (mode === 'summary') {
    // 캐시 확인: DB에 저장된 요약이 있으면 바로 반환
    const { data: chapterWithSummary } = await supabase
      .from('chapters')
      .select('summary')
      .eq('id', chapterId)
      .single();

    if (chapterWithSummary?.summary) {
      return NextResponse.json({ text: chapterWithSummary.summary });
    }

    // 없으면 AI 생성 후 DB에 저장
    const text = await callAI(`다음은 NCS 문화예술경영 학습모듈 "${chapter.title}"의 내용입니다:\n\n${chapter.content}\n\n위 내용을 아래 형식으로 요약하세요. 반드시 이 형식을 그대로 따르고, 마크다운 기호(**,##) 없이 작성하세요. 표가 필요하면 | 기호를 사용하세요. 원본 내용의 50% 수준으로 충분히 상세하게 작성하고, 중요한 개념과 사례는 빠짐없이 포함하세요.\n\n[학습 목표]\n• 목표1\n• 목표2\n\n[핵심 개념]\n• 개념1: 설명\n• 개념2: 설명\n• 개념3: 설명\n• 개념4: 설명\n\n[주요 내용]\n내용에 표가 있으면 표로 정리하고, 단계나 절차가 있으면 번호 목록으로 정리하세요.\n\n[반드시 기억할 포인트]\n① 포인트1\n② 포인트2\n③ 포인트3`, 4000);

    // DB에 저장
    await supabase
      .from('chapters')
      .update({ summary: text })
      .eq('id', chapterId);

    return NextResponse.json({ text });
  }

  if (mode === 'question') {
    // 난이도 결정: 3연속 정답이면 심화, 2연속 오답이면 기본
    const difficulty = (streak ?? 0) >= 3 ? '심화' : (streak ?? 0) <= -2 ? '기본' : '기본 또는 심화 중 적절한 것';

    // 문제 유형 순환: 최근 사용한 유형 제외
    const allTypes = ['개념정의', '적용', '틀린것고르기', '빈칸채우기'];
    const recentTypes = usedTypes || [];
    const availableTypes = allTypes.filter(t => !recentTypes.slice(-2).includes(t));
    const nextType = availableTypes[Math.floor(Math.random() * availableTypes.length)] || allTypes[0];

    const text = await callAI(`다음은 NCS 문화예술경영 학습모듈 "${chapter.title}"의 내용입니다:\n\n${chapter.content}\n\n위 내용을 바탕으로 NCS 시험 문제를 만들어주세요.\n\n조건:\n- 문제 유형: 반드시 "${nextType}" 유형으로 만드세요\n  * 개념정의: 용어나 개념의 정확한 정의를 묻는 문제\n  * 적용: 실제 상황에 개념을 적용하는 문제\n  * 틀린것고르기: 4개 선택지 중 옳지 않은 것을 고르는 문제\n  * 빈칸채우기: 문장의 빈칸에 들어갈 내용을 고르는 문제\n- 난이도: ${difficulty}\n- 객관식 4지선다\n\n반드시 아래 JSON 형식으로만 답하세요 (다른 텍스트 없이):\n{"type":"${nextType}","difficulty":"기본 또는 심화","question":"문제 텍스트","options":["선택지1","선택지2","선택지3","선택지4"],"answer_index":0,"explanation_correct":"정답 해설 2-3문장 (현장 맥락 포함)","explanation_wrong":"오답 해설 2-3문장 (현장 맥락 포함)"}`);

    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('JSON 없음');
      const parsed = JSON.parse(match[0]);
      parsed.usedType = nextType;
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json({ error: '문제 생성 실패' });
    }
  }

  if (mode === 'explain') {
    const prompt = isCorrect
      ? `NCS 문화예술경영 시험 문제 "${question}"에서 정답 "${correctAnswer}"을 맞혔습니다. 왜 정답인지 실제 문화재단 현장 맥락을 담아 2-3문장으로 설명해주세요. 마크다운 없이 일반 텍스트로 작성하세요.`
      : `NCS 문화예술경영 시험 문제 "${question}"에서 오답을 선택했습니다. 정답은 "${correctAnswer}"입니다. 왜 정답인지 문화재단 현장 사례를 담아 2-3문장으로 친절하게 설명해주세요. 마크다운 없이 일반 텍스트로 작성하세요.`;
    const text = await callAI(prompt);
    return NextResponse.json({ text });
  }

  return NextResponse.json({ text: '알 수 없는 요청' });
}