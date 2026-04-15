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
    return str.replace(/（僅限.*?）|（仅限.*?）/g, '').replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').toLowerCase();
};
const extractNum = (str) => { const match = str.match(/(?:#|part|第|season)\s*(\d+)/i); return match ? parseInt(match[1]) : null; };
const parseEpNum = (str) => { const match = str.match(/(\d+)/); return match ? parseInt(match[1]) : null; };

const fuzzyMatch = (str1, str2) => {
    const n1 = normalizeStr(str1), n2 = normalizeStr(str2);
    if (!n1 || !n2) return false;
    const num1 = extractNum(str1), num2 = extractNum(str2);
    if (num1 !== null && num2 !== null && num1 !== num2) return false;
    if (n1 === n2 || n1.includes(n2) || n2.includes(n1)) return true;
    if (n1.length > 4 && n2.length > 4) {
        const minLen = Math.min(n1.length, n2.length);
        if (n1.substring(0, Math.floor(minLen * 0.8)) === n2.substring(0, Math.floor(minLen * 0.8))) return true;
    }
    return false;
};

let cachedData = null, lastScrapeTime = 0, isScraping = false;
let broadcastStatusCache = new Map();

async function scrapeAll() {
    if (isScraping) return cachedData;
    isScraping = true;
    console.log("Starting scrape...");
    try {
        const [anibkRes, mikanRes, mikanClassicRes] = await Promise.all([
            axios.get('https://www.anibk.com/', { headers: { 'User-Agent': 'Mozilla/5.0' } }).catch(e => null),
            axios.get('https://mikanani.me/', { headers: { 'User-Agent': 'Mozilla/5.0' } }).catch(e => null),
            axios.get('https://mikanani.me/Home/Classic', { headers: { 'User-Agent': 'Mozilla/5.0' } }).catch(e => null)
        ]);

        const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'recent'];
        const data = {};
        dayKeys.forEach(k => data[k] = []);
        const allMikanItems = [];
        const mikanEpIndex = new Map();

        if (mikanClassicRes && mikanClassicRes.data) {
            const $classic = cheerio.load(mikanClassicRes.data);
            $classic('.table-striped tbody tr').each((i, el) => {
                if (i > 200) return;
                const $tds = $classic(el).find('td');
                const gName = $tds.eq(1).find('a').text().trim() || "字幕组";
                const fTitle = $tds.eq(2).find('a.magnet-link-wrap').text().trim();
                const bId = $tds.eq(2).find('a.magnet-link-wrap').attr('href')?.split('/').pop();
                const epMatch = fTitle.match(/\[(\d{1,3})v?\d*\]|第\s*(\d{1,3})\s*[话集]|(?:EP|Episode)\s*(\d{1,3})|[-\s\.]0*(\d{1,3})(?:\s|\[|\.|$)/i);
                const rawNum = epMatch ? (epMatch[1] || epMatch[2] || epMatch[3] || epMatch[4]) : null;
                const epNum = rawNum ? parseInt(rawNum) : null;
                if (bId && epNum !== null && (!mikanEpIndex.has(bId) || !mikanEpIndex.get(bId).has(epNum))) {
                    if (!mikanEpIndex.has(bId)) mikanEpIndex.set(bId, new Map());
                    mikanEpIndex.get(bId).set(epNum, { groupName: gName });
                }
            });
        }

        if (mikanRes && mikanRes.data) {
            const $mikan = cheerio.load(mikanRes.data);
            $mikan('.an-box li').each((j, li) => {
                const title = $mikan(li).find('a.an-text').attr('title');
                const bId = $mikan(li).find('span.js-expand_bangumi').attr('data-bangumiid');
                let img = $mikan(li).find('span.js-expand_bangumi').attr('data-src') || $mikan(li).find('img').attr('src');
                if (img) {
                    if (img.startsWith('//')) img = 'https:' + img;
                    else if (img.startsWith('/')) img = 'https://mikanani.me' + img;
                }
                if (title && bId) allMikanItems.push({ title, id: bId, img, updateTime: $mikan(li).find('.date-text').text().trim() });
            });
        }

        const updatesFound = [];
        if (anibkRes && anibkRes.data) {
            const $anibk = cheerio.load(anibkRes.data);
            const processSection = (selector, dayKey) => {
                $anibk(selector).each((i, el) => {
                    const title = $anibk(el).find('.char-bk-title a').attr('title');
                    if (!title) return;
                    const rawEp = $anibk(el).find('.k').last().text().trim();
                    const currentBroadcastEp = parseEpNum(rawEp);
                    let img = $anibk(el).find('.char-bk-pic img').attr('data-src') || $anibk(el).find('.char-bk-pic img').attr('src');
                    if (img && img.startsWith('//')) img = 'https:' + img;

                    let subtitleUpdates = null, mikanId = null, mikanGroup = "字幕组", hasResource = false;
                    for (let mItem of allMikanItems) {
                        if (fuzzyMatch(title, mItem.title)) {
                            mikanId = mItem.id;
                            if (!img && mItem.img) img = mItem.img;
                            const resources = mikanEpIndex.get(mItem.id);
                            if (resources && currentBroadcastEp !== null && resources.has(currentBroadcastEp)) {
                                mikanGroup = resources.get(currentBroadcastEp).groupName;
                                hasResource = true;
                                subtitleUpdates = { updateTime: mItem.updateTime, count: currentBroadcastEp };
                            }
                            break;
                        }
                    }

                    const cacheKey = `${title}_${dayKey}`;
                    const prev = broadcastStatusCache.get(cacheKey) || { ep: 0, hasRes: false };
                    if (currentBroadcastEp !== null) {
                        const isNewEp = currentBroadcastEp > prev.ep;
                        const justGotRes = !prev.hasRes && hasResource;
                        if (isNewEp || justGotRes) {
                            updatesFound.push({ title, episode: currentBroadcastEp, groupName: hasResource ? `${mikanGroup}已更新` : "字幕组未更新" });
                            broadcastStatusCache.set(cacheKey, { ep: currentBroadcastEp, hasRes: hasResource });
                        }
                    }
                    data[dayKey].push({ title, img, time: $anibk(el).find('.v.fs.tm').text().trim(), ep: rawEp, subtitleUpdates, mikanId, groupName: mikanGroup, episode: currentBroadcastEp || 1 });
                });
            };
            for (let day = 1; day <= 7; day++) processSection(`#wk-bk-${day} > li`, dayKeys[day - 1]);
            processSection('.wt-bk-list-zxsy > li', 'recent');
        }

        cachedData = data;
        lastScrapeTime = Date.now();
        if (updatesFound.length > 0) io.emit('new_update', updatesFound);
        console.log("Scrape completed successfully.");
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
    const force = req.query.force === 'true';
    if (force || !cachedData) await scrapeAll();
    res.json({ success: true, data: cachedData, lastUpdate: lastScrapeTime, forced: force });
});

app.get('/api/subtitles/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const resMikan = await axios.get(`https://mikanani.me/Home/Bangumi/${id}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(resMikan.data);
        const data = [];
        $('.table-striped').each((i, table) => {
            let groupName = $(table).parent().find('.subgroup-text').text().trim().replace(/\s+/g, ' ');
            groupName = groupName.split(' 已订阅')[0].split(' 订阅')[0].trim() || "其他资源";
            const resources = [];
            $(table).find('tbody tr').each((j, row) => {
                const magnet = $(row).find('a.js-magnet').attr('data-clipboard-text');
                if (magnet) resources.push({ title: $(row).find('a.magnet-link-wrap').text().trim(), magnet, size: $(row).find('td').eq(1).text().trim(), time: $(row).find('td').eq(2).text().trim() });
            });
            if (resources.length > 0) data.push({ groupName, resources });
        });
        res.json({ success: true, data });
    } catch (error) { res.status(500).json({ success: false, error: 'Failed' }); }
});

server.listen(PORT, () => { console.log(`Server is running at http://localhost:${PORT}`); });