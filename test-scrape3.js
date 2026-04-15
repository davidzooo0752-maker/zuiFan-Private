const axios = require('axios');
const cheerio = require('cheerio');

async function check() {
    try {
        const res2 = await axios.get('https://mikanime.tv/');
        const $2 = cheerio.load(res2.data);
        console.log("MIKAN PROJECT FULL LI:");
        console.log($2('.sk-bangumi li').first().html());
        
        const res1 = await axios.get('https://www.anibk.com/');
        const $1 = cheerio.load(res1.data);
        console.log("ANIBK HOMEPAGE:");
        // Look for the element that contains "每周放送表"
        let found = false;
        $1('*').each(function() {
            if ($1(this).text().trim() === '每周放送表' && !found) {
                found = true;
                // dump its parent or sibling to see structure
                console.log("Found 每周放送表 in tag:", this.tagName);
                console.log("Parent HTML:", $1(this).parent().parent().html().substring(0, 1000));
            }
        });
        
    } catch (e) {
        console.error(e.message);
    }
}
check();