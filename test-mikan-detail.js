const axios = require('axios');
const cheerio = require('cheerio');

async function check() {
    try {
        const res = await axios.get('https://mikanime.tv/Home/Bangumi/3906', { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(res.data);
        console.log("Subtitle Groups:");
        $('.subgroup-text').each((i, el) => {
            console.log($(el).text().trim());
        });
        // If .subgroup-text doesn't exist, let's look for other classes
        if ($('.subgroup-text').length === 0) {
            console.log("No .subgroup-text found. Looking at title structure...");
            // Let's print the HTML of the main container
            console.log($('.central-container').html()?.substring(0, 1000) || $('body').html().substring(0, 1000));
        }
    } catch (e) {
        console.error(e.message);
    }
}
check();