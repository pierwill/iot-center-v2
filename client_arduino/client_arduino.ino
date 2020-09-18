//environment,clientID=6cc2e939-af25-45fa-be6c-2241d53aa3de,device=ESP8266,sensor=BME280+CCS811 Temperature=10.21,Humidity=62.36,Pressure=983.72,CO2=1337i,TVOC=28425i,Lat=50.126144,Lon=14.504621

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
// IoT Center URL - set real URL wher IoT Center is running
#define IOT_CENTER_URL "http://IP:5000/api/env/"
// Define device UUID - use generator e.g. https://www.uuidgenerator.net/version4
#define DEVICE_UUID "00000000-0000-0000-0000-000000000000"

#define WRITE_PRECISION WritePrecision::S
#define MAX_BATCH_SIZE 10
#define WRITE_BUFFER_SIZE 30

#include "mirek.h"

#define IOT_CENTER_API_URL IOT_CENTER_URL DEVICE_UUID
// InfluxDB client
InfluxDBClient client;
// Data point
Point envData("environment");
// Number for loops to sync new configuration
int iterations = 0;
int configRefresh = 360;
int 

String loadParameter( const String& response, const char* param) {
  int i = response.indexOf(param);
  if (i == -1) {
    Serial.print("Error - missing parameter: ");
    Serial.println( param);
    return "";
  }
  return response.substring( response.indexOf(":", i) + 2, response.indexOf("\n", i));  
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
  http.begin( IOT_CENTER_API_URL);
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
    Serial.println(String(ctime(&ttServer)));

    //Load InfluxDB parameters
    String influxdbURL = loadParameter( payload, "influx_url");
    String influxdbOrg = loadParameter( payload, "influx_org");
    String influxdbToken = loadParameter( payload, "influx_token");
    String influxdbBucket = loadParameter( payload, "influx_bucket");
    
    // Set InfluxDB parameters
    client.setConnectionParams(influxdbURL.c_str(), influxdbOrg.c_str(), influxdbBucket.c_str(), influxdbToken.c_str(), InfluxDbCloud2CACert);

    //Enable messages batching and retry buffer
    WriteOptions wrOpt;
    wrOpt.writePrecision( WRITE_PRECISION).batchSize( MAX_BATCH_SIZE).bufferSize( WRITE_BUFFER_SIZE);
    client.setWriteOptions(wrOpt);

    // Check server connection
    if (client.validateConnection()) {
      Serial.print("Connected to InfluxDB: ");
      Serial.println(client.getServerUrl());
    } else {
      Serial.print("InfluxDB connection failed: ");
      Serial.println(client.getLastErrorMessage());
    }

    //Load refersh parameters
    int influxdbInt = loadParameter( payload, "measurement_interval").toInt();
    Serial.println(influxdbInt);
    int influxdbRefr = loadParameter( payload, "configuration_refresh").toInt();
    Serial.println(influxdbRefr);
  } else {
    Serial.println("[HTTP] GET failed, emty response"); 
  }
}

void setup() {
  Serial.begin(115200);

  // Setup wifi
  WiFi.mode(WIFI_STA);
  wifiMulti.addAP(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Connecting to wifi");
  while (wifiMulti.run() != WL_CONNECTED) {
    Serial.print(".");
    delay(100);
  }
  Serial.println();

  // Load configuration including time
  configSync();

  // Add tags
  envData.addTag("clientID", DEVICE_UUID);
  envData.addTag("device", DEVICE);
  envData.addTag("sensor", "BME280+GPS"); //TODO select sensor
}

void loop() {
  // Sync time for batching once per hour
  if (iterations++ >= 360) {
    configSync();
    iterations = 0;
  }

  // Report RSSI of currently connected network
  envData.setTime(time(nullptr));
  envData.addField("Temperature", 10.21);
  envData.addField("Humidity", 62.36);
  envData.addField("Pressure", 983.72);
  envData.addField("CO2", 1337);
  envData.addField("TVOC", 284);
  envData.addField("Lat", 50.126144);
  envData.addField("Lon", 14.504621);

  // Print what are we exactly writing
  Serial.print("Writing: ");
  Serial.println(envData.toLineProtocol());

  // Write point into buffer - high priority measure
  //client.writePoint(envData);

  // Clear fields for next usage. Tags remain the same.
  envData.clearFields();

  // If no Wifi signal, try to reconnect it
  if ((WiFi.RSSI() == 0) && (wifiMulti.run() != WL_CONNECTED))
    Serial.println("Wifi connection lost");

  // End of the iteration - force write of all the values into InfluxDB as single transaction
  Serial.println("Flushing data into InfluxDB");
  if (!client.flushBuffer()) {
    Serial.print("InfluxDB flush failed: ");
    Serial.println(client.getLastErrorMessage());
    Serial.print("Full buffer: ");
    Serial.println(client.isBufferFull() ? "Yes" : "No");
  }

  //Wait 10s
  Serial.println("Wait 60s");
  delay(60000);
}
