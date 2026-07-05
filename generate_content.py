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
import re
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


def get_summary_content(chapter_id, level):
    res = requests.get(
        f"{SUPABASE_URL}/rest/v1/chapter_summaries",
        headers=HEADERS,
        params={"chapter_id": f"eq.{chapter_id}", "level": f"eq.{level}", "is_active": "eq.true", "select": "content"},
    )
    rows = res.json()
    return rows[0]["content"] if rows else None


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


def insert_summary(chapter_id, level, content, terms=None):
    payload = {"chapter_id": chapter_id, "level": level, "content": content}
    if terms is not None:
        payload["highlight_terms"] = terms
    requests.post(
        f"{SUPABASE_URL}/rest/v1/chapter_summaries",
        headers=HEADERS,
        json=payload,
    )


def get_summary_terms(chapter_id):
    res = requests.get(
        f"{SUPABASE_URL}/rest/v1/chapter_summaries",
        headers=HEADERS,
        params={"chapter_id": f"eq.{chapter_id}", "level": "eq.detailed", "is_active": "eq.true", "select": "highlight_terms"},
    )
    rows = res.json()
    return rows[0].get("highlight_terms") if rows else None


def update_highlight_terms(chapter_id, terms):
    requests.patch(
        f"{SUPABASE_URL}/rest/v1/chapter_summaries",
        headers=HEADERS,
        params={"chapter_id": f"eq.{chapter_id}", "level": "eq.detailed", "is_active": "eq.true"},
        json={"highlight_terms": terms},
    )


def parse_terms(key_points_text):
    terms = []
    for line in key_points_text.split("\n"):
        line = line.strip()
        if not line:
            continue
        line = re.sub(r'^[\d]+[\.\)]\s*', '', line)
        line = re.sub(r'^[-•]\s*', '', line)
        term = re.split(r'[:：]', line, maxsplit=1)[0].strip()
        if term and len(term) <= 30:
            terms.append(term)
    return terms


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

# 1단계: 원문에서 핵심 항목 추출 (중요도 판단 기준 명시)
def extract_key_points(chapter):
    prompt = (
        f'다음은 NCS 문화예술경영 학습모듈 "{chapter["title"]}"의 원문입니다:\n\n'
        f'{chapter["content"]}\n\n'
        f'이 원문에서 학습자가 반드시 알아야 할 핵심 개념·수치·절차를 12~15개, 우선순위 순으로 뽑으세요. '
        f'NCS 시험에 나올 가능성이 높은 것, 실무 현장에서 반복적으로 쓰이는 것을 우선하세요. '
        f'각 항목은 "개념명: 왜 중요한지 한 줄" 형식으로 작성하세요.'
    )
    return call_claude(prompt, max_tokens=1500)


# 2단계: 추출된 핵심 항목을 중심으로 "상세" 버전 작성
def generate_detailed(chapter, key_points):
    prompt = (
        f'다음은 NCS 문화예술경영 학습모듈 "{chapter["title"]}"의 원문과, '
        f'그 안에서 미리 선별한 핵심 항목 목록입니다.\n\n'
        f'[원문]\n{chapter["content"]}\n\n'
        f'[핵심 항목 목록 - 우선순위 순]\n{key_points}\n\n'
        f'위 핵심 항목 목록을 중심으로 아래 형식에 맞춰 학습자료를 작성하세요. '
        f'목록에 없는 사소한 내용은 과감히 생략해도 됩니다. '
        f'마크다운 기호(**,##) 없이 작성하고, 표가 필요하면 | 기호를 사용하세요. '
        f'원본 내용의 90% 수준으로 충분히 상세하게 작성하세요.\n\n'
        f'[학습 목표]\n• 목표1\n• 목표2\n\n'
        f'[핵심 개념]\n• 개념1: 설명\n• 개념2: 설명\n• 개념3: 설명\n• 개념4: 설명\n\n'
        f'[주요 내용]\n내용에 표가 있으면 표로 정리하고, 단계나 절차가 있으면 번호 목록으로 정리하세요.\n\n'
        f'[반드시 기억할 포인트]\n① 포인트1\n② 포인트2\n③ 포인트3'
    )
    return call_claude(prompt, max_tokens=8000)


# 3단계: "상세" 버전을 원본 삼아 요약·키워드 파생
DERIVE_PROMPTS = {
    "keyword": (
        '다음은 "{title}" 단원의 상세 학습자료입니다:\n\n{source}\n\n'
        '위 자료의 [주요 내용]에 나온 섹션 구성과 순서를 그대로 유지하면서 키워드 정리본을 만드세요. '
        '섹션을 새로 나누거나 순서를 바꾸지 마세요 — 상세 자료의 목차와 반드시 동일해야 합니다. '
        '각 섹션 제목 아래에 그 섹션의 핵심 키워드·개념명 3~5개만 나열하세요. 설명 문장은 절대 붙이지 마세요 — '
        '이미 학습한 사람이 보고 스스로 기억을 떠올리는 용도이니, 단어나 짧은 구(句) 형태로만 작성하세요.'
    ),
}

