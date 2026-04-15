const axios = require('axios');

async function check() {
    try {
        const res1 = await axios.get('https://www.anibk.com/');
        const html = res1.data;
        const index = html.indexOf('每周放送表');
        console.log("IndexOf 每周放送表: ", index);
        // let's grab the HTML from this index to + 5000 characters
        if (index !== -1) {
            console.log(html.substring(index, index + 2000));
        }
    } catch (e) {
        console.error(e.message);
    }
}
check();