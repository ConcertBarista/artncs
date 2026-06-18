import pdfplumber
import urllib.request
import json
import os
import re

SUPABASE_URL = 'https://ebkwxouncjozrihnsypf.supabase.co'

env = {}
with open(os.path.expanduser('~/artncs/.env.local')) as f:
    for line in f:
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip()

SERVICE_KEY = env.get('SUPABASE_SERVICE_KEY', '')

BASE_PATH = '/Users/konbapark/Desktop/# 강의자료/* NCS 자료'

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

def find_toc_page(pdf):
    """차례 페이지 찾기 - 1-1. 형태 패턴이 2개 이상 있는 페이지"""
    for page_num in range(len(pdf.pages)):
        text = pdf.pages[page_num].extract_text()
        if not text:
            continue
        hits = re.findall(r'\d+-\d+\.', text)
        if len(hits) >= 2:
            return page_num, text
    return None, None

def parse_toc(toc_text):
    """차례 텍스트에서 챕터 제목과 페이지 번호 추출"""
    toc = []
    # 패턴: 1-1. 제목 ... 숫자 또는 1-1. 제목 숫자
    pattern = re.compile(r'^(\d+-\d+)\.\s+(.+?)\s+(\d+)\s*$', re.MULTILINE)
    
    for match in pattern.finditer(toc_text):
        chapter_num = match.group(1)
        chapter_title = match.group(2).strip()
        start_page = int(match.group(3))
        
        # 교수학습방법, 평가, 참고자료 제외
        skip_words = ['교수・학습', '• 평가', '참고 자료', '학습모듈의 개요']
        if any(w in chapter_title for w in skip_words):
            continue
        
        toc.append({
            'num': chapter_num,
            'title': f'{chapter_num}. {chapter_title}',
            'start_page': start_page
        })
    
    return toc

def find_page_offset(pdf, toc_page_num):
    """PDF 물리적 페이지와 문서 내 페이지 번호의 오프셋 계산"""
    # 차례 다음 페이지들에서 페이지 번호 찾기
    for page_num in range(toc_page_num + 1, min(toc_page_num + 5, len(pdf.pages))):
        text = pdf.pages[page_num].extract_text()
        if not text:
            continue
        lines = text.strip().split('\n')
        for line in [lines[0], lines[-1]]:
            line = line.strip()
            if line.isdigit() and 1 <= int(line) <= 10:
                doc_page = int(line)
                offset = page_num - doc_page
                return offset
    return toc_page_num  # 기본값

def extract_chapter_content(pdf, start_page, end_page, offset):
    """페이지 범위의 텍스트 추출"""
    texts = []
    for page_num in range(len(pdf.pages)):
        doc_page = page_num - offset
        if start_page <= doc_page < end_page:
            text = pdf.pages[page_num].extract_text()
            if text:
                texts.append(text)
    return '\n'.join(texts)

# 전체 처리
for folder_name, track_code in TRACKS.items():
    folder_path = os.path.join(BASE_PATH, folder_name)
    if not os.path.exists(folder_path):
        print(f'⚠️  폴더 없음: {folder_path}')
        continue
    
    pdf_files = sorted([f for f in os.listdir(folder_path) if f.endswith('.pdf') and not f.startswith('report')])
    
    for pdf_file in pdf_files:
        parts = pdf_file.replace('.pdf', '').split('_')
        if len(parts) < 3:
            continue
        
        num = parts[1]
        code = f'{track_code}{num}'
        
        url = f'{SUPABASE_URL}/rest/v1/modules?code=eq.{code}&select=id'
        modules = supabase_get(url, headers)
        if not modules:
            print(f'⚠️  모듈 없음: {code}')
            continue
        
        module_id = modules[0]['id']
        pdf_path = os.path.join(folder_path, pdf_file)
        
        print(f'\n📄 처리 중: {pdf_file} ({code})')
        
        with pdfplumber.open(pdf_path) as pdf:
            # 차례 페이지 찾기
            toc_page_num, toc_text = find_toc_page(pdf)
            
            if toc_page_num is None:
                print(f'  ⚠️  차례 페이지 없음 - 건너뜀')
                continue
            
            print(f'  📋 차례 페이지: {toc_page_num + 1}번째')
            
            # 차례 파싱
            toc = parse_toc(toc_text)
            
            if not toc:
                print(f'  ⚠️  차례 파싱 실패')
                print(f'  차례 텍스트:\n{toc_text[:500]}')
                continue
            
            print(f'  챕터 {len(toc)}개 발견:')
            for t in toc:
                print(f'    {t["title"]} (p.{t["start_page"]})')
            
            # 페이지 오프셋 계산
            offset = find_page_offset(pdf, toc_page_num)
            print(f'  페이지 오프셋: {offset}')
            
            # 기존 챕터 삭제
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
            
            # 각 챕터 내용 추출 및 삽입
            for i, chapter in enumerate(toc):
                start_page = chapter['start_page']
                end_page = toc[i+1]['start_page'] if i+1 < len(toc) else 9999
                
                content = extract_chapter_content(pdf, start_page, end_page, offset)
                
                if len(content) < 100:
                    print(f'  ⚠️  내용 부족: {chapter["title"]}')
                    continue
                
                data = {
                    'module_id': module_id,
                    'title': chapter['title'],
                    'order_num': i + 1,
                    'content': content
                }
                status = supabase_post(f'{SUPABASE_URL}/rest/v1/chapters', data, headers)
                if status:
                    print(f'  ✅ {chapter["title"]}')

print('\n\n🎉 전체 완료!')