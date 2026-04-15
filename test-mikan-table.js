const axios = require('axios');
const cheerio = require('cheerio');

async function testMikanDetail() {
    try {
        const res = await axios.get('https://mikanime.tv/Home/Bangumi/3899', { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(res.data);
        
        const results = [];
        
        // It seems mikan detail page uses a tabbed or list structure for different subtitle groups
        // Usually, there is a `.subgroup-text` and a corresponding table.
        // Let's look for tables
        
        $('.bangumi-info').each((i, infoEl) => {
             // maybe `.bangumi-info` is the top area?
             console.log("Bangumi Info:", $(infoEl).text().trim().substring(0, 100));
        });
        
        // Groups might be separated by a container, like `.subgroup-text` is in a `.leftbar-nav` or similar?
        // Actually, looking at Mikan, each subtitle group has an id or class, and a table following it.
        let htmlSnippet = $('.central-container').html() || $('body').html();
        
        // Let's just parse tables and their preceding headings.
        // Usually, the structure is a div with an id that links to the group.
        
        $('.table-striped').each((i, table) => {
            const tableId = $(table).parent().attr('id');
            // Try to find the group name. It's usually in a preceding div or inside a linked tab.
            console.log("Found table:", tableId || "no-id");
            const rows = $(table).find('tbody tr');
            console.log("Rows count:", rows.length);
            if (rows.length > 0) {
                const firstRow = rows.first();
                console.log("First row text:", firstRow.text().trim().replace(/\s+/g, ' '));
                const magnet = firstRow.find('a.js-magnet').attr('data-clipboard-text');
                console.log("Magnet:", magnet);
            }
        });
        
    } catch (e) {
        console.error(e.message);
    }
}
testMikanDetail();