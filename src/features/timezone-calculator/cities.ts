export interface WorldCity {
  id: string;
  city: string;
  country: string;
  zone: string;
  coordinates: readonly [longitude: number, latitude: number];
}

export const WORLD_CITIES: readonly WorldCity[] = [
  { id: "seoul", city: "서울", country: "대한민국", zone: "Asia/Seoul", coordinates: [126.978, 37.5665] },
  { id: "tokyo", city: "도쿄", country: "일본", zone: "Asia/Tokyo", coordinates: [139.6917, 35.6895] },
  { id: "beijing", city: "베이징", country: "중국", zone: "Asia/Shanghai", coordinates: [116.4074, 39.9042] },
  { id: "hong-kong", city: "홍콩", country: "홍콩", zone: "Asia/Hong_Kong", coordinates: [114.1694, 22.3193] },
  { id: "taipei", city: "타이베이", country: "대만", zone: "Asia/Taipei", coordinates: [121.5654, 25.033] },
  { id: "manila", city: "마닐라", country: "필리핀", zone: "Asia/Manila", coordinates: [120.9842, 14.5995] },
  { id: "singapore", city: "싱가포르", country: "싱가포르", zone: "Asia/Singapore", coordinates: [103.8198, 1.3521] },
  { id: "bangkok", city: "방콕", country: "태국", zone: "Asia/Bangkok", coordinates: [100.5018, 13.7563] },
  { id: "jakarta", city: "자카르타", country: "인도네시아", zone: "Asia/Jakarta", coordinates: [106.8456, -6.2088] },
  { id: "new-delhi", city: "뉴델리", country: "인도", zone: "Asia/Kolkata", coordinates: [77.209, 28.6139] },
  { id: "dubai", city: "두바이", country: "아랍에미리트", zone: "Asia/Dubai", coordinates: [55.2708, 25.2048] },
  { id: "istanbul", city: "이스탄불", country: "튀르키예", zone: "Europe/Istanbul", coordinates: [28.9784, 41.0082] },

  { id: "london", city: "런던", country: "영국", zone: "Europe/London", coordinates: [-0.1276, 51.5072] },
  { id: "paris", city: "파리", country: "프랑스", zone: "Europe/Paris", coordinates: [2.3522, 48.8566] },
  { id: "berlin", city: "베를린", country: "독일", zone: "Europe/Berlin", coordinates: [13.405, 52.52] },
  { id: "amsterdam", city: "암스테르담", country: "네덜란드", zone: "Europe/Amsterdam", coordinates: [4.9041, 52.3676] },
  { id: "madrid", city: "마드리드", country: "스페인", zone: "Europe/Madrid", coordinates: [-3.7038, 40.4168] },
  { id: "rome", city: "로마", country: "이탈리아", zone: "Europe/Rome", coordinates: [12.4964, 41.9028] },
  { id: "warsaw", city: "바르샤바", country: "폴란드", zone: "Europe/Warsaw", coordinates: [21.0122, 52.2297] },
  { id: "stockholm", city: "스톡홀름", country: "스웨덴", zone: "Europe/Stockholm", coordinates: [18.0686, 59.3293] },
  { id: "athens", city: "아테네", country: "그리스", zone: "Europe/Athens", coordinates: [23.7275, 37.9838] },
  { id: "moscow", city: "모스크바", country: "러시아", zone: "Europe/Moscow", coordinates: [37.6173, 55.7558] },

  { id: "new-york", city: "뉴욕", country: "미국", zone: "America/New_York", coordinates: [-74.006, 40.7128] },
  { id: "los-angeles", city: "로스앤젤레스", country: "미국", zone: "America/Los_Angeles", coordinates: [-118.2437, 34.0522] },
  { id: "chicago", city: "시카고", country: "미국", zone: "America/Chicago", coordinates: [-87.6298, 41.8781] },
  { id: "toronto", city: "토론토", country: "캐나다", zone: "America/Toronto", coordinates: [-79.3832, 43.6532] },
  { id: "vancouver", city: "밴쿠버", country: "캐나다", zone: "America/Vancouver", coordinates: [-123.1207, 49.2827] },
  { id: "mexico-city", city: "멕시코시티", country: "멕시코", zone: "America/Mexico_City", coordinates: [-99.1332, 19.4326] },
  { id: "bogota", city: "보고타", country: "콜롬비아", zone: "America/Bogota", coordinates: [-74.0721, 4.711] },
  { id: "lima", city: "리마", country: "페루", zone: "America/Lima", coordinates: [-77.0428, -12.0464] },
  { id: "sao-paulo", city: "상파울루", country: "브라질", zone: "America/Sao_Paulo", coordinates: [-46.6333, -23.5505] },
  { id: "buenos-aires", city: "부에노스아이레스", country: "아르헨티나", zone: "America/Argentina/Buenos_Aires", coordinates: [-58.3816, -34.6037] },
  { id: "santiago", city: "산티아고", country: "칠레", zone: "America/Santiago", coordinates: [-70.6693, -33.4489] },

  { id: "sydney", city: "시드니", country: "호주", zone: "Australia/Sydney", coordinates: [151.2093, -33.8688] },
  { id: "melbourne", city: "멜버른", country: "호주", zone: "Australia/Melbourne", coordinates: [144.9631, -37.8136] },
  { id: "perth", city: "퍼스", country: "호주", zone: "Australia/Perth", coordinates: [115.8605, -31.9505] },
  { id: "auckland", city: "오클랜드", country: "뉴질랜드", zone: "Pacific/Auckland", coordinates: [174.7633, -36.8485] },
  { id: "honolulu", city: "호놀룰루", country: "미국", zone: "Pacific/Honolulu", coordinates: [-157.8583, 21.3069] },

  { id: "cairo", city: "카이로", country: "이집트", zone: "Africa/Cairo", coordinates: [31.2357, 30.0444] },
  { id: "casablanca", city: "카사블랑카", country: "모로코", zone: "Africa/Casablanca", coordinates: [-7.5898, 33.5731] },
  { id: "lagos", city: "라고스", country: "나이지리아", zone: "Africa/Lagos", coordinates: [3.3792, 6.5244] },
  { id: "nairobi", city: "나이로비", country: "케냐", zone: "Africa/Nairobi", coordinates: [36.8219, -1.2921] },
  { id: "johannesburg", city: "요하네스버그", country: "남아프리카공화국", zone: "Africa/Johannesburg", coordinates: [28.0473, -26.2041] },
  { id: "cape-town", city: "케이프타운", country: "남아프리카공화국", zone: "Africa/Johannesburg", coordinates: [18.4241, -33.9249] },
] as const;

