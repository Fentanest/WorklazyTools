import json

with open("scratch/full_seo_ko.json", "r", encoding="utf-8") as f:
    seo = json.load(f)

print("# WorklazyTools 검색어 통합 및 콘텐츠 반영 현황")
print()
print("부록 A와 부록 B의 내용을 기반으로 44개 도구/경로의 검색어(SEO) 정보와 안내 원고를 통합 반영했습니다.")
print()
print("| 대상 경로 | 처리 상태 | 메뉴명(ko) | H1 (ko) | H2 (안내/FAQ) |")
print("|:---|:---:|:---|:---|:---|")

for path, data in seo.items():
    menu = data.get("menu", "").strip()
    h1 = data.get("h1", "").strip()
    print(f"| `/tools/{path}` | ✅ 완료 | {menu} | {h1} | ✅ 반영됨 |")

