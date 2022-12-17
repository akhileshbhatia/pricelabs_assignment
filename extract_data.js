const puppeteer = require('puppeteer');
const haversine = require('haversine-distance');
const { scrollPageToBottom } = require('puppeteer-autoscroll-down');

const baseUrl = 'https://www.vrbo.com';

// This function waits for data request url to be fulfilled. Once available, it returns the response
// It verifies data.data.results is there or not because there can be multiple requests to the same URL but with different responses
const waitForDataRequestUrl = async (page) => {
  const response = await page.waitForResponse(async response => {
    if (response.url() === `${baseUrl}/serp/g` && response.status() === 200) {
      const data = await response.json();
      return !!data.data.results;
    }
    return false;
  });
  return response;
}

// This function evaluates each page
const evaluatePage = async (page, pageNum, data, origin, idAndDistance, idAndOtherInfo, maxDistance) => {
  let finalData = data;
  if (pageNum !== 0) {
    const response = await waitForDataRequestUrl(page);
    finalData = await response.json();
  }
  else {
    await page.waitForTimeout(2000);
  }
  finalData.data.results.listings.map(listing => {
    const destination = listing.geoCode;
    // Calculate the haversine distance between origin and destination
    const distance = haversine(origin, destination)/1000; // Divide by 1000 to get the distance in kms
    // Add it to the map because it's within the max distance
    if (distance < maxDistance) {
      idAndDistance.set(listing.propertyId, distance);
      idAndOtherInfo.set(listing.propertyId, {
        name: listing.propertyMetadata.headline,
        detailsUrl: `${baseUrl}/${listing.detailPageUrl}`}
      );
    }
  });
  // Scroll to bottom because we need to click the next button if available
  await scrollPageToBottom(page);
}

// This function takes the two maps and returns an array with name, prices for next 1 year and distance from source
const getListingsPriceForNext12Months = async (idAndDistance, idAndOtherInfo, page) => {
  const sortedDistanceMap = new Map([...idAndDistance.entries()].sort((a, b) => a[1] - b[1]));
  const keys = [...sortedDistanceMap.keys()].splice(0, 50);
  const listingPricesAndDistance = [];
  for (key of keys) {
    const { name, detailsUrl } = idAndOtherInfo.get(key);
    await page.goto(detailsUrl, { waitUntil: 'domcontentloaded' });
    // Get the page source
    const content = await page.content();
    // Parse the source string and get the array between `rentNights` and `rentNightsConverted` which is the rent nights array
    const substring = content.substring(content.indexOf('"rentNights":'), content.indexOf(',"rentNightsConverted":')).split(':')[1];
    const parsed = JSON.parse(substring);
    listingPricesAndDistance.push({ 
      name,
      prices: !!parsed ? parsed.splice(0, 365) : 'Price per day not available', // Some properties have rentNights as null
      distance: Math.round(sortedDistanceMap.get(key) * 100) / 100 
    });
  }
  return listingPricesAndDistance;
}

// This function takes the address and max distance and returns an array with listing name, it's prices for next 1 year and the distance from source address
const getListingDetailsWithinDistance = async (address, maxDistance) => {
  // Function is called directly or indirectly from the API so parsing the string to number assuming it's an integer
  maxDistance = parseInt(maxDistance);
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(`${baseUrl}/search/keywords:${address}/minNightlyPrice/0?filterByTotalPrice=true&petIncluded=false&ssr=true&adultsCount=1&childrenCount=0`, { waitUntil: 'domcontentloaded' });

  const response = await waitForDataRequestUrl(page);
  const data = await response.json();
  const { pageCount, geography } = data.data.results;
  console.log(`Total pages: ${pageCount}`);
  // We create two maps and pass them by reference to evaluatePage
  // One map will store the listing id and the distance and the other will store the listing id and info about the listing
  // Two maps because we use the first one to sort by distance. Once sorted, we use the keys from the sorted map to get the info
  const idAndDistance = new Map();
  const idAndOtherInfo = new Map();
  for (let index = 0; index < pageCount; index++) {
    console.log(`Evaluating page ${index + 1}`);
    // Evaluate each page
    await evaluatePage(page, index, data, geography.location, idAndDistance, idAndOtherInfo, maxDistance);

    // If it's not the last page, click the next button
    if (index != (pageCount-1)) {
      await page.click('a[data-wdio="pager-next"]');
    }
  }
  // Pass the two maps and the page to get listings price for the next 12 months
  const listingPricesAndDistance = await getListingsPriceForNext12Months(idAndDistance, idAndOtherInfo, page);
  await browser.close();
  return listingPricesAndDistance;
};

// This function returns the name of the property and the 3 dates when the property is highest priced
// It picks 3 highest unique price and calculates the 'first' date when the property is available at that price
const getHighestPricedDates = async (address, distance) => {
  const listingPricesAndDistance = await getListingDetailsWithinDistance(address, distance);
  const listingAndHighestPricedDates = {};
  listingPricesAndDistance.map(listing => {
    if (typeof listing.prices === 'string') {
      listingAndHighestPricedDates[listing.name] = 'Price per day not available';
    }
    else {
      // create a shallow copy of the prices array for sorting as Array.sort updates original array
    const pricesArr = listing.prices.slice();
    // use Set to get unique values + javascript Sets preserve insertion order
    const prices = [...new Set(pricesArr.sort((a, b) => b - a))];
    const dates = [];
    for (let i = 0; i < 3; i++) {
      // Number of days will be the index of highest price. The plus 1 is get the actual number of days
      const numOfDays = listing.prices.indexOf(prices[i]) + 1;
      // Get the date after number of days from today 
      const currentDate = new Date();
      const dateForPrice = new Date(currentDate.setDate(currentDate.getDate() + numOfDays));
      // Add the date in dd/mm/yyyy format to the array
      dates.push(`${dateForPrice.getDate()}/${dateForPrice.getMonth() + 1}/${dateForPrice.getFullYear()}`);
    }
    listingAndHighestPricedDates[listing.name] = dates;
    }
  });
  return listingAndHighestPricedDates;
}

module.exports = {
  getListingDetailsWithinDistance,
  getHighestPricedDates
}