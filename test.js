const puppeteer = require('puppeteer');

const getDetails = async () => {
  const detailsUrl = 'https://vrbo.com/3085724?unitId=3657782&adultsCount=1&noDates=true';
  const browser = await puppeteer.launch({ headless: false });
  const newPage = await browser.newPage();
  await newPage.goto(detailsUrl, { waitUntil: 'domcontentloaded' });
  const data = await newPage.evaluate(() => {
    const text = document.querySelector('body > script').innerHTML;
    const stringArr = text.substring(text.indexOf('"rentNights":'), text.indexOf(',"rentNightsConverted":')).split(':')[1];
    return JSON.parse(stringArr).splice(0, 365);
  });
  console.log(data);
  await browser.close();
}

getDetails();