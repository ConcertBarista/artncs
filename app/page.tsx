'use client';

import { useState } from 'react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'learn' | 'quiz' | 'analysis'>('learn');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [loadingExplain, setLoadingExplain] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const ANSWER_INDEX = 1;

  const handleSubmit = async () => {
    if (selectedOption === null) return;
    setSubmitted(true);
    setLoadingExplain(true);
    const isCorrect = selectedOption === ANSWER_INDEX;
    setScore(prev => ({ correct: prev.correct + (isCorrect ? 1 : 0), total: prev.total + 1 }));

    try {
      const res = await fetch('/api/generate-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'explain',
          isCorrect,
          question: '문화예술 재원조성의 기본 요소 중 관련성(Relevance)이 의미하는 것은?',
          correctAnswer: '재원(기부자)을 기관 활동에 참여시켜 관계를 형성하는 것',
        }),
      });
      const data = await res.json();
      setExplanation(data.text);
    } catch {
      setExplanation('해설을 불러오지 못했습니다.');
    } finally {
      setLoadingExplain(false);
    }
  };

  const handleNext = () => {
    setSelectedOption(null);
    setSubmitted(false);
    setExplanation('');
  };

  return (
    <div style={{ fontFamily: "'Apple SD Gothic Neo', sans-serif", background: '#f7f7fb', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: '#0f0f1a', padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ color: '#fff', fontSize: 18, fontWeight: 800 }}>Art<span style={{ color: '#5b4fff' }}>NCS</span></div>
        <div style={{ background: 'rgba(91,79,255,0.2)', color: '#a99eff', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20 }}>문화예술경영</div>
      </div>

      {/* Tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e4e4f0', display: 'flex', position: 'sticky', top: 0, zIndex: 99 }}>
        {(['learn', 'quiz', 'analysis'] as const).map((tab) => (
          <div key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, padding: '14px 0', textAlign: 'center', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: activeTab === tab ? '#5b4fff' : '#999', borderBottom: activeTab === tab ? '2px solid #5b4fff' : '2px solid transparent' }}>
            {tab === 'learn' ? '📖 학습하기' : tab === 'quiz' ? '✏️ 문제풀기' : '📊 학습분석'}
          </div>
        ))}
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px 80px' }}>

        {/* 학습 탭 */}
        {activeTab === 'learn' && (
          <div>
            <div style={{ background: '#0f0f1a', borderRadius: 12, padding: '24px 20px', marginBottom: 16, color: '#fff' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#5b4fff', marginBottom: 8 }}>문화예술경영 · 세분류 05</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>문화예술 재원조성</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>학습 1-3 · 총 3개 능력단위</div>
            </div>

            {[
              { label: '학습 목표', content: '• 문화예술 사업목표와 예산계획에 따라 효과적인 재원조성전략을 수립할 수 있다.\n• 재원금액 목표설정 시 재원주체별 재원조달 목표액을 상정할 수 있다.' },
              { label: '핵심 개념', content: '재원조성(Fundraising)은 문화예술 사업을 위한 자금을 외부로부터 확보하는 전략적 활동입니다. 단순한 모금이 아니라 기관의 미션과 연계하여 지속적인 관계를 형성하는 과정입니다.' },
            ].map((card, i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid #e4e4f0', borderRadius: 12, padding: 18, marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#5b4fff', marginBottom: 10 }}>{card.label}</div>
                <div style={{ fontSize: 13, color: '#3a3a52', lineHeight: 1.85, whiteSpace: 'pre-line' }}>{card.content}</div>
              </div>
            ))}

            <div style={{ background: '#fff', border: '1px solid #e4e4f0', borderRadius: 12, padding: 18, marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#5b4fff', marginBottom: 10 }}>재원조성의 5가지 기본 요소</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[['⚡', '효율성', '재원조성 비용 최소화'], ['🔗', '관련성', '기부자를 기관 활동에 참여시켜 관계 형성'], ['📈', '성장', '자원 규모 및 재원 수 증진'], ['🛡️', '안정성', '다각화를 통한 안정적 재원 확보'], ['🎯', '유형성', '시장 주의를 끄는 프로그램 창출']].map(([icon, name, desc], i) => (
                  <div key={i} style={{ background: '#f7f7fb', borderRadius: 8, padding: 12, gridColumn: i === 4 ? '1 / -1' : undefined }}>
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{name}</div>
                    <div style={{ fontSize: 11, color: '#7a7a96', lineHeight: 1.5 }}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={() => setActiveTab('quiz')} style={{ width: '100%', padding: 14, background: '#5b4fff', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              ✏️ 문제 풀러 가기 →
            </button>
          </div>
        )}

        {/* 문제풀기 탭 */}
        {activeTab === 'quiz' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
              {[['총 문제', score.total], ['정답', score.correct], ['정답률', score.total > 0 ? Math.round(score.correct / score.total * 100) + '%' : '—']].map(([label, value]) => (
                <div key={label as string} style={{ background: '#fff', border: '1px solid #e4e4f0', borderRadius: 12, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{value}</div>
                  <div style={{ fontSize: 11, color: '#7a7a96', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>

            <div style={{ background: '#fff', border: '1px solid #e4e4f0', borderRadius: 12, padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 700, background: '#ede9ff', color: '#5b4fff', padding: '4px 10px', borderRadius: 20 }}>개념정의</span>
                <span style={{ fontSize: 11, color: '#7a7a96' }}>기본</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0f0f1a', lineHeight: 1.75, marginBottom: 16 }}>
                문화예술 재원조성의 기본 요소 중 <strong style={{ color: '#5b4fff' }}>&#39;관련성(Relevance)&#39;</strong>이 의미하는 것으로 가장 적절한 것은?
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {['재원조성에 드는 비용을 최소화하는 것', '재원(기부자)을 기관 활동에 참여시켜 관계를 형성하는 것', '시장의 주의를 끌 수 있는 규모의 프로그램을 창출하는 것', '재원조성 활동을 통해 자원 규모를 증진시키는 것'].map((opt, i) => {
                  const nums = ['①', '②', '③', '④'];
                  let borderColor = '#e4e4f0', bg = '#fff', color = '#3a3a52';
                  if (submitted) {
                    if (i === ANSWER_INDEX) { borderColor = '#00c896'; bg = '#e8fff8'; color = '#005a42'; }
                    else if (i === selectedOption && i !== ANSWER_INDEX) { borderColor = '#ff4d6d'; bg = '#fff0f3'; color = '#8b0022'; }
                  } else if (selectedOption === i) { borderColor = '#5b4fff'; bg = '#ede9ff'; }
                  return (
                    <div key={i} onClick={() => !submitted && setSelectedOption(i)} style={{ padding: '12px 14px', border: `1.5px solid ${borderColor}`, borderRadius: 8, fontSize: 13, color, background: bg, cursor: submitted ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: submitted && i === ANSWER_INDEX ? '#00c896' : submitted && i === selectedOption ? '#ff4d6d' : selectedOption === i ? '#5b4fff' : '#f0f0f4', color: (submitted && (i === ANSWER_INDEX || i === selectedOption)) || selectedOption === i ? '#fff' : '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{nums[i]}</div>
                      {opt}
                    </div>
                  );
                })}
              </div>

              {!submitted && (
                <button onClick={handleSubmit} disabled={selectedOption === null} style={{ width: '100%', padding: 13, background: selectedOption === null ? '#e4e4f0' : '#0f0f1a', color: selectedOption === null ? '#7a7a96' : '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: selectedOption === null ? 'not-allowed' : 'pointer', marginTop: 12 }}>
                  답 제출하기
                </button>
              )}

              {submitted && (
                <div style={{ background: '#f3f0ff', border: '1px solid #d4caff', borderRadius: 8, padding: 14, marginTop: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#5b4fff', marginBottom: 8 }}>🤖 AI 해설</div>
                  {loadingExplain ? (
                    <div style={{ display: 'flex', gap: 5 }}>
                      {[0, 1, 2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#5b4fff', animation: `bounce 1.1s ${i * 0.18}s infinite` }} />)}
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: '#3a3a52', lineHeight: 1.85 }}>
                      <span style={{ fontWeight: 700, color: selectedOption === ANSWER_INDEX ? '#00c896' : '#ff4d6d' }}>{selectedOption === ANSWER_INDEX ? '✅ 정답' : '❌ 오답'}</span>
                      <br /><br /><div style={{ fontSize: 13, color: '#3a3a52', lineHeight: 1.85 }}
  dangerouslySetInnerHTML={{ __html: explanation
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^## (.*)/gm, '<strong style="font-size:14px">$1</strong>')
    .replace(/^--- >/gm, '')
    .replace(/\n/g, '<br/>')
  }}
/>
                    </div>
                  )}
                </div>
              )}

              {submitted && (
                <button onClick={handleNext} style={{ width: '100%', padding: 13, background: '#5b4fff', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 8 }}>
                  다음 문제 →
                </button>
              )}
            </div>
          </div>
        )}

        {/* 학습분석 탭 */}
        {activeTab === 'analysis' && (
          <div style={{ background: '#fff', border: '1px solid #e4e4f0', borderRadius: 12, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>📊 학습 현황</div>
            {score.total === 0 ? (
              <div style={{ fontSize: 13, color: '#7a7a96', textAlign: 'center', padding: '20px 0' }}>문제를 풀면 분석 결과가 나타납니다.</div>
            ) : (
              <div>
                <div style={{ fontSize: 13, color: '#3a3a52', marginBottom: 8 }}>총 {score.total}문제 중 {score.correct}문제 정답</div>
                <div style={{ background: '#f0f0f4', borderRadius: 20, height: 8 }}>
                  <div style={{ width: `${Math.round(score.correct / score.total * 100)}%`, height: 8, background: '#5b4fff', borderRadius: 20 }} />
                </div>
                <div style={{ fontSize: 12, color: '#7a7a96', marginTop: 6 }}>정답률 {Math.round(score.correct / score.total * 100)}%</div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-7px)} }`}</style>
    </div>
  );
}