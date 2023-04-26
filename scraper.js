const puppeteer = require('puppeteer');
const express = require('express');
const basicAuth = require('express-basic-auth')
const PropertiesReader = require('properties-reader');
const DataModel = require('./DataModel.js');

const properties = PropertiesReader('scraper.properties');

const app = express();
const port = properties.get("service.port")

app.use(basicAuth( { authorizer: propertyAuthoriser } ))

function propertyAuthoriser(username, password) {
	const scrapeRequiredUsername = properties.get("service.username")
	const scrapeRequiredPassword = properties.get("service.password")

    const userMatches = basicAuth.safeCompare(username, scrapeRequiredUsername)
    const passwordMatches = basicAuth.safeCompare(password, scrapeRequiredPassword)

    return userMatches & passwordMatches
}

const url = properties.get("solis.url")
const username = properties.get("solis.username")
const password = properties.get("solis.password")
const maxSelectorRetries = properties.get("solis.maxSelectorRetries")

async function scrapeData() {

	const startTime = Date.now();

	const browser = await puppeteer.launch({
		headless:true,
		args: ['--no-zygote', '--no-sandbox','--single-process']
	});

	try {
		const page = await browser.newPage();
		await page.setViewport({ width: 1200, height: 1000 });
		await page.goto(url);

		await waitForSelectorWithRetries(page, '.username input', "Login page", maxSelectorRetries, 1000 )

		// Fill in username and password
		await page.click(".username input")
		await page.type(".username input", username)
		await page.click(".username_pwd.el-input input")
		await page.type(".username_pwd.el-input input", password)

		// Click privacy policy
		await page.evaluate(() => {
			document.querySelector(".remember .el-checkbox__original").click()
		})

		// Click login button
		await page.click(".login-btn button")

		// Wait for page load then click on the table to go to station overview
		await page.waitForTimeout(5000)

		// Get station capacity - potential reload point
		await page.waitForSelector('.el-table__row .el-table_1_column_8 .cell')
		const stationElement = await page.$('.el-table__row .el-table_1_column_8 .cell')
		const stationCapacity = await (await stationElement.getProperty('textContent')).jsonValue()

		// await page.waitForSelector(".el-table__body-wrapper tr");
		await page.click(".el-table__body-wrapper tr")
	 	await page.waitForTimeout(5000)

		// Opens in new tab, so move that that
		let pages = await browser.pages();

		let popup = pages[pages.length - 1];
		await popup.setViewport({ width: 1200, height: 1000 });

		await waitForSelectorWithRetries(popup, '.toptext-info > div > .fadian-info > div > span:nth-child(2)', "Current stats diagram" , maxSelectorRetries )

		// Solar generation today
		const totalYieldElement = await popup.$('.toptext-info > div > .fadian-info > div > span:nth-child(2)')
		const totalYield = await (await totalYieldElement.getProperty('textContent')).jsonValue()

		// Solar generation now
		const currentGenElement = await popup.$('.animation > .wrap > .fadian > .content > span') 
		const currentGen = await (await currentGenElement.getProperty('textContent')).jsonValue()

		// Battery charge level now
		const batteryChargeElement = await popup.$('.chongdian > .content > div > .batteryProgress > .colorBox1')
		const batteryCharge = await (await batteryChargeElement.getProperty('textContent')).jsonValue()

		// Battery consumption now
		const drawFromBatteryElement = await popup.$('.animation > .wrap > .chongdian > .content > span')
		const drawFromBattery = await (await drawFromBatteryElement.getProperty('textContent')).jsonValue()

		// Battery charging today
		const todaysChargingElement = await popup.$('.bottomtext-info > div > .chongdian-info > div:nth-child(1) > span:nth-child(2)')
		const todaysCharging = await (await todaysChargingElement.getProperty('textContent')).jsonValue()

		// Battery discharge today
		const todaysDischargingElement = await popup.$('.bottomtext-info > div > .chongdian-info > div:nth-child(2) > span:nth-child(2)')
		const todaysDischarging = await (await todaysDischargingElement.getProperty('textContent')).jsonValue()

		// Today from grid
		const todayFromElement = await popup.$('.toptext-info > div > .maidian-info > div:nth-child(1) > span:nth-child(2)')
		const todayFromGrid = await (await todayFromElement.getProperty('textContent')).jsonValue()

		// Today to grid
		const todayToElement = await popup.$('.toptext-info > div > .maidian-info > div:nth-child(2) > span:nth-child(2)')
		const todayToGrid = await (await todayToElement.getProperty('textContent')).jsonValue()

		// Grid in/out now
		const currentGridInOutElement = await popup.$('.animation > .wrap > .maidian > .content > span')
		const currentGridInOut = await (await currentGridInOutElement.getProperty('textContent')).jsonValue()

		// House draw now
		const currentHouseDrawElement = await popup.$('.animation > .wrap > .yongdian > .content > span')
		const currentHouseDraw = await (await currentHouseDrawElement.getProperty('textContent')).jsonValue()

		// House consumption today
		const totalHouseConsumptionElement = await popup.$('.animation > .bottomtext-info > div > .yongdian-info > div > span:nth-child(2)')
		const totalHouseConsumption = await (await totalHouseConsumptionElement.getProperty('textContent')).jsonValue()

		await browser.close()

		const endTime = Date.now();
		const now = new Date(endTime);

		// Puppeteer will put the string value of NaN if it can't get it, which is why we check for the string not isNaN()
		if (currentGen === "NaN") {
			return new Map([])
		} else {
			const data = new Map([
				['totalYield',totalYield],
				['currentGen',currentGen],
				['batteryCharge',batteryCharge],
				['drawFromBattery',drawFromBattery],
				['todaysCharging',todaysCharging],
				['todaysDischarging',todaysDischarging],
				['todayFromGrid',todayFromGrid],
				['todayToGrid',todayToGrid],
				['currentGridInOut',currentGridInOut],
				['currentHouseDraw',currentHouseDraw],
				['totalHouseConsumption',totalHouseConsumption],
				['scrapeStartDurationMs', startTime],
				['scrapeEndTimeMs',endTime],
				['stationCapacity',stationCapacity],
				])

			return data
		}

	} catch (e) {
		console.log("Error - " + e.message)
		// await browser.close()
		throw (e);
	}
}

