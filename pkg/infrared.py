"""Infrared API handler."""



import os
import re
import sys
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))

import functools
import json
#from os import listdir
#from os.path import isfile, join
import time, struct
#from time import sleep, time
#import random
#import datetime
import subprocess
import threading
import requests
#import base64



from collections import Counter

try:
    from gateway_addon import APIHandler, APIResponse
    #print("succesfully loaded APIHandler and APIResponse from gateway_addon")
except:
    print("Import APIHandler and APIResponse from gateway_addon failed. Use at least WebThings Gateway version 0.10")

try:
    from gateway_addon import Adapter, Device, Database
except:
    print("Gateway not loaded?!")

print = functools.partial(print, flush=True)






_TIMEOUT = 3

_CONFIG_PATHS = [
    os.path.join(os.path.expanduser('~'), '.webthings', 'config'),
]

if 'WEBTHINGS_HOME' in os.environ:
    _CONFIG_PATHS.insert(0, os.path.join(os.environ['WEBTHINGS_HOME'], 'config'))





#try:
#    from flask import Flask, send_from_directory, send_file
#    from flask_socketio import SocketIO, emit
#except ImportError:
#    print("ERROR: pip install flask flask-socketio"); sys.exit(1)

usb_available = False
usb_backend = None
try:
    import usb.core, usb.util
    try:
        import libusb_package; usb_backend = libusb_package.get_libusb1_backend()
        print("[OK] libusb-package backend")
    except ImportError:
        print("[OK] system libusb")
    usb_available = True
except ImportError:
    print("ERROR: pip install pyusb libusb-package")

#app = Flask(__name__, static_folder='.')
#app.config['SECRET_KEY'] = 'iremote'
#socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

def emit(message):
    print("_emit: ", message)


# ── Global state ──
device_lock = threading.Lock()
connected_device = None
device_type = None
ocrustar_variant = None
ep_in = None
ep_out = None
tiq_cmd_id = 0
tiq_pkt_idx = 0