DERIVE_MAX_TOKENS = {"keyword": 2000}

SUMMARY_FROM_KEYWORD_PROMPT = (
    '다음은 "{title}" 단원의 키워드 정리본입니다:\n\n{keyword_text}\n\n'
    '위 키워드 정리본의 섹션 구성·순서·키워드 항목을 그대로 유지하면서, '
    '각 키워드 옆에 1~2줄의 간략한 설명을 추가하세요. '
    '새로운 키워드를 추가하거나 순서를 바꾸지 마세요. '
    '"키워드: 설명" 형태의 목록으로, 섹션 제목은 그대로 유지하세요. '
    '설명은 반드시 1~2줄로 짧게 유지하세요. 마크다운 기호 없이 작성하세요.'
)


def generate_from_detailed(chapter, detailed_text, level):
    prompt = DERIVE_PROMPTS[level].format(title=chapter["title"], source=detailed_text)
    return call_claude(prompt, max_tokens=DERIVE_MAX_TOKENS[level])


def generate_summary_from_keyword(chapter, keyword_text):
    prompt = SUMMARY_FROM_KEYWORD_PROMPT.format(title=chapter["title"], keyword_text=keyword_text)
    return call_claude(prompt, max_tokens=3000)


def generate_summaries(chapter):
    existing = existing_summary_levels(chapter["id"])

    if "detailed" not in existing:
        try:
            key_points = extract_key_points(chapter)
            detailed_text = generate_detailed(chapter, key_points)
            terms = parse_terms(key_points)
            insert_summary(chapter["id"], "detailed", detailed_text, terms=terms)
            print(f"  [완료] detailed 요약 (하이라이트 용어 {len(terms)}개 포함)")
        except Exception as e:
            print(f"  [실패] detailed 요약: {e}")
            detailed_text = None
    else:
        print("  [건너뜀] detailed 요약 - 이미 있음")
        detailed_text = get_summary_content(chapter["id"], "detailed")
        if not get_summary_terms(chapter["id"]):
            try:
                key_points = extract_key_points(chapter)
                terms = parse_terms(key_points)
                update_highlight_terms(chapter["id"], terms)
                print(f"  [완료] highlight_terms 백필: {len(terms)}개 용어 (내용은 그대로)")
            except Exception as e:
                print(f"  [실패] highlight_terms 백필: {e}")

    if not detailed_text:
        print("  [중단] 상세 버전이 없어 키워드/요약 파생을 건너뜁니다")
        return

    # 키워드: 상세 버전을 원본 삼아 파생
    if "keyword" not in existing:
        try:
            keyword_text = generate_from_detailed(chapter, detailed_text, "keyword")
            insert_summary(chapter["id"], "keyword", keyword_text)
            print("  [완료] keyword 요약 (상세 기반 파생)")
        except Exception as e:
            print(f"  [실패] keyword 요약: {e}")
            keyword_text = None
        time.sleep(1)
    else:
        print("  [건너뜀] keyword 요약 - 이미 있음")
        keyword_text = get_summary_content(chapter["id"], "keyword")

    # 요약: 키워드 버전에 설명을 붙여서 파생
    if "summary" not in existing:
        if not keyword_text:
            print("  [중단] 키워드 버전이 없어 요약 파생을 건너뜁니다")
        else:
            try:
                text = generate_summary_from_keyword(chapter, keyword_text)
                insert_summary(chapter["id"], "summary", text)
                print("  [완료] summary 요약 (키워드 기반 파생)")
            except Exception as e:
                print(f"  [실패] summary 요약: {e}")
    else:
        print("  [건너뜀] summary 요약 - 이미 있음")


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

TEST_CHAPTER_TITLE = "1-1. 문화예술환경 분석"  # 테스트 끝나면 이 줄과 아래 필터 제거

def main():
    module_id = get_module_id()
    chapters = get_chapters(module_id)
    chapters = [c for c in chapters if c["title"] == TEST_CHAPTER_TITLE]
    print(f"총 {len(chapters)}개 챕터 발견 (테스트 모드: {TEST_CHAPTER_TITLE}만)\n")

    for idx, chapter in enumerate(chapters, 1):
        print(f"=== [{idx}/{len(chapters)}] {chapter['title']} ===")
        generate_summaries(chapter)
        generate_questions(chapter)
        print()

    print("전체 완료!")


if __name__ == "__main__":
    main()
