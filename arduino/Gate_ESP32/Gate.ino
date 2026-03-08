#include <MFRC522v2.h>
#include <MFRC522DriverSPI.h>
#include <MFRC522DriverPinSimple.h>
#include <MFRC522Debug.h>
#include "HX711.h"
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// --- RFID Pins ---
#define SS_PIN 5

// --- HX711 Pins ---
const int LOADCELL_DOUT_PIN = 32;
const int LOADCELL_SCK_PIN  = 4;

// --- Network & MQTT ---
const char* ssid = "Thassaraz";
const char* password = "123456789";
const char* mqtt_server = "broker.hivemq.com";

WiFiClient espClient;
PubSubClient client(espClient);

// --- Logic Tuning ---
const float minimumUploadValue = 0.0; // grams. Only send to broker if weight > this value.

// --- HX711 Tuning ---
const float DIVIDER   = 230.0;
const float OFFSET    = 0.0;
const float ZERO_BAND = 5.0;  // snap to 0 if within ±5g

// --- RFID Setup ---
MFRC522DriverPinSimple ss_pin(SS_PIN);
SPIClass &spiClass = SPI;
const SPISettings spiSettings = SPISettings(SPI_CLOCK_DIV4, MSBFIRST, SPI_MODE0);
MFRC522DriverSPI driver{ss_pin, spiClass, spiSettings};
MFRC522 mfrc522{driver};

// --- HX711 Setup ---
HX711 scale;
bool lastWiFiState = false;
bool lastMQTTState = false;

void setup_wifi() {
  delay(10);
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { 
    delay(500); 
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected!");
}

void reconnect() {
  while (!client.connected() && WiFi.status() == WL_CONNECTED) {
    Serial.print("Attempting MQTT connection...");
    String clientId = "ESP32Gate-";
    clientId += String(random(0xffff), HEX);
    
    if (client.connect(clientId.c_str())) {
      Serial.println("connected");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  while (!Serial);

  // Init WiFi
  setup_wifi();
  client.setServer(mqtt_server, 1883);

  // Init RFID
  mfrc522.PCD_Init();
  MFRC522Debug::PCD_DumpVersionToSerial(mfrc522, Serial);
  Serial.println(F("RFID reader ready."));

  // Init Scale
  scale.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);
  if (!scale.is_ready()) {
    Serial.println("ERROR: HX711 not found!");
    while (1);
  }

  Serial.println("Zeroing scale... DO NOT TOUCH for 3 seconds.");
  delay(3000);
  scale.tare();
  Serial.println("Scale zeroed! Ready — scan a card.\n");
}

void loop() {
  bool currentWiFiState = (WiFi.status() == WL_CONNECTED);
  
  // Ensure we are connected without blocking the main loop aggressively
  if (!currentWiFiState) {
    // optional: attempt reconnect or wait for auto-reconnect
  } else {
    if (!client.connected()) reconnect();
    if (client.connected()) client.loop();
  }

  bool currentMQTTState = client.connected();

  // Print Status Update ONLY when a connection state changes
  if (currentWiFiState != lastWiFiState || currentMQTTState != lastMQTTState) {
    lastWiFiState = currentWiFiState;
    lastMQTTState = currentMQTTState;
    
    Serial.println("\n--- System Status Changed ---");
    Serial.print("WiFi: "); Serial.println(currentWiFiState ? "CONNECTED" : "DISCONNECTED");
    Serial.print("MQTT: "); Serial.println(currentMQTTState ? "CONNECTED" : "DISCONNECTED");
    Serial.println("-----------------------------\n");
  }

  // Wait for a new RFID card
  if (!mfrc522.PICC_IsNewCardPresent() || !mfrc522.PICC_ReadCardSerial()) {
    return;
  }

  // Read card UID
  String uidStr = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    uidStr += String(mfrc522.uid.uidByte[i] < 0x10 ? "0" : "");
    uidStr += String(mfrc522.uid.uidByte[i], HEX);
  }
  uidStr.toUpperCase();

  // Print UID
  Serial.print(F("UID: "));
  MFRC522Debug::PrintUID(Serial, mfrc522.uid);
  Serial.println();

  // Print card type
  MFRC522::PICC_Type piccType = mfrc522.PICC_GetType(mfrc522.uid.sak);
  Serial.print(F("Card type: "));
  Serial.println(MFRC522Debug::PICC_GetTypeName(piccType));

  float grams = 0;
  // Read weight
  if (scale.is_ready()) {
    long raw = scale.get_value(10);
    grams = (raw / DIVIDER) + OFFSET;
    if (abs(grams) <= ZERO_BAND) grams = 0.0;

    Serial.print(F("Weight: "));
    Serial.print(grams, 1);
    Serial.println(F(" g"));
  } else {
    Serial.println(F("Weight: HX711 not ready"));
  }

  // --- MQTT LOGIC ---
  if (grams > minimumUploadValue) {
    Serial.println("[LOGIC] Conditions met. Preparing ...");
    
    // Create JSON Payload
    DynamicJsonDocument doc(256);
    doc["type"] = "gate_scan";
    doc["truck_id"] = uidStr;
    doc["weight"] = grams;
    doc["trip_direction"] = "TOBEDECLARED";

    // Use a String to serialize safely and avoid memory corruption / garbage characters
    String payload;
    serializeJson(doc, payload);
    
    if (client.connected()) {
      Serial.print("[PUBLISH] Sending to IOTBDAGateOne: ");
      //Serial.println(payload);
      client.publish("IOTBDAGateOne", payload.c_str());
    } else {
      Serial.println("[ERROR] Cannot publish. MQTT is disconnected!");
    }
  } else {
    Serial.print("[LOGIC] Ignored. Weight (");
    Serial.print(grams, 1);
    Serial.print("g) is not greater than minimumUploadValue (");
    Serial.print(minimumUploadValue, 1);
    Serial.println("g).");
  }

  Serial.println(F("----------------------------------------"));

  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();

  delay(2000); // debounce — prevent double-reads
}