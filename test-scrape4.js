const axios = require('axios');
const cheerio = require('cheerio');

async function check() {
    try {
        const res1 = await axios.get('https://www.anibk.com/');
        const $1 = cheerio.load(res1.data);
        console.log("ANIBK TAB CONTENT:");
        
        // Find the div that contains the items for id="wt-tab-1"
        // Usually it's in a sibling div to wt-tab, like <div id="wt-con-1" ...>
        for (let i = 1; i <= 2; i++) {
            let container = $1(`#wt-con-${i}`);
            if (container.length > 0) {
                console.log(`Found wt-con-${i}:`);
                console.log(container.find('li').first().html());
            } else {
                // look for other ways it's bound
                console.log(`wt-con-${i} not found. Let's look for classes like wt-con or similar`);
            }
        }
        
        const firstCon = $1('.wt-con').first();
        if (firstCon.length) {
             console.log("Found .wt-con HTML:", firstCon.html().substring(0, 1000));
        }

    } catch (e) {
        console.error(e.message);
    }
}
check();