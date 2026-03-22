# Hanyang Canvas Tracker 🎓

한양대학교 학생들을 위한 Canvas LMS 과제 관리 및 푸시 알림 도구입니다.

## 🚀 주요 기능
- **실시간 과제 동기화**: 웹페이지에서 한양대학교 Canvas API를 통해 남은 과제 목록을 동기화합니다.
- **마감 임박 하이라이트**: 가장 가까운 마감 기한을 대시보드 상단에 시각적으로 강조하여 보여줍니다.
- **스마트폰 푸시 알림 연동**: `Pushover`와 Python 스크립트를 배포하여 스마트폰(iOS/Android)으로 언제 어디서든 과제 마감 알림을 즉시 받을 수 있습니다.

---

## 🛠️ 개발 및 빌드 (Web App)
이 프로젝트의 프론트엔드/백엔드는 React, Vite, Tailwind CSS 및 Firebase를 기반으로 구축되었습니다.

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 빌드
npm run build
```

---

## 📱 스마트폰 푸시 알림 설정 (Pushover)

웹 브라우저를 열지 않고도 노트북을 통해 스마트폰(iOS/Android)으로 직접 푸시 알림을 쏘고 싶다면 아래 파이썬 스크립트를 사용하세요.

### 1. 준비 사항
- **Pushover 앱 설치**: 폰에 다운로드 후 가입 및 30자리 **User Key** 복사.
- [pushover.net](https://pushover.net/) 에 로그인 후 하단에서 Application을 생성하여 **API Token** 발급.
- Python 3 환경에서 `requests` 라이브러리 설치 (`pip install requests`)

### 2. 스크립트 작성 및 실행
아래 코드를 `send_pushover.py`로 저장하세요. 소스코드 상단의 키 입력란에 위에서 확인한 토큰을 입력하고 파이썬을 실행하면 폰으로 띠링! 하고 알림이 옵니다.

```python
import requests
import sys

# ==========================================
# Pushover API 설정 (pushover.net 에서 발급)
# ==========================================
APP_TOKEN = "여기에_발급받은_APP_TOKEN_입력"
USER_KEY = "여기에_본인의_USER_KEY_입력"

def send_pushover_message(title, message):
    if APP_TOKEN.startswith("여기에_"):
        print("🚨 오류: send_pushover.py 파일에 APP_TOKEN과 USER_KEY를 먼저 입력해주세요!")
        return False

    url = "https://api.pushover.net/1/messages.json"
    data = {
        "token": APP_TOKEN,
        "user": USER_KEY,
        "title": title,
        "message": message,
        "sound": "pushover",
    }
    
    try:
        response = requests.post(url, data=data)
        response.raise_for_status()
        print("✅ 폰으로 Pushover 푸시 알림 전송 성공!")
        return True
    except Exception as e:
        print(f"❌ 푸시 알림 전송 실패: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) > 1:
        msg = " ".join(sys.argv[1:])
        send_pushover_message("터미널 알림", msg)
    else:
        send_pushover_message("테스트 알림 🚀", "노트북에서 파이썬 스크립트로 폰에 보낸 첫 푸시 알림입니다!")
```

위 템플릿과 로직을 활용해 기존의 크롤러 봇이나 다양한 과제 패치 스크립트에 이 함수 한 줄만 추가하시면 완벽한 "스마트폰 과제 알리미"를 구성할 수 있습니다.
