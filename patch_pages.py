import json

with open("src/locales/ko/pages.json", "r", encoding="utf-8") as f:
    pages = json.load(f)

# The user provided the new content for the about page in the markdown:
# "작은 반복 작업을 쉽게 끝내도록 ..."
# Actually, the user's prompt text for /about was:
"""
작은 반복 작업을 쉽게 끝내도록

Worklazy Tools는 파일을 합치고, 내용을 비교하고, 공유할 자료를 정리하는 반복 작업을 브라우저에서 처리하도록 만든 도구 모음입니다. 간단한 작업을 위해 여러 프로그램을 오가야 하는 번거로움을 줄이는 데 초점을 맞췄습니다.

전문 편집 프로그램의 모든 기능을 대신하지는 않습니다. 각 도구에서 지원하는 파일과 보존 범위를 안내하고, 결과를 직접 확인할 수 있도록 제공합니다. HWP·오피스 같은 편집기는 공개된 편집 구성요소를 활용하며, 사용한 구성요소와 고지는 라이선스 페이지에서 확인할 수 있습니다.
"""

pages["about"]["title"] = "작은 반복 작업을 쉽게 끝내도록"
pages["about"]["description"] = "Worklazy Tools는 파일을 합치고, 내용을 비교하고, 공유할 자료를 정리하는 반복 작업을 브라우저에서 처리하도록 만든 도구 모음입니다. 간단한 작업을 위해 여러 프로그램을 오가야 하는 번거로움을 줄이는 데 초점을 맞췄습니다."

pages["about"]["localDescription"] = "선택한 파일, 입력한 암호와 작업 결과는 외부 서버로 전송되지 않습니다. HWP·오피스의 복구용 로컬 초안이나 프로그램 파일 등 명시된 캐시를 제외하고 탭을 닫으면 작업 데이터도 지워집니다."

pages["about"]["appearanceDescription"] = "사용 환경에 맞춰 라이트 모드, 다크 모드와 고대비 테마 등을 수동으로 선택할 수 있습니다."

pages["about"]["items"] = {
  "uploadTitle": "업로드하지 않음", "uploadDescription": "파일과 암호 처리는 브라우저 내부에서만 진행됩니다.",
  "accountTitle": "계정이 필요 없음", "accountDescription": "로그인하거나 개인정보를 입력할 필요가 없습니다.",
  "transparentTitle": "투명한 도구", "transparentDescription": "전문 편집 프로그램의 모든 기능을 대신하지는 않으며 각 도구에서 지원하는 파일과 보존 범위를 안내합니다."
}

with open("src/locales/ko/pages.json", "w", encoding="utf-8") as f:
    json.dump(pages, f, ensure_ascii=False, indent=2)
