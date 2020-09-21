#include <BME280I2C.h>
#include "ClosedCube_HDC1080.h"
#include "SparkFunCCS811.h"
#include "SparkFun_Si7021_Breakout_Library.h"
#include <TinyGPS++.h>
#include <axp20x.h>

TinyGPSPlus gps;
HardwareSerial GPS(1);
AXP20X_Class axp; //Power control
bool bGPS = false;

BME280I2C bme;
bool bBME = false;
ClosedCube_HDC1080 hdc1080;
bool bHDC = false;
CCS811 ccs811(0x5a);
bool bCCS = false;
Weather si7021sensor;
bool b7021 = false;

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
  //Init I2C
  Wire.begin(21,22);
  report_i2c();
  
  // Initialising Sensor BMP/BME280
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

  // Initialising Sensor BMP/BME280
  bme.begin();  //I2C 0x76
  switch(bme.chipModel()) {
     case BME280::ChipModel_BME280:
       Serial.println("Found BME280 sensor");
       bBME = true;
       break;
     case BME280::ChipModel_BMP280:
       Serial.println("Found BMP280 sensor");
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
  temp = NAN;
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
  
  //Read the BME/BMP sensor
  bme.read(pres, temp, hum, BME280::TempUnit_Celsius, BME280::PresUnit_hPa);
  if ( !bBME) // Only BME280 does have humidity sensor
    hum = NAN;
  Serial.println(String("BME Temp: ") + temp + "°C\tHumidity: " + hum + "% RH\tPressure: " + pres + " hPa");
  
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
    ccs811.setEnvironmentalData( hum == NAN? 60 : hum, temp);
    ccs811.readAlgorithmResults();
    co2 = ccs811.getCO2();
    tvoc = ccs811.getTVOC();
    Serial.println(String("CCS CO2: ") + co2 + "ppm\t\tVOC: " + tvoc + "ppb");
  }
}