export const CITY_BY_ID = new Map(WORLD_CITIES.map((city) => [city.id, city]));

const ENGLISH_CITY_NAMES: Record<string, string> = {
  seoul: "Seoul", tokyo: "Tokyo", beijing: "Beijing", "hong-kong": "Hong Kong", taipei: "Taipei", manila: "Manila", singapore: "Singapore", bangkok: "Bangkok", jakarta: "Jakarta", "new-delhi": "New Delhi", dubai: "Dubai", istanbul: "Istanbul",
  london: "London", paris: "Paris", berlin: "Berlin", amsterdam: "Amsterdam", madrid: "Madrid", rome: "Rome", warsaw: "Warsaw", stockholm: "Stockholm", athens: "Athens", moscow: "Moscow",
  "new-york": "New York", "los-angeles": "Los Angeles", chicago: "Chicago", toronto: "Toronto", vancouver: "Vancouver", "mexico-city": "Mexico City", bogota: "Bogotá", lima: "Lima", "sao-paulo": "São Paulo", "buenos-aires": "Buenos Aires", santiago: "Santiago",
  sydney: "Sydney", melbourne: "Melbourne", perth: "Perth", auckland: "Auckland", honolulu: "Honolulu", cairo: "Cairo", casablanca: "Casablanca", lagos: "Lagos", nairobi: "Nairobi", johannesburg: "Johannesburg", "cape-town": "Cape Town",
};

const ENGLISH_COUNTRY_NAMES: Record<string, string> = {
  seoul: "South Korea", tokyo: "Japan", beijing: "China", "hong-kong": "Hong Kong", taipei: "Taiwan", manila: "Philippines", singapore: "Singapore", bangkok: "Thailand", jakarta: "Indonesia", "new-delhi": "India", dubai: "United Arab Emirates", istanbul: "Türkiye",
  london: "United Kingdom", paris: "France", berlin: "Germany", amsterdam: "Netherlands", madrid: "Spain", rome: "Italy", warsaw: "Poland", stockholm: "Sweden", athens: "Greece", moscow: "Russia",
  "new-york": "United States", "los-angeles": "United States", chicago: "United States", toronto: "Canada", vancouver: "Canada", "mexico-city": "Mexico", bogota: "Colombia", lima: "Peru", "sao-paulo": "Brazil", "buenos-aires": "Argentina", santiago: "Chile",
  sydney: "Australia", melbourne: "Australia", perth: "Australia", auckland: "New Zealand", honolulu: "United States", cairo: "Egypt", casablanca: "Morocco", lagos: "Nigeria", nairobi: "Kenya", johannesburg: "South Africa", "cape-town": "South Africa",
};

export function cityName(city: WorldCity, language: "ko" | "en") {
  return language === "en" ? ENGLISH_CITY_NAMES[city.id] ?? city.city : city.city;
}

export function countryName(city: WorldCity, language: "ko" | "en") {
  return language === "en" ? ENGLISH_COUNTRY_NAMES[city.id] ?? city.country : city.country;
}
