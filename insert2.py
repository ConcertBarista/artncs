# -*- coding: utf-8 -*-
import urllib.request
import json
import os

SUPABASE_URL = 'https://ebkwxouncjozrihnsypf.supabase.co'

# .env.local 파일에서 키 읽기
env = {}
env_path = os.path.expanduser('~/artncs/.env.local')
with open(env_path, 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip()

SERVICE_KEY = env.get('SUPABASE_SERVICE_KEY', '')
print(f'Service key: {SERVICE_KEY[:20]}...')

# module_id 가져오기
req = urllib.request.Request(
    f'{SUPABASE_URL}/rest/v1/modules?code=eq.M05&select=id',
    headers={
        'apikey': SERVICE_KEY,
        'Authorization': f'Bearer {SERVICE_KEY}',
        'Content-Type': 'application/json'
    }
)
with urllib.request.urlopen(req) as res:
    modules = json.loads(res.read())

if not modules:
    print('ERROR: M05 모듈 없음')
    exit(1)

module_id = modules[0]['id']
print(f'Module ID: {module_id}')

# chapters_data.json 읽기
with open('/Users/konbapark/artncs/chapters_data.json', 'r', encoding='utf-8') as f:
    chapters = json.load(f)

# 챕터 삽입
for ch in chapters:
    data = {
        'module_id': module_id,
        'title': ch['title'],
        'order_num': ch['order_num'],
        'content': ch['content']
    }
    req = urllib.request.Request(
        f'{SUPABASE_URL}/rest/v1/chapters',
        data=json.dumps(data, ensure_ascii=False).encode('utf-8'),
        headers={
            'apikey': SERVICE_KEY,
            'Authorization': f'Bearer {SERVICE_KEY}',
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        },
        method='POST'
    )
    try:
        with urllib.request.urlopen(req) as res:
            print(f'OK: {ch["title"]}')
    except Exception as e:
        print(f'FAIL: {ch["title"]} - {e}')

print('완료!')
