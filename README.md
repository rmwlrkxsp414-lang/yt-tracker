# YouTube 쇼츠 영상 자동 추적기

GitHub Actions로 키워드 기반 신규 영상 발견 + 2시간마다 조회수 기록을 자동화합니다.
집 PC를 켜둘 필요 없이 GitHub이 무료로 스케줄을 돌려줍니다.

## 1. 셋업

1. 이 폴더를 새 GitHub 저장소로 만듭니다 (private 권장 — public이어도 동작하지만 API 키 노출에 더 신경 써야 함).
   ```
   git init
   git add .
   git commit -m "init"
   git remote add origin <본인 저장소 URL>
   git push -u origin main
   ```
2. 저장소 Settings → Secrets and variables → Actions → New repository secret
   - Name: `YOUTUBE_API_KEY`
   - Value: 본인의 YouTube Data API v3 키
3. Settings → Actions → General → Workflow permissions → "Read and write permissions" 체크 (workflow가 결과를 커밋하려면 필요)

## 2. 동작 확인

- Actions 탭 → `discover-videos` → Run workflow (수동 실행) 으로 먼저 한 번 돌려서 `data/tracked.json`이 채워지는지 확인
- 이후 `refresh-views`도 수동 실행해서 `data/history.json`이 채워지는지 확인
- 정상이면 그대로 두면 cron에 따라 자동 실행됩니다 (discover 하루 5회, refresh 2시간마다)

## 3. 앱에서 데이터 읽기

저장소를 push하면 아래 주소로 history.json을 공개로 읽을 수 있습니다 (raw.githubusercontent.com):

```
https://raw.githubusercontent.com/<본인계정>/<저장소명>/main/data/history.json
```

쇼츠 채널 탐색기 앱(youtube-analyzer_3.html) 상단의 `REMOTE_HISTORY_URL` 변수에 이 주소를 넣으면,
앱이 페이지를 열 때 이 데이터를 자동으로 가져와서 영상 랭킹 탭의 그래프에 반영합니다.

저장소가 private이면 raw 주소가 인증 없이는 안 열리니, 이 기능을 쓰려면 데이터 저장용 저장소만 public으로 분리하는 걸 권장합니다.

## 4. API 쿼터 참고

- discover (검색): 키워드 15개 × 하루 5회 × 100 units = 7,500 units/일
- refresh (조회수 갱신): 추적 영상 약 1,000개 기준 50개씩 묶음 → 20회 호출 × 하루 12회 × 1 unit = 240 units/일
- 합계 약 7,740 units/일 (기본 할당량 10,000의 약 77%)

키워드 수나 빈도를 바꾸려면 `config.json`을 수정하세요.
