const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Explicitly serve index.html for the root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Helper to normalize strings for comparison
const normalizeStr = (str) => {
    if (!str) return '';
    // Heavy normalization: remove season info, common tags, and non-alphanumeric chars
    return str.replace(/第[一二三四五六七八九十\d]+[季期]/g, '')
              .replace(/season\s*\d+/gi, '')
              .replace(/part\s*\d+/gi, '')
              .replace(/s\d+/gi, '')
              .replace(/（僅限.*?）|（仅限.*?）/g, '')
              .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '')
              .toLowerCase();
};

const fuzzyMatch = (str1, str2) => {
    const n1 = normalizeStr(str1);
    const n2 = normalizeStr(str2);
    if (!n1 || !n2) return false;
    if (n1 === n2 || n1.includes(n2) || n2.includes(n1)) return true;
    
    // Check for 85% similarity in longer strings
    if (n1.length > 4 && n2.length > 4) {
        const minLen = Math.min(n1.length, n2.length);
        const overlap = n1.substring(0, Math.floor(minLen * 0.85)) === n2.substring(0, Math.floor(minLen * 0.85));
        if (overlap) return true;
    }
    return false;
};

let cachedData = null;
let lastScrapeTime = 0;

async function scrapeAll() {
    try {
        console.log("Starting background scrape...");
        const [anibkRes, mikanRes, mikanClassicRes] = await Promise.all([
            axios.get('https://www.anibk.com/', { headers: { 'User-Agent': 'Mozilla/5.0' } }).catch(e => null),
            axios.get('https://mikanime.tv/', { headers: { 'User-Agent': 'Mozilla/5.0' } }).catch(e => null),
            axios.get('https://mikanime.tv/Home/Classic', { headers: { 'User-Agent': 'Mozilla/5.0' } }).catch(e => null)
        ]);

        const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'recent'];
        const data = {};
        const allMikanItems = [];
        dayKeys.forEach(k => data[k] = []);

        if (mikanRes && mikanRes.data) {
            const $mikan = cheerio.load(mikanRes.data);
            let currentDayKey = 'unknown';
            $mikan('.sk-bangumi').children().each((i, el) => {
                const $el = $mikan(el);
                const id = $el.attr('id');
                if (id && id.startsWith('data-row-')) {
                    const day = parseInt(id.split('-').pop());
                    if (day >= 1 && day <= 7) currentDayKey = dayKeys[day - 1];
                    else if (day === 0) currentDayKey = 'sunday';
                    else if (day === 8) currentDayKey = 'recent';
                } else if ($el.hasClass('an-box')) {
                    $el.find('li').each((j, li) => {
                        const title = $mikan(li).find('a.an-text').attr('title');
                        let img = $mikan(li).find('span.js-expand_bangumi').attr('data-src');
                        if (img && !img.startsWith('http')) img = 'https://mikanime.tv' + img;
                        const updateTime = $mikan(li).find('.date-text').text().trim();
                        const count = $mikan(li).find('.num-node').text().trim() || "1";
                        const bangumiId = $mikan(li).find('span.js-expand_bangumi').attr('data-bangumiid');
                        if (title) {
                            allMikanItems.push({ 
                                title, img, updateTime, count, id: bangumiId, 
                                matched: false, originalDay: currentDayKey !== 'unknown' ? currentDayKey : 'recent' 
                            });
                        }
                    });
                }
            });
        }

        if (mikanClassicRes && mikanClassicRes.data) {
            const $classic = cheerio.load(mikanClassicRes.data);
            $classic('.table-striped tbody tr').each((i, el) => {
                if (i > 100) return; 
                const id = $classic(el).find('.magnet-link-wrap').first().attr('href')?.split('/').pop();
                if (id) {
                    const existing = allMikanItems.find(m => m.id === id);
                    if (existing) {
                        existing.hasRecentRelease = true; 
                        if (!existing.count || existing.count === "") existing.count = "最新";
                    }
                }
            });
        }

        if (anibkRes && anibkRes.data) {
            const $anibk = cheerio.load(anibkRes.data);
            for (let day = 1; day <= 7; day++) {
                const dayKey = dayKeys[day - 1];
                $anibk(`#wk-bk-${day} > li`).each((i, el) => {
                    const title = $anibk(el).find('.char-bk-title a').attr('title');
                    if (!title) return;
                    let img = $anibk(el).find('.char-bk-pic img').attr('data-src') || $anibk(el).find('.char-bk-pic img').attr('data-original') || $anibk(el).find('.char-bk-pic img').attr('src');
                    if (img && img.startsWith('//')) img = 'https:' + img;
                    const time = $anibk(el).find('.v.fs.tm').text().trim();
                    const ep = $anibk(el).find('.k').last().text().trim();
                    let subtitleUpdates = null;
                    for (let mItem of allMikanItems) {
                        if (fuzzyMatch(title, mItem.title)) {
                            if (mItem.count || mItem.hasRecentRelease) {
                                subtitleUpdates = { updateTime: mItem.updateTime || "最近更新", count: mItem.count || "新", id: mItem.id };
                            }
                            mItem.matched = true;
                            break;
                        }
                    }
                    data[dayKey].push({ title, img, time, ep, subtitleUpdates, source: 'anibk' });
                });
            }
            $anibk('.wt-bk-list-zxsy > li').each((i, el) => {
                const title = $anibk(el).find('.char-bk-title a').attr('title');
                if (!title) return; 
                let img = $anibk(el).find('.char-bk-pic img').attr('data-src') || $anibk(el).find('.char-bk-pic img').attr('data-original') || $anibk(el).find('.char-bk-pic img').attr('src');
                if (img && img.startsWith('//')) img = 'https:' + img;
                const time = $anibk(el).find('.fs-italic.fs-gray').text().trim() || '近期上映';
                const ep = '新上映';
                let subtitleUpdates = null;
                for (let mItem of allMikanItems) {
                    if (fuzzyMatch(title, mItem.title)) {
                        if (mItem.count || mItem.hasRecentRelease) {
                            subtitleUpdates = { updateTime: mItem.updateTime || "最近更新", count: mItem.count || "新", id: mItem.id };
                        }
                        mItem.matched = true;
                        break;
                    }
                }
                data['recent'].push({ title, img, time, ep, subtitleUpdates, source: 'anibk' });
            });
        }

        for (let mItem of allMikanItems) {
            if (!mItem.matched && (mItem.count || mItem.hasRecentRelease)) {
                data[mItem.originalDay].push({
                    title: mItem.title, img: mItem.img, time: mItem.originalDay === 'recent' ? '近期更新' : '', ep: '',
                    subtitleUpdates: { updateTime: mItem.updateTime || "最近更新", count: mItem.count || "新", id: mItem.id },
                    source: 'mikan'
                });
            }
        }
        cachedData = data;
        lastScrapeTime = Date.now();
        console.log("Scrape completed successfully.");
    } catch (e) {
        console.error("Scrape Error:", e.message);
    }
}