class InfraredAPIHandler(APIHandler):
    """API handler."""

    def __init__(self, verbose=False):
        """Initialize the object."""
        print("INSIDE API HANDLER INIT")
        
        self.addon_name = 'infrared'
        self.DEBUG = True
            
        #self.things = [] # Holds all the things, updated via the API. Used to display a nicer thing name instead of the technical internal ID.
            
        
            
        try:
            manifest_fname = os.path.join(
                os.path.dirname(__file__),
                '..',
                'manifest.json'
            )

            with open(manifest_fname, 'rt') as f:
                manifest = json.load(f)

            APIHandler.__init__(self, manifest['id'])
            self.manager_proxy.add_api_handler(self)
            
            
            if self.DEBUG:
                print("self.manager_proxy = " + str(self.manager_proxy))
                print("Created new API HANDLER: " + str(manifest['id']))
        except Exception as e:
            print("Failed to init UX extension API handler: " + str(e))
        

        # LOAD CONFIG
        try:
            self.add_from_config()
        except Exception as ex:
            print("caught error loading config: ", ex)

        
        self.addon_path = os.path.join(self.user_profile['addonsDir'], self.addon_name)
        #self.persistence_file_folder = os.path.join(self.user_profile['configDir'])
        self.persistence_file_path = os.path.join(self.user_profile['dataDir'], self.addon_name, 'persistence.json')
        

            
        # Get persistent data
        self.persistent_data = {}
        try:
            with open(self.persistence_file_path) as f:
                self.persistent_data = json.load(f)
                if self.DEBUG:
                    print('self.persistent_data loaded from file: ' + str(self.persistent_data))
                
        except:
            if self.DEBUG:
                print("could not load persistent data (if you just installed the add-on then this is normal)")


        if 'codes' not in self.persistent_data:
            self.persistent_data['codes'] = []


        self.dongle = None
        self.dongle_ready = False
        
        self.device_type = ''
        self.device_product_name = ''

        self.last_transmitted_pulses = None
        self.last_transmitted_frequency = None

        if self.DEBUG:
            print("usb_available: ", usb_available)

            print("="*52)
            print("  iRemote Server — USB IR Blaster Backend")
            print("="*52)
            print(f"  pyusb: {'OK' if usb_available else 'NOT INSTALLED'}")

        if usb_available:
            devs = list_usb_devices()
            if devs:
                if self.DEBUG:
                    print(f"  {len(devs)} USB devices:")
                for d in devs:
                    m = ''
                    
                    if d['vid']==f'0x{TIQ_VID:04X}' and d['pid']==f'0x{TIQ_PID:04X}': 
                        m=' ← TIQIAA'
                        self.device_type = 'TIQIAA'
                        if 'product' in d:
                            self.device_product_name = str(d['product'])
                        self.dongle = d
                        self.on_connect_tiqiaa()
                        break
                    elif d['vid']==f'0x{OCRU_VID:04X}': 
                        m=' ← OCRUSTAR'
                        self.device_type = 'OCRUSTAR'
                        if 'product' in d:
                            self.device_product_name = str(d['product'])
                        self.dongle = d
                        self.on_connect_ocrustar()
                        break
                    if self.DEBUG:
                        print(f"    {d['vid']}:{d['pid']} — {d['product']}{m}")
        #if self.DEBUG:
        #    print(f"\n  http://localhost:7890\n{'='*52}")
        #socketio.run(app, host='0.0.0.0', port=7890, debug=False, allow_unsafe_werkzeug=True)





    # Read the settings from the add-on settings page
    def add_from_config(self):
        """Attempt to add all configured devices."""
        try:
            database = Database(self.addon_name)
            if not database.open():
                print("Could not open settings database")
                return
            
            config = database.load_config()
            database.close()
            
        except:
            print("Error! Failed to open settings database.")
            self.close_proxy()
        
        if not config:
            print("Error loading config from database")
            return

        if 'Debugging' in config:
            self.DEBUG = bool(config['Debugging'])
            if self.DEBUG:
                print("-Debugging preference was in config: " + str(self.DEBUG))

        
        


    def on_connect_tiqiaa(self):
        global connected_device, device_type, tiq_cmd_id, tiq_pkt_idx
        if not usb_available: emit('error', {'msg': 'pyusb not installed'}); return
        with device_lock:
            #dev = usb.core.find(idVendor=TIQ_VID, idProduct=TIQ_PID, backend=usb_backend)
            dev = self.dongle

            try:
                if dev.is_kernel_driver_active(0): dev.detach_kernel_driver(0)
            except: pass
            try: dev.set_configuration()
            except: pass
            # Try to claim interface 0
            try: usb.util.claim_interface(self,dev, 0)
            except Exception as e:
                emit('log', {'msg': f'Interface claim: {e}', 'cls': 'err'})

            connected_device = dev; device_type = 'tiqiaa'
            tiq_cmd_id = 0; tiq_pkt_idx = 0

            # Drain stale data
            try: dev.read(TIQ_EP_IN, 64, timeout=100)
            except: pass

            # Handshake: IDLE then SEND
            emit('log', {'msg': 'Sending IDLE (L)...', 'cls': 'tx'})
            ok_idle = tiq_send_cmd(self,dev, ord('L'))
            emit('log', {'msg': f'IDLE result: {ok_idle}', 'cls': 'info'})

            if ok_idle:
                emit('log', {'msg': 'Sending SEND (S)...', 'cls': 'tx'})
                ok_send = tiq_send_cmd(self,dev, ord('S'))
                emit('log', {'msg': f'SEND result: {ok_send}', 'cls': 'info'})

            if ok_idle:
                emit('log', {'msg': 'Tiqiaa ready', 'cls': 'tx'})
                emit('connected', {'type': 'tiqiaa', 'variant': None, 'label': 'Tiqiaa (pyusb)'})
                self.dongle_ready = True
            else:
                connected_device = None; device_type = None
                import platform
                if platform.system() == 'Windows':
                    emit('error', {'msg': 'Tiqiaa handshake failed. On Windows you MUST install WinUSB driver via Zadig for BOTH Tiqiaa AND Ocrustar. The Tiqiaa looks like HID but uses bulk transfers internally.'})
                    emit('log', {'msg': '┌─ FIX: Run Zadig as Admin', 'cls': 'err'})
                    emit('log', {'msg': '│  Options → List All Devices', 'cls': 'err'})
                    emit('log', {'msg': '│  Select "Tview" or "Tiqiaa"', 'cls': 'err'})
                    emit('log', {'msg': '│  Target: WinUSB → Replace Driver', 'cls': 'err'})
                    emit('log', {'msg': '└─ Then reconnect here', 'cls': 'err'})
                else:
                    emit('error', {'msg': 'Tiqiaa handshake failed'})



    def on_connect_ocrustar(self):
        """Mirrors elksmart_v15.py Dev.connect() + Dev.handshake() exactly."""
        global connected_device, device_type, ocrustar_variant, ep_in, ep_out
        if not usb_available: emit('error', {'msg': 'pyusb not installed'}); return
        with device_lock:
            dev = self.dongle

            try:
                if dev.is_kernel_driver_active(0): dev.detach_kernel_driver(0)
            except: pass
            try: dev.set_configuration()
            except: pass

            devices = dev.get_active_configuration()
            if self.DEBUG:
                print("devices: ", devices)
            # Endpoint detection: use interface (0,0) — matches working driver exactly
            ei, eo = None, None
            try:
                for ep in dev.get_active_configuration()[(0,0)]:
                    if self.DEBUG:
                        print("ep: ", ep)
                    d = usb.util.endpoint_direction(ep.bEndpointAddress)
                    if self.DEBUG:
                        print("d: ", d)
                    if d == usb.util.ENDPOINT_IN: ei = ep
                    elif d == usb.util.ENDPOINT_OUT: eo = ep
            except Exception as e:
                emit('log', {'msg': f'Interface (0,0) failed: {e} — trying all interfaces', 'cls': 'info'})
                # Fallback: scan all interfaces
                try:
                    for intf in dev.get_active_configuration():
                        if self.DEBUG:
                            print("fallback: intf: ", intf)
                        for ep in intf:
                            d = usb.util.endpoint_direction(ep.bEndpointAddress)
                            if d == usb.util.ENDPOINT_IN and not ei: ei = ep
                            elif d == usb.util.ENDPOINT_OUT and not eo: eo = ep
                        if ei and eo:
                            try: usb.util.claim_interface(self,dev, intf.bInterfaceNumber)
                            except: pass
                            break
                except: pass
            
            if self.DEBUG:
                print("ei: ", ei)
                print("eo: ", eo)
            if not ei or not eo:
                emit('error', {'msg': 'No endpoints found. Check Zadig WinUSB driver.'})
                return

            ep_in = ei; ep_out = eo; connected_device = dev; device_type = 'ocrustar'
            emit('log', {'msg': f'EP IN=0x{ei.bEndpointAddress:02X} OUT=0x{eo.bEndpointAddress:02X}', 'cls': 'info'})
            if self.DEBUG:
                print("OK, connected to ocrustar")
            
            # ── Handshake: exact copy of elksmart_v15.py Dev.handshake() ──
            # Flush (matches working driver: read 16384 in loop until timeout)
            while True:
                try: ei.read(16384, timeout=10)
                except: break

            ok = False
            for attempt in range(3):  # 3 attempts, matching working driver
                emit('log', {'msg': f'Handshake {attempt+1}/3 — FC×4', 'cls': 'tx'})
                try: eo.write(bytes([0xFC]*4), timeout=500)
                except Exception as e:
                    emit('log', {'msg': f'Write error: {e}', 'cls': 'err'}); continue

                for _ in range(5):  # 5 read attempts per handshake, matching working driver
                    try:
                        resp = bytes(ei.read(16384, timeout=200))
                    except: resp = None
                    if resp and len(resp) >= 6:
                        h = ' '.join(f'{b:02X}' for b in resp)
                        emit('log', {'msg': f'RX ({len(resp)}B): {h}', 'cls': 'rx'})
                        if resp[0]==0xFC and resp[1]==0xFC and resp[2]==0xFC and resp[3]==0xFC:
                            # Send ACK — mandatory!
                            eo.write(bytes([0xFA]*4), timeout=500)
                            emit('log', {'msg': 'Sent ACK: FA FA FA FA', 'cls': 'tx'})
                            time.sleep(0.05)
                            hi, lo = resp[4]&0xFF, resp[5]&0xFF
                            if hi==0x70 and lo==0x01: ocrustar_variant='D552'
                            elif hi==0x02 and lo==0xAA: ocrustar_variant='D226'
                            else: ocrustar_variant='D226' if found_pid==0x02AA else 'D552'
                            ok = True; break
                if ok: break

            if not ok:
                connected_device=None; device_type=None; ep_in=None; ep_out=None
                emit('error', {'msg': 'Handshake failed. Try: unplug device, wait 3s, replug, then connect again.'})
                return
            emit('log', {'msg': f'Handshake OK — {ocrustar_variant}', 'cls': 'tx'})
            emit('connected', {'type':'ocrustar','variant':ocrustar_variant,'label':f'Ocrustar ({ocrustar_variant})'})
            self.dongle_ready = True









    def transmit(self,pulses=[],frequency=38000):
        """Pulses: signed array. Positive=mark, Negative=space."""
        global connected_device
        #pulses = data.get('pulses', [])
        #freq = data.get('freq', 38000)
        if not self.dongle_ready: emit('error', {'msg': 'No device connected'}); return False
        with device_lock:
            try:
                if device_type == 'tiqiaa':
                    ir = pulses_to_tiqiaa(pulses)
                    if not tiq_send_cmd(connected_device, ord('D'), b'\x00' + ir):
                        tiq_recv(connected_device, 100)
                        tiq_send_cmd(connected_device, ord('L'))
                        tiq_send_cmd(connected_device, ord('S'))
                        tiq_send_cmd(connected_device, ord('D'), b'\x00' + ir)
                    time.sleep(0.05)
                    tiq_send_cmd(connected_device, ord('L'))
                    emit('log', {'msg': f'TX {len(pulses)} pulses via Tiqiaa', 'cls': 'tx'})
                    emit('transmit_ok', {'pulses': len(pulses)})
                    return True
                elif device_type == 'ocrustar':
                    ap = [abs(v) for v in pulses]
                    st = 'd226' if ocrustar_variant=='D226' else 'd552'
                    frames = encode_ir(freq, ap, st)
                    emit('log', {'msg': f'TX {len(ap)} vals, {len(frames)} frames ({ocrustar_variant})', 'cls': 'tx'})
                    for f in frames:
                        ep_out.write(f, timeout=500)
                        time.sleep(0.002)
                    time.sleep(0.05)
                    try:
                        r = bytes(ep_in.read(16384, timeout=200))
                        if r: emit('log', {'msg': f'ACK: {" ".join(f"{b:02X}" for b in r)}', 'cls': 'rx'})
                    except: pass
                    emit('transmit_ok', {'pulses': len(pulses)})
                    return True
            except Exception as e:
                if self.DEBUG:
                    print("caught error in transmit: ", e)
                emit('error', {'msg': f'TX error: {str(e)}'})
        return False



    def learn(self,data=None):
        learned_code = None
        timeout = (data or {}).get('timeout', 15)
        if not self.dongle_ready: emit('error', {'msg': 'No device connected'}); return None
        with device_lock:
            try:
                if self.device_type == 'ocrustar':
                    emit('log', {'msg': f'Learn ({timeout}s) — press remote...', 'cls': 'info'})
                    # Flush like working driver
                    while True:
                        try: ep_in.read(16384, timeout=10)
                        except: break
                    ep_out.write(bytes([0xFE]*4), timeout=500)
                    exp, buf, t0 = None, bytearray(), time.time()
                    while time.time()-t0 < timeout:
                        try: resp = bytes(ep_in.read(16384, timeout=300))
                        except: continue
                        if exp is not None:
                            buf.extend(resp)
                            if len(buf) >= exp: break
                            continue
                        if len(resp)>7 and resp[0]==0xFE and resp[1]==0xFE and resp[2]==0xFE and resp[3]==0xFE:
                            exp = ((resp[4]&0xFF)<<8)|(resp[5]&0xFF)
                            buf = bytearray(resp[6:])
                            emit('log', {'msg': f'Header: expect {exp}B, got {len(buf)}', 'cls': 'rx'})
                            if len(buf) >= exp: break
                    ep_out.write(bytes([0xFD]*4), timeout=500)
                    if exp and len(buf) >= exp:
                        timings = parse_learn(buf[:exp])
                        signed = [t if i%2==0 else -t for i,t in enumerate(timings)]
                        learned_code = {'pulses': signed, 'count': len(signed),
                                            'duration_ms': round(sum(timings)/1000)}
                        emit('learn_data', {'pulses': signed, 'count': len(signed),
                                            'duration_ms': round(sum(timings)/1000)})
                        return learned_code
                    else:
                        emit('learn_timeout', {'msg': 'No signal detected'})
                else:
                    # ── Tiqiaa learn: IDLE → SEND → RECV → OUTPUT → wait → CANCEL → IDLE ──
                    emit('log', {'msg': f'Tiqiaa learn ({timeout}s) — press remote...', 'cls': 'info'})
                    tiq_send_cmd(connected_device, ord('L'))  # IDLE
                    tiq_send_cmd(connected_device, ord('S'))  # SEND
                    tiq_send_cmd(connected_device, ord('R'))  # RECV
                    # Send OUTPUT command without reading (response comes when IR is captured)
                    tiq_send_cmd_raw(connected_device, ord('O'))
                    # Wait for captured data (long timeout)
                    ir_data = tiq_recv_data(connected_device, timeout=timeout * 1000)
                    # Clean up: CANCEL → IDLE
                    tiq_send_cmd(connected_device, ord('C'))
                    tiq_send_cmd(connected_device, ord('L'))
                    if ir_data and len(ir_data) > 0:
                        pulses = tiqiaa_to_pulses(ir_data)
                        if pulses:
                            learned_code = {
                                    'pulses': pulses,
                                    'count': len(pulses),
                                    'duration_ms': round(sum(abs(p) for p in pulses) / 1000)
                                    }
                            emit('log', {'msg': f'Captured {len(pulses)} pulses via Tiqiaa', 'cls': 'rx'})
                            emit('learn_data', {
                                'pulses': pulses,
                                'count': len(pulses),
                                'duration_ms': round(sum(abs(p) for p in pulses) / 1000)
                            })
                            return learned_code
                    emit('learn_timeout', {'msg': 'No signal detected'})
            except Exception as e:
                if self.DEBUG:
                    print("caught error in on_learn: ", e)
                emit('error', {'msg': f'Learn error: {str(e)}'})

        return learned_code




    def handle_request(self, request):
        """
        Handle a new API request for this handler.

        request -- APIRequest object
        """
        
        try:
        
            if request.method != 'POST':
                #print("not post")
                return APIResponse(status=404)
            
            if request.path == '/ajax':
                
                action = str(request.body['action'])
                if self.DEBUG:
                    print("handling action: ", action)
                
                backend_ip = str(run_command('ip addr show |grep "inet " |grep -v 127.0.0. |head -1|cut -d" " -f6|cut -d/ -f1')).rstrip()
                if re.match(r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}', backend_ip) == None:
                    if self.DEBUG:
                        print("ERROR, no own valid ip4 address?  backend_ip: ", backend_ip)
                    backend_ip = None

                # INIT
                if action == 'init':
                    
                    return APIResponse(
                      status=200,
                      content_type='application/json',
                      content=json.dumps({
                                        'action':action,
                                        'device_type':self.device_type,
                                        'device_product_name':self.device_product_name,
                                        'codes':self.persistent_data['codes'],
                                        'backend_ip':backend_ip,
                                        'debug':self.DEBUG
                                        }),
                    )
                
                
                # Transmit IR code
                elif action == 'transmit':
                    state = False
                    data_to_transmit = None
                    try:

                        if 'pulses' in request.body and 'freq' in request.body:
                            self.last_transmitted_pulses = request.body['pulses']
                            self.last_transmitted_frequency = request.body['freq']
                            if self.DEBUG:
                                print("transmit request:\n- self.last_transmitted_pulses is now: ", self.last_transmitted_pulses, "\n - self.last_transmitted_frequency is now: ", self.last_transmitted_frequency)

                        state = self.transmit(self.last_transmitted_pulses, self.last_transmitted_frequency)
                        if self.DEBUG:
                            print("transmitted?: ", state)

                    except Exception as ex:
                        print("caught error trying to transmit: ", ex)
                    
                    return APIResponse(
                      status=200,
                      content_type='application/json',
                      content=json.dumps({
                                        'state':state,
                                        'action':action
                                        }),
                    )


                # Learn IR code
                elif action == 'learn':
                    state = False
                    learned_code = None
                    try:
                        learned_code = self.learn()
                        state = True
                    except Exception as ex:
                        print("caught error handling request to learn code: ", ex)
                    
                    return APIResponse(
                      status=200,
                      content_type='application/json',
                      content=json.dumps({
                                        'state':state,
                                        'action':action,
                                        'learned_code':learned_code
                                        }),
                    )

                    
                
                # UNSUPPORTED ACTION
                else:
                    return APIResponse(
                      status=404,
                      content_type='application/json',
                      content=json.dumps({"error":"Unsupported action"}),
                    )
                        

            else:
                if self.DEBUG:
                    print("unknown API path")
                return APIResponse(status=404)
               
                
        except Exception as ex:
            if self.DEBUG:
                print("Failed to handle UX extension API request: " + str(ex))
            return APIResponse(
              status=500,
              content_type='application/json',
              content=json.dumps({"error":"General API error"}),
            )
        

    def unload(self):
        if self.DEBUG:
            print("Shutting down")
        return True



    def save_persistent_data(self):
        if self.DEBUG:
            print("Saving to persistence data store")

        try:
            if not os.path.isfile(self.persistence_file_path):
                open(self.persistence_file_path, 'a').close()
                if self.DEBUG:
                    print("Created an empty persistence file")
            else:
                if self.DEBUG:
                    print("Persistence file existed. Will try to save to it.")

            with open(self.persistence_file_path, 'w+') as f:
                if self.DEBUG:
                    print("saving: " + str(self.persistent_data))
                try:
                    json.dump( self.persistent_data, f )
                except Exception as ex:
                    print("caught error saving to persistence file: " + str(ex))
                return True
            #self.previous_persistent_data = self.persistent_data.copy()

        except Exception as ex:
            if self.DEBUG:
                print("Error: could not store data in persistent store: " + str(ex) )
            return False



