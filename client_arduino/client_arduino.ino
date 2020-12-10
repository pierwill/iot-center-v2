// Set device UUID - use generator e.g. https://www.uuidgenerator.net/version4
#define DEVICE_UUID "00000000-0000-0000-0000-000000000000"
// Set WiFi AP SSID
#define WIFI_SSID "SSID"
// Set WiFi password
#define WIFI_PASSWORD "PASSWORD"
// Set IoT Center URL - set URL where IoT Center registration API is running
#define IOT_CENTER_URL "http://IP:5000/api/env/"

//#define MEMORY_DEBUG    //Uncomment if you want to debug memory usage
#define WRITE_PRECISION WritePrecision::S
#define MAX_BATCH_SIZE 2
#define WRITE_BUFFER_SIZE 2
#define DEFAULT_CONFIG_REFRESH 3600
#define DEFAULT_MEASUREMENT_INTERVAL 60
#define MIN_FREE_MEMORY 15000   //memory leaks prevention

#if defined(ESP32)
  #include <WiFiMulti.h>
  WiFiMulti wifiMulti;
  #define DEVICE "ESP32"
#elif defined(ESP8266)
  #include <ESP8266WiFiMulti.h>
  ESP8266WiFiMulti wifiMulti;
  #define DEVICE "ESP8266"
  #define WIFI_AUTH_OPEN ENC_TYPE_NONE
#endif

#include <InfluxDbClient.h>   //InfluxDB client for Arduino
#include <InfluxDbCloud.h>    //For Influx Cloud support
#include "mirek.h" //Remove or comment it out

#define IOT_CENTER_DEVICE_URL IOT_CENTER_URL DEVICE_UUID
#define xstr(s) str(s)
#define str(s) #s


//Simple circular buffer to store measured values when offline
#include "cbuffer.h"
CircularBuffer mBuff;

extern String tempSens, humSens, presSens, co2Sens, tvocSens, gpsSens;
extern void setupSensors();
extern void readSensors( tMeasurement* ppm);
double defaultLatitude(NAN), defaultLongitude(NAN);

// InfluxDB client
InfluxDBClient client;
// Data point
Point envData("environment");
// How often the device should read configuration in seconds
int configRefresh = DEFAULT_CONFIG_REFRESH;
// How often the device should transmit measurements in seconds
int measurementInterval = DEFAULT_MEASUREMENT_INTERVAL;
//Time of the last config load
unsigned long loadConfigTime;

//Load value for specific parameter
String loadParameter( const String& response, const char* param) {
  int i = response.indexOf(param);
  if (i == -1) {
    Serial.print("Error - missing parameter: ");
    Serial.println( param);
    return "";
  }
  return response.substring( response.indexOf(":", i) + 2, response.indexOf("\n", i));
}

//Convert IP address into String
String IpAddress2String(const IPAddress& ipAddress) {
  return String(ipAddress[0]) + String(".") + String(ipAddress[1]) + String(".") + String(ipAddress[2]) + String(".") + String(ipAddress[3]);
}

