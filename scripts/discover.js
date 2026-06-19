// discover.js
// 키워드 검색으로 신규 영상을 발견해서 data/tracked.json에 추가합니다.
// search.list 비용: 키워드당 100 units. (config.json의 keywords 개수 x 100)
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.YOUTUBE_API_KEY;
if (!API_KEY) {
  console.error('YOUTUBE_API_KEY 환경변수가 없어요. GitHub Secrets에 등록했는지 확인하세요.');
  process.exit(1);
}

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');
const TRACKED_PATH = path.join(__dirname, '..', 'data', 'tracked.json');

function loadJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fallback; }
}

async function searchKeyword(keyword, maxResults) {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoDuration=short&q=${encodeURIComponent(keyword)}&maxResults=${maxResults}&order=viewCount&key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) {
    console.error(`검색 실패 (${keyword}):`, data.error.message);
    return [];
  }
  return data.items || [];
}

async function main() {
  const config = loadJson(CONFIG_PATH, { keywords: [], maxResultsPerKeyword: 15, maxTrackedVideos: 1000 });
  const tracked = loadJson(TRACKED_PATH, { videos: {} }); // videoId -> { channelId, channelName, title, publishedAt, firstSeen }

  let added = 0;
  for (const keyword of config.keywords) {
    const items = await searchKeyword(keyword, config.maxResultsPerKeyword || 15);
    for (const item of items) {
      const videoId = item.id.videoId;
      if (!videoId) continue;
      if (!tracked.videos[videoId]) {
        tracked.videos[videoId] = {
          channelId: item.snippet.channelId,
          channelName: item.snippet.channelTitle,
          title: item.snippet.title,
          publishedAt: item.snippet.publishedAt,
          firstSeen: new Date().toISOString(),
          discoveredVia: keyword
        };
        added++;
      }
    }
    // search.list 쿼터를 한 번에 너무 빨리 쓰지 않도록 살짝 대기
    await new Promise(r => setTimeout(r, 300));
  }

  // 추적 영상 수가 너무 많아지면 오래된 것부터 정리
  const ids = Object.keys(tracked.videos);
  const max = config.maxTrackedVideos || 1000;
  if (ids.length > max) {
    const sorted = ids.sort((a, b) =>
      new Date(tracked.videos[a].firstSeen) - new Date(tracked.videos[b].firstSeen)
    );
    const toRemove = sorted.slice(0, ids.length - max);
    toRemove.forEach(id => delete tracked.videos[id]);
  }

  fs.mkdirSync(path.dirname(TRACKED_PATH), { recursive: true });
  fs.writeFileSync(TRACKED_PATH, JSON.stringify(tracked, null, 2));
  console.log(`신규 발견: ${added}개, 전체 추적 영상: ${Object.keys(tracked.videos).length}개`);
}

main().catch(e => { console.error(e); process.exit(1); });
