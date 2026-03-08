#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <Wire.h>

// Configuration
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* mqtt_server = "broker.hivemq.com";
const char* truck_id = "Truck01";

// Pin Definitions
#define DHTPIN 4
#define DHTTYPE DHT11
#define START_BTN 13
#define END_BTN 12
#define RED_LED 14
#define BUZZER 27

// Sensor Objects
DHT dht(DHTPIN, DHTTYPE);
Adafruit_MPU6050 mpu;

// Network Objects
WiFiClient espClient;
PubSubClient client(espClient);

// Threshold Constraints
const float TEMP_THRESHOLD = 2.0;    // Max 2 Celsius allowed
const float MOTION_THRESHOLD = 0.3;  // +0.3g above baseline resting state

// Tracking Variables - Temperature (updated every 1 min, pushed every 3 min)
unsigned long lastTempRead = 0;
unsigned long lastUpload = 0;
float tempSum = 0;
float tempMin = 999.0;
float tempMax = -999.0;
int tempReadingsCount = 0;

// Tracking Variables - Motion (updated rapid)
float maxAccel = 0;
bool harshEventDetected = false;

// System State
bool tripActive = false;

void setup_wifi() {
  delay(10);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { 
    delay(500); 
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected");
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    String clientId = "ESP32Truck-";
    clientId += String(random(0xffff), HEX);
    if (client.connect(clientId.c_str())) {
      Serial.println("connected");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  setup_wifi();
  client.setServer(mqtt_server, 1883);

  // Initialize Sensors
  dht.begin();
  if (!mpu.begin()) {
    Serial.println("Failed to find MPU6050 chip - Check wiring!");
  }
  
  // Pin Configurations
  pinMode(START_BTN, INPUT_PULLUP);
  pinMode(END_BTN, INPUT_PULLUP);
  pinMode(RED_LED, OUTPUT);
  pinMode(BUZZER, OUTPUT);
  
  alarmOff(); // Ensure alarms are clear
  Serial.println("Truck Node Initialized.");
}

void alarmTrigger() {
  digitalWrite(RED_LED, HIGH);
  digitalWrite(BUZZER, HIGH);
}

void alarmOff() {
  digitalWrite(RED_LED, LOW);
  digitalWrite(BUZZER, LOW);
}

void loop() {
  if (!client.connected()) reconnect();
  client.loop();

  unsigned long currentMillis = millis();

  // --- TRIP START BUTTON ---
  if (digitalRead(START_BTN) == LOW) {
    tripActive = true;
    DynamicJsonDocument doc(256);
    doc["type"] = "trip_start";
    doc["truck_id"] = truck_id;
    char buffer[256];
    serializeJson(doc, buffer);
    client.publish("IOTBDATruckOne", buffer);
    Serial.println("Trip Started!");
    delay(1000); // Debounce
  }

  // --- TRIP END BUTTON ---
  if (digitalRead(END_BTN) == LOW) {
    tripActive = false;
    alarmOff(); // Reset physical alarms
    
    DynamicJsonDocument doc(256);
    doc["type"] = "trip_end";
    doc["truck_id"] = truck_id;
    char buffer[256];
    serializeJson(doc, buffer);
    client.publish("IOTBDATruckOne", buffer);
    Serial.println("Trip Ended!");
    delay(1000); // Debounce
  }

  // If truck isn't on a trip, we don't need to sample/alarm
  if (!tripActive) return; 

  // --- MOTION SAMPLING (Runs continually) ---
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);
  
  // Calculate total acceleration magnitude in g (9.81 m/s^2 = 1g)
  float currentAccel = sqrt(sq(a.acceleration.x) + sq(a.acceleration.y) + sq(a.acceleration.z)) / 9.81;
  // Subtracting static gravity baseline to get 'shock' variance (baseline should be approx 1.0)
  float deltaG = abs(currentAccel - 1.0); 

  if (deltaG > maxAccel) maxAccel = deltaG;
  
  // Instant Warning!
  if (deltaG > MOTION_THRESHOLD) {
    harshEventDetected = true;
    alarmTrigger();
  }

  // --- TEMPERATURE SAMPLING (Every 1 minute = 60000 ms) ---
  if (currentMillis - lastTempRead >= 60000) {
    lastTempRead = currentMillis;
    float t = dht.readTemperature();
    
    if (!isnan(t)) {
      if (t > TEMP_THRESHOLD) alarmTrigger(); // Instant Warning!
      
      tempSum += t;
      tempReadingsCount++;
      if (t < tempMin) tempMin = t;
      if (t > tempMax) tempMax = t;
    }
  }

  // --- DATA UPLOAD (Every 3 minutes = 180000 ms) ---
  if (currentMillis - lastUpload >= 180000) {
    lastUpload = currentMillis;
    
    float avgTemp = tempReadingsCount > 0 ? (tempSum / tempReadingsCount) : 0;
    
    DynamicJsonDocument doc(512);
    doc["type"] = "sensor_data";
    doc["truck_id"] = truck_id;
    
    JsonObject temperature = doc.createNestedObject("temperature");
    temperature["avg"] = avgTemp;
    temperature["min"] = tempMin == 999.0 ? 0 : tempMin;
    temperature["max"] = tempMax == -999.0 ? 0 : tempMax;
    
    JsonObject motion = doc.createNestedObject("motion");
    motion["max_accel"] = maxAccel;
    motion["harsh_event"] = harshEventDetected;

    char buffer[512];
    serializeJson(doc, buffer);
    client.publish("IOTBDATruckOne", buffer);
    Serial.println("Uploaded 3-minute summary.");

    // Reset aggregation tracking vars for next 3 minutes
    tempSum = 0; tempMin = 999.0; tempMax = -999.0; tempReadingsCount = 0;
    maxAccel = 0; harshEventDetected = false;
  }
}