def run_command(cmd, timeout_seconds=20):
    try:
        p = subprocess.run(cmd, timeout=timeout_seconds, stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=True, universal_newlines=True)
        if p.returncode == 0:
            return p.stdout # + '\n' + "Command success" #.decode('utf-8')
            #yield("Command success")
        else:
            if p.stderr:
                return "Error: " + str(p.stderr) # + '\n' + "Command failed"   #.decode('utf-8'))

    except Exception as ex:
        print("caught error in run_command: ", ex)


















# ═══════════════════════════════════════════════════
#  TIQIAA — pyusb driver (from working HotelModeSamsung_aio.py)
# ═══════════════════════════════════════════════════
TIQ_VID, TIQ_PID = 0x10C4, 0x8468
TIQ_EP_OUT, TIQ_EP_IN = 0x01, 0x81
TICK_US = 16

def tiq_recv(dev, timeout=500):
    try:
        buf = dev.read(TIQ_EP_IN, 64, timeout=timeout)
        if len(buf) < 5: return False
        _, _, _, total, cur = struct.unpack("<BBBBB", bytes(buf[:5]))
        while cur < total:
            buf = dev.read(TIQ_EP_IN, 64, timeout=timeout)
            cur = buf[4]
        return True
    except: return False

def tiq_send_cmd(dev, cmd_type, payload=b""):
    global tiq_cmd_id, tiq_pkt_idx
    tiq_cmd_id = (tiq_cmd_id % 0x7F) + 1
    data = b"ST" + bytes([tiq_cmd_id, cmd_type]) + payload + b"EN"
    frag_cnt = (len(data) + 55) // 56
    tiq_pkt_idx = (tiq_pkt_idx % 15) + 1
    for i in range(frag_cnt):
        frag = data[i*56 : (i+1)*56]
        hdr = struct.pack("<BBBBB", 0x02, len(frag)+3, tiq_pkt_idx, frag_cnt, i+1)
        try: dev.write(TIQ_EP_OUT, hdr + frag, timeout=1000)
        except: return False
    return tiq_recv(dev)

