// refresh.js
// data/tracked.json에 있는 영상들의 현재 조회수를 가져와 data/history.json에 누적합니다.
// videos.list 비용: 50개씩 묶어서 1 unit. (추적 영상 수 / 50, 올림)
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.YOUTUBE_API_KEY;
if (!API_KEY) {
  console.error('YOUTUBE_API_KEY 환경변수가 없어요. GitHub Secrets에 등록했는지 확인하세요.');
  process.exit(1);
}

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');
const TRACKED_PATH = path.join(__dirname, '..', 'data', 'tracked.json');
const HISTORY_PATH = path.join(__dirname, '..', 'data', 'history.json');

function loadJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fallback; }
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchStats(ids) {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${ids.join(',')}&key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) {
    console.error('videos.list 실패:', data.error.message);
    return [];
  }
  return data.items || [];
}

async function main() {
  const config = loadJson(CONFIG_PATH, { historyPointsPerVideo: 60 });
  const tracked = loadJson(TRACKED_PATH, { videos: {} });
  const history = loadJson(HISTORY_PATH, { points: {} }); // videoId -> [{ ts, views, likes, comments }]

  const ids = Object.keys(tracked.videos);
  if (!ids.length) {
    console.log('추적 중인 영상이 없어요. discover.js를 먼저 실행하세요.');
    return;
  }

  const now = new Date().toISOString();
  const maxPoints = config.historyPointsPerVideo || 60;
  let updated = 0;

  for (const idGroup of chunk(ids, 50)) {
    const items = await fetchStats(idGroup);
    for (const item of items) {
      const views = parseInt(item.statistics.viewCount || 0);
      const likes = parseInt(item.statistics.likeCount || 0);
      const comments = parseInt(item.statistics.commentCount || 0);
      if (!history.points[item.id]) history.points[item.id] = [];
      history.points[item.id].push({ ts: now, views, likes, comments });
      if (history.points[item.id].length > maxPoints) {
        history.points[item.id] = history.points[item.id].slice(-maxPoints);
      }
      updated++;
    }
  }

  // 더 이상 추적 목록에 없는 영상의 히스토리는 정리
  Object.keys(history.points).forEach(id => {
    if (!tracked.videos[id]) delete history.points[id];
  });

  fs.mkdirSync(path.dirname(HISTORY_PATH), { recursive: true });
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
  console.log(`조회수 갱신: ${updated}개 영상, 시각: ${now}`);
}

main().catch(e => { console.error(e); process.exit(1); });
