const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

const normalizeStr = (str) => {
    if (!str) return '';
    return str.replace(/[\(（\[【].*?[\)）\]】]/g, '').replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').toLowerCase().trim();
};

const fuzzyMatch = (str1, str2) => {
    const n1 = normalizeStr(str1), n2 = normalizeStr(str2);
    if (!n1 || !n2) return false;
    return n1 === n2 || n1.includes(n2) || n2.includes(n1);
};

const parseEpNum = (str) => { const match = str.match(/(\d+)/); return match ? parseInt(match[1]) : null; };

let cachedData = { monday:[], tuesday:[], wednesday:[], thursday:[], friday:[], saturday:[], sunday:[], recent:[] }, lastScrapeTime = 0, isScraping = false;
let broadcastStatusCache = new Map();

async function scrapeAll() {
    if (isScraping) return cachedData;
    isScraping = true;
    console.log(">>> 正在启动 Mikan 首页秒级同步...");
    try {
        const [anibkRes, mikanRes] = await Promise.all([
            axios.get('https://www.anibk.com/', { headers: { 'User-Agent': 'Mozilla/5.0' } }).catch(() => null),
            axios.get('https://mikanani.me/', { headers: { 'User-Agent': 'Mozilla/5.0' } }).catch(() => null)
        ]);

        const mikanRealtimeItems = [];
        if (mikanRes && mikanRes.data) {
            const $mikan = cheerio.load(mikanRes.data);
            // 改进：使用更通用的选择器，抓取页面上所有带 ID 的番剧项
            $mikan('.js-expand_bangumi').each((_, el) => {
                const $li = $mikan(el).closest('li');
                const title = $li.find('.an-text').attr('title') || $li.find('.an-text').text().trim();
                const bId = $mikan(el).attr('data-bangumiid');
                const updateTime = $li.find('.date-text').text().trim() || "刚刚";
                let img = $mikan(el).attr('data-src') || $li.find('img').attr('src');
                
                if (img) {
                    if (img.startsWith('//')) img = 'https:' + img;
                    else if (img.startsWith('/')) img = 'https://mikanani.me' + img;
                }
                
                if (title && bId) {
                    mikanRealtimeItems.push({ title, id: bId, img, updateTime });
                }
            });
        }
        
        // 兜底：如果首页没抓到，尝试解析整个页面的 a 标签
        if (mikanRealtimeItems.length === 0 && mikanRes && mikanRes.data) {
            console.log(">>> 首页标准解析失败，启动深度 DOM 扫描...");
            const $mikan = cheerio.load(mikanRes.data);
            $mikan('a[href*="/Home/Bangumi/"]').each((_, a) => {
                const href = $mikan(a).attr('href');
                const title = $mikan(a).attr('title') || $mikan(a).text().trim();
                const bId = href.split('/').pop();
                if (title && bId && !mikanRealtimeItems.find(it => it.id === bId)) {
                    mikanRealtimeItems.push({ title, id: bId, img: null, updateTime: "已更新" });
                }
            });
        }

        console.log(`>>> Mikan 首页实时获取到 ${mikanRealtimeItems.length} 条更新`);

        const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'recent'];
        const data = {};
        dayKeys.forEach(k => data[k] = []);

        const updatesFound = [];
        if (anibkRes && anibkRes.data) {
            const $anibk = cheerio.load(anibkRes.data);
            const processSection = (selector, dayKey) => {
                $anibk(selector).each((i, el) => {
                    const title = $anibk(el).find('.char-bk-title a').attr('title');
                    if (!title) return;
                    const rawEp = $anibk(el).find('.k').last().text().trim();
                    let broadcastEp = parseEpNum(rawEp) || 1;
                    let img = $anibk(el).find('.char-bk-pic img').attr('data-src') || $anibk(el).find('.char-bk-pic img').attr('src');
                    if (img && img.startsWith('//')) img = 'https:' + img;

                    // 在首页实时流中寻找匹配
                    let matchedMikan = mikanRealtimeItems.find(m => fuzzyMatch(title, m.title));
                    
                    let subtitleUpdates = null, mikanId = null;
                    if (matchedMikan) {
                        mikanId = matchedMikan.id;
                        subtitleUpdates = { updateTime: matchedMikan.updateTime, count: broadcastEp };
                        if (!img) img = matchedMikan.img;
                    }

                    // 实时推送逻辑
                    const cacheKey = `${title}_${dayKey}`;
                    if (matchedMikan) {
                        const prev = broadcastStatusCache.get(cacheKey) || { time: "" };
                        if (matchedMikan.updateTime !== prev.time) {
                            updatesFound.push({ title, episode: broadcastEp, groupName: "首页新发布" });
                            broadcastStatusCache.set(cacheKey, { time: matchedMikan.updateTime });
                        }
                    }

                    let timeText = $anibk(el).find('.v.fs.tm').text().trim();
                    if (dayKey === 'recent' || !timeText) {
                        timeText = $anibk(el).find('.fs-italic').first().text().trim() || "近期";
                    }

                    data[dayKey].push({ title, img, time: timeText, ep: rawEp, subtitleUpdates, mikanId, groupName: "最新资源", episode: broadcastEp });
                });
            };
            for (let day = 1; day <= 7; day++) processSection(`#wk-bk-${day} > li`, dayKeys[day - 1]);
            processSection('.wt-bk-list-zxsy > li', 'recent');
        }

        cachedData = data;
        lastScrapeTime = Date.now();
        if (updatesFound.length > 0) io.emit('new_update', updatesFound);
        console.log(`>>> 实时同步完成。`);
    } catch (e) {
        console.error("Scrape Error:", e.message);
    } finally {
        isScraping = false;
    }
    return cachedData;
}

scrapeAll();
setInterval(scrapeAll, 180000);

app.get('/api/schedule', async (req, res) => {
    res.json({ success: true, data: cachedData, lastUpdate: lastScrapeTime });
});

app.get('/api/subtitles/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const resMikan = await axios.get(`https://mikanani.me/Home/Bangumi/${id}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(resMikan.data);
        const data = [];
        $('.table-striped').each((i, table) => {
            let prev = $(table).parent().prev();
            let groupName = '';
            while (prev && prev.length) {
                if (prev.hasClass('subgroup-text')) {
                    groupName = prev.text().trim();
                    break;
                }
                prev = prev.prev();
            }
            if (groupName) {
                groupName = groupName.split(' 已订阅')[0].split(' 订阅')[0].replace(/\s+/g, ' ').trim();
            }
            if (!groupName) {
                const firstTitle = $(table).find('tbody tr').first().find('a.magnet-link-wrap').text().trim();
                const match = firstTitle.match(/^[\[【「](.*?)[\]】」]/);
                groupName = match ? match[1].trim() + "字幕组" : "其他资源";
            }
            const resources = [];
            $(table).find('tbody tr').each((j, row) => {
                const magnet = $(row).find('a.js-magnet').attr('data-clipboard-text');
                if (magnet) {
                    resources.push({ 
                        title: $(row).find('a.magnet-link-wrap').text().trim() || "无标题", 
                        magnet, 
                        size: $(row).find('td').eq(2).text().trim() || "-", 
                        time: $(row).find('td').eq(3).text().trim() || "-" 
                    });
                }
            });
            if (resources.length > 0) data.push({ groupName, resources });
        });
        res.json({ success: true, data });
    } catch (error) { res.status(500).json({ success: false, error: 'Failed' }); }
});

server.listen(PORT, () => { console.log(`Server is running at http://localhost:${PORT}`); });