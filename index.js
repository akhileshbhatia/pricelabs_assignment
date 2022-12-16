const { getListingDetailsWithinDistance, getHighestPricedDates } = require('./extract_data');
const createCSVWriter = require('csv-writer').createObjectCsvWriter;
const express = require('express');
const app = express();

app.get('/getListingsWithinDistance/:address/:distance', async (req, res) => {
  const { address, distance } = req.params;
  const listingPricesAndDistance = await getListingDetailsWithinDistance(address, distance);
  const csvWriter = createCSVWriter({
    path: 'data.csv',
    header: [
      { id: 'name', title: 'Name' },
      { id: 'prices', title: 'Prices for next 12 months' },
      { id: 'distance', title: 'Distance (in kms)' }
    ]
  });
  await csvWriter.writeRecords(listingPricesAndDistance);
  res.status(200).send('CSV with listing details created successfully');
});

app.get('/getHighestPricedDates/:address/:distance', async (req, res) => {
  const { address, distance } = req.params;
  const output = await getHighestPricedDates(address, distance);
  res.status(200).send(JSON.stringify(output, null, 2));
});


app.listen(3000, () => console.log('Server listening on port 3000'));