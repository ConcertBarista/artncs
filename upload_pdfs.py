import pdfplumber
import urllib.request
import json
import os
import re

SUPABASE_URL = 'https://ebkwxouncjozrihnsypf.supabase.co'

# .env.local에서 키 읽기
env = {}
with open(os.path.expanduser('~/artncs/.env.local')) as f:
    for line in f:
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip()

SERVICE_KEY = env.get('SUPABASE_SERVICE_KEY', '')

# PDF 폴더 경로
BASE_PATH = '/Users/konbapark/Desktop/# 강의자료/* NCS 자료'

# 분야별 폴더명과 트랙 코드 매핑
TRACKS = {
    '문화예술경영': 'M',
    '문화예술기획': 'P',
    '문화예술행정': 'A',
    '문화콘텐츠기획': 'C',
}

def supabase_get(url, headers):
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read())

def supabase_post(url, data, headers):
    req = urllib.request.Request(
        url, data=json.dumps(data).encode('utf-8'),
        headers=headers, method='POST'
    )
    try:
        with urllib.request.urlopen(req) as res:
            return res.status
    except Exception as e:
        print(f'  ❌ POST 실패: {e}')
        return None

headers = {
    'apikey': SERVICE_KEY,
    'Authorization': f'Bearer {SERVICE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
}

def extract_chapters(pdf_path):
    """PDF에서 챕터별로 텍스트 추출"""
    chapters = []
    current_title = None
    current_text = []
    
    # 챕터 패턴: 1-1., 1-2., 2-1. 등
    chapter_pattern = re.compile(r'^(\d+-\d+)\.\s+(.+)')
    
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if not text:
                continue
            
            for line in text.split('\n'):
                line = line.strip()
                match = chapter_pattern.match(line)
                if match:
                    # 이전 챕터 저장
                    if current_title and current_text:
                        chapters.append({
                            'title': current_title,
                            'content': '\n'.join(current_text).strip()
                        })
                    current_title = line
                    current_text = []
                else:
                    if current_title:
                        current_text.append(line)
        
        # 마지막 챕터 저장
        if current_title and current_text:
            chapters.append({
                'title': current_title,
                'content': '\n'.join(current_text).strip()
            })
    
    return chapters

# 전체 처리
for folder_name, track_code in TRACKS.items():
    folder_path = os.path.join(BASE_PATH, folder_name)
    if not os.path.exists(folder_path):
        print(f'⚠️  폴더 없음: {folder_path}')
        continue
    
    pdf_files = sorted([f for f in os.listdir(folder_path) if f.endswith('.pdf')])
    
    for pdf_file in pdf_files:
        # 파일명에서 번호 추출: 문화예술경영_01_경영전략수립.pdf
        parts = pdf_file.replace('.pdf', '').split('_')
        if len(parts) < 3:
            print(f'⚠️  파일명 형식 오류: {pdf_file}')
            continue
        
        num = parts[1]  # '01'
        code = f'{track_code}{num}'  # 'M01'
        
        # module_id 조회
        url = f'{SUPABASE_URL}/rest/v1/modules?code=eq.{code}&select=id'
        modules = supabase_get(url, headers)
        
        if not modules:
            print(f'⚠️  모듈 없음: {code}')
            continue
        
        module_id = modules[0]['id']
        pdf_path = os.path.join(folder_path, pdf_file)
        
        print(f'\n📄 처리 중: {pdf_file} ({code})')
        
        # 기존 챕터 삭제 (재업로드 방지)
        del_req = urllib.request.Request(
            f'{SUPABASE_URL}/rest/v1/chapters?module_id=eq.{module_id}',
            headers={**headers, 'Content-Type': 'application/json'},
            method='DELETE'
        )
        try:
            with urllib.request.urlopen(del_req) as res:
                pass
        except:
            pass
        
        # PDF 파싱
        chapters = extract_chapters(pdf_path)
        
        if not chapters:
            print(f'  ⚠️  챕터 추출 실패')
            continue
        
        # 챕터 삽입
        for i, ch in enumerate(chapters):
            data = {
                'module_id': module_id,
                'title': ch['title'],
                'order_num': i + 1,
                'content': ch['content']
            }
            status = supabase_post(
                f'{SUPABASE_URL}/rest/v1/chapters',
                data, headers
            )
            if status:
                print(f'  ✅ {ch["title"]}')

print('\n\n🎉 전체 완료!')