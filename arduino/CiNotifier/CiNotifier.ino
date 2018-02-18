#include <SPI.h>
#include <LiquidCrystal.h>
#include <SakuraIO.h>

#define PIN_R 3
#define PIN_G 5
#define PIN_B 6
#define LCD_LINES 4
#define MAX_NAME_LEN 16
#define MAX_BUILD_STATE_LEN 3

#define CHANNEL_CMD        0
#define CHANNEL_PART_STR   1
#define CHANNEL_ANIM_COLOR 2

// #define DEBUG

const uint8_t BOOT_COLOR[] = {
  0b00111111,
  0b00000000,
  0b00111111
};

typedef struct _BranchState {
  char branchName[MAX_NAME_LEN + 1];
  char buildState[MAX_BUILD_STATE_LEN + 1];
} BranchState;

LiquidCrystal lcd(10);
SakuraIO_SPI sakuraio(9);

BranchState gBranchStatus[LCD_LINES];
char gPartStrBuf[MAX_NAME_LEN + 1];
int gPartStrIdx = 0;
uint16_t gLoopCount = 0;

void printLcd(uint8_t col, uint8_t row, char* str, uint8_t range) {
  char buf[range + 1];
  memset(buf, ' ', sizeof(buf));
  for (int i = 0; i < range; i++) {
    if (str[i] == '\0') {
      break;
    }
    buf[i] = str[i];
  }
  buf[range] = '\0';

  lcd.setCursor(col, row);
  lcd.print(buf);
}

void setColor(uint8_t r, uint8_t g, uint8_t b) {
  analogWrite(PIN_R, r);
  analogWrite(PIN_G, g);
  analogWrite(PIN_B, b);

#ifdef DEBUG
  Serial.print(r);
  Serial.print(",");
  Serial.print(g);
  Serial.print(",");
  Serial.print(b);
  Serial.println();
#endif
}

void rainbow(uint16_t intervalMsec, uint16_t loopCount) {
  int delayPerStep = 20;
  int intervalColor = intervalMsec / 3;

  uint16_t endMSec = intervalMsec * loopCount;
  for (uint16_t t = 0; t < endMSec; t += delayPerStep) {
    uint16_t f = (t / intervalColor) % 3;
    uint16_t v = t % intervalColor;
    setColor(
      map((f == 0) ? (intervalColor - v) : (f == 2) ? (v) : (0), 0, intervalColor, 0, 0xFF),
      map((f == 1) ? (intervalColor - v) : (f == 0) ? (v) : (0), 0, intervalColor, 0, 0xFF),
      map((f == 2) ? (intervalColor - v) : (f == 1) ? (v) : (0), 0, intervalColor, 0, 0xFF)
    );
    delay(delayPerStep);
  }
}

void animColor(byte* values, int from, int to) {
  int i = from;
  do {
    uint8_t v = values[i];
    setColor(
      (v & 0b00110000) << 2,
      (v & 0b00001100) << 4,
      (v & 0b00000011) << 6
    );
    delay((((v & 0b11000000) >> 6) + 1) * 250);
    if (i == to) {
      break;
    }
    i += (i < to) ? 1 : -1;
  } while (true);
  setColor(0, 0, 0);
}

void refreshLcdLine(int i) {
  printLcd(0, i, gBranchStatus[i].branchName, MAX_NAME_LEN + 1);
  char *s = gBranchStatus[i].buildState;
  int col = MAX_NAME_LEN + 1;

  if (strcmp(s, "...") == 0) {
    switch (gLoopCount % 4) {
      case 0:
        printLcd(col, i, "", 3);
        break;
      case 1:
        printLcd(col, i, ".", 3);
        break;
      case 2:
        printLcd(col, i, "..", 3);
        break;
      case 3:
        printLcd(col, i, "...", 3);
        break;
    }
  } else {
    printLcd(col, i, s, 3);
  }
}

void refreshLcd() {
  int n = sizeof(gBranchStatus) / sizeof(gBranchStatus[0]);
  for (int i = 0; i < n; i++) {
    refreshLcdLine(i);
  }
}

void updateBranchState(char* branchName, char* buildState) {
  int n = sizeof(gBranchStatus) / sizeof(gBranchStatus[0]);
  int t = n - 1;
  for (int i = 0; i < n; i++) {
    if (strcmp(gBranchStatus[i].branchName, branchName) == 0) {
      t = i;
      break;
    }
  }
  for (int i = t; i >= 1; i--) {
    gBranchStatus[i] = gBranchStatus[i - 1];
  }
  strncpy(gBranchStatus[0].branchName, branchName, MAX_NAME_LEN);
  strncpy(gBranchStatus[0].buildState, buildState, MAX_BUILD_STATE_LEN);

  refreshLcd();
}

void setup()
{
#ifdef DEBUG
  Serial.begin(9600);
#endif
  memset(gBranchStatus, 0, sizeof(gBranchStatus));
  memset(gPartStrBuf, '\0', sizeof(gPartStrBuf));

  pinMode(PIN_R, OUTPUT);
  pinMode(PIN_G, OUTPUT);
  pinMode(PIN_B, OUTPUT);

  lcd.begin(20, LCD_LINES);

  printLcd(0, 0, "CI Notifier", 20);
  printLcd(0, 1, "initializing...", 20);
  for (;;) {
    rainbow(600, 1);
    if ( (sakuraio.getConnectionStatus() & 0x80) == 0x80 ) break;
  }
  printLcd(0, 1, "initializing...done", 20);
  animColor(BOOT_COLOR, 0, sizeof(BOOT_COLOR) / sizeof(BOOT_COLOR[0]));
  setColor(0x00, 0x00, 0x00);
}

void loop() {
  uint8_t rxAvailable;
  uint8_t rxQueued;
  sakuraio.getRxQueueLength(&rxAvailable, &rxQueued);

  for (uint8_t q = 0; q < rxQueued; q++) {
    uint8_t channel;
    uint8_t type;
    uint8_t values[8];
    int64_t offset;

    uint8_t ret = sakuraio.dequeueRx(&channel, &type, values, &offset);
    if (ret == CMD_ERROR_NONE) {
#ifdef DEBUG
      Serial.print("channel : ");
      Serial.print(channel, DEC);
      Serial.println();
      Serial.print("type : ");
      Serial.print(type, DEC);
      Serial.println();
      Serial.print("values : ");
      for (int i = 0; i < 8; i++) {
        Serial.print(values[i], HEX);
        Serial.print(" ");
      }
      Serial.println();
      Serial.print("offset : ");
      Serial.print((int)offset, DEC);
      Serial.println();
#endif

      if (channel == CHANNEL_PART_STR) {
        int endIdx = 7;
        for (int i = 0; i <= endIdx && (gPartStrIdx < sizeof(gPartStrBuf) - 1); i++) {
          gPartStrBuf[gPartStrIdx] = values[i];
          gPartStrIdx++;
        }
      } else if (channel == CHANNEL_CMD) {
        updateBranchState(gPartStrBuf, values);

        memset(gPartStrBuf, '\0', sizeof(gPartStrBuf));
        gPartStrIdx = 0;
      } else if (channel == CHANNEL_ANIM_COLOR) {
        animColor(values, 0, 7);
      }
    } else {
      printLcd(17, 4, "ERR", 3);
    }
  }

  int n = sizeof(gBranchStatus) / sizeof(gBranchStatus[0]);
  for (int i = 0; i < n; i++) {
    if (strcmp(gBranchStatus[i].buildState, "...") == 0) {
      refreshLcdLine(i);
    }
  }
  gLoopCount++;
  delay(1000);
}

