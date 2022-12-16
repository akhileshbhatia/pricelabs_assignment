const puppeteer = require('puppeteer');
const haversine = require('haversine-distance');
const { scrollPageToBottom } = require('puppeteer-autoscroll-down');
const { writeFileSync } = require('fs');

const minDistance = 2;

const evaluate = async (page, origin, idAndDistance, idAndOtherInfo) => {
  const response = await page.waitForResponse(async response => {
    if (response.url() === 'https://www.vrbo.com/serp/g' && response.status() === 200) {
      const data = await response.json();
      return !!data.data.results;
    }
    return false;
  });
  const data = await response.json();
  data.data.results.listings.map(listing => {
    const destination = listing.geoCode;
    const distance = haversine(origin, destination)/1000;
    if (distance < minDistance) {
      idAndDistance.set(listing.propertyId, distance);
      idAndOtherInfo.set(listing.propertyId, {
        name: listing.propertyMetadata.headline,
        detailsUrl: `https://vrbo.com/${listing.detailPageUrl}`}
      );
    }
  });
  await scrollPageToBottom(page);
}

const getData = async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto('https://www.vrbo.com/search/keywords:73-w-monroe-st-chicago-il-60603-usa/minNightlyPrice/0?filterByTotalPrice=true&petIncluded=false&ssr=true&adultsCount=1&childrenCount=0', { waitUntil: 'domcontentloaded' });
  const response = await page.waitForResponse(async response => response.url() === 'https://www.vrbo.com/serp/g' && response.status() === 200);
  const data = await response.json();
  const totalPages = data.data.results.pageCount;
  const idAndDistance = new Map();
  const idAndOtherInfo = new Map();
  for (let index = 0; index < totalPages; index++) {
    console.log(`Evaluating page ${index+1}`);
    await evaluate(page, data.data.results.geography.location, idAndDistance, idAndOtherInfo);

    if (index != (totalPages-1)) {
      await page.click('a[data-wdio="pager-next"]');
    }
  }
  const sortedMap = new Map([...idAndDistance.entries()].sort((a, b) => a[1] - b[1]));
  const detailsUrl = idAndOtherInfo.get(Array.from(sortedMap.keys())[0]).detailsUrl;
  console.log(detailsUrl);
  const newPage = await browser.newPage();
  await newPage.goto(detailsUrl, { waitUntil: 'domcontentloaded' });
  await browser.close();
};

getData();