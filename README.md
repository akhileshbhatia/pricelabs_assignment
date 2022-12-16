## Prerequisties
1. node 12+
1. npm
1. A utility like postman to call the API (or of course curl can be used)

## What it does
This app takes an address and radius in kms and scrapes vrbo.com for this information.
It opens the browser temporarily and closes it once the scraping is done.

It has three APIs
1. getListingsWithinDistance API - creates a `data.csv` with the 50 closest listings, their prices for next 365 days and their distance
1. getHighestPricedDates API - returns an object which has the listing name and it's 3 dates when the listing is most expensive

## Running the app
1. Clone the repository locally
1. Run `npm ci`
1. Run `node .` and you will see the message 'Server listening on port 3000'
1. Call the APIs one by one and wait for the response, for example

```
  curl http://localhost:3000/getListingsWithinDistance/73-w-monroe-st-chicago-il-60603-usa/2
  curl http://localhost:3000/getHighestPricedDates/73-w-monroe-st-chicago-il-60603-usa/2
```