def pulses_to_tiqiaa(pulses):
    out = []
    for v in pulses:
        is_mark = v > 0
        ticks = abs(int(round(v / TICK_US)))
        if ticks == 0: ticks = 1
        while ticks > 0:
            chunk = min(0x7F, ticks)
            ticks -= chunk
            out.append((0x80 if is_mark else 0x00) | chunk)
    return bytes(out)

def tiq_send_cmd_raw(dev, cmd_type):
    """Send command WITHOUT reading response (for OUTPUT command in learn mode)."""
    global tiq_cmd_id, tiq_pkt_idx
    tiq_cmd_id = (tiq_cmd_id % 0x7F) + 1
    data = b"ST" + bytes([tiq_cmd_id, cmd_type]) + b"EN"
    tiq_pkt_idx = (tiq_pkt_idx % 15) + 1
    hdr = struct.pack("<BBBBB", 0x02, len(data)+3, tiq_pkt_idx, 1, 1)
    try: dev.write(TIQ_EP_OUT, hdr + data, timeout=1000); return True
    except: return False

def tiq_recv_data(dev, timeout=5000):
    """Read response and return extracted payload bytes (for learn mode)."""
    try:
        buf = bytes(dev.read(TIQ_EP_IN, 64, timeout=timeout))
        if len(buf) < 5: return None
        total = buf[3]
        cur = buf[4]
        frag_size = max(0, min((buf[1] & 0xFF) - 3, len(buf) - 5))
        all_data = bytearray(buf[5:5+frag_size])
        while cur < total:
            buf = bytes(dev.read(TIQ_EP_IN, 64, timeout=1000))
            cur = buf[4]
            frag_size = max(0, min((buf[1] & 0xFF) - 3, len(buf) - 5))
            all_data.extend(buf[5:5+frag_size])
        # Strip ST(2)+cmdId(1)+cmdType(1)...EN(2) wrapper
        if len(all_data) > 6 and all_data[0:2] == b'ST' and all_data[-2:] == b'EN':
            return bytes(all_data[4:-2])
        elif len(all_data) > 4:
            return bytes(all_data[2:])  # skip cmdId+cmdType
        return bytes(all_data) if all_data else None
    except:
        return None

