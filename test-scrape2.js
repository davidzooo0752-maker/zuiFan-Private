const axios = require('axios');
const cheerio = require('cheerio');

async function check() {
    try {
        const res2 = await axios.get('https://mikanime.tv/');
        const $2 = cheerio.load(res2.data);
        console.log("MIKAN PROJECT:");
        $2('.sk-bangumi').each((i, el) => {
            const dayText = $2(el).parent().parent().find('.sk-week').text().trim() || 'Unknown Day';
            if (i < 2) {
                console.log("Found day block: ", $2(el).html().substring(0, 300));
            }
        });
        
        const res1 = await axios.get('https://www.anibk.com/date'); // Maybe they have a schedule page? Or homepage
        const $1 = cheerio.load(res1.data);
        console.log("ANIBK HOMEPAGE text snippet around 周一:");
        const text = $1('body').text().replace(/\s+/g, ' ');
        const index = text.indexOf('周一');
        if (index !== -1) {
            console.log(text.substring(index - 50, index + 200));
        } else {
            console.log("周一 not found on anibk homepage.");
        }
        
    } catch (e) {
        console.error(e.message);
    }
}
check();