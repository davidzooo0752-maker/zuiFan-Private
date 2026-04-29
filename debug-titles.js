const axios = require('axios');
const cheerio = require('cheerio');

async function debug() {
    try {
        const res = await axios.get('https://mikanani.me/Home/Classic/0', { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(res.data);
        const row = $('.table-striped tbody tr').first();
        row.find('a').each((i, a) => {
            console.log(`Link ${i}: ${$(a).attr('href')}`);
        });
    } catch (e) {
        console.error("Error:", e.message);
    }
}

debug();