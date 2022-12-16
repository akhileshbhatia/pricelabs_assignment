const puppeteer = require('puppeteer');
const haversine = require('haversine-distance');
const { scrollPageToBottom } = require('puppeteer-autoscroll-down');

const evaluatePage = async (page, origin, idAndDistance, idAndOtherInfo, maxDistance) => {
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
    if (distance < maxDistance) {
      idAndDistance.set(listing.propertyId, distance);
      idAndOtherInfo.set(listing.propertyId, {
        name: listing.propertyMetadata.headline,
        detailsUrl: `https://vrbo.com/${listing.detailPageUrl}`}
      );
    }
  });
  await scrollPageToBottom(page);
}

const getListingsPriceForNext12Months = async (idAndDistance, idAndOtherInfo, page) => {
  const sortedDistanceMap = new Map([...idAndDistance.entries()].sort((a, b) => a[1] - b[1]));
  const keys = Array.from(sortedDistanceMap.keys()).splice(0, 50);
  const listingPricesAndDistance = [];
  for (key of keys) {
    const { name, detailsUrl } = idAndOtherInfo.get(key);
    await page.goto(detailsUrl, { waitUntil: 'domcontentloaded' });
    const content = await page.content();
    const stringArr = content.substring(content.indexOf('"rentNights":'), content.indexOf(',"rentNightsConverted":')).split(':')[1];
    listingPricesAndDistance.push({ 
      name,
      prices: JSON.parse(stringArr).splice(0, 365),
      distance: Math.round(sortedDistanceMap.get(key) * 100) / 100 
    });
  }
  return listingPricesAndDistance;
}

const getListingDetailsWithinDistance = async (address, maxDistance) => {
  maxDistance = parseInt(maxDistance);
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(`https://www.vrbo.com/search/keywords:${address}/minNightlyPrice/0?filterByTotalPrice=true&petIncluded=false&ssr=true&adultsCount=1&childrenCount=0`, { waitUntil: 'domcontentloaded' });
  const response = await page.waitForResponse(async response => response.url() === 'https://www.vrbo.com/serp/g' && response.status() === 200);
  const data = await response.json();
  const totalPages = data.data.results.pageCount;
  const idAndDistance = new Map();
  const idAndOtherInfo = new Map();
  for (let index = 0; index < totalPages; index++) {
    await evaluatePage(page, data.data.results.geography.location, idAndDistance, idAndOtherInfo, maxDistance);

    if (index != (totalPages-1)) {
      await page.click('a[data-wdio="pager-next"]');
    }
  }
  const listingPricesAndDistance = await getListingsPriceForNext12Months(idAndDistance, idAndOtherInfo, page);
  await browser.close();
  return listingPricesAndDistance;
};

const getHighestPricedDates = async (address, distance) => {
  const listingPricesAndDistance = await getListingDetailsWithinDistance(address, distance);
  const listingAndHighestPricedDates = {};
  listingPricesAndDistance.map(listing => {
    // create a shallow copy of the prices array for sorting as Array.sort updates original array
    const pricesArr = listing.prices.slice();
    // Use Set to get unique values + Javascript Sets preserve insertion order
    const prices = [...new Set(pricesArr.sort((a, b) => b - a))];
    const dates = [];
    for (let i = 0; i < 3; i++) {
      const numOfDays = listing.prices.indexOf(prices[i]) + 1;
      const currentDate = new Date();
      const dateForPrice = new Date(currentDate.setDate(currentDate.getDate() + numOfDays));
      dates.push(`${dateForPrice.getDate()}/${dateForPrice.getMonth() + 1}/${dateForPrice.getFullYear()}`);
    }
    listingAndHighestPricedDates[listing.name] = dates;
  });
  return listingAndHighestPricedDates;
}

module.exports = {
  getListingDetailsWithinDistance,
  getHighestPricedDates
}