// Initial scrape and interval every 5 minutes
scrapeAll();
setInterval(scrapeAll, 300000);

app.get('/api/schedule', async (req, res) => {
    if (cachedData) {
        res.json({ success: true, data: cachedData, lastUpdate: lastScrapeTime });
    } else {
        // Fallback for first request if cache empty
        await scrapeAll();
        res.json({ success: true, data: cachedData, lastUpdate: lastScrapeTime });
    }
});

app.get('/api/subtitles/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const resMikan = await axios.get(`https://mikanime.tv/Home/Bangumi/${id}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(resMikan.data);
        const data = [];
        $('.table-striped').each((i, table) => {
            let groupName = $(table).parent().find('.subgroup-text').text().trim().replace(/\s+/g, ' ');
            groupName = groupName.split(' 已订阅')[0].split(' 订阅')[0].trim();
            if (!groupName) {
                const firstTitle = $(table).find('tbody tr').first().find('a.magnet-link-wrap').text().trim() || $(table).find('tbody tr').first().find('td').first().text().trim();
                const match = firstTitle.match(/^[\[【](.*?)[\]】]/);
                groupName = (match && match[1]) ? match[1].trim() + "字幕组" : "其他资源";
            }
            const resources = [];
            $(table).find('tbody tr').each((j, row) => {
                let title = $(row).find('a.magnet-link-wrap').text().trim() || $(row).find('td').first().text().trim().replace(/\[复制磁连\]/, '').trim();
                const magnet = $(row).find('a.js-magnet').attr('data-clipboard-text');
                const size = $(row).find('td').eq(1).text().trim();
                const time = $(row).find('td').eq(2).text().trim();
                if (magnet) resources.push({ title, magnet, size, time });
            });
            if (resources.length > 0) data.push({ groupName, resources });
        });
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});