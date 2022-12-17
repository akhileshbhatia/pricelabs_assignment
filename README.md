## Prerequisties
1. node 12+
1. npm
1. A utility like postman to call the API (or of course curl can be used)

## What it does
This app takes an address and radius in kms and scrapes vrbo.com for this information.
It opens the browser temporarily and closes it once the scraping is done.

It has two APIs
1. getListingsWithinDistance API - creates a `data.csv` with the 50 closest listings, their prices for next 365 days and their distance
1. getHighestPricedDates API - returns an object which has the listing name and it's 3 dates when the listing is most expensive

NOTE: The highest prices logic takes the highest unique price and picks the 'first' occurence of the price from the rentNights array 
and calculates that date.

## Running the app
1. Clone the repository locally
1. Run `npm ci`
1. Run `node .` and you will see the message 'Server listening on port 3000'
1. Call the APIs one by one and wait for the response, for example

```
  curl http://localhost:3000/getListingsWithinDistance/73-w-monroe-st-chicago-il-60603-usa/2
  curl http://localhost:3000/getHighestPricedDates/73-w-monroe-st-chicago-il-60603-usa/2
```

```
  curl http://localhost:3000/getListingsWithinDistance/lake-district-wildlife-park-keswick-england-united-kingdom/2
  curl http://localhost:3000/getHighestPricedDates/lake-district-wildlife-park-keswick-england-united-kingdom/2
```

## Missing implementation
The code is missing the following:
1. More modularity. Breaking `extract_data` into smaller chunks. Will make it easier for testing and maintaining
1. Error handling.
    1. Doesn't verify that address and radius are not empty and are in the correct format
    1. No try-catch block in case puppeteer fails
1. Unit tests which mock's puppeteer's response and check if processing works fine
1. No security like a JWT auth token for the APIs
## Thought exercise answer
Scraping is expensive and time consuming. So when a address and a radius are requested, I will store the scraped data for that address and radius in
a database. That's because reading a database will be faster than the scraping. The data post processing can happen once the data is retrieved from the database.

The columns in the Cached_Info table will be as follows. It will have the address and the radius of the request along with the response in three different columns.
Additionally, there will be a Request_timestamp column to check when the information was last scraped. If the new request is within 24 hours, then
we can use the cached information. If not, we scrape again and store the new response and the new timestamp

Table => Cached_Info
| Column Name | Description |
| -------- | -------------- |
| Id | auto generated unique identifier |
| Address | address of the request |
| Radius | radius of the request |
| Request_timestamp | timestamp when the information was last scraped |
| Response| scraped response from vrbo |