def tiqiaa_to_pulses(self,data):
    """Convert Tiqiaa tick-encoded bytes to signed pulse array."""
    if not data: return []
    pulses = []
    current_mark = (data[0] & 0x80) != 0
    current_ticks = 0
    for b in data:
        v = b & 0xFF
        is_mark = (v & 0x80) != 0
        ticks = v & 0x7F
        if is_mark == current_mark:
            current_ticks += ticks
        else:
            pulses.append(current_ticks * 16 if current_mark else -(current_ticks * 16))
            current_mark = is_mark
            current_ticks = ticks
    if current_ticks > 0:
        pulses.append(current_ticks * 16 if current_mark else -(current_ticks * 16))
    return pulses

# ═══════════════════════════════════════════════════
#  OCRUSTAR — from elksmart_v15.py
# ═══════════════════════════════════════════════════
OCRU_VID = 0x045C
OCRU_PIDS = [0x02AA,0x014A,0x0134,0x0195,0x0184,0x0130,0x0189,0x018F,0x0131,0x0132,0x0133]

def mangle_byte(v):
    value = v & 0xFF; r = 0
    for _ in range(8): r = (r << 1) | (value & 1); value >>= 1
    return (~r) & 0xFF

def checksum62(buf):
    s = sum(b & 0xFF for b in buf[:62])
    return mangle_byte((s & 0xF0) | ((s >> 8) & 0x0F))

