const axios = require('axios');
const cheerio = require('cheerio');

async function testMikanStructure() {
    try {
        const res = await axios.get('https://mikanime.tv/Home/Bangumi/3899', { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(res.data);
        
        $('.subgroup-text').each((i, el) => {
            let name = $(el).text().trim().replace(/\s+/g, ' ');
            // Remove '已订阅', '订阅', '订阅设置', '订阅语言' texts that are in the dropdown
            name = name.split(' 已订阅')[0].split(' 订阅')[0].trim();
            
            // The corresponding table ID is usually derived from the subtitle group id
            // Let's find the nearest `.table-striped`
            const containerId = $(el).attr('id');
            // Actually, Mikan usually has a `.subgroup-text` in the left navbar and then the main content has the tables.
            console.log("Subgroup Name:", name);
        });

        // Another way is to look at `.central-container .bangumi-list` or something.
        // Each table is under a `div` that represents the subgroup.
        $('.table-striped').each((i, el) => {
            const parentId = $(el).parent().attr('id');
            const subgroupText = $(el).parent().find('.subgroup-text').text().trim().replace(/\s+/g, ' ').split(' 已订阅')[0].split(' 订阅')[0].trim();
            console.log(`Table ID: ${parentId}, Internal Subgroup Text: ${subgroupText}`);
            
            // Let's print the first row's title, magnet, size and time.
            const firstRow = $(el).find('tbody tr').first();
            const title = firstRow.find('a.magnet-link-wrap').text().trim() || firstRow.find('td').first().text().trim();
            const magnet = firstRow.find('a.js-magnet').attr('data-clipboard-text');
            const size = firstRow.find('td').eq(1).text().trim();
            const time = firstRow.find('td').eq(2).text().trim();
            console.log(`  Row: [${size}] [${time}] ${title.substring(0,30)}... \n  Magnet: ${magnet}`);
        });

    } catch (e) {
        console.error(e.message);
    }
}
testMikanStructure();