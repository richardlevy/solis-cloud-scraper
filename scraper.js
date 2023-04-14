const puppeteer = require('puppeteer');
const express = require('express');
const basicAuth = require('express-basic-auth')
const PropertiesReader = require('properties-reader');

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

async function scrapeData() {

	const startTime = Date.now();

	const browser = await puppeteer.launch({
		headless:true,
		args: ['--no-zygote', '--no-sandbox']
	});

	try {
		const page = await browser.newPage();
		await page.setViewport({ width: 1200, height: 1000 });

		await page.goto(url);

		try {
			await page.click(".username input")
		}	catch (err) {
    	console.log("Reloading page as empty")
			await page.goto(url);
		}

		// Fill in username and password
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

		// Get station capacity
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

		// Wait for detail to be available
		await popup.waitForSelector('.toptext-info > div > .fadian-info > div > span:nth-child(2)')

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

		// if charge is goign TO battery, it had this:
		// <div data-v-44bfab40="" class="chongdianqiu" style="background-color: rgb(170, 218, 118); border-color: rgba(170, 218, 118, 0.3);"></div>
		// if charge is going FROM battery it had this:
		// <div data-v-44bfab40="" class="chongdianqiu" style="background-color: rgb(182, 118, 218); border-color: rgba(182, 118, 218, 0.35);"></div>

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

		/*

		If sending to grid, get this element for animation
		 <div data-v-44bfab40="" class="maidianqiu" style="background-color: rgb(95, 145, 203); border-color: rgba(45, 111, 187, 0.2);"></div>

		 css classes (animation and webkit-animation) the name implies the direction
		 	maidan
		*/


		// House draw now
		const currentHouseDrawElement = await popup.$('.animation > .wrap > .grid-side > .content > span')
		const currentHouseDraw = await (await currentHouseDrawElement.getProperty('textContent')).jsonValue()

		// House consumption today
		const totalHouseConsumptionElement = await popup.$('.animation > .wrap > .grid-side > .use-power > span:nth-child(2)')
		const totalHouseConsumption = await (await totalHouseConsumptionElement.getProperty('textContent')).jsonValue()

		await browser.close()

		const endTime = Date.now();
		const now = new Date(endTime);

		// Puppeteer will put the string value of NaN if it can't get it, which is why we check for the string not isNaN()
		if (currentGen === "NaN") {
			return new Map([])
		} else {

			// Elements should be named NOW or TODAY as appropriate
			// A negative value could mean drawing FROM ad positive is TO
			// ie -1kw = coming from battery or grid
			//     1kw = going to battery or grid
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
		await browser.close()
		throw (e);
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

app.get('/refresh', (req, res) => {
	getData()
	return res.send("ok");
});

app.listen(port, () => {
  console.log(`Solis cloud scraper listening on port ${port}`)
})

getData();


