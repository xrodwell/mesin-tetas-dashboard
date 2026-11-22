#!/usr/bin/env python3
"""Simulator alat mesin tetas — kirim telemetry + terima perintah via MQTT.

Pakai untuk testing dashboard tanpa hardware.

Jalankan:
    python3 mock_device.py [broker_host]

Alur: dengarkan incubator/control/{power,setpoint}, lalu kirim state ke
incubator/sensor/state tiap 2 detik.
"""
import json
import math
import sys
import time

import paho.mqtt.client as mqtt

BROKER = sys.argv[1] if len(sys.argv) > 1 else "127.0.0.1"
PORT = 1883
TELE_TOPIC = "incubator/sensor/state"
CMD_POWER = "incubator/control/power"
CMD_SETPOINT = "incubator/control/setpoint"

DEFAULT_SP = 37.5

state = {"power": False, "setpoint": DEFAULT_SP}
my_temp = 28.0  # mulai dari suhu ruang


def on_connect(c, _u, _f, rc):
    if rc == 0:
        print(f"[mock] connected to {BROKER}:{PORT}")
        c.subscribe([(CMD_POWER, 1), (CMD_SETPOINT, 1)])
        print(f"[mock] listening on {CMD_POWER} , {CMD_SETPOINT}")
    else:
        print(f"[mock] connect failed rc={rc}")


def on_message(_c, _u, msg):
    raw = msg.payload.decode().strip()
    if msg.topic == CMD_POWER:
        state["power"] = raw.lower() in ("on", "1", "true")
        if state["power"]:
            state["setpoint"] = DEFAULT_SP  # ON → default
        print(f"[mock] POWER -> {raw.upper()} (setpoint={state['setpoint']})")
    elif msg.topic == CMD_SETPOINT:
        try:
            state["setpoint"] = float(raw)
            print(f"[mock] SETPOINT -> {state['setpoint']} °C")
        except ValueError:
            print(f"[mock] setpoint invalid: {raw!r}")


client = mqtt.Client()
client.on_connect = on_connect
client.on_message = on_message
client.connect(BROKER, PORT, 60)
client.loop_start()

time.sleep(1)
t = 0
try:
    while True:
        sp = state["setpoint"]
        if state["power"]:
            # pemanas menuju setpoint (first-order lag)
            my_temp += (sp - my_temp) * 0.12
            # dikit noise sensor
            my_temp += (0.05 * math.sin(t / 3))
        else:
            # pemanas mati → mendingin pelan ke suhu ruang
            my_temp += (28.0 - my_temp) * 0.04

        humi = 62.0 + 2.5 * math.sin(t / 12)

        payload = {
            "temp_c": round(my_temp, 2),
            "humidity": round(humi, 1),
            "power": state["power"],
            "setpoint": sp,
        }
        client.publish(TELE_TOPIC, json.dumps(payload), qos=0)
        print(f"[mock] t={t:4d}s  temp={my_temp:5.2f}  sp={sp:4.1f}  "
              f"power={'ON ' if state['power'] else 'OFF'}")
        t += 2
        time.sleep(2)
except KeyboardInterrupt:
    print("\n[mock] stopped")
finally:
    client.loop_stop()
    client.disconnect()
