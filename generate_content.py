"""
ArtNCS 콘텐츠 배치 생성 스크립트
- 대상: 문화예술경영 트랙 > 경영전략수립 모듈
- 생성물: 챕터별 학습요약 3단계(상세/요약/키워드) + 문제 유형×난이도별 5개
- 이미 생성된 항목은 건너뛰므로, 중간에 실패해도 다시 실행하면 이어서 채워집니다.

실행 전 준비:
1. 이 파일을 프로젝트 최상위 폴더(.env.local과 같은 위치)에 저장하세요.
2. 터미널에서: pip install requests
3. 터미널에서: python3 generate_content.py
"""

import os
import time
import json
import requests

# ── 1. .env.local에서 키 읽어오기 (git에 올라가지 않는 안전한 방식) ──

def load_env_local(path=".env.local"):
    env = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            env[key.strip()] = value.strip().strip('"').strip("'")
    return env

env = load_env_local()
SUPABASE_URL = env["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_SERVICE_KEY = env["SUPABASE_SERVICE_KEY"]
ANTHROPIC_API_KEY = env["ANTHROPIC_API_KEY"]

HEADERS = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json",
}

# ── 2. 이번 배치 대상 설정 ──

TRACK = "문화예술경영"
MODULE_TITLE = "문화예술 경영전략수립"
TYPES = ["개념정의", "적용", "틀린것고르기", "빈칸채우기"]
DIFFICULTIES = ["easy", "medium", "hard"]
QUESTIONS_PER_BUCKET = 5

SUMMARY_PROMPTS = {
    "detailed": "원본 내용의 90% 수준으로 상세하게 요약하세요. 중요한 개념, 사례, 수치를 빠짐없이 포함하세요.",
    "summary": "원본 내용의 50% 수준으로 핵심만 요약하세요.",
    "keyword": "원본 내용의 20% 수준으로 핵심 키워드와 한 줄 설명 위주로 압축하세요.",
}

DIFFICULTY_LABEL = {"easy": "기본", "medium": "중급", "hard": "심화"}


# ── 3. Claude API 호출 ──

def call_claude(prompt, max_tokens=1500):
    res = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
        },
        json={
            "model": "claude-sonnet-4-6",
            "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=120,
    )
    data = res.json()
    content = data.get("content")
    if not content:
        raise Exception(f"API 응답 이상: {data}")
    return content[0].get("text", "")


# ── 4. Supabase 조회/저장 ──

def get_module_id():
    res = requests.get(
        f"{SUPABASE_URL}/rest/v1/modules",
        headers=HEADERS,
        params={"track": f"eq.{TRACK}", "title": f"eq.{MODULE_TITLE}", "select": "id"},
    )
    rows = res.json()
    if not rows:
        raise Exception(f"모듈을 찾을 수 없습니다: {TRACK} / {MODULE_TITLE}")
    return rows[0]["id"]


def get_chapters(module_id):
    res = requests.get(
        f"{SUPABASE_URL}/rest/v1/chapters",
        headers=HEADERS,
        params={"module_id": f"eq.{module_id}", "select": "id,title,content", "order": "title"},
    )
    return res.json()


def existing_summary_levels(chapter_id):
    res = requests.get(
        f"{SUPABASE_URL}/rest/v1/chapter_summaries",
        headers=HEADERS,
        params={"chapter_id": f"eq.{chapter_id}", "is_active": "eq.true", "select": "level"},
    )
    return {row["level"] for row in res.json()}


def existing_question_count(chapter_id, qtype, difficulty):
    res = requests.get(
        f"{SUPABASE_URL}/rest/v1/chapter_questions",
        headers=HEADERS,
        params={
            "chapter_id": f"eq.{chapter_id}",
            "type": f"eq.{qtype}",
            "difficulty": f"eq.{difficulty}",
            "is_active": "eq.true",
            "select": "id",
        },
    )
    return len(res.json())


