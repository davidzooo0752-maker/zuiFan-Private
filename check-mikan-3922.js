const axios = require('axios');
const cheerio = require('cheerio');

async function checkMikan() {
    try {
        const res = await axios.get('https://mikanime.tv/', { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(res.data);
        console.log("Mikan Homepage Items:");
        $('.js-expand_bangumi').each((i, el) => {
            const id = $(el).attr('data-bangumiid');
            const title = $(el).parent().find('a.an-text').attr('title');
            const count = $(el).parent().find('.num-node').text().trim();
            if (id === '3922' || (title && title.includes('茉莉花'))) {
                console.log(`FOUND: ID=${id}, Title=${title}, NewCount=${count}`);
            }
        });
    } catch (e) {
        console.error(e.message);
    }
}
checkMikan();