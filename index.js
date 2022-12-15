const puppeteer = require('puppeteer');
const haversine = require('haversine-distance');
const { scrollPageToBottom } = require('puppeteer-autoscroll-down');
const minDistance = 2;

const getPropertiesWithinDistance = (minDistance, results) => {
  const origin = results.geography.location;
  const properties = new Map();
  results.listings.map(listing => {
    const destination = listing.geoCode;
    const distance = haversine(origin, destination)/1000;
    if (distance < minDistance) {
      properties.set(listing.propertyMetadata.headline, distance)
    }
  });
  return properties;
}

const evaluate = async (page, origin) => {
  const response = await page.waitForResponse(async response => {
    if (response.url() === 'https://www.vrbo.com/serp/g' && response.status() === 200) {
      const data = await response.json();
      return !!data.data.results;
    }
    return false;
  });
  const data = await response.json();
  const interimResults = [];
  data.data.results.listings.map(listing => {
    const destination = listing.geoCode;
    const distance = haversine(origin, destination)/1000;
    if (distance < minDistance) {
      interimResults.push([listing.propertyMetadata.headline, distance]);
    }
  });
  await scrollPageToBottom(page);
  return interimResults;
}

const getData = async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('https://www.vrbo.com/search/keywords:73-w-monroe-st-chicago-il-60603-usa/minNightlyPrice/0?filterByTotalPrice=true&petIncluded=false&ssr=true&adultsCount=1&childrenCount=0', { waitUntil: 'domcontentloaded' });
  const response = await page.waitForResponse(async response => response.url() === 'https://www.vrbo.com/serp/g' && response.status() === 200);
  const data = await response.json();
  const totalPages = data.data.results.pageCount;
  let results = [];
  for (let index = 0; index < totalPages; index++) {
    console.log(`Evaluating page ${index+1}`);
    results = results.concat(await evaluate(page, data.data.results.geography.location));

    if (index != (totalPages-1)) {
      await page.click('a[data-wdio="pager-next"]');
    }
  }
  console.log(new Map(results));
  await browser.close();
};

getData();