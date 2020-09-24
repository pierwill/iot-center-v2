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

// WiFi AP SSID
#define WIFI_SSID "SSID"
// WiFi password
#define WIFI_PASSWORD "PASSWORD"
// IoT Center URL - set real URL where IoT Center is running
#define IOT_CENTER_URL "http://IP:5000/api/env/"
// Define device UUID - use generator e.g. https://www.uuidgenerator.net/version4
#define DEVICE_UUID "00000000-0000-0000-0000-000000000000"

#define WRITE_PRECISION WritePrecision::S
#define MAX_BATCH_SIZE 10
#define WRITE_BUFFER_SIZE 30
#define DEFAULT_CONFIG_REFRESH 360
#define DEFAULT_MEASUREMENT_INTERVAL 10

#include "mirek.h"

#define IOT_CENTER_DEVICE_URL IOT_CENTER_URL DEVICE_UUID

// From sensors.ino
extern float temp, hum, pres, co2, tvoc;
extern double latitude, longitude;

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

String loadParameter( const String& response, const char* param) {
  int i = response.indexOf(param);
  if (i == -1) {
    Serial.print("Error - missing parameter: ");
    Serial.println( param);
    return "";
  }
  return response.substring( response.indexOf(":", i) + 2, response.indexOf("\n", i));  
}

String IpAddress2String(const IPAddress& ipAddress) {
  return String(ipAddress[0]) + String(".") + String(ipAddress[1]) + String(".") + String(ipAddress[2]) + String(".") + String(ipAddress[3]); 
}

void configSync() {
/*  
influx_url: http://localhost:9999
influx_org: my-org
influx_token: x0102CguGaU7qoJWftHUTV5wk5J-s6pZ_4WAIQjAmqU9zEXESKh4Am1p8URyNx9nfeU9TuGMtFUH85crAHO1IQ==
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
  HTTPClient http;
  Serial.println("Connecting " IOT_CENTER_DEVICE_URL);
  http.begin( IOT_CENTER_DEVICE_URL);
  http.addHeader("Accept", "text/plain");
  int httpCode = http.GET();
  String payload;
  // httpCode will be negative on error
  if (httpCode == HTTP_CODE_OK) {
    payload = http.getString();
    Serial.println( "--Received configuration");
    Serial.print(payload);
    Serial.println("--end");
  } else {
    Serial.print("[HTTP] GET failed, error: ");
    Serial.println( http.errorToString(httpCode).c_str());
  }
  http.end();

  //Parse response
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
    Serial.print("Synchronized time: ");
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
    //Serial.println(influxdbInt);
    configRefresh = loadParameter( payload, "configuration_refresh").toInt();
    if (configRefresh == 0)
      configRefresh = DEFAULT_CONFIG_REFRESH;
    //Serial.println(configRefresh);
    
    //Enable messages batching and retry buffer
    WriteOptions wrOpt;
    wrOpt.writePrecision( WRITE_PRECISION).batchSize( MAX_BATCH_SIZE).bufferSize( WRITE_BUFFER_SIZE);
    client.setWriteOptions(wrOpt);
    
    HTTPOptions htOpt;
    htOpt.connectionReuse(measurementInterval <= 20);
    client.setHTTPOptions(htOpt);

    // Check server connection
    if (client.validateConnection()) {
      Serial.print("Connected to InfluxDB: ");
      Serial.println(client.getServerUrl());
    } else {
      Serial.print("InfluxDB connection failed: ");
      Serial.println(client.getLastErrorMessage());
    }

    latitude = loadParameter( payload, "default_lat").toDouble();
    longitude = loadParameter( payload, "default_lon").toDouble();
  } else {
    Serial.println("[HTTP] GET failed, emty response"); 
  }
  loadConfigTime = millis();
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  
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

  // Add tags
  envData.addTag("clientId", DEVICE_UUID);
  envData.addTag("device", DEVICE);
  envData.addTag("sensor", getSensorsList());
}

void loop() {
  unsigned long loopTime = millis();
  
  // Read values from all the sensors
  readSensors();
  
  // Report measured values
  envData.setTime(time(nullptr));
  envData.addField("Temperature", temp);
  envData.addField("Humidity", hum);
  envData.addField("Pressure", pres);
  if ( !isnan(co2))
    envData.addField("CO2", uint16_t(co2));
  if ( !isnan(tvoc))
    envData.addField("TVOC", uint16_t(tvoc));
  envData.addField("Lat", latitude, 6);
  envData.addField("Lon", longitude, 6);

  // Print what are we exactly writing
  Serial.print("Writing: ");
  Serial.println(envData.toLineProtocol());

  // Write point into buffer
  unsigned long writeTime = millis();

  if (!isnan(temp)) //Write only if we have valid temperature
    client.writePoint(envData);
  else
    Serial.println("Error, missing temperature, skipping write");

  // Clear fields for next usage. Tags remain the same.
  envData.clearFields();

  // If no Wifi signal, try to reconnect it
  if ((WiFi.RSSI() == 0) && (wifiMulti.run() != WL_CONNECTED))
    Serial.println("Wifi connection lost");

  // End of the iteration - force write of all the values into InfluxDB as single transaction
  if (!client.flushBuffer()) {
    Serial.print("InfluxDB flush failed: ");
    Serial.println(client.getLastErrorMessage());
    Serial.print("Full buffer: ");
    Serial.println(client.isBufferFull() ? "Yes" : "No");
  }

  // Sync time for batching once per hour
  if ((loadConfigTime > millis()) || ( millis() >= loadConfigTime + (configRefresh * 1000)))
    configSync();   

  // Calculate sleep time
  long delayTime = (measurementInterval * 1000) - (millis() - writeTime) - (writeTime - loopTime);

  if (delayTime < 0) {
    Serial.println("Warning, too slow processing");
    delayTime = 0; 
  }
  
  if (delayTime > measurementInterval * 1000) {
    Serial.println("Error, time overflow");
    delayTime = measurementInterval * 1000;
  }
    
  Serial.print("Wait: ");
  Serial.println( delayTime);
  delay(delayTime);
}