def compress_value(v):
    if v <= 1: return [v]
    sv = int(v / 16.0 + 0.5); out = []
    while True:
        b = sv & 0x7F; sv >>= 7
        if sv: b |= 0x80
        if (b & 0xFF) == 0xFF: b = 0xFE
        out.append(b & 0xFF)
        if not sv: break
    return out

def compress_pulses(pat):
    pulses = []
    i = 0
    while i < len(pat):
        on = max(0, pat[i])
        off = max(0, pat[i+1]) if i+1 < len(pat) else 10000
        pulses.append((on, off)); i += 2
    if not pulses: return bytes()
    freq = Counter(pulses)
    top2 = [p for p, _ in freq.most_common(2)]
    if len(top2) == 1: top2.append(top2[0])
    top2.sort(key=lambda x: x[0] + x[1])
    pair0, pair1 = top2[0], top2[1]
    out = []
    out.extend(compress_value(pair1[0])); out.extend(compress_value(pair1[1]))
    out.extend(compress_value(pair0[0])); out.extend(compress_value(pair0[1]))
    out.extend([0xFF, 0xFF, 0xFF])
    for p in pulses:
        if p == pair0: out.append(0x00)
        elif p == pair1: out.append(0x01)
        else: out.extend(compress_value(p[0])); out.extend(compress_value(p[1]))
    return bytes(out)

