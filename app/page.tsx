'use client';

import { useState, useEffect } from 'react';

interface Chapter {
  id: string;
  title: string;
  order_num: number;
}

interface Question {
  type: string;
  difficulty: string;
  question: string;
  options: string[];
  answer_index: number;
  explanation_correct: string;
  explanation_wrong: string;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'learn' | 'quiz' | 'analysis'>('learn');
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [summary, setSummary] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [question, setQuestion] = useState<Question | null>(null);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [loadingExplain, setLoadingExplain] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [history, setHistory] = useState<{ chapter: string; correct: boolean }[]>([]);
const [streak, setStreak] = useState(0);
const [usedTypes, setUsedTypes] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/generate-question')
      .then(r => r.json())
      .then(data => {
        setChapters(data);
        if (data.length > 0) setSelectedChapter(data[0]);
      });
  }, []);

  const loadSummary = async (chapter: Chapter) => {
    setLoadingSummary(true);
    setSummary('');
    const res = await fetch('/api/generate-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'summary', chapterId: chapter.id }),
    });
    const data = await res.json();
    setSummary(data.text || '');
    setLoadingSummary(false);
  };

  const loadQuestion = async () => {
    if (!selectedChapter) return;
    setLoadingQuestion(true);
    setQuestion(null);
    setSelectedOption(null);
    setSubmitted(false);
    setExplanation('');
    const res = await fetch('/api/generate-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'question', chapterId: selectedChapter.id, streak, usedTypes }),
    });
    const data = await res.json();
    setQuestion(data);
    setLoadingQuestion(false);
  };

  const handleSubmit = async () => {
    if (selectedOption === null || !question) return;
    setSubmitted(true);
    setLoadingExplain(true);
    const isCorrect = selectedOption === question.answer_index;
    setScore(prev => ({ correct: prev.correct + (isCorrect ? 1 : 0), total: prev.total + 1 }));
    setHistory(prev => [...prev, { chapter: selectedChapter?.title || '', correct: isCorrect }]);
    setStreak(prev => isCorrect ? prev + 1 : prev - 1);
if (question) setUsedTypes(prev => [...prev.slice(-4), question.type]);
    const res = await fetch('/api/generate-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'explain',
        chapterId: selectedChapter?.id,
        isCorrect,
        question: question.question,
        correctAnswer: question.options[question.answer_index],
      }),
    });
    const data = await res.json();
    setExplanation(data.text || '');
    setLoadingExplain(false);
  };

  const s = { fontFamily: "'Apple SD Gothic Neo', sans-serif", background: '#f7f7fb', minHeight: '100vh' } as const;

  return (
    <div style={s}>
      {/* Header */}
      <div style={{ background: '#0f0f1a', padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ color: '#fff', fontSize: 18, fontWeight: 800 }}>Art<span style={{ color: '#5b4fff' }}>NCS</span></div>
        <div style={{ background: 'rgba(91,79,255,0.2)', color: '#a99eff', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20 }}>문화예술경영</div>
      </div>

      {/* Tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e4e4f0', display: 'flex', position: 'sticky', top: 56, zIndex: 99 }}>
        {(['learn', 'quiz', 'analysis'] as const).map((tab) => (
          <div key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, padding: '14px 0', textAlign: 'center', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: activeTab === tab ? '#5b4fff' : '#999', borderBottom: activeTab === tab ? '2px solid #5b4fff' : '2px solid transparent' }}>
            {tab === 'learn' ? '📖 학습하기' : tab === 'quiz' ? '✏️ 문제풀기' : '📊 학습분석'}
          </div>
        ))}
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px 80px' }}>

        {/* 챕터 선택 */}
        <div style={{ background: '#fff', border: '1px solid #e4e4f0', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#5b4fff', marginBottom: 8 }}>학습 단원 선택</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {chapters.map(ch => (
              <div key={ch.id} onClick={() => { setSelectedChapter(ch); setSummary(''); setQuestion(null); setSelectedOption(null); setSubmitted(false); setExplanation(''); }}
                style={{ fontSize: 12, padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${selectedChapter?.id === ch.id ? '#5b4fff' : '#e4e4f0'}`, background: selectedChapter?.id === ch.id ? '#ede9ff' : '#fff', color: selectedChapter?.id === ch.id ? '#5b4fff' : '#666', cursor: 'pointer', fontWeight: selectedChapter?.id === ch.id ? 700 : 400 }}>
                {ch.title}
              </div>
            ))}
          </div>
        </div>

        {/* 학습 탭 */}
        {activeTab === 'learn' && (
          <div>
            <div style={{ background: '#0f0f1a', borderRadius: 12, padding: '24px 20px', marginBottom: 16, color: '#fff' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#5b4fff', marginBottom: 8 }}>문화예술경영 · NCS 학습모듈</div>
              <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>{selectedChapter?.title || '단원을 선택해주세요'}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>AI가 핵심 내용을 요약해드립니다</div>
            </div>

            {!summary && !loadingSummary && (
              <button onClick={() => selectedChapter && loadSummary(selectedChapter)}
                style={{ width: '100%', padding: 14, background: '#5b4fff', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 12 }}>
                🤖 AI 학습 요약 생성하기
              </button>
            )}

            {loadingSummary && (
              <div style={{ background: '#fff', border: '1px solid #e4e4f0', borderRadius: 12, padding: 24, textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginBottom: 8 }}>
                  {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#5b4fff', animation: `bounce 1.1s ${i*0.18}s infinite` }} />)}
                </div>
                <div style={{ fontSize: 13, color: '#999' }}>AI가 학습 내용을 분석 중입니다...</div>
              </div>
            )}

            {summary && (
              <div style={{ background: '#fff', border: '1px solid #e4e4f0', borderRadius: 12, padding: 18, marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#5b4fff', marginBottom: 10 }}>🤖 AI 학습 요약</div>
                <div style={{ fontSize: 13, color: '#3a3a52', lineHeight: 1.85 }}>
  {(() => {
    const lines = summary.split('\n');
    const result = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const clean = line.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
      
      // 표 처리
      if (line.includes('|') && line.trim().startsWith('|')) {
        const tableLines = [];
        while (i < lines.length && lines[i].includes('|')) {
          if (!lines[i].includes('---')) tableLines.push(lines[i]);
          i++;
        }
        if (tableLines.length > 0) {
          const headers = tableLines[0].split('|').filter(c => c.trim());
          const rows = tableLines.slice(1).map(r => r.split('|').filter(c => c.trim()));
          result.push(
            <div key={`table-${i}`} style={{ overflowX: 'auto', margin: '10px 0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>{headers.map((h, j) => <th key={j} style={{ background: '#f0f0f4', padding: '6px 10px', textAlign: 'left', borderBottom: '2px solid #e4e4f0', fontWeight: 700, color: '#0f0f1a' }}>{h.trim()}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((row, j) => <tr key={j}>{row.map((cell, k) => <td key={k} style={{ padding: '6px 10px', borderBottom: '1px solid #f0f0f4', color: '#3a3a52' }}>{cell.trim()}</td>)}</tr>)}
                </tbody>
              </table>
            </div>
          );
        }
        continue;
      }

      if (line.startsWith('# ') || line.startsWith('## ') || line.startsWith('### ')) {
        const text = clean.replace(/^#+\s/, '');
        result.push(<div key={i} style={{ fontWeight: 700, color: '#0f0f1a', marginTop: 16, marginBottom: 6, fontSize: line.startsWith('# ') ? 15 : 14, borderBottom: line.startsWith('## ') ? '1px solid #e4e4f0' : 'none', paddingBottom: line.startsWith('## ') ? 4 : 0 }}>{text}</div>);
      } else if (line.match(/^[-–>]\s/)) {
        result.push(<div key={i} style={{ paddingLeft: 12, marginBottom: 4, display: 'flex', gap: 6 }}><span style={{ color: '#5b4fff', flexShrink: 0 }}>•</span><span>{clean.replace(/^[-–>]\s/, '')}</span></div>);
      } else if (line.match(/^\d+\.\s/)) {
        result.push(<div key={i} style={{ paddingLeft: 12, marginBottom: 4, fontWeight: 600 }}>{clean}</div>);
      } else if (line === '---') {
        result.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid #e4e4f0', margin: '10px 0' }} />);
      } else if (!line.trim()) {
        result.push(<div key={i} style={{ height: 6 }} />);
      } else {
        result.push(<div key={i} style={{ marginBottom: 4 }}>{clean}</div>);
      }
      i++;
    }
    return result;
  })()}
</div>
                <button onClick={() => selectedChapter && loadSummary(selectedChapter)}
                  style={{ marginTop: 12, padding: '8px 16px', background: 'transparent', border: '1.5px solid #5b4fff', color: '#5b4fff', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  🔄 다시 요약하기
                </button>
              </div>
            )}

            <button onClick={() => setActiveTab('quiz')}
              style={{ width: '100%', padding: 14, background: '#0f0f1a', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              ✏️ 이 단원 문제 풀기 →
            </button>
          </div>
        )}

        {/* 문제풀기 탭 */}
        {activeTab === 'quiz' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
              {[['총 문제', score.total], ['정답', score.correct], ['정답률', score.total > 0 ? Math.round(score.correct/score.total*100)+'%' : '—']].map(([label, value]) => (
                <div key={label as string} style={{ background: '#fff', border: '1px solid #e4e4f0', borderRadius: 12, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{value}</div>
                  <div style={{ fontSize: 11, color: '#7a7a96', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>

            {!question && !loadingQuestion && (
              <button onClick={loadQuestion}
                style={{ width: '100%', padding: 14, background: '#5b4fff', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 12 }}>
                🤖 AI 문제 생성하기 ({selectedChapter?.title})
              </button>
            )}

            {loadingQuestion && (
              <div style={{ background: '#fff', border: '1px solid #e4e4f0', borderRadius: 12, padding: 24, textAlign: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginBottom: 8 }}>
                  {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#5b4fff', animation: `bounce 1.1s ${i*0.18}s infinite` }} />)}
                </div>
                <div style={{ fontSize: 13, color: '#999' }}>AI가 문제를 생성 중입니다...</div>
              </div>
            )}

            {question && (
              <div style={{ background: '#fff', border: '1px solid #e4e4f0', borderRadius: 12, padding: 18, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, background: '#ede9ff', color: '#5b4fff', padding: '4px 10px', borderRadius: 20 }}>{question.type}</span>
                  <span style={{ fontSize: 11, color: '#7a7a96' }}>{question.difficulty}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#0f0f1a', lineHeight: 1.75, marginBottom: 16 }}
                  dangerouslySetInnerHTML={{ __html: question.question.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#5b4fff">$1</strong>') }} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {question.options.map((opt, i) => {
                    let borderColor = '#e4e4f0', bg = '#fff', color = '#3a3a52';
                    if (submitted) {
                      if (i === question.answer_index) { borderColor = '#00c896'; bg = '#e8fff8'; color = '#005a42'; }
                      else if (i === selectedOption) { borderColor = '#ff4d6d'; bg = '#fff0f3'; color = '#8b0022'; }
                    } else if (selectedOption === i) { borderColor = '#5b4fff'; bg = '#ede9ff'; }
                    return (
                      <div key={i} onClick={() => !submitted && setSelectedOption(i)}
                        style={{ padding: '12px 14px', border: `1.5px solid ${borderColor}`, borderRadius: 8, fontSize: 13, color, background: bg, cursor: submitted ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: submitted && i === question.answer_index ? '#00c896' : submitted && i === selectedOption ? '#ff4d6d' : selectedOption === i ? '#5b4fff' : '#f0f0f4', color: (submitted && (i === question.answer_index || i === selectedOption)) || selectedOption === i ? '#fff' : '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                          {['①','②','③','④'][i]}
                        </div>
                        {opt.replace(/^[①②③④]\s?/, '')}
                      </div>
                    );
                  })}
                </div>

                {!submitted && (
                  <button onClick={handleSubmit} disabled={selectedOption === null}
                    style={{ width: '100%', padding: 13, background: selectedOption === null ? '#e4e4f0' : '#0f0f1a', color: selectedOption === null ? '#7a7a96' : '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: selectedOption === null ? 'not-allowed' : 'pointer', marginTop: 12 }}>
                    답 제출하기
                  </button>
                )}

                {submitted && (
                  <div style={{ background: '#f3f0ff', border: '1px solid #d4caff', borderRadius: 8, padding: 14, marginTop: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#5b4fff', marginBottom: 8 }}>🤖 AI 해설</div>
                    {loadingExplain ? (
                      <div style={{ display: 'flex', gap: 5 }}>
                        {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#5b4fff', animation: `bounce 1.1s ${i*0.18}s infinite` }} />)}
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: '#3a3a52', lineHeight: 1.85 }}>
                        <span style={{ fontWeight: 700, color: selectedOption === question.answer_index ? '#00c896' : '#ff4d6d' }}>{selectedOption === question.answer_index ? '✅ 정답' : '❌ 오답'}</span>
                        <br /><br />
                        <span dangerouslySetInnerHTML={{ __html: explanation.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} />
                      </div>
                    )}
                  </div>
                )}

                {submitted && (
                  <button onClick={loadQuestion}
                    style={{ width: '100%', padding: 13, background: '#5b4fff', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 8 }}>
                    다음 문제 →
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* 학습분석 탭 */}
        {activeTab === 'analysis' && (
          <div>
            <div style={{ background: '#fff', border: '1px solid #e4e4f0', borderRadius: 12, padding: 18, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>📊 전체 학습 현황</div>
              {score.total === 0 ? (
                <div style={{ fontSize: 13, color: '#7a7a96', textAlign: 'center', padding: '20px 0' }}>문제를 풀면 분석 결과가 나타납니다.</div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: '#3a3a52' }}>{score.total}문제 중 {score.correct}문제 정답</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#5b4fff' }}>{Math.round(score.correct/score.total*100)}%</span>
                  </div>
                  <div style={{ background: '#f0f0f4', borderRadius: 20, height: 8 }}>
                    <div style={{ width: `${Math.round(score.correct/score.total*100)}%`, height: 8, background: '#5b4fff', borderRadius: 20 }} />
                  </div>
                </div>
              )}
            </div>

            <div style={{ background: '#fff', border: '1px solid #e4e4f0', borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>📋 학습 기록</div>
              {history.length === 0 ? (
                <div style={{ fontSize: 13, color: '#7a7a96', textAlign: 'center', padding: '20px 0' }}>학습 기록이 없습니다.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {history.slice().reverse().slice(0, 10).map((h, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: '#f7f7fb', borderRadius: 8 }}>
                      <span style={{ fontSize: 12, color: '#3a3a52' }}>{h.chapter}</span>
                      <span style={{ fontSize: 13, color: h.correct ? '#00c896' : '#ff4d6d' }}>{h.correct ? '✅' : '❌'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-7px)} }`}</style>
    </div>
  );
}