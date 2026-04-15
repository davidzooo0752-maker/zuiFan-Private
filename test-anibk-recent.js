const axios = require('axios');
const cheerio = require('cheerio');

async function testAnibkRecent() {
    try {
        const res = await axios.get('https://www.anibk.com/', { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(res.data);
        
        $('.wt-title').each((i, el) => {
            const titleText = $(el).text().trim();
            if (titleText.includes('最新上映')) {
                const parent = $(el).parent(); // .rbox-title
                const grandParent = parent.parent(); 
                
                // Let's dump grandparent HTML up to 2000 chars
                console.log(grandParent.html().substring(0, 2000));
            }
        });
        
    } catch (e) {
        console.error(e.message);
    }
}
testAnibkRecent();