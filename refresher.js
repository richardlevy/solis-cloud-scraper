const client = require("http");

const PropertiesReader = require('properties-reader');
const properties = PropertiesReader('scraper.properties');

const url = properties.get("service.refresh.url")
const scrapeRequiredUsername = properties.get("service.username")
const scrapeRequiredPassword = properties.get("service.password")

const refreshIntervalMins = properties.get("refresh.interval-mins")
// Note 24 hr clock
const scrapeStartHour = properties.get("refresh.start-hour")
const scrapeEndHour = properties.get("refresh.end-hour")

async function callDataRefresh() {
	console.log("Calling refresh")
	await getRemoteData(url)
	.then((response) => {
		if (response==="ok") {
			console.log ("Data refreshing")
		} else {			
			console.log ("Unknown response to refresh - [" + response + "]")
		}
	})
	.catch((err) => {
		console.log ("Error with refresh call -  [" + err + "]")
	})
}

const getRemoteData = (url) => new Promise((resolve, reject) => {
  
  const credentials = scrapeRequiredUsername + ':' + scrapeRequiredPassword
  var authOptions = {'auth': credentials}

  const request = client.get(url, authOptions, (response) => {
    if (response.statusCode < 200 || response.statusCode > 299) {
      reject(new Error(`Failed with status code: ${response.statusCode}`));
    }
    const body = [];
    response.on('data', (chunk) => body.push(chunk));
    response.on('end', () => resolve(body.join('')));
  });
  request.on('error', (err) => reject(err));
});


function calcTimeout() {

	const hour = new Date().getHours();
	if (hour >= scrapeStartHour && hour < scrapeEndHour) {
		callDataRefresh();
    	setTimeout(calcTimeout, refreshIntervalMins * 60 * 1000)
	} else {		
		var now = new Date().getTime();

		var tomorrow = new Date(now + 86400000);
		tomorrow.setHours(scrapeStartHour,0,0);
		var startTimeTomorrow = tomorrow.getTime(); 

  	var timeToStartTime = startTimeTomorrow-now;
  	// Add 5 seconds to ensure we're inside window
  	timeToStartTime += 5 * 1000

  	var minsTo = Math.floor((timeToStartTime / 1000) / 60)

		console.log("Sleeping until " + scrapeStartHour + " tomorrow. " + minsTo + " minutes")

  	setTimeout(calcTimeout, timeToStartTime)
	}
}

calcTimeout();
