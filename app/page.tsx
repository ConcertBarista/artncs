'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Module {
  id: string;
  title: string;
  track: string;
  order_num: number;
}

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
  explanation_correct?: string;
  explanation_wrong?: string;
  locked?: boolean;
}

interface User {
  id: string;
  is_anonymous?: boolean;
  email?: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
    guest_summary_chapter_ids?: string[];
  };
}

const TRACKS = ['문화예술경영', '문화예술기획', '문화예술행정', '문화콘텐츠기획'];
const OPEN_TRACKS = ['문화예술경영'];
const OPEN_MODULES = ['문화예술 경영전략수립'];
const SUMMARY_LEVELS: { key: 'detailed' | 'summary' | 'keyword'; label: string }[] = [
  { key: 'detailed', label: '상세' },
  { key: 'summary', label: '요약' },
  { key: 'keyword', label: '키워드' },
];
const DIFFICULTIES: { key: string; label: string }[] = [
  { key: 'easy', label: '기본' },
  { key: 'medium', label: '중급' },
  { key: 'hard', label: '심화' },
];

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'learn' | 'quiz' | 'analysis'>('learn');
  const [selectedTrack, setSelectedTrack] = useState('문화예술경영');
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(true);
  const [summary, setSummary] = useState('');
  const [summaryLevel, setSummaryLevel] = useState<'detailed' | 'summary' | 'keyword' | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [question, setQuestion] = useState<Question | null>(null);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [manualDifficulty, setManualDifficulty] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [loadingExplain, setLoadingExplain] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [history, setHistory] = useState<{ chapter: string; correct: boolean }[]>([]);
  const [streak, setStreak] = useState(0);
  const [usedTypes, setUsedTypes] = useState<string[]>([]);
  const [guestLimitReached, setGuestLimitReached] = useState(false);
  const [questionError, setQuestionError] = useState('');
  const [guestSummaryLocked, setGuestSummaryLocked] = useState(false);

  // 로그인 체크
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        const { data: anonData, error } = await supabase.auth.signInAnonymously();
        if (error) {
          console.error('게스트 로그인 실패:', error.message);
          return;
        }
        setUser(anonData.user);
      } else {
        setUser(data.user);
      }
    });
  }, []);

  // 트랙 변경 시 모듈 로드
  useEffect(() => {
    fetch(`/api/generate-question?track=${encodeURIComponent(selectedTrack)}`)
      .then(r => r.json())
      .then(data => {
        setModules(data);
        setSelectedModule(data[0] || null);
        setChapters([]);
        setSelectedChapter(null);
        setSummary('');
        setSummaryLevel(null);
        setQuestion(null);
      });
  }, [selectedTrack]);

  // 모듈 변경 시 챕터 로드
  useEffect(() => {
    if (!selectedModule) return;
    fetch(`/api/generate-question?moduleId=${selectedModule.id}`)
      .then(r => r.json())
      .then(data => {
        setChapters(data);
        setSelectedChapter(data[0] || null);
        setSummary('');
        setSummaryLevel(null);
        setQuestion(null);
      });
  }, [selectedModule]);

  // 게스트 챕터당 1문제 제한 확인
  useEffect(() => {
    if (!user || !selectedChapter) return;
    if (!user.is_anonymous) {
      setGuestLimitReached(false);
      return;
    }
    supabase
      .from('quiz_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('chapter_id', selectedChapter.id)
      .then(({ count }) => {
        setGuestLimitReached((count ?? 0) >= 1);
      });
  }, [selectedChapter, user]);

  // 게스트 학습요약 잠금 확인 (최대 3개 챕터까지 허용)
  useEffect(() => {
    if (!user || !selectedChapter) return;
    if (!user.is_anonymous) {
      setGuestSummaryLocked(false);
      return;
    }
    const viewedIds = user.user_metadata?.guest_summary_chapter_ids || [];
    setGuestSummaryLocked(viewedIds.length >= 3 && !viewedIds.includes(selectedChapter.id));
  }, [selectedChapter, user]);

  const loadSummary = async (chapter: Chapter, level: 'detailed' | 'summary' | 'keyword') => {
    if (user?.is_anonymous) {
      const viewedIds = user.user_metadata?.guest_summary_chapter_ids || [];
      if (!viewedIds.includes(chapter.id) && viewedIds.length < 3) {
        const { data } = await supabase.auth.updateUser({
          data: { guest_summary_chapter_ids: [...viewedIds, chapter.id] },
        });
        if (data?.user) setUser(data.user as User);
      } else if (guestSummaryLocked) {
        return;
      }
    }
    setLoadingSummary(true);
    setSummaryLevel(level);
    setSummary('');
    const res = await fetch('/api/generate-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'cached_summary', chapterId: chapter.id, level }),
    });
    const data = await res.json();
    setSummary(data.text || '');
    setLoadingSummary(false);
  };

  const getRecommendedDifficulty = () => {
    if (streak >= 4) return 'hard';
    if (streak >= 2) return 'medium';
    return 'easy';
  };

  const loadQuestion = async (difficulty: string) => {
    if (!selectedChapter) return;
    setManualDifficulty(difficulty);
    setLoadingQuestion(true);
    setQuestion(null);
    setQuestionError('');
    setSelectedOption(null);
    setSubmitted(false);
    setExplanation('');

    const allTypes = ['개념정의', '적용', '틀린것고르기', '빈칸채우기'];
    const availableTypes = allTypes.filter(t => !usedTypes.slice(-2).includes(t));
    const nextType = availableTypes[Math.floor(Math.random() * availableTypes.length)] || allTypes[0];

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/generate-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'cached_question',
        chapterId: selectedChapter.id,
        type: nextType,
        difficulty,
        accessToken: session?.access_token,
      }),
    });
    const data = await res.json();
    if (data.error) {
      setQuestionError(data.error);
      setQuestion(null);
    } else {
      setQuestionError('');
      setQuestion(data);
    }
    setLoadingQuestion(false);
  };

  const handleSubmit = async () => {
    if (selectedOption === null || !question) return;
    setSubmitted(true);
    setLoadingExplain(true);
    const isCorrect = selectedOption === question.answer_index;

    // DB에 풀이 기록 저장
    const { error: logError } = await supabase.from('quiz_logs').insert({
      user_id: user?.id,
      module_code: selectedModule?.id || '',
      chapter_id: selectedChapter?.id,
      topic: question.type,
      is_correct: isCorrect,
    });
    if (logError) console.error('quiz_logs 저장 실패:', logError.message, logError);

    setScore(prev => ({ correct: prev.correct + (isCorrect ? 1 : 0), total: prev.total + 1 }));
    setHistory(prev => [...prev, { chapter: selectedChapter?.title || '', correct: isCorrect }]);
    setStreak(prev => isCorrect ? prev + 1 : prev - 1);
    if (question) setUsedTypes(prev => [...prev.slice(-4), question.type]);

    if (question.locked) {
      setExplanation('LOCKED');
    } else {
      setExplanation((isCorrect ? question.explanation_correct : question.explanation_wrong) || '');
    }
    setLoadingExplain(false);
  };

  const selectChapterAndClose = (ch: Chapter) => {
    setSelectedChapter(ch);
    setSummary('');
    setSummaryLevel(null);
    setQuestion(null);
    setSelectedOption(null);
    setSubmitted(false);
    setExplanation('');
    setManualDifficulty(null);
    setStreak(0);
    setSelectorOpen(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const s = { fontFamily: "'Apple SD Gothic Neo', sans-serif", background: '#f7f7fb', minHeight: '100vh' } as const;

  if (!user) return null;

  return (
    <div style={s}>
      {/* Header */}
      <div style={{ background: '#0f0f1a', padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div onClick={() => window.location.href = '/'} style={{ color: '#fff', fontSize: 18, fontWeight: 800, cursor: 'pointer' }}>Art<span style={{ color: '#5b4fff' }}>NCS</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {user?.is_anonymous ? (
            <div onClick={() => window.location.href = '/login'}
              style={{ background: '#5b4fff', color: '#fff', fontSize: 11, fontWeight: 700, padding: '6px 14px', borderRadius: 20, cursor: 'pointer' }}>
              로그인
            </div>
          ) : (
            <>
              <div style={{ color: '#a99eff', fontSize: 11, fontWeight: 600 }}>
                {user?.user_metadata?.full_name || user?.email?.split('@')[0] || ''}
              </div>
              <div onClick={handleLogout} style={{ background: 'rgba(91,79,255,0.2)', color: '#a99eff', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, cursor: 'pointer' }}>
                로그아웃
              </div>
            </>
          )}
        </div>
      </div>

      {/* 메인 탭 */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e4e4f0', display: 'flex', position: 'sticky', top: 56, zIndex: 99 }}>
        {(['learn', 'quiz', 'analysis'] as const).map((tab) => (
          <div key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, padding: '14px 0', textAlign: 'center', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: activeTab === tab ? '#5b4fff' : '#999', borderBottom: activeTab === tab ? '2px solid #5b4fff' : '2px solid transparent' }}>
            {tab === 'learn' ? '📖 학습하기' : tab === 'quiz' ? '✏️ 문제풀기' : '📊 학습분석'}
          </div>
        ))}
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px 80px' }}>

        {/* 선택 영역: 펼침/접힘 */}
        {selectorOpen ? (
          <div style={{ background: '#fff', border: '1.5px solid #5b4fff', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#5b4fff', marginBottom: 8 }}>분야 선택</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {TRACKS.map(track => {
                  const isOpen = OPEN_TRACKS.includes(track);
                  return (
                    <div key={track} onClick={() => isOpen && setSelectedTrack(track)}
                      style={{ fontSize: 12, padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${selectedTrack === track ? '#5b4fff' : '#e4e4f0'}`, background: selectedTrack === track ? '#5b4fff' : '#fff', color: !isOpen ? '#ccc' : selectedTrack === track ? '#fff' : '#666', cursor: isOpen ? 'pointer' : 'not-allowed', fontWeight: selectedTrack === track ? 700 : 400, opacity: isOpen ? 1 : 0.6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {track}
                      {!isOpen && <span style={{ fontSize: 9 }}>준비중</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            {modules.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#5b4fff', marginBottom: 8 }}>학습모듈 선택</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {modules.map(mod => {
                    const isModuleOpen = OPEN_MODULES.includes(mod.title);
                    return (
                      <div key={mod.id} onClick={() => { if (!isModuleOpen) return; setSelectedModule(mod); setSummary(''); setSummaryLevel(null); setQuestion(null); setQuestionError(''); setSelectedOption(null); setSubmitted(false); setExplanation(''); }}
                        style={{ fontSize: 12, padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${selectedModule?.id === mod.id ? '#5b4fff' : '#e4e4f0'}`, background: selectedModule?.id === mod.id ? '#ede9ff' : '#fff', color: !isModuleOpen ? '#ccc' : selectedModule?.id === mod.id ? '#5b4fff' : '#666', cursor: isModuleOpen ? 'pointer' : 'not-allowed', fontWeight: selectedModule?.id === mod.id ? 700 : 400, opacity: isModuleOpen ? 1 : 0.6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {mod.title.replace('문화예술 ', '').replace('문화콘텐츠 ', '')}
                        {!isModuleOpen && <span style={{ fontSize: 9 }}>준비중</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {chapters.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#5b4fff', marginBottom: 8 }}>학습 단원 선택</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {chapters.map(ch => (
                    <div key={ch.id} onClick={() => selectChapterAndClose(ch)}
                      style={{ fontSize: 12, padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${selectedChapter?.id === ch.id ? '#5b4fff' : '#e4e4f0'}`, background: selectedChapter?.id === ch.id ? '#ede9ff' : '#fff', color: selectedChapter?.id === ch.id ? '#5b4fff' : '#666', cursor: 'pointer', fontWeight: selectedChapter?.id === ch.id ? 700 : 400 }}>
                      {ch.title}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div onClick={() => setSelectorOpen(true)}
            style={{ background: '#fff', border: '1px solid #e4e4f0', borderRadius: 12, padding: '10px 14px', marginBottom: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontSize: 12, color: '#3a3a52', display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
              <span style={{ flexShrink: 0 }}>📍</span>
              <span style={{ fontWeight: 600, color: '#5b4fff', flexShrink: 0 }}>{selectedTrack}</span>
              <span style={{ color: '#ccc', flexShrink: 0 }}>›</span>
              <span style={{ flexShrink: 0 }}>{selectedModule?.title.replace('문화예술 ', '').replace('문화콘텐츠 ', '')}</span>
              <span style={{ color: '#ccc', flexShrink: 0 }}>›</span>
              <span style={{ fontWeight: 700, color: '#0f0f1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedChapter?.title}</span>
            </div>
            <span style={{ fontSize: 11, color: '#5b4fff', fontWeight: 700, flexShrink: 0, background: '#ede9ff', padding: '4px 10px', borderRadius: 20 }}>변경</span>
          </div>
        )}

        {/* 학습 탭 */}
        {activeTab === 'learn' && (
          <div>
            <div style={{ background: '#0f0f1a', borderRadius: 12, padding: '24px 20px', marginBottom: 16, color: '#fff' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#5b4fff', marginBottom: 8 }}>{selectedTrack} · NCS 학습모듈</div>
              <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>{selectedChapter?.title || '단원을 선택해주세요'}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>원하는 요약 단계를 선택해주세요</div>
            </div>

            {guestSummaryLocked && (
              <div style={{ background: '#fff', border: '1.5px solid #5b4fff', borderRadius: 12, padding: 24, textAlign: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f0f1a', marginBottom: 8 }}>모든 학습 요약은 로그인 후 확인 가능해요</div>
                <div style={{ fontSize: 13, color: '#7a7a96', marginBottom: 16 }}>3개 단원까지 체험하셨어요, 더 보려면 로그인해주세요</div>
                <div onClick={() => window.location.href = '/login'}
                  style={{ display: 'inline-block', background: '#5b4fff', color: '#fff', fontSize: 13, fontWeight: 700, padding: '10px 24px', borderRadius: 20, cursor: 'pointer' }}>
                  로그인하고 계속하기
                </div>
              </div>
            )}

            {!guestSummaryLocked && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {SUMMARY_LEVELS.map(lv => (
                  <div key={lv.key} onClick={() => selectedChapter && loadSummary(selectedChapter, lv.key)}
                    style={{ flex: 1, textAlign: 'center', padding: '12px 0', borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 700, border: `1.5px solid ${summaryLevel === lv.key ? '#5b4fff' : '#e4e4f0'}`, background: summaryLevel === lv.key ? '#5b4fff' : '#fff', color: summaryLevel === lv.key ? '#fff' : '#666' }}>
                    {lv.label}
                  </div>
                ))}
              </div>
            )}

            {loadingSummary && (
              <div style={{ background: '#fff', border: '1px solid #e4e4f0', borderRadius: 12, padding: 24, textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginBottom: 8 }}>
                  {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#5b4fff', animation: `bounce 1.1s ${i*0.18}s infinite` }} />)}
                </div>
                <div style={{ fontSize: 13, color: '#999' }}>불러오는 중입니다...</div>
              </div>
            )}

            {summary && !loadingSummary && (
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
                                <thead><tr>{headers.map((h, j) => <th key={j} style={{ background: '#f0f0f4', padding: '6px 10px', textAlign: 'left', borderBottom: '2px solid #e4e4f0', fontWeight: 700, color: '#0f0f1a' }}>{h.trim().replace(/\*\*(.*?)\*\*/g, '$1')}</th>)}</tr></thead>
                                <tbody>{rows.map((row, j) => <tr key={j}>{row.map((cell, k) => <td key={k} style={{ padding: '6px 10px', borderBottom: '1px solid #f0f0f4', color: '#3a3a52' }}>{cell.trim().replace(/\*\*(.*?)\*\*/g, '$1')}</td>)}</tr>)}</tbody>
                              </table>
                            </div>
                          );
                        }
                        continue;
                      }
                      if (line.startsWith('[') && line.endsWith(']')) {
                        result.push(<div key={i} style={{ fontWeight: 700, color: '#0f0f1a', marginTop: 16, marginBottom: 8, fontSize: 14, borderBottom: '1px solid #e4e4f0', paddingBottom: 4 }}>{line.slice(1,-1)}</div>);
                      } else if (line.startsWith('# ') || line.startsWith('## ') || line.startsWith('### ')) {
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
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#2d2d4e' }}>{value}</div>
                  <div style={{ fontSize: 11, color: '#7a7a96', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>

            {guestLimitReached && !question && (
              <div style={{ background: '#fff', border: '1.5px solid #5b4fff', borderRadius: 12, padding: 24, textAlign: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f0f1a', marginBottom: 8 }}>이 단원은 이미 체험하셨어요</div>
                <div style={{ fontSize: 13, color: '#7a7a96', marginBottom: 16 }}>로그인하면 모든 단원의 문제를 제한 없이 풀 수 있어요</div>
                <div onClick={() => window.location.href = '/login'}
                  style={{ display: 'inline-block', background: '#5b4fff', color: '#fff', fontSize: 13, fontWeight: 700, padding: '10px 24px', borderRadius: 20, cursor: 'pointer' }}>
                  로그인하고 계속하기
                </div>
              </div>
            )}

            {!guestLimitReached && !loadingQuestion && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#7a7a96', marginBottom: 6 }}>
                  난이도 선택 {!manualDifficulty && `(추천: ${DIFFICULTIES.find(d => d.key === getRecommendedDifficulty())?.label})`}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {DIFFICULTIES.map(d => {
                    const isRecommended = !manualDifficulty && d.key === getRecommendedDifficulty();
                    const isActive = manualDifficulty === d.key || isRecommended;
                    return (
                      <div key={d.key} onClick={() => loadQuestion(d.key)}
                        style={{ flex: 1, textAlign: 'center', padding: '12px 0', borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 700, border: `1.5px solid ${isActive ? '#5b4fff' : '#e4e4f0'}`, background: isActive ? '#5b4fff' : '#fff', color: isActive ? '#fff' : '#666' }}>
                        {d.label}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {questionError && !loadingQuestion && (
              <div style={{ background: '#fff', border: '1px solid #ffd1d1', borderRadius: 12, padding: 24, textAlign: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 13, color: '#ff4d6d', fontWeight: 700, marginBottom: 4 }}>아직 이 난이도의 문제가 준비되지 않았어요</div>
                <div style={{ fontSize: 12, color: '#999' }}>다른 난이도를 선택해보세요</div>
              </div>
            )}

            {loadingQuestion && (
              <div style={{ background: '#fff', border: '1px solid #e4e4f0', borderRadius: 12, padding: 24, textAlign: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginBottom: 8 }}>
                  {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#5b4fff', animation: `bounce 1.1s ${i*0.18}s infinite` }} />)}
                </div>
                <div style={{ fontSize: 13, color: '#999' }}>문제를 불러오는 중입니다...</div>
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
                    ) : explanation === 'LOCKED' ? (
                      <div>
                        <span style={{ fontWeight: 700, color: selectedOption === question.answer_index ? '#00c896' : '#ff4d6d' }}>{selectedOption === question.answer_index ? '✅ 정답' : '❌ 오답'}</span>
                        <div style={{ marginTop: 12, padding: 14, background: '#fff', border: '1px dashed #d4caff', borderRadius: 8, textAlign: 'center' }}>
                          <div style={{ fontSize: 13, color: '#5b4fff', fontWeight: 700, marginBottom: 8 }}>🔒 상세 해설은 로그인 후 확인 가능해요</div>
                          <div onClick={() => window.location.href = '/login'}
                            style={{ display: 'inline-block', background: '#5b4fff', color: '#fff', fontSize: 12, fontWeight: 700, padding: '8px 18px', borderRadius: 20, cursor: 'pointer' }}>
                            로그인하고 해설 보기
                          </div>
                        </div>
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
                  <button onClick={() => loadQuestion(manualDifficulty || getRecommendedDifficulty())}
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