def insert_summary(chapter_id, level, content):
    requests.post(
        f"{SUPABASE_URL}/rest/v1/chapter_summaries",
        headers=HEADERS,
        json={"chapter_id": chapter_id, "level": level, "content": content},
    )


def insert_question(chapter_id, qtype, difficulty, question_data):
    requests.post(
        f"{SUPABASE_URL}/rest/v1/chapter_questions",
        headers=HEADERS,
        json={
            "chapter_id": chapter_id,
            "type": qtype,
            "difficulty": difficulty,
            "question_data": question_data,
        },
    )


# ── 5. 생성 로직 ──

def generate_summaries(chapter):
    existing = existing_summary_levels(chapter["id"])
    for level, instruction in SUMMARY_PROMPTS.items():
        if level in existing:
            print(f"  [건너뜀] {level} 요약 - 이미 있음")
            continue
        prompt = (
            f'다음은 NCS 문화예술경영 학습모듈 "{chapter["title"]}"의 내용입니다:\n\n'
            f'{chapter["content"]}\n\n'
            f'{instruction}\n'
            f'마크다운 기호(**,##) 없이 일반 텍스트로 작성하세요.'
        )
        try:
            text = call_claude(prompt, max_tokens=3000)
            insert_summary(chapter["id"], level, text)
            print(f"  [완료] {level} 요약")
        except Exception as e:
            print(f"  [실패] {level} 요약: {e}")
        time.sleep(1)


def generate_questions(chapter):
    for qtype in TYPES:
        for difficulty in DIFFICULTIES:
            have = existing_question_count(chapter["id"], qtype, difficulty)
            need = QUESTIONS_PER_BUCKET - have
            if need <= 0:
                print(f"  [건너뜀] {qtype}/{difficulty} - 이미 {have}개 있음")
                continue
            for i in range(need):
                prompt = (
                    f'다음은 NCS 문화예술경영 학습모듈 "{chapter["title"]}"의 내용입니다:\n\n'
                    f'{chapter["content"]}\n\n'
                    f'위 내용을 바탕으로 NCS 시험 문제를 만들어주세요.\n\n'
                    f'조건:\n'
                    f'- 문제 유형: 반드시 "{qtype}" 유형으로 만드세요\n'
                    f'- 난이도: {DIFFICULTY_LABEL[difficulty]}\n'
                    f'- 객관식 4지선다\n\n'
                    f'반드시 아래 JSON 형식으로만 답하세요 (다른 텍스트 없이):\n'
                    f'{{"type":"{qtype}","difficulty":"{DIFFICULTY_LABEL[difficulty]}",'
                    f'"question":"문제 텍스트","options":["선택지1","선택지2","선택지3","선택지4"],'
                    f'"answer_index":0,"explanation_correct":"정답 해설 2-3문장 (현장 맥락 포함)",'
                    f'"explanation_wrong":"오답 해설 2-3문장 (현장 맥락 포함)"}}'
                )
                try:
                    text = call_claude(prompt)
                    match = text[text.index("{"): text.rindex("}") + 1]
                    parsed = json.loads(match)
                    insert_question(chapter["id"], qtype, difficulty, parsed)
                    print(f"  [완료] {qtype}/{difficulty} #{have + i + 1}")
                except Exception as e:
                    print(f"  [실패] {qtype}/{difficulty} #{have + i + 1}: {e}")
                time.sleep(1)


# ── 6. 실행 ──

def main():
    module_id = get_module_id()
    chapters = get_chapters(module_id)
    print(f"총 {len(chapters)}개 챕터 발견\n")

    for idx, chapter in enumerate(chapters, 1):
        print(f"=== [{idx}/{len(chapters)}] {chapter['title']} ===")
        generate_summaries(chapter)
        generate_questions(chapter)
        print()

    print("전체 완료!")


if __name__ == "__main__":
    main()
