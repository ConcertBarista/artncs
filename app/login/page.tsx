'use client';

import { supabase } from '@/lib/supabase';

export default function LoginPage() {
const loginWithKakao = async () => {
  await supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: {
      redirectTo: 'https://artncs.vercel.app/auth/callback',
    },
  });
};

const loginWithGoogle = async () => {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'https://artncs.vercel.app/auth/callback',
    },
  });
};

  const s = { fontFamily: "'Apple SD Gothic Neo', sans-serif", background: '#f7f7fb', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' } as const;

  return (
    <div style={s}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '40px 32px', width: '100%', maxWidth: 400, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        {/* 로고 */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#0f0f1a' }}>Art<span style={{ color: '#5b4fff' }}>NCS</span></div>
          <div style={{ fontSize: 13, color: '#7a7a96', marginTop: 8 }}>문화예술 NCS 학습 플랫폼</div>
        </div>

        {/* 카카오 로그인 */}
        <button onClick={loginWithKakao}
          style={{ width: '100%', padding: '14px 0', background: '#FEE500', color: '#000', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>💬</span> 카카오로 시작하기
        </button>

        {/* 구글 로그인 */}
        <button onClick={loginWithGoogle}
          style={{ width: '100%', padding: '14px 0', background: '#fff', color: '#3a3a52', border: '1.5px solid #e4e4f0', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🇬</span> 구글로 시작하기
        </button>

        <div style={{ fontSize: 11, color: '#aaa', textAlign: 'center', marginTop: 24, lineHeight: 1.6 }}>
          로그인 시 <span style={{ color: '#5b4fff' }}>이용약관</span> 및 <span style={{ color: '#5b4fff' }}>개인정보처리방침</span>에 동의하게 됩니다.
        </div>
      </div>
    </div>
  );
}