//Load configuration from IoT Center
HTTPClient http_config;
void configSync() {
/*
<<<<<<< HEAD
Response example:
influx_url: http://localhost:9999
=======
Example response:
influx_url: http://localhost:8086
>>>>>>> 931a1fce76be327cd840b1cbf887b6fba488d9d6
influx_org: my-org
influx_token: x0102CguGaU7qoJWftHUTV5wk5J-s6pZ_4WAIQjAmqU91EXxSKh4Am1p8URyNx9nfeU9TuGMtFUH85crAHO1Is==
influx_bucket: iot_center
id: 857b4466-2bbb-48e5-9f51-d3eef385e4a8
default_lon: 14.4071543
default_lat: 50.0873254
measurement_interval: 60
newlyRegistered: false
createdAt: 2020-09-15T12:40:12.4796108+02:00
updatedAt: 2020-09-15T12:40:12.4796108+02:00
serverTime: 2020-09-15T12:19:17.319Z
configuration_refresh: 3600
*/
  // Load config from IoT Center
  String payload;
  Serial.println("Connecting " IOT_CENTER_DEVICE_URL);
  http_config.begin( IOT_CENTER_DEVICE_URL);
  http_config.addHeader("Accept", "text/plain");
  int httpCode = http_config.GET();
  if (httpCode == HTTP_CODE_OK) {
    payload = http_config.getString();
    Serial.println( "--Received configuration");
    Serial.print(payload);
    Serial.println("--end");
  } else {
    Serial.print("[HTTP] GET failed, error: ");
    Serial.println( http_config.errorToString(httpCode).c_str());
  }
  http_config.end();

  //Parse response, if exists
  if ( payload.length() > 0) {

    //Sync time from IoT Cenetr
    String iotTime = loadParameter( payload, "serverTime");
    tm tmServer;
    strptime(iotTime.c_str(), "%Y-%m-%dT%H:%M:%S.%f", &tmServer);
    time_t ttServer = mktime(&tmServer);
    struct timeval tvServer = { .tv_sec = ttServer };
    settimeofday(&tvServer, NULL);

    // Show time
    ttServer = time(nullptr);
    Serial.print("Set time: ");
    Serial.print(String(ctime(&ttServer)));

    //Load InfluxDB parameters
    String influxdbURL = loadParameter( payload, "influx_url");
    String influxdbOrg = loadParameter( payload, "influx_org");
    String influxdbToken = loadParameter( payload, "influx_token");
    String influxdbBucket = loadParameter( payload, "influx_bucket");

    // Set InfluxDB parameters
    client.setConnectionParams(influxdbURL.c_str(), influxdbOrg.c_str(), influxdbBucket.c_str(), influxdbToken.c_str(), InfluxDbCloud2CACert);

    //Load refresh parameters
    measurementInterval = loadParameter( payload, "measurement_interval").toInt();
    if (measurementInterval == 0)
      measurementInterval = DEFAULT_MEASUREMENT_INTERVAL;
    //Serial.println(measurementInterval);

    configRefresh = loadParameter( payload, "configuration_refresh").toInt();
    if (configRefresh == 0)
      configRefresh = DEFAULT_CONFIG_REFRESH;
    //Serial.println(configRefresh);

    //Enable messages batching and retry buffer
    WriteOptions wrOpt;
    wrOpt.writePrecision( WRITE_PRECISION).batchSize( MAX_BATCH_SIZE).bufferSize( WRITE_BUFFER_SIZE).addDefaultTag( "clientId", DEVICE_UUID).addDefaultTag( "Device", DEVICE);
    client.setWriteOptions(wrOpt);

    HTTPOptions htOpt;
    htOpt.connectionReuse(measurementInterval <= 20);
    client.setHTTPOptions(htOpt);

    // Check InfluxDB server connection
    if (client.validateConnection()) {
      Serial.print("Connected to InfluxDB: ");
      Serial.println(client.getServerUrl());
    } else {
      Serial.print("InfluxDB connection failed: ");
      Serial.println(client.getLastErrorMessage());
    }

    defaultLatitude = loadParameter( payload, "default_lat").toDouble();
    defaultLongitude = loadParameter( payload, "default_lon").toDouble();
  } else {
    Serial.println("[HTTP] GET failed, emty response");
  }
  loadConfigTime = millis();
}

// Add sensor type as tag
void addSensorTag( const char* tagName, float value, String sensor) {
  if ( isnan(value) || (sensor == ""))  //No sensor, exit
    return;
  envData.addTag( tagName, sensor);
}

// Convert measured values into InfluxDB point
void measurementToPoint( tMeasurement* ppm, Point& point) {
  // Clear tags (except default ones) and fields
  envData.clearTags();
  envData.clearFields();

  // Add InfluxDB tags
  addSensorTag( "TemperatureSensor", ppm->temp, tempSens);
  addSensorTag( "HumiditySensor", ppm->hum, humSens);
  addSensorTag( "PressureSensor", ppm->pres, presSens);
  addSensorTag( "CO2Sensor", ppm->co2, co2Sens);
  addSensorTag( "TVOCSensor", ppm->tvoc, tvocSens);
  addSensorTag( "GPSSensor", ppm->latitude, gpsSens);

  // Report measured values. If NAN, addField will skip it
  point.setTime( ppm->timestamp);
  point.addField("Temperature", ppm->temp);
  point.addField("Humidity", ppm->hum);
  point.addField("Pressure", ppm->pres);
  if ( !isnan(ppm->co2))
    point.addField("CO2", uint16_t(ppm->co2));
  if ( !isnan(ppm->tvoc))
    point.addField("TVOC", uint16_t(ppm->tvoc));
  point.addField("Lat", ppm->latitude, 6);
  point.addField("Lon", ppm->longitude, 6);
}

