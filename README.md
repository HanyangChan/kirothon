# Hanyang Canvas Tracker 🎓

한양대학교 학생들을 위한 Canvas LMS 과제 관리 및 알림 도구입니다.

## 🚀 주요 기능
- **실시간 과제 동기화**: 한양대학교 Canvas API를 통해 과제 목록을 가져옵니다.
- **마감 임박 하이라이트**: 가장 가까운 마감 기한을 대시보드 상단에 강조하여 보여줍니다.
- **macOS 네이티브 알림**: Python 스크립트를 사용하여 맥북 데스크탑에서 직접 알림을 받을 수 있습니다.

---

## 🍎 macOS 데스크탑 알림 설정 (Python)

웹 브라우저를 열지 않고도 맥북 우측 상단에서 과제 알림을 받고 싶다면 아래 스크립트를 사용하세요.

### 1. 준비 사항
- **Python 3**가 설치되어 있어야 합니다.
- API 호출을 위해 `requests` 라이브러리를 설치해야 합니다.
  ```bash
  pip install requests
  ```

### 2. Canvas API 토큰 발급
1. [한양대학교 Canvas](https://learning.hanyang.ac.kr/) 로그인
2. **계정 > 설정** 메뉴 이동
3. **+ 새 액세스 토큰** 버튼 클릭하여 토큰 생성 및 복사

### 3. 스크립트 실행
아래 코드를 `canvas_notify.py`로 저장한 후 실행하세요. (웹 앱의 설정 메뉴에서도 복사할 수 있습니다.)

```python
import requests
import os
from datetime import datetime

# 설정
CANVAS_DOMAIN = 'https://learning.hanyang.ac.kr'
ACCESS_TOKEN = 'YOUR_ACCESS_TOKEN_HERE' # 여기에 발급받은 토큰 입력

def send_notification(title, message):
    command = f'display notification "{message}" with title "{title}" sound name "Glass"'
    os.system(f"osascript -e '{command}'")

def get_todo():
    endpoint = f"{CANVAS_DOMAIN}/api/v1/users/self/todo"
    headers = {"Authorization": f"Bearer {ACCESS_TOKEN}"}
    try:
        res = requests.get(endpoint, headers=headers, timeout=10)
        res.raise_for_status()
        items = res.json()
        assignments = []
        for item in items:
            if item.get('type') == 'assignment' and 'assignment' in item:
                data = item['assignment']
                if data.get('due_at'):
                    assignments.append({
                        'name': data['name'],
                        'due_at': datetime.strptime(data['due_at'], '%Y-%m-%dT%H:%M:%SZ')
                    })
        assignments.sort(key=lambda x: x['due_at'])
        return assignments
    except Exception as e:
        print(f"Error: {e}")
        return None

def main():
    assignments = get_todo()
    if not assignments:
        send_notification("Canvas 알림", "남은 과제가 없습니다!")
    else:
        urgent = assignments[0]
        due_str = urgent['due_at'].strftime('%m월 %d일 %H:%M')
        send_notification("Canvas 마감 임박!", f"{urgent['name']}\n마감: {due_str}")

if __name__ == "__main__":
    main()
```

---

## 🛠️ 개발 및 빌드
이 프로젝트는 React, Vite, Tailwind CSS 및 Firebase를 사용하여 구축되었습니다.

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 빌드
npm run build
```
