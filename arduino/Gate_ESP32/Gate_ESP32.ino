/*
 * GATE NODE WIRING (ESP32)
 * 
 * --- RFID (MFRC522v2) WIRING ---
 * RC522 Pin | ESP32 GPIO
 * -----------|------------
 * SDA (SS)   | GPIO 5
 * SCK        | GPIO 18
 * MOSI       | GPIO 23
 * MISO       | GPIO 19
 * RST        | 3.3V (tie directly to 3.3V, v2 uses software reset)
 * 3.3V       | 3.3V
 * GND        | GND
 * 
 * --- LOAD CELL (HX711) WIRING ---
 * HX711 Pin  | ESP32 Pin | Function
 * GND        | GND       | Ground connection
 * DT (Data)  | GPIO 21   | Data signal line
 * SCK (Clock)| GPIO 4    | Clock signal line
 * VCC        | 3V3       | Power (3.3V is recommended for ESP32 logic levels)

 * Wire Color | HX711 Pin | Description
 * Red        | E+        | Excitation (+) - Powers the load cell
 * Black      | E-        | Excitation (-) - Ground for the load cell
 * White      | A-        | Signal (-) - Negative output signal
 * Green      | A+        | Signal (+) - Positive output signal
 *E+ and GND are to the right side if 4 up and 6 down
 *
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <SPI.h>

// New RFID Includes
#include <MFRC522v2.h>
#include <MFRC522DriverSPI.h>
#include <MFRC522DriverPinSimple.h>
#include <MFRC522Debug.h>

// HX711 Load Cell
#include "HX711.h"

// Configuration
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* mqtt_server = "broker.hivemq.com";

WiFiClient espClient;
PubSubClient client(espClient);

// RFID Pins and Settings
#define SS_PIN 5

// Explicit SPI settings — critical for ESP32 compatibility
MFRC522DriverPinSimple ss_pin(SS_PIN);
SPIClass &spiClass = SPI;
const SPISettings spiSettings = SPISettings(SPI_CLOCK_DIV4, MSBFIRST, SPI_MODE0);
MFRC522DriverSPI driver{ss_pin, spiClass, spiSettings};
MFRC522 mfrc522{driver};

// HX711 Load Cell Pins
const int LOADCELL_DOUT_PIN = 21;
const int LOADCELL_SCK_PIN = 4;
HX711 scale;
long lastWeight = 0;
unsigned long lastStatusPrint = 0;

void setup_wifi() {
  delay(10);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { 
    delay(500); 
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected!");
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    // Create random client ID
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
  while (!Serial); // wait for serial port to connect
  delay(2000);     // Give Serial Monitor time to open

  // Setup WiFi and MQTT
  setup_wifi();
  client.setServer(mqtt_server, 1883);

  // Setup RFID
  SPI.begin(); // Ensures SPI is initialized for the ESP32
  mfrc522.PCD_Init();
  MFRC522Debug::PCD_DumpVersionToSerial(mfrc522, Serial);
  Serial.println(F("RFID Initialization Complete."));
  
  // Setup Load Cell
  Serial.println("--- Load Cell Initialization ---"); 
  scale.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN); 
   
  if (!scale.is_ready()) { 
    Serial.println("ERROR: HX711 not found! Check your VCC, GND, DT, and SCK wires."); 
  } else {
    Serial.println("Sensor found! Please wait, resetting scale to ZERO..."); 
    Serial.println("    DO NOT TOUCH THE SENSOR    "); 
    delay(2000); 
    scale.tare();  
    Serial.println("   Scale is ZEROED! You may now press on the load cell."); 
  }
  
  Serial.println("Gate Node Initialization Complete. Waiting for Trucks...");
}

void loop() {
  // We handle WiFi/MQTT connection explicitly without blocking the entire loop 
  // so we can still print to Serial monitor even when offline.
  if (WiFi.status() != WL_CONNECTED) {
    // Attempt non-blocking reconnect (or just let the user know)
    // Note: To keep loop responsive, we just report status every 5 seconds
  } else {
    if (!client.connected()) reconnect();
    if (client.connected()) client.loop();
  }

  // Periodic Status Update (Every 5 Seconds)
  if (millis() - lastStatusPrint > 5000) {
    lastStatusPrint = millis();
    Serial.println("\n--- System Status ---");
    Serial.print("WiFi: "); Serial.println(WiFi.status() == WL_CONNECTED ? "CONNECTED" : "DISCONNECTED");
    Serial.print("MQTT: "); Serial.println(client.connected() ? "CONNECTED" : "DISCONNECTED");
    Serial.print("HX711: "); Serial.println(scale.is_ready() ? "READY" : "ERROR/DISCONNECTED");
    Serial.println("---------------------\n");
  }

  // 1. Read Weight continuously to detect changes
  long currentWeight = 0;
  if (scale.is_ready()) { 
    currentWeight = scale.get_value(5); 
    if(currentWeight < 0) currentWeight = 0;

    // Print if weight changes significantly (e.g. > 50 units difference to avoid noise spam)
    if (abs(currentWeight - lastWeight) > 50) {
      Serial.print("[SENSOR] Weight Changed: ");
      Serial.println(currentWeight);
      lastWeight = currentWeight;
    }
  } else {
    // scale not ready
  }

  // 2. Check for RFID presentation
  if (mfrc522.PICC_IsNewCardPresent() && mfrc522.PICC_ReadCardSerial()) {
    
    // Read card UID
    String uid = "";
    for (byte i = 0; i < mfrc522.uid.size; i++) {
      uid += String(mfrc522.uid.uidByte[i] < 0x10 ? "0" : "");
      uid += String(mfrc522.uid.uidByte[i], HEX);
    }
    uid.toUpperCase();
    
    Serial.print(F("[SENSOR] Card Tapped - UID: "));
    Serial.println(uid);
    Serial.print(F("[SENSOR] Current Weight on Tap: "));
    Serial.println(currentWeight);

    // 3. Logic: ONLY send to broker if weight > 0 AND an RFID is tapped.
    if (currentWeight > 0) {
      Serial.println("[LOGIC] Valid conditions met (Weight > 0 + Card Tapped). Preparing payload...");

      // We assume OUTBOUND unless you add physical buttons to switch modes
      String currentDirection = "OUTBOUND";

      // Create JSON Payload
      DynamicJsonDocument doc(256);
      doc["type"] = "gate_scan";
      doc["truck_id"] = uid;
      doc["weight"] = currentWeight;
      doc["trip_direction"] = currentDirection;

      char buffer[256];
      serializeJson(doc, buffer);
      
      if (client.connected()) {
        Serial.print("[PUBLISH] Publishing to IOTBDAGateOne: ");
        Serial.println(buffer);
        client.publish("IOTBDAGateOne", buffer);
      } else {
        Serial.println("[ERROR] Cannot publish. MQTT is disconnected!");
      }

    } else {
      Serial.println("[LOGIC] Conditions NOT met! Tag tapped, but Weight is 0 or less. Not sending to broker.");
    }

    // Halt PICC to prevent multiple reads of the same card instantly
    mfrc522.PICC_HaltA();
    mfrc522.PCD_StopCrypto1();

    delay(2000); 
  }
}