class JavaPQ:
    def __init__(self): self.queue = []
    def offer(self, item):
        self.queue.append(item); self._siftUp(len(self.queue)-1, item)
    def poll(self):
        if not self.queue: return None
        result = self.queue[0]; x = self.queue.pop()
        if self.queue: self._siftDown(0, x)
        return result
    def _siftUp(self, k, x):
        while k > 0:
            parent = (k-1)>>1; e = self.queue[parent]
            if x.w >= e.w: break
            self.queue[k] = e; k = parent
        self.queue[k] = x
    def _siftDown(self, k, x):
        half = len(self.queue)>>1
        while k < half:
            child = (k<<1)+1; c = self.queue[child]; right = child+1
            if right < len(self.queue) and c.w > self.queue[right].w:
                child = right; c = self.queue[child]
            if x.w <= c.w: break
            self.queue[k] = c; k = child
        self.queue[k] = x
    def size(self): return len(self.queue)

def huffman_encode(raw):
    if not raw: return raw
    freq = [0]*256
    for b in raw: freq[b & 0xFF] += 1
    class N:
        def __init__(self,w): self.w=w
    class L(N):
        def __init__(self,w,sym): super().__init__(w); self.sym=sym
    class B(N):
        def __init__(self,l,r): super().__init__(l.w+r.w); self.l=l; self.r=r
    pq = JavaPQ()
    for i in range(256):
        if freq[i]>0: pq.offer(L(freq[i], i))
    if pq.size()==0: return raw
    while pq.size()>1: pq.offer(B(pq.poll(), pq.poll()))
    codes = []
    def bc(n,p=""):
        if isinstance(n,L): codes.append((n.sym,n.w,p or "0"))
        elif isinstance(n,B): bc(n.l,p+"0"); bc(n.r,p+"1")
    bc(pq.poll(),""); codes.sort(key=lambda e:e[0])
    cm={s:b for s,_,b in codes}
    out=[(len(codes)>>8)&0xFF,len(codes)&0xFF]
    for s,w,_ in codes: out.extend([s&0xFF,(w>>8)&0xFF,w&0xFF])
    bs="".join(cm[b&0xFF] for b in raw)
    pad=(8-len(bs)%8)%8
    if pad>0: bs+="0"*pad
    out.append(pad&0xFF)
    for i in range(0,len(bs),8): out.append(int(bs[i:i+8],2))
    return bytes(out)

