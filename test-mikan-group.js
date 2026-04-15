const axios = require('axios');
const cheerio = require('cheerio');

async function testMikanGroup() {
    try {
        const res = await axios.get('https://mikanime.tv/Home/Bangumi/3899', { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(res.data);
        
        const data = [];
        
        // Mikan has an anchor system. 
        // Subgroup names are in .subgroup-text, inside a tag with id or class linking to the table.
        // Actually, the structure usually is:
        // <div class="subgroup-text" id="subgroup-123">Name</div>
        // And then the table is somewhere with an id matching or a structure matching.
        // Let's just find each `.subgroup-text` and find its corresponding table.
        
        $('.subgroup-text').each((i, el) => {
            // Get raw text
            const name = $(el).contents().filter(function() { return this.nodeType === 3; }).text().trim();
            // The table is usually related to an ID on the parent element
            // On mikanime, the left sidebar has links with `href="#TG123"` 
            // but the class is `.subgroup-text`. Let's see its parent or itself.
            const parentHref = $(el).parent().attr('href') || $(el).attr('href');
            // Actually, `.subgroup-text` might not have href.
            // Let's just look at `.table-striped`. The parent div usually has an id like `TG_123` or similar.
            console.log("Found Subgroup text:", name);
        });

        // Let's see how .subgroup-text relates to the tables
        $('.bangumi-subgroup').each((i, bg) => {
            const groupName = $(bg).find('.subgroup-name').text().trim() || $(bg).attr('title');
            console.log("Bangumi subgroup:", groupName);
            // Let's print some HTML to understand
            if(i===0) console.log("HTML:", $(bg).html().substring(0, 500));
        });

    } catch (e) {
        console.error(e.message);
    }
}
testMikanGroup();