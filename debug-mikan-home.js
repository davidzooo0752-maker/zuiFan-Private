const axios = require('axios');
const cheerio = require('cheerio');

async function debug() {
    try {
        const url = 'https://mikanani.me/';
        console.log(`Fetching ${url}...`);
        const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(res.data);
        
        console.log('Checking for .an-box...');
        const boxes = $('.an-box');
        console.log(`Found ${boxes.length} .an-box elements`);
        
        if (boxes.length > 0) {
            const firstBox = boxes.first();
            console.log('First box HTML (truncated):', firstBox.html().substring(0, 500));
            const items = firstBox.find('li');
            console.log(`Found ${items.length} items in first box`);
        } else {
            console.log('DOM structure might have changed. Printing body snippet:');
            console.log($('body').html().substring(0, 2000));
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}

debug();