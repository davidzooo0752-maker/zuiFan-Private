const axios = require('axios');
const cheerio = require('cheerio');

async function debugMatch() {
    try {
        const res1 = await axios.get('https://www.anibk.com/', { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $1 = cheerio.load(res1.data);
        console.log("Searching Anibk...");
        $1('.char-bk-title a').each((i, el) => {
            const t = $1(el).attr('title');
            if (t && (t.includes('茉莉花') || t.includes('崩坏'))) {
                console.log("Anibk Match:", t);
            }
        });

        const res2 = await axios.get('https://mikanime.tv/', { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $2 = cheerio.load(res2.data);
        console.log("\nSearching Mikan Homepage...");
        $2('a.an-text').each((i, el) => {
            const t = $2(el).attr('title');
            if (t && (t.includes('茉莉花') || t.includes('崩坏'))) {
                console.log("Mikan Match:", t);
            }
        });
    } catch (e) {
        console.error(e.message);
    }
}
debugMatch();