async function waitForSelectorWithRetries(page, selector, selectorDescription, maxRetries, timeoutms = 5000) {

	var retries = maxRetries

	while (retries > 0) {
		try {
			await page.waitForSelector(selector, {timeout: timeoutms })
			if (retries < maxRetries){
				console.log("  Retry successfull")
			}
			return
		}	catch (err) {
			await page.reload({ waitUntil: ["networkidle0", "domcontentloaded"] });
			retries -= 1
    	console.log("Reloading selector ("+selectorDescription+").  " + retries + " retries remaining")
		}
	}
}

async function getData() {
	const timeElapsed = Date.now();
	const now = new Date(timeElapsed);
	console.log ("Scrape requested at " + now.toUTCString())

	try {
		const newData = await scrapeData()
		if (newData.size > 0){
			data = newData
			let scrapeMs = data.get('scrapeEndTimeMs');
			let scrapeTime = new Date(scrapeMs);
			console.log("Data scraped at " + scrapeTime.toUTCString())
		} else {
			console.log("Unable to fetch data - using previous data")
		}
	} catch (err) {
		console.log("Error fetching data - using previous data")
	}

}

var data = []

function initialiseData() {
	const time = Date.now();
	data = new Map([
		['totalYield',""],
		['currentGen',""],
		['batteryCharge',""],
		['drawFromBattery',""],
		['todaysCharging',""],
		['todaysDischarging',""],
		['todayFromGrid',""],
		['todayToGrid',""],
		['currentGridInOut',""],
		['currentHouseDraw',""],
		['totalHouseConsumption',""],
		['scrapeStartDurationMs', time],
		['scrapeEndTimeMs',time],
		['stationCapacity',""],
		])
}

initialiseData()

app.get('/data', (req, res) => {
  return res.send(Object.fromEntries(data));
});

app.get('/v1/data', (req, res) => {
  return res.send(Object.fromEntries(data));
});

app.get('/v2/data', (req, res) => {
  var v2Data = new DataModel(data);
  return res.send(v2Data.toJson());
});

app.get('/refresh', (req, res) => {
	getData()
	return res.send("ok");
});

app.listen(port, () => {
  console.log(`Solis cloud scraper V2.0 listening on port ${port}`)
})

getData();


