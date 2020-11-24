#ifndef _CBUFFER_H
#define _CBUFFER_H

#if defined(ESP32)
  #define OFFLINE_BUFFER_SIZE 600
#elif defined(ESP8266)
  #define OFFLINE_BUFFER_SIZE 120
#endif

struct tMeasurement {
  float temp, hum, pres, co2, tvoc;
  double latitude, longitude;
  unsigned long long timestamp;
};

//Simple circular buffer to store measured values when offline
class CircularBuffer {
private:
  tMeasurement buffer[OFFLINE_BUFFER_SIZE];
  int head = 0;
  int tail = 0;
public:
  //Return tail item to store new data
  tMeasurement* getTail() {
//    Serial.println("getTail head: " + String(head) + " tail: " + String(tail) + " isEmpty: " + String(isEmpty()) + " isFull: " + String(isFull()));
    return &buffer[tail];
  }
  // Add tail item to circular buffer
  bool enqueue() {
    if (isFull())  //if full, drop latest record - releases space for a new record
      dequeue();
    tail = (tail + 1) % OFFLINE_BUFFER_SIZE;  // increment tail
  }
  // Remove an item from circular buffer and return it
  tMeasurement* dequeue() {
    if (isEmpty())
      return nullptr;
    tMeasurement* item = &buffer[head]; // get item at head
    head = (head + 1) % OFFLINE_BUFFER_SIZE; // move head foward
    return item;  // return item
  }
  bool isFull() { return head == ((tail + 1) % OFFLINE_BUFFER_SIZE); }
  bool isEmpty() { return head == tail; }
  int size() { return tail >= head ? tail - head : OFFLINE_BUFFER_SIZE - (head - tail);}
};

#endif  //_CBUFFER_H
