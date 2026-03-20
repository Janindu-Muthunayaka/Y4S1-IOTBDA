#include <Wire.h>
#include <DHT.h>
#include <MPU6050.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ===================== WiFi =====================
const char* ssid     = "LOQ7929";
const char* password = "12345678";

// ===================== MQTT =====================
const char* mqtt_server = "broker.hivemq.com";
const int   mqtt_port   = 1883;
const char* mqtt_topic  = "IOTBDATruckOne";
const char* client_id   = "ESP32_CargoLink_01";

WiFiClient   espClient;
PubSubClient client(espClient);

// ===================== DHT11 =====================
#define DHTPIN  4
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

// ===================== MPU6050 =====================
MPU6050 mpu;

// ===================== PINS =====================
#define TEMP_LED_PIN   2
#define SHOCK_LED_PIN  18
#define BUTTON_PIN     15

// ===================== TRIP STATE =====================
const String truckID = "C3809540";
bool   tripStarted   = false;
String tripID        = "TRIP-001";

// ===================== BUTTON DEBOUNCE =====================
int           lastButtonReading = HIGH;
int           buttonState       = HIGH;
unsigned long lastDebounceTime  = 0;
const unsigned long debounceDelay = 50;

// ===================== TIMING =====================
unsigned long lastPublishTime     = 0;
const unsigned long publishInterval = 2000; // One combined publish every 2s

// ===================== LATEST SENSOR VALUES =====================
// Stored globally so both sensors feed into one single publish
float latestSimTemp    = 0.0;
bool  latestTempAlert  = false;
float latestShockG     = 0.0;
bool  latestShockAlert = false;

// ===================== TEMPERATURE SIMULATION =====================
float REAL_TEMP_MIN  = 26.0;
float REAL_TEMP_MAX  = 30.0;
float SIM_TEMP_MIN   = -2.0;
float SIM_TEMP_MAX   =  6.0;
float SAFE_TEMP_LOW  = -2.0;
float SAFE_TEMP_HIGH =  4.0;

// ===================== SHOCK THRESHOLD =====================
float SHOCK_THRESHOLD = 0.1;

// ===================== HELPER =====================
float mapFloat(float x, float in_min, float in_max,
               float out_min, float out_max) {
  return (x - in_min) * (out_max - out_min) /
         (in_max - in_min) + out_min;
}

// ===================== WiFi =====================
void setupWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected. IP: " + WiFi.localIP().toString());
}

// ===================== MQTT RECONNECT =====================
void reconnectMQTT() {
  while (!client.connected()) {
    Serial.print("Connecting to MQTT broker...");
    if (client.connect(client_id)) {
      Serial.println("connected!");
    } else {
      Serial.print("failed rc=");
      Serial.print(client.state());
      Serial.println(" — retrying in 3s");
      delay(3000);
    }
  }
}

// ===================== SINGLE COMBINED PUBLISH =====================
void publishCombined() {
  StaticJsonDocument<256> doc;
  doc["truck_id"]    = truckID;
  doc["trip_id"]     = tripID;
  doc["temperature"] = round(latestSimTemp * 100.0) / 100.0;
  doc["shock_g"]     = round(latestShockG  * 100.0) / 100.0;
  doc["temp_alert"]  = latestTempAlert;
  doc["shock_alert"] = latestShockAlert;
  doc["timestamp"]   = millis();

  char payload[256];
  serializeJson(doc, payload);

  if (!client.connected()) reconnectMQTT();
  if (client.publish(mqtt_topic, payload)) {
    Serial.println("Published: " + String(payload));
  } else {
    Serial.println("Publish FAILED!");
  }
}

// ===================== READ TEMPERATURE =====================
void readTemperature() {
  float realTemp = dht.readTemperature();
  if (isnan(realTemp)) {
    Serial.println("Error: DHT11 read failed!");
    digitalWrite(TEMP_LED_PIN, HIGH);
    return;
  }

  latestSimTemp  = mapFloat(realTemp,
                            REAL_TEMP_MIN, REAL_TEMP_MAX,
                            SIM_TEMP_MIN,  SIM_TEMP_MAX);
  latestTempAlert = (latestSimTemp > SAFE_TEMP_HIGH ||
                     latestSimTemp < SAFE_TEMP_LOW);

  digitalWrite(TEMP_LED_PIN, latestTempAlert ? HIGH : LOW);

  Serial.println("Temp | Room: "    + String(realTemp)      + "C" +
                 "  Simulated: "    + String(latestSimTemp)  + "C" +
                 "  Alert: "        + String(latestTempAlert));
}

// ===================== READ SHOCK =====================
void readShock() {
  int16_t ax, ay, az, gx, gy, gz;
  mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);

  float accelX = ax / 16384.0;
  float accelY = ay / 16384.0;
  float accelZ = az / 16384.0;
  float total  = sqrt(accelX*accelX + accelY*accelY + accelZ*accelZ);

  latestShockG     = abs(total - 1.0);
  latestShockAlert = (latestShockG > SHOCK_THRESHOLD);

  digitalWrite(SHOCK_LED_PIN, latestShockAlert ? HIGH : LOW);

  Serial.println("Shock | G: " + String(latestShockG) +
                 "  Alert: "   + String(latestShockAlert));
}

// ===================== BUTTON =====================
// Simple toggle: press = start, press again = end
void handleButton() {
  int reading = digitalRead(BUTTON_PIN);

  if (reading != lastButtonReading) lastDebounceTime = millis();

  if ((millis() - lastDebounceTime) > debounceDelay) {
    if (reading != buttonState) {
      buttonState = reading;

      if (buttonState == LOW) {
        tripStarted = !tripStarted;

        if (tripStarted) {
          lastPublishTime = 0; // Publish immediately on start
          Serial.println("======================================");
          Serial.println("TRIP STARTED | ID: " + tripID);
          Serial.println("Truck ID    : " + truckID);
          Serial.println("======================================");
        } else {
          Serial.println("======================================");
          Serial.println("TRIP ENDED  | ID: " + tripID);
          Serial.println("======================================");
          digitalWrite(TEMP_LED_PIN,  LOW);
          digitalWrite(SHOCK_LED_PIN, LOW);
        }
      }
    }
  }

  lastButtonReading = reading;
}

// ===================== SETUP =====================
void setup() {
  Serial.begin(115200);
  delay(2000);

  dht.begin();
  Wire.begin(21, 22);
  mpu.initialize();

  pinMode(TEMP_LED_PIN,  OUTPUT);
  pinMode(SHOCK_LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN,    INPUT_PULLUP);

  digitalWrite(TEMP_LED_PIN,  LOW);
  digitalWrite(SHOCK_LED_PIN, LOW);

  setupWiFi();
  client.setServer(mqtt_server, mqtt_port);

  Serial.println("======================================");
  Serial.println(" Smart Fish Transportation Monitoring ");
  Serial.println(" Truck ID: " + truckID);
  Serial.println(" Press button to START trip.");
  Serial.println("======================================");
}

// ===================== LOOP =====================
void loop() {
  if (!client.connected()) reconnectMQTT();
  client.loop();

  handleButton();

  if (tripStarted) {
    unsigned long now = millis();
    if (now - lastPublishTime >= publishInterval) {
      lastPublishTime = now;
      readTemperature(); // Updates latestSimTemp + latestTempAlert
      readShock();       // Updates latestShockG  + latestShockAlert
      publishCombined(); // ONE single message with both values
    }
  }
}