#if defined(MEMORY_DEBUG)
//Only for memory debug puproses - detect memory leaks
void printHeap( const char* location){
  Serial.print(location);
  Serial.print(" - Free: ");
#if defined(ESP8266)  
  Serial.println(ESP.getFreeHeap());
#elif defined(ESP32)  
  Serial.print(ESP.getFreeHeap());
  Serial.print(" Min: ");
  Serial.print(ESP.getMinFreeHeap());
  Serial.print(" Size: ");
  Serial.print(ESP.getHeapSize());
  Serial.print(" Alloc: ");
  Serial.println(ESP.getMaxAllocHeap());
#endif
  if (client.isBufferEmpty()) {
    Point memData("memory");
    memData.addTag( "Code", location);
    memData.addField("Free", ESP.getFreeHeap());
#if defined(ESP32)    
    memData.addField("Min", ESP.getMinFreeHeap());
    memData.addField("Size", ESP.getHeapSize());
    memData.addField("Alloc", ESP.getMaxAllocHeap());
#endif    
    client.writePoint(memData);
    client.flushBuffer();
  }
}
#else
#define printHeap(s)
#endif

// Arduino main setup fuction
void setup() {
  //Prepare logging
  Serial.begin(115200);
  delay(500);
  printHeap("setup start");

  // Initialize sensors
  setupSensors();

  // Setup wifi
  WiFi.mode(WIFI_STA);
  wifiMulti.addAP(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Connecting to wifi");
  while (wifiMulti.run() != WL_CONNECTED) {
    Serial.print(".");
    delay(100);
  }
  Serial.println();
  Serial.println("Connected " + WiFi.SSID() + " " + IpAddress2String(WiFi.localIP()));

  // Load configuration including time
  configSync();
  printHeap("setup exit");
}

// Arduino main loop function
void loop() {
  printHeap("loop");
  // Read actual time to calculate final delay
  unsigned long loopTime = millis();

  // Read measurements from all the sensors
  tMeasurement* pm = mBuff.getTail();
  pm->timestamp = time(nullptr);
  readSensors( pm);

  // Convert measured values into InfluxDB point
  measurementToPoint( pm, envData);

  // Write point into buffer
  unsigned long writeTime = millis();

  if (!isnan(pm->temp)) { //Write to InfluxDB only if we have a valid temperature
    if ( client.isBufferEmpty()) { //Only if InfluxDB client buffer is flushed, write new data
      // Print what are we exactly writing
      Serial.print("Writing: ");
      Serial.println(client.pointToLineProtocol(envData));
      client.writePoint(envData);
    } else {
      if (mBuff.isFull())
        Serial.println("Error, full cBuffer, dropping the oldest record");
      Serial.print("Writing to cBuffer: ");
      Serial.println(client.pointToLineProtocol(envData));
      mBuff.enqueue();            //if we already have data in InfluxDB client buffer, save to circular buffer
      Serial.print("cBuffer size: ");
      Serial.print( mBuff.size() + 1);  //One record is allocated for actual write
      Serial.println(" of " xstr(OFFLINE_BUFFER_SIZE));
    }
  } else
    Serial.println("Error, missing temperature, skipping write");

  // If no Wifi signal, try to reconnect it
  if ((WiFi.status() != WL_CONNECTED) && (wifiMulti.run() != WL_CONNECTED))
    Serial.println("Error, Wifi connection lost");

  // End of the iteration - force write of all the values into InfluxDB as single transaction
  if (client.flushBuffer()) {
    //Write circular buffer if not empty
    while (client.isBufferEmpty() && !mBuff.isEmpty()) {
      pm = mBuff.dequeue();
      measurementToPoint( pm, envData);
      Serial.print("Restoring from cBuffer: ");
      Serial.println(client.pointToLineProtocol(envData));
      client.writePoint(envData);
      client.flushBuffer();
    }
  } else {
    Serial.print("Error, InfluxDB flush failed: ");
    Serial.println(client.getLastErrorMessage());
    if ( client.isBufferFull())
      Serial.println("Full client buffer");
  }

  // Test wheter synce sync configuration and configuration from IoT center
  if ((loadConfigTime > millis()) || ( millis() >= loadConfigTime + (configRefresh * 1000))) {
    if (ESP.getFreeHeap() < MIN_FREE_MEMORY) {    //if low memory, restart
      printHeap("low memory");
      ESP.restart();
    }
    printHeap("config start");
    configSync();
    printHeap("config exit");
  }

  // Calculate sleep time
  long delayTime = (measurementInterval * 1000) - (millis() - writeTime) - (writeTime - loopTime);

  if (delayTime <= 0) {
    Serial.println("Warning, too slow processing");
    delayTime = 0;
  }

  if (delayTime > measurementInterval * 1000) {
    Serial.println("Error, time overflow");
    delayTime = measurementInterval * 1000;
  }

  // Sleep remaining time
  Serial.print("Wait: ");
  Serial.println( delayTime);
  delay(delayTime);
}
