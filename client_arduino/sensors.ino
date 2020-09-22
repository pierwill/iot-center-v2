#include <BME280I2C.h>
#include <ClosedCube_HDC1080.h>
#include <SparkFunCCS811.h>
#include <SparkFun_Si7021_Breakout_Library.h>
#include <Adafruit_BME680.h>

#if defined(ESP32)
  #include <TinyGPS++.h>
  #include <axp20x.h>
  TinyGPSPlus gps;
  HardwareSerial GPS(1);
  AXP20X_Class axp; //Power control
#endif
bool bGPS = false;

BME280I2C bme;
bool bBME280 = false;
bool bBMP280 = false;
ClosedCube_HDC1080 hdc1080;
bool bHDC = false;
CCS811 ccs811(0x5a);
bool bCCS = false;
Weather si7021sensor;
bool b7021 = false;

Adafruit_BME680 bme680; // I2C
bool bBME680 = false;

float temp(NAN), hum(NAN), pres(NAN), co2(NAN), tvoc(NAN);
double latitude(NAN), longitude(NAN);

void report_i2c() {
   Serial.println( "I2C scan");
   byte nDevices = 0;
   for(byte address = 1; address < 127; address++ ) {
    Wire.beginTransmission(address);
    byte error = Wire.endTransmission();
    if (error == 0) {
      Serial.print("I2C device found at address 0x");
      if (address<16) {
        Serial.print("0");
      }
      Serial.println(address,HEX);
      nDevices++;
    }
    else if (error==4) {
      Serial.print("Unknow error at address 0x");
      if (address<16) {
        Serial.print("0");
      }
      Serial.println(address,HEX);
    }    
  }
  if (nDevices == 0) {
    Serial.println("No I2C devices found\n");
  }
  else {
    Serial.println("done\n");
  }
}

void setupSensors() {
  Serial.println( "Setup sensors");
  //Init I2C
  Wire.begin();
  report_i2c();

  #if defined(ESP32)
  // Initialising GPS
  if (!axp.begin(Wire, AXP192_SLAVE_ADDRESS)) { //I2C 0x34
    Serial.println("Found AXP192 power controller");
    axp.setPowerOutPut(AXP192_LDO2, AXP202_ON);
    axp.setPowerOutPut(AXP192_LDO3, AXP202_ON);
    axp.setPowerOutPut(AXP192_DCDC2, AXP202_ON);
    axp.setPowerOutPut(AXP192_EXTEN, AXP202_ON);
    axp.setPowerOutPut(AXP192_DCDC1, AXP202_ON);
    GPS.begin(9600, SERIAL_8N1, 34, 12);   //17-TX 18-RX
    bGPS = true;
  } else
    Serial.println("Missing AXP192");
  #endif
  
  // Initialising Sensor BME680
  if (bme680.begin()) {  //I2C 0x77
    Serial.println("Found BME680 sensor");
    // Set up oversampling and filter initialization
    bme680.setTemperatureOversampling(BME680_OS_8X);
    bme680.setHumidityOversampling(BME680_OS_2X);
    bme680.setPressureOversampling(BME680_OS_4X);
    bme680.setIIRFilterSize(BME680_FILTER_SIZE_3);
    bme680.setGasHeater(320, 150); // 320*C for 150 ms
    bBME680 = true;
  } else
    Serial.println("Missing BME680 sensor");
  
  // Initialising Sensor BMP/BME280
  bme.begin();  //I2C 0x76
  switch(bme.chipModel()) {
     case BME280::ChipModel_BME280:
       Serial.println("Found BME280 sensor");
       bBME280 = true;
       break;
     case BME280::ChipModel_BMP280:
       Serial.println("Found BMP280 sensor");
       bBMP280 = true;
       break;
     default:
       Serial.println("Missing BMx280 sensor");
  }

  // Initialising Sensor SI7021
  if (si7021sensor.begin()) { //I2C 0x40
    Serial.println("Found SI7021 sensor");
    b7021 = true;
  } else {
    Serial.println("Missing SI7021 sensor");
  }

  // Initialising Sensor hdc1080
  hdc1080.begin(0x40);
  if ( hdc1080.readManufacturerId() == 0x5449) {
    Serial.println("Found HDC1080 sensor");
    bHDC = true;
  } else {
    Serial.print("Missing HDC1080 sensor, code: ");
    Serial.println(hdc1080.readManufacturerId(), HEX);
  }

  // Initialising Sensor CSS811  
  if ( ccs811.beginWithStatus() == CCS811Core::CCS811_Stat_SUCCESS) { //I2C 0x5A or 0x5B
    Serial.println("Found CCS811 sensor");
    bCCS = true;
  } else {
    Serial.println("Missing CCS811 sensor");
  }
}

void readSensors() {
  temp = NAN; //Clear temperature
  
  #if defined(ESP32)
  //Read GPS location
  if (bGPS) {
    while (GPS.available() > 0)
      gps.encode(GPS.read());
    if (gps.location.isValid()) {
      latitude = gps.location.lat();
      longitude = gps.location.lng();
      Serial.println( String("GPS Lat: ") + latitude + "\t\tLongitude: " + longitude);
    } else
      Serial.println( "Waiting for GPS fix");
  }  
  #endif

  if (bBME680) {
    if (bme680.performReading()) {
      temp = bme680.temperature;
      hum = bme680.humidity;
      pres = bme680.pressure / 100.0;
      co2 = (bme680.gas_resistance / 1000.0) + 400;
    } else
      Serial.println("Failed to perform reading :(");
  }
  
  //Read the BME280/BMP280 sensor
  if ( bBME280 || bBMP280) {
    bme.read(pres, temp, hum, BME280::TempUnit_Celsius, BME280::PresUnit_hPa);
    if ( !bBME280) // Only BME280 does have humidity sensor
      hum = NAN;
    Serial.println(String("BME Temp: ") + temp + "°C\tHumidity: " + hum + "% RH\tPressure: " + pres + " hPa");
  }
  
  if (bHDC) {
    temp = hdc1080.readTemperature();
    hum = hdc1080.readHumidity();
    Serial.println(String("HDC Temp: ") + temp + "°C\tHumidity: " + hum + "% RH");
  }

  if (b7021) {
    temp = si7021sensor.getTemp();
    hum = si7021sensor.getRH();
    Serial.println(String("SI Temp: ") + temp + "°C\tHumidity: " + hum + "% RH");
  }
  
  if (bCCS) {
    ccs811.setEnvironmentalData( isnan(hum) ? 60 : hum, temp);  //if humidity is not measured, set 60%
    ccs811.readAlgorithmResults();
    co2 = ccs811.getCO2();
    tvoc = ccs811.getTVOC();
    Serial.println(String("CCS CO2: ") + co2 + "ppm\t\tVOC: " + tvoc + "ppb");
  }
}

String getSensorsList() {
  return String(bBME680 ? "BME680" : "") + (bBME280 ? "BME280" : "") + (bBMP280 ? "BMP280" : "") + (bCCS ? "+CCS811" : "") + (bHDC ? "+HDC1080" : "") + (b7021 ? "+SI7021" : "") + (bGPS ? "+GPS" : "");
}
