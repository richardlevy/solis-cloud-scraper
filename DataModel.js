module.exports = class DataModel {

	static kwh = "kwh"
	static kwp = "kwp"
	static kw = "kw"
	static percent = "%"

	#currentYield = 0.0
	#currentYieldUnit = DataModel.kw

	#currentBatteryCharge = 0.0
	#currentbatteryChargeUnit = DataModel.percent

	// Negative means we're discharging from the battery
	#currentBatteryUsage = 0.0
	#currentBatteryUsageUnit = DataModel.kw

	// Negative means we're importing from the grid
	#currentGridUsage = 0.0
	#currentGridUsageUnit = DataModel.kw

	#currentHouseConsumption = 0.0
	#currentHouseConsumptionUnit = DataModel.kw

	#todayYield = 0.0
	#todayYieldUnit = DataModel.kwh

	#todaysCharging = 0.0
	#todaysChargingUnit = DataModel.kwh

	#todaysDischarging = 0.0
	#todaysDischargingUnit = DataModel.kwh

	#todayGridImport = 0.0
	#todayGridImportUnit = DataModel.kwh

	#todayGridExport = 0.0
	#todayGridExportUnit = DataModel.kwh

	#todayHouseConsumption = 0.0
	#todayHouseConsumptionUnit = DataModel.kwh

	#stationCapacity = 0.0
	#stationCapacityUnit = DataModel.kwh

	#scrapeStartDurationMs = 0
	#scrapeEndTimeMs = 0

	// Construct from the extracted strings from Solis Cloud
	constructor(rawData) {

		const currentYieldData = this.separateValueFromUnit(rawData.get("currentGen"))
		this.currentYield = currentYieldData[0]
		this.currentYieldUnit = currentYieldData[1]

		const currentBatteryChargeData = this.separateValueFromUnit(rawData.get("batteryCharge"))
		this.currentBatteryCharge = currentBatteryChargeData[0]
		this.currentBatteryChargeUnit = currentBatteryChargeData[1]

		const currentBatteryUsageData = this.separateValueFromUnit(rawData.get("drawFromBattery"))
		this.currentBatteryUsage = currentBatteryUsageData[0]
		this.currentBatteryUsageUnit = currentBatteryUsageData[1]

		const currentGridUsageData = this.separateValueFromUnit(rawData.get("currentGridInOut"))
		this.currentGridUsage = currentGridUsageData[0]
		this.currentGridUsageUnit = currentGridUsageData[1]

		const currentHouseConsumptionData = this.separateValueFromUnit(rawData.get("currentHouseDraw"))
		this.currentHouseConsumption = currentHouseConsumptionData[0]
		this.currentHouseConsumptionUnit = currentHouseConsumptionData[1]

		const todayYieldData = this.separateValueFromUnit(rawData.get("totalYield"))
		this.todayYield = todayYieldData[0]
		this.todayYieldUnit = todayYieldData[1]

		const todaysChargingData = this.separateValueFromUnit(rawData.get("todaysCharging"))
		this.todaysCharging = todaysChargingData[0]
		this.todaysChargingUnit = todaysChargingData[1]

		const todaysDischargingData = this.separateValueFromUnit(rawData.get("todaysDischarging"))
		this.todaysDischarging = todaysDischargingData[0]
		this.todaysDischargingUnit = todaysDischargingData[1]

		const todayGridImportData = this.separateValueFromUnit(rawData.get("todayFromGrid"))
		this.todayGridImport = todayGridImportData[0]
		this.todayGridImportUnit = todayGridImportData[1]

		const todayGridExportData = this.separateValueFromUnit(rawData.get("todayToGrid"))
		this.todayGridExport = todayGridExportData[0]
		this.todayGridExportUnit = todayGridExportData[1]

		const stationCapacityData = this.separateValueFromUnit(rawData.get("stationCapacity"))
		this.stationCapacity = stationCapacityData[0]
		this.stationCapacityUnit = stationCapacityData[1]

		this.scrapeStartDurationMs = rawData.get("scrapeStartDurationMs")
		this.scrapeEndTimeMs = rawData.get("scrapeEndTimeMs")

		// If the house is using more than the solar is generating
		if (this.currentHouseConsumption > this.currentYield) {
		    // Whatever the battery usage it, it must be coming out of the battery so make it negative
			this.currentBatteryUsage = Math.abs(this.currentBatteryUsage) * -1
		}

		// If the house is using more than the solar is generating and there is power in the battery
		if (this.currentHouseConsumption > this.currentYield + Math.abs(this.currentBatteryUsage)){
			// Whatever the grid usage it, its probably importing from the grid, so make it negative
			this.currentGridUsage = Math.abs(this.currentGridUsage) * -1
		}

	}

	toJson() {
		return JSON.stringify(this)
	}

	separateValueFromUnit(data) {
		var value = 0.0
		var unit = ""

		if (data) {

			const lowerData = data.toLowerCase()

			// Remove all know units and spaces
			var cleanLowerData = lowerData.replace(DataModel.kwh, "");
			cleanLowerData = cleanLowerData.replace(DataModel.kwp, "");
			cleanLowerData = cleanLowerData.replace(DataModel.kw, "");
			cleanLowerData = cleanLowerData.replace(DataModel.percent, "");
			cleanLowerData = cleanLowerData.replace(" ", "");

			// Check its a number
			if (this.isNumeric(cleanLowerData)) {
				value = parseFloat(cleanLowerData)

				// Remove the value from the original string to get the unit
				unit = data.replace(cleanLowerData, "")
				unit = unit.replace(" ", "")
			}
		}

		return [value, unit]
	}

	isNumeric(str) {
		if (typeof str != "string") {
			return false  
		}
  		return !isNaN(str) && !isNaN(parseFloat(str))
	}

}