def encode_ir(freq_hz, pat, subtype="d226"):
    rc = compress_pulses(pat)
    payload = huffman_encode(rc) if subtype=="d226" else rc
    f = freq_hz + 0x7FFFF
    msg = bytearray([0xFF]*4)
    msg.append(mangle_byte(f>>8)); msg.append(mangle_byte(f>>16)); msg.append(mangle_byte(f))
    msg.append(mangle_byte(len(payload)>>8)); msg.append(mangle_byte(len(payload)))
    msg.extend(payload)
    frames = []
    o = 0
    while o < len(msg):
        c = min(62, len(msg)-o)
        if c == 62:
            buf = bytearray(63); buf[:62] = msg[o:o+62]; buf[62] = checksum62(buf)
            frames.append(bytes(buf))
        else:
            frames.append(bytes(msg[o:o+c]))
        o += c
    return frames

def parse_learn(raw):
    t, carry = [], 0
    for b in raw:
        v = b & 0xFF
        if v < 0xFF: t.append(v*16+carry); carry=0
        else: carry += 0xFF0
    return t

def list_usb_devices():
    if not usb_available: return []
    devices = []
    try:
        for dev in usb.core.find(find_all=True, backend=usb_backend):
            try: prod = dev.product or '?'
            except: prod = '?'
            try: mfr = dev.manufacturer or '?'
            except: mfr = '?'
            devices.append({'vid':f'0x{dev.idVendor:04X}','pid':f'0x{dev.idProduct:04X}','product':prod,'manufacturer':mfr})
    except: pass
    return devices


#def on_disconnect():
#    global connected_device, device_type, ocrustar_variant, ep_in, ep_out
#    with device_lock:
#        if connected_device:
#            try: usb.util.dispose_resources(connected_device)
#            except: pass
#        connected_device=None; device_type=None; ocrustar_variant=None; ep_in=None; ep_out=None
#    emit('disconnected', {})


