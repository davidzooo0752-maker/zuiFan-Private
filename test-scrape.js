const axios = require('axios');
const cheerio = require('cheerio');

async function check() {
    try {
        const res1 = await axios.get('https://www.anibk.com/');
        const $1 = cheerio.load(res1.data);
        console.log("ANIBK TABS:", $1('.week-item').length ? "Has .week-item" : "No .week-item");
        console.log("ANIBK HTML SNIPPET:", $1('body').html().substring(0, 500));
        
        const res2 = await axios.get('https://mikanime.tv/');
        const $2 = cheerio.load(res2.data);
        console.log("MIKAN TABS:", $2('.sk-bangumi').length ? "Has .sk-bangumi" : "No .sk-bangumi");
    } catch (e) {
        console.error(e.message);
    }
}
check();