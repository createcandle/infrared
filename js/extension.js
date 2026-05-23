(function() {
    class Infrared extends window.Extension {
        constructor() {
            super('infrared');
            //console.log("Adding Infrared to menu");
            this.addMenuEntry('Infrared');


			window.extension_infrared_kiosk = false;
            this.kiosk = false;
            if (document.getElementById('virtualKeyboardChromeExtension') != null) {
                document.body.classList.add('kiosk');
                this.kiosk = true;
				window.extension_infrared_kiosk = true;
            }
			/*
			document.onmousemove = function(event)
			{
				console.log("mouse moved");
			 //cursor_x = event.pageX;
			 //cursor_y = event.pageY;
			}
			*/

            //console.log(window.API);

      this.debug = false;
      this.content = '';

      this.busy_doing_poll = false;

			this.backend_ip = '127.0.0.1';

			// ═══════════════════════════════════════════════════
			//  iRemote — Python Backend Client (Socket.IO)
			// ═══════════════════════════════════════════════════

			// ── State ──
      
			this.socket = null;
			this.isDeviceConnected = false;
			this.isRecording = false;
      this.allCapturedPulses = {}
			this.capturedPulses = null;
      this.learned_code = null;
			this.acTemp = 24;
			this.savedRemotes = []; //JSON.parse(localStorage.getItem('iremote_saved') || '[]');
			this.importedButtons = [];
      this.dongle_ready = false;
      this.suggested_remote_name = '';


			this.hotelSelectedBrand = null;
			this.macroRunning = false;
      this.show_extra_macros = false;

      this.thing_actions = {};
			
			// ═══════════════════════════════════════════════════
			//  UNIVERSAL TV REMOTE
			// ═══════════════════════════════════════════════════

			this.TV_SAMSUNG = { POWER:0x02,SOURCE:0x01,NUM_0:0x11,NUM_1:0x04,NUM_2:0x05,NUM_3:0x06,NUM_4:0x08,NUM_5:0x09,NUM_6:0x0A,NUM_7:0x0C,NUM_8:0x0D,NUM_9:0x0E,VOL_UP:0x07,VOL_DOWN:0x0B,MUTE:0x0F,CH_UP:0x12,CH_DOWN:0x10,UP:0x60,DOWN:0x61,LEFT:0x65,RIGHT:0x62,OK:0x68,MENU:0x1A,INFO:0x1F,BACK:0x58,EXIT:0x2D,HOME:0x79,PLAY:0x47,PAUSE:0x4A,STOP:0x46,REWIND:0x45,FAST_FWD:0x48 };
			this.TV_LG = { POWER:0x08,SOURCE:0x0B,NUM_0:0x10,NUM_1:0x11,NUM_2:0x12,NUM_3:0x13,NUM_4:0x14,NUM_5:0x15,NUM_6:0x16,NUM_7:0x17,NUM_8:0x18,NUM_9:0x19,VOL_UP:0x02,VOL_DOWN:0x03,MUTE:0x09,CH_UP:0x00,CH_DOWN:0x01,UP:0x40,DOWN:0x41,LEFT:0x07,RIGHT:0x06,OK:0x44,MENU:0x43,INFO:0xAA,BACK:0x28,EXIT:0x5B,HOME:0x7C,PLAY:0xB0,PAUSE:0xBA,STOP:0xB1,REWIND:0x8F,FAST_FWD:0x8E };
			this.TV_SONY = { POWER:0x15,SOURCE:0x25,NUM_0:0x09,NUM_1:0x00,NUM_2:0x01,NUM_3:0x02,NUM_4:0x03,NUM_5:0x04,NUM_6:0x05,NUM_7:0x06,NUM_8:0x07,NUM_9:0x08,VOL_UP:0x12,VOL_DOWN:0x13,MUTE:0x14,CH_UP:0x10,CH_DOWN:0x11,UP:0x74,DOWN:0x75,LEFT:0x34,RIGHT:0x33,OK:0x65,MENU:0x60,INFO:0x3A,BACK:0x23,EXIT:0x23,HOME:0x60,PLAY:0x58,PAUSE:0x59,STOP:0x18,REWIND:0x1B,FAST_FWD:0x1A };
			this.TV_RC5 = { POWER:0x0C,SOURCE:0x38,NUM_0:0x00,NUM_1:0x01,NUM_2:0x02,NUM_3:0x03,NUM_4:0x04,NUM_5:0x05,NUM_6:0x06,NUM_7:0x07,NUM_8:0x08,NUM_9:0x09,VOL_UP:0x10,VOL_DOWN:0x11,MUTE:0x0D,CH_UP:0x20,CH_DOWN:0x21,UP:0x50,DOWN:0x51,LEFT:0x55,RIGHT:0x56,OK:0x25,MENU:0x12,INFO:0x0F,BACK:0x0A,EXIT:0x0A,HOME:0x54,PLAY:0x35,PAUSE:0x29,STOP:0x36,REWIND:0x32,FAST_FWD:0x34 };

			this.FAN_CMDS = { POWER:0x02, SPEED:0x04, OSCILLATE:0x08, TIMER:0x0A, SPEED_1:0x01, SPEED_2:0x03, SPEED_3:0x05, NATURAL:0x06, SLEEP:0x07 };

			// ═══════════════════════════════════════════════════
			//  HOTEL / HOSPITALITY TV MACROS
			// ═══════════════════════════════════════════════════
			this.HOTEL_MACROS = [];

			this.HOTEL_TV_MACROS = [
				// ===== SAMSUNG =====
				{
					id: 'samsung_hotel_primary', name: 'Hotel Menu', brand: 'Samsung',
					description: 'Mute → 1 → 1 → 9 → Enter\nOpens Hotel Option menu. ~85% success rate.',
					tvState: 'ON', warningLevel: 0,
					steps: [
					{ type: 'ir', encode: () => this.samsung32Encode(0x07, 0x0F), label: 'Mute' },
					{ type: 'delay', ms: 250 },
					{ type: 'ir', encode: () => this.samsung32Encode(0x07, 0x04), label: '1' },
					{ type: 'delay', ms: 250 },
					{ type: 'ir', encode: () => this.samsung32Encode(0x07, 0x04), label: '1' },
					{ type: 'delay', ms: 250 },
					{ type: 'ir', encode: () => this.samsung32Encode(0x07, 0x0E), label: '9' },
					{ type: 'delay', ms: 250 },
					{ type: 'ir', encode: () => this.samsung32Encode(0x07, 0x68), label: 'Enter' },
					]
				},
				{
					id: 'samsung_hotel_alt', name: 'Hotel Menu (Alt)', brand: 'Samsung',
					description: 'Mute → 1 → 1 → 9 → Power\nAlternative ending key. ~75% success rate.',
					tvState: 'ON', warningLevel: 0,
					steps: [
					{ type: 'ir', encode: () => this.samsung32Encode(0x07, 0x0F), label: 'Mute' },
					{ type: 'delay', ms: 250 },
					{ type: 'ir', encode: () => this.samsung32Encode(0x07, 0x04), label: '1' },
					{ type: 'delay', ms: 250 },
					{ type: 'ir', encode: () => this.samsung32Encode(0x07, 0x04), label: '1' },
					{ type: 'delay', ms: 250 },
					{ type: 'ir', encode: () => this.samsung32Encode(0x07, 0x0E), label: '9' },
					{ type: 'delay', ms: 250 },
					{ type: 'ir', encode: () => this.samsung32Encode(0x07, 0x02), label: 'Power' },
					]
				},
				{
					id: 'samsung_smart_remote', name: 'Smart Remote Unlock', brand: 'Samsung',
					description: 'Mute → Up → Down → OK → Mute\nFor Tizen TVs without number pads. Navigate to Settings → Sound Output first. ~60%.',
					tvState: 'ON', warningLevel: 0,
					steps: [
					{ type: 'ir', encode: () => this.samsung32Encode(0x07, 0x0F), label: 'Mute' },
					{ type: 'delay', ms: 300 },
					{ type: 'ir', encode: () => this.samsung32Encode(0x07, 0x60), label: 'Up' },
					{ type: 'delay', ms: 300 },
					{ type: 'ir', encode: () => this.samsung32Encode(0x07, 0x61), label: 'Down' },
					{ type: 'delay', ms: 300 },
					{ type: 'ir', encode: () => this.samsung32Encode(0x07, 0x68), label: 'OK' },
					{ type: 'delay', ms: 300 },
					{ type: 'ir', encode: () => this.samsung32Encode(0x07, 0x0F), label: 'Mute' },
					]
				},
				{
					id: 'samsung_service_menu', name: 'Service Menu', brand: 'Samsung',
					description: 'Mute → 1 → 8 → 2 → Power\nTV must be OFF (standby). Powers on into service mode.',
					tvState: 'OFF', warningLevel: 1,
					steps: [
					{ type: 'ir', encode: () => this.samsung32Encode(0x07, 0x0F), label: 'Mute' },
					{ type: 'delay', ms: 250 },
					{ type: 'ir', encode: () => this.samsung32Encode(0x07, 0x04), label: '1' },
					{ type: 'delay', ms: 250 },
					{ type: 'ir', encode: () => this.samsung32Encode(0x07, 0x0D), label: '8' },
					{ type: 'delay', ms: 250 },
					{ type: 'ir', encode: () => this.samsung32Encode(0x07, 0x05), label: '2' },
					{ type: 'delay', ms: 250 },
					{ type: 'ir', encode: () => this.samsung32Encode(0x07, 0x02), label: 'Power' },
					]
				},
				{
					id: 'samsung_factory_service', name: 'Factory Service', brand: 'Samsung',
					description: 'Info → Menu → Mute → Power\nTV must be OFF (standby). Full factory access.',
					tvState: 'OFF', warningLevel: 2,
					steps: [
					{ type: 'ir', encode: () => this.samsung32Encode(0x07, 0x1F), label: 'Info' },
					{ type: 'delay', ms: 250 },
					{ type: 'ir', encode: () => this.samsung32Encode(0x07, 0x1A), label: 'Menu' },
					{ type: 'delay', ms: 250 },
					{ type: 'ir', encode: () => this.samsung32Encode(0x07, 0x0F), label: 'Mute' },
					{ type: 'delay', ms: 250 },
					{ type: 'ir', encode: () => this.samsung32Encode(0x07, 0x02), label: 'Power' },
					]
				},
				{
					id: 'samsung_pin_reset', name: 'PIN Reset', brand: 'Samsung',
					description: 'Mute → 8 → 2 → 4 → Power\nResets PIN to 0000 on some models. Use when password prompt appears.',
					tvState: 'ON', warningLevel: 1,
					steps: [
					{ type: 'ir', encode: () => this.samsung32Encode(0x07, 0x0F), label: 'Mute' },
					{ type: 'delay', ms: 250 },
					{ type: 'ir', encode: () => this.samsung32Encode(0x07, 0x0D), label: '8' },
					{ type: 'delay', ms: 250 },
					{ type: 'ir', encode: () => this.samsung32Encode(0x07, 0x05), label: '2' },
					{ type: 'delay', ms: 250 },
					{ type: 'ir', encode: () => this.samsung32Encode(0x07, 0x08), label: '4' },
					{ type: 'delay', ms: 250 },
					{ type: 'ir', encode: () => this.samsung32Encode(0x07, 0x02), label: 'Power' },
					]
				},

				// ===== LG =====
				{
					id: 'lg_installer_9876', name: 'Installer Menu (9876)', brand: 'LG',
					description: 'Hold Menu 5s → 9-8-7-6 → OK\nDefault installer sequence for LG hospitality TVs.',
					tvState: 'ON', warningLevel: 0,
					steps: [
					{ type: 'hold', encode: () => this.necEncode(0x04, 0x43), label: 'Menu (hold)', durationMs: 5000 },
					{ type: 'delay', ms: 500 },
					{ type: 'ir', encode: () => this.necEncode(0x04, 0x19), label: '9' },
					{ type: 'delay', ms: 200 },
					{ type: 'ir', encode: () => this.necEncode(0x04, 0x18), label: '8' },
					{ type: 'delay', ms: 200 },
					{ type: 'ir', encode: () => this.necEncode(0x04, 0x17), label: '7' },
					{ type: 'delay', ms: 200 },
					{ type: 'ir', encode: () => this.necEncode(0x04, 0x16), label: '6' },
					{ type: 'delay', ms: 200 },
					{ type: 'ir', encode: () => this.necEncode(0x04, 0x44), label: 'OK' },
					]
				},
				{
					id: 'lg_installer_1105', name: 'Installer Menu (1105)', brand: 'LG',
					description: 'Hold Home 5s → 1-1-0-5 → OK\nFor newer webOS hospitality models.',
					tvState: 'ON', warningLevel: 0,
					steps: [
					{ type: 'hold', encode: () => this.necEncode(0x04, 0x7C), label: 'Home (hold)', durationMs: 5000 },
					{ type: 'delay', ms: 500 },
					{ type: 'ir', encode: () => this.necEncode(0x04, 0x11), label: '1' },
					{ type: 'delay', ms: 200 },
					{ type: 'ir', encode: () => this.necEncode(0x04, 0x11), label: '1' },
					{ type: 'delay', ms: 200 },
					{ type: 'ir', encode: () => this.necEncode(0x04, 0x10), label: '0' },
					{ type: 'delay', ms: 200 },
					{ type: 'ir', encode: () => this.necEncode(0x04, 0x15), label: '5' },
					{ type: 'delay', ms: 200 },
					{ type: 'ir', encode: () => this.necEncode(0x04, 0x44), label: 'OK' },
					]
				},
				{
					id: 'lg_service_menu', name: 'Service Menu', brand: 'LG',
					description: 'IN_START → EZ_ADJUST\nAdvanced service menu access.',
					tvState: 'ON', warningLevel: 1,
					steps: [
					{ type: 'ir', encode: () => this.necEncode(0x04, 0xFA), label: 'IN_START' },
					{ type: 'delay', ms: 500 },
					{ type: 'ir', encode: () => this.necEncode(0x04, 0xFF), label: 'EZ_ADJUST' },
					]
				},

				// ===== PHILIPS =====
				{
					id: 'philips_hotel_bds', name: 'Hotel Mode (BDS)', brand: 'Philips',
					description: '3-1-9-7-5-3-Mute\nOpens BDS Hotel Mode Setup menu. TV must be on an analog channel.',
					tvState: 'ON', warningLevel: 0,
					steps: [
					{ type: 'ir', encode: () => this.rc5Encode(0x00, 0x03), label: '3', freq: 36000 },
					{ type: 'delay', ms: 300 },
					{ type: 'ir', encode: () => this.rc5Encode(0x00, 0x01), label: '1', freq: 36000 },
					{ type: 'delay', ms: 300 },
					{ type: 'ir', encode: () => this.rc5Encode(0x00, 0x09), label: '9', freq: 36000 },
					{ type: 'delay', ms: 300 },
					{ type: 'ir', encode: () => this.rc5Encode(0x00, 0x07), label: '7', freq: 36000 },
					{ type: 'delay', ms: 300 },
					{ type: 'ir', encode: () => this.rc5Encode(0x00, 0x05), label: '5', freq: 36000 },
					{ type: 'delay', ms: 300 },
					{ type: 'ir', encode: () => this.rc5Encode(0x00, 0x03), label: '3', freq: 36000 },
					{ type: 'delay', ms: 300 },
					{ type: 'ir', encode: () => this.rc5Encode(0x00, 0x0D), label: 'Mute', freq: 36000 },
					]
				},
				{
					id: 'philips_service_menu', name: 'Service Menu (SAM)', brand: 'Philips',
					description: '0-6-2-5-9-6-Menu\nMain service/factory menu. ~70% of Philips models.',
					tvState: 'ON', warningLevel: 1,
					steps: [
					{ type: 'ir', encode: () => this.rc5Encode(0x00, 0x00), label: '0', freq: 36000 },
					{ type: 'delay', ms: 200 },
					{ type: 'ir', encode: () => this.rc5Encode(0x00, 0x06), label: '6', freq: 36000 },
					{ type: 'delay', ms: 200 },
					{ type: 'ir', encode: () => this.rc5Encode(0x00, 0x02), label: '2', freq: 36000 },
					{ type: 'delay', ms: 200 },
					{ type: 'ir', encode: () => this.rc5Encode(0x00, 0x05), label: '5', freq: 36000 },
					{ type: 'delay', ms: 200 },
					{ type: 'ir', encode: () => this.rc5Encode(0x00, 0x09), label: '9', freq: 36000 },
					{ type: 'delay', ms: 200 },
					{ type: 'ir', encode: () => this.rc5Encode(0x00, 0x06), label: '6', freq: 36000 },
					{ type: 'delay', ms: 200 },
					{ type: 'ir', encode: () => this.rc5Encode(0x00, 0x12), label: 'Menu', freq: 36000 },
					]
				},

				// ===== SONY =====
				{
					id: 'sony_service_menu', name: 'Service Menu', brand: 'Sony',
					description: 'Display → 5 → Vol+ → Power\nTV must be OFF (standby). Powers on into service mode.',
					tvState: 'OFF', warningLevel: 1,
					steps: [
					{ type: 'ir', encode: () => this.sonyEncode(0x01, 0x3A), label: 'Display', freq: 40000 },
					{ type: 'delay', ms: 250 },
					{ type: 'ir', encode: () => this.sonyEncode(0x01, 0x04), label: '5', freq: 40000 },
					{ type: 'delay', ms: 250 },
					{ type: 'ir', encode: () => this.sonyEncode(0x01, 0x12), label: 'Vol+', freq: 40000 },
					{ type: 'delay', ms: 250 },
					{ type: 'ir', encode: () => this.sonyEncode(0x01, 0x15), label: 'Power', freq: 40000 },
					]
				},

				// ===== UNIVERSAL =====
				{
					id: 'universal_power_off', name: 'Power Off All', brand: 'Universal',
					description: 'Sends power commands for Samsung, LG, Sony, Philips, Toshiba, and Hisense.\nOne tap to turn off any TV.',
					tvState: 'ON', warningLevel: 0,
					steps: [
					{ type: 'ir', encode: () => this.samsung32Encode(0x07, 0x02), label: 'Samsung' },
					{ type: 'delay', ms: 400 },
					{ type: 'ir', encode: () => this.necEncode(0x04, 0x08), label: 'LG' },
					{ type: 'delay', ms: 400 },
					{ type: 'ir', encode: () => this.sonyEncode(0x01, 0x15), label: 'Sony', freq: 40000 },
					{ type: 'delay', ms: 400 },
					{ type: 'ir', encode: () => this.rc5Encode(0x00, 0x0C), label: 'Philips', freq: 36000 },
					{ type: 'delay', ms: 400 },
					{ type: 'ir', encode: () => this.necEncode(0x40, 0x12), label: 'Toshiba' },
					{ type: 'delay', ms: 400 },
					{ type: 'ir', encode: () => this.necEncode(0x00, 0x08), label: 'Hisense' },
					]
				},
			];




			this.IRDB_CAT_INFO = {
				TVs: { label: 'TVs', emoji: '📺' }, Air_Conditioners: { label: 'Air Conditioners', emoji: '❄️' },
				Fans: { label: 'Fans', emoji: '🌀' }, Projectors: { label: 'Projectors', emoji: '📽️' },
				Audio_Receivers: { label: 'Audio Receivers', emoji: '🔊' }, DVD_Players: { label: 'DVD Players', emoji: '💿' },
				LED_Lighting: { label: 'LED Lighting', emoji: '💡' }, Cable_Boxes: { label: 'Cable Boxes', emoji: '📡' },
				Soundbars: { label: 'Soundbars', emoji: '🔈' }, Monitors: { label: 'Monitors', emoji: '🖥️' },
				Cameras: { label: 'Cameras', emoji: '📷' }, Vacuum_Cleaners: { label: 'Vacuums', emoji: '🧹' },
				TV: { label: 'TVs', emoji: '📺' }, Receiver: { label: 'Receivers', emoji: '🔊' },
				DVD: { label: 'DVD Players', emoji: '💿' }, Projector: { label: 'Projectors', emoji: '📽️' },
				Cable: { label: 'Cable Boxes', emoji: '📡' }, Satellite: { label: 'Satellite', emoji: '📡' },
				CD: { label: 'CD Players', emoji: '💿' }, VCR: { label: 'VCR', emoji: '📼' },
				Fan: { label: 'Fans', emoji: '🌀' }, AC: { label: 'Air Conditioners', emoji: '❄️' },
				'Blu-ray': { label: 'Blu-ray', emoji: '💿' }, Camera: { label: 'Cameras', emoji: '📷' },
				Media_Player: { label: 'Media Players', emoji: '📺' }, Monitor: { label: 'Monitors', emoji: '🖥️' },
				LEDs: { label: 'LED Lighting', emoji: '💡' }
			};


			this.irdbIndex = null;
			this.irdbLoading = false;
			this.irdbNav = { category: null, brand: null, query: '' };


			// ═══════════════════════════════════════════════════
			//  BATCH LEARN MODE
			// ═══════════════════════════════════════════════════

			this.batchButtons = [];
			this.batchLearning = false;
			this.batchIndex = 0;
			this.batchResults = [];

			this.BATCH_PRESETS = {
				tv: ['Power','Vol +','Vol -','Mute','Ch +','Ch -','0','1','2','3','4','5','6','7','8','9','Menu','OK','Up','Down','Left','Right','Back','Source','Info','Home'],
				ac: ['Power','Temp +','Temp -','Mode','Fan Speed','Swing','Timer','Sleep','Turbo'],
				dvd: ['Power','Play','Pause','Stop','Rewind','Fast Fwd','Prev','Next','Menu','OK','Up','Down','Left','Right','Eject'],
			};


			// CUSTOM MACRO BUILDER

			this.customMacroSteps = [];
			this.customMacros = []; //JSON.parse(localStorage.getItem('iremote_custom_macros') || '[]');

			this.CM_COMMANDS = {
			samsung32: { power:0x02,mute:0x0F,vol_up:0x07,vol_down:0x0B,ch_up:0x12,ch_down:0x10,source:0x01,
				'0':0x11,'1':0x04,'2':0x05,'3':0x06,'4':0x08,'5':0x09,'6':0x0A,'7':0x0C,'8':0x0D,'9':0x0E,
				enter:0x68,menu:0x1A,info:0x1F,up:0x60,down:0x61,left:0x65,right:0x62,back:0x58,exit:0x2D,home:0x79 },
			nec: { power:0x08,mute:0x09,vol_up:0x02,vol_down:0x03,ch_up:0x00,ch_down:0x01,source:0x0B,
				'0':0x10,'1':0x11,'2':0x12,'3':0x13,'4':0x14,'5':0x15,'6':0x16,'7':0x17,'8':0x18,'9':0x19,
				enter:0x44,menu:0x43,info:0xAA,up:0x40,down:0x41,left:0x07,right:0x06,back:0x28,exit:0x5B,home:0x7C },
			rc5: { power:0x0C,mute:0x0D,vol_up:0x10,vol_down:0x11,ch_up:0x20,ch_down:0x21,source:0x38,
				'0':0x00,'1':0x01,'2':0x02,'3':0x03,'4':0x04,'5':0x05,'6':0x06,'7':0x07,'8':0x08,'9':0x09,
				enter:0x25,menu:0x12,info:0x0F,up:0x50,down:0x51,left:0x55,right:0x56,back:0x0A,exit:0x0A,home:0x54 },
			sony12: { power:0x15,mute:0x14,vol_up:0x12,vol_down:0x13,ch_up:0x10,ch_down:0x11,source:0x25,
				'0':0x09,'1':0x00,'2':0x01,'3':0x02,'4':0x03,'5':0x04,'6':0x05,'7':0x06,'8':0x07,'9':0x08,
				enter:0x65,menu:0x60,info:0x3A,up:0x74,down:0x75,left:0x34,right:0x33,back:0x23,exit:0x23,home:0x60 },
			};
			this.CM_ADDRS = { samsung32: 0x07, nec: 0x04, rc5: 0x00, sony12: 0x01 };
			this.CM_FREQS = { samsung32: 38000, nec: 38000, rc5: 36000, sony12: 40000 };











      fetch(`/extensions/${this.id}/views/content.html`)
      .then((res) => res.text())
      .then((text) => {
                    this.content = text;
                    if (location.pathname == "/extensions/infrared") {
                        this.show();
                    }
      })
      .catch((e) => console.error('infrared: failed to fetch content:', e));


      window.API.postJson(
        `/extensions/${this.id}/api/ajax`, {'action': 'init'}

      ).then((body) => {
				if(typeof body.debug != 'undefined'){
					this.debug = body.debug;
				}
				if(this.debug){
					console.log("infrared debug: early init response: ", body);
				}
				this.parse_body(body);

      }).catch((err) => {
        console.error("Infrared: caught error in early init function: ", err);
      });


    }

    do_poll(){
      if(this.busy_doing_poll == false){
        this.busy_doing_poll = true;
        window.API.postJson(
          `/extensions/${this.id}/api/ajax`, {'action': 'poll'}

        ).then((body) => {
          if(typeof body.debug != 'undefined'){
            this.debug = body.debug;
          }
          if(this.debug){
            console.log("infrared debug: poll response: ", body);
          }
          
          this.parse_body(body);
          this.busy_doing_poll = false;

        }).catch((err) => {
          console.error("Infrared: caught error calling poll: ", err);
          this.busy_doing_poll = false;
        });
      }
    }

		parse_body(body){
			if(this.debug){
				console.log("infrared debug: in parse_body.  body: ", body);
			}

			if(typeof body.backend_ip == 'string'){
				this.backend_ip = body.backend_ip;
			}
			
      const dongle_container_el = this.view.querySelector('#extension-infrared-dongle-container');
      if(dongle_container_el){
        if(this.debug){
          console.log("infrared debug: dongle_ready: ", body.dongle_ready);
        }
        this.dongle_ready = body.dongle_ready;
        if(typeof body.dongle_ready == 'boolean' && body.dongle_ready == true){
          dongle_container_el.classList.add('extension-infrared-dongle-is-ready');
        }else{
          dongle_container_el.classList.remove('extension-infrared-dongle-is-ready');
        }
        if(typeof body.device_type == 'string'){
          if(this.debug){
            console.log("infrared debug: device_type: ", body.device_type);
          }
          if(body.device_type == ''){
            dongle_container_el.innerHTML = '';
          }else{
            this.isDeviceConnected = true;
            let ocrustar_variant = '';
            if(typeof body.ocrustar_variant == 'string' && body.ocrustar_variant != '' && body.ocrustar_variant.length < 8){
              ocrustar_variant = ' (' + body.ocrustar_variant + ')'
            }
            dongle_container_el.innerHTML = '<img src="/extensions/infrared/images/' + body.device_type + '.svg"><p>' + body.device_type + ocrustar_variant + '</p>';
          }
        }
        
      }

			
      

			if(typeof body.device_product_name == 'string'){
				if(this.debug){
					console.log("infrared debug: device_product_name: ", body.device_product_name);
				}
			}

      if(typeof body.thing_state == 'boolean'){
				if(this.debug){
					console.log("infrared debug: body.thing_state: ", body.thing_state);
				}
        const state_hint_el = this.view.querySelector('#extension-infrared-disabled-state-hint');
        if(state_hint_el){
          if(body.thing_state == true){
            state_hint_el.classList.add('extension-infrared-hidden');
          }
          else{
            state_hint_el.classList.remove('extension-infrared-hidden');
          }
        }
			}


		
			if(typeof body.remotes != 'undefined'){
				if(this.debug){
					console.log("infrared debug: received remotes data: ", body.remotes);
				}
				if(typeof body.remotes.iremote_saved != 'undefined'){
					this.savedRemotes = body.remotes.iremote_saved;
					
				}
				if(typeof body.remotes.iremote_custom_macros != 'undefined'){
					this.customMacros = body.remotes.iremote_custom_macros;
				}

        if(typeof body.remotes.iremote_captured_pulses != 'undefined'){
					this.allCapturedPulses = body.remotes.iremote_captured_pulses;
				}

         if(typeof body.remotes.thing_actions != 'undefined'){
					this.thing_actions = body.remotes.thing_actions;
				}

			}


      if(typeof body.show_extra_macros == 'boolean'){
        this.show_extra_macros = body.show_extra_macros;
      }
      
			
               
		}
        

		
		



    show() {
      if(this.debug){
				console.log("infrared debug: in show()");
			}

      if (this.content == '') {
          return;
      } else {
          this.view.innerHTML = this.content;
      }

			/*
			if(localStorage.getItem('extension-infrared-shown-limitations-hint') == null){
				const hint_el = this.view.querySelector('#extension-infrared-limitations-hint');
				if(hint_el){
					hint_el.style.display = 'flex';
					hint_el.addEventListener('click', () => {
	                	hint_el.style.display = 'none';
						localStorage.setItem('extension-infrared-shown-limitations-hint',1);
	            	});
				}
			}
			*/

			//const infrared_root_el = this.view.querySelector('#extension-infrared-border-root');
            
			const infrared_main_el = this.view.querySelector('#extension-infrared-main');

			if(infrared_main_el){
				infrared_main_el.addEventListener('click', (event) => {
					if(this.debug){
						console.log("infrared debug: clicked on: ", event.target);
					}
					let script = event.target.getAttribute('data-onclick');
					if(!script){
						script = event.target.getAttribute('data-onchange');
					}
					if(script){
						if(this.debug){
							console.log("infrared debug: element onClick script: ", script);
						}
						if(script.endsWith(')') && script.indexOf(';') == -1 && script.indexOf(',') == -1){
							let parameter = null;
							if(script.endsWith('()')){
								script = script.replaceAll('()','');
							}
							else if(script.indexOf('(') != -1){
								const matches = script.match(/\((.*?)\)/);
								//console.log("matches: ", matches);
								if (matches) {
									parameter = matches[1];
									//console.log("parameter: ", parameter);
									script = script.replace('(' + parameter + ')','');

									parameter = parameter.replaceAll("'","");

									

								}
							}
							

							script = script.replaceAll('()','');
							if(typeof this[script] == 'function'){
								
								if(typeof parameter == 'string'){
									if(this.debug){
										console.log("infrared debug: attempting to call function: ", script, ", with parameter: ", parameter);
									}
									if(!isNaN(Number(parameter))){
										parameter = parseInt(parameter);
									}
									this[script](parameter);
								}
								else{
									if(this.debug){
										console.log("infrared debug: attempting to call function: ", script);
									}
									this[script]();
								}
								
							}
						}
						else{
							if(this.debug){
                console.warn("infrared debug: script is too complex to call: ", script);
              }
						}
					}
				})
			}

			// ── Tabs ──
			this.view.querySelectorAll('.extension-infrared-tab').forEach(tab => {
				tab.addEventListener('click', () => {
					document.querySelectorAll('.extension-infrared-tab').forEach(t => t.classList.remove('extension-infrared-active'));
					document.querySelectorAll('.extension-infrared-tab-panel').forEach(p => p.classList.remove('extension-infrared-active'));
					tab.classList.add('extension-infrared-active');
					this.view.querySelector('#extension-infrared-tab-' + tab.dataset.tab).classList.add('extension-infrared-active');
					if (tab.dataset.tab === 'database') this.loadirdbIndex();
          else if(tab.dataset.tab === 'remote'){
            this.render_thing_actions_list();
          }
          this.do_poll();
				});
			});

      const retry_connecting_to_dongle_button_el = this.view.querySelector('#extension-infrared-try-detect-dongle-again-button');
      if(retry_connecting_to_dongle_button_el){
        retry_connecting_to_dongle_button_el.addEventListener('click', () => {
          retry_connecting_to_dongle_button_el.classList.add('extension-infrared-faded');
          setTimeout(() => {
            retry_connecting_to_dongle_button_el.classList.remove('extension-infrared-faded');
          },5000);
          window.API.postJson(
            `/extensions/${this.id}/api/ajax`, {'action': 'detect'}

          ).then((body) => {
            if(this.debug){
              console.log("infrared debug: detect dongle response: ", body);
            }
          }).catch((err) => {
            console.error("infrared: caught error doing call to detect dongle: ", err);
          });

        })
      }
      
      const disabled_state_hint_el = this.view.querySelector('#extension-infrared-disabled-state-hint');
      if(disabled_state_hint_el){
        disabled_state_hint_el.addEventListener('click', (event) => {
          window.API.postJson(
              `/extensions/${this.id}/api/ajax`, {'action': 'enable'}

            ).then((body) => {
              if(this.debug){
                console.log("infrared debug: enable thing response: ", body);
              }
              if(typeof body.state == 'boolean' && body.state == true){
                disabled_state_hint_el.classList.add('extension-infrared-hidden');
              }
            }).catch((err) => {
              console.error("infrared: caught error doing call to enable thing ", err);
            });
        });
      }
      
      const dongle_container_el = this.view.querySelector('#extension-infrared-dongle-container');
      if(dongle_container_el){
        dongle_container_el.addEventListener('click', () => {
          dongle_container_el.classList.add('extension-infrared-hidden');
        });
      }
      
      const add_remote_button_el = this.view.querySelector('#extension-infrared-add-remote-button');
      if(add_remote_button_el){
        add_remote_button_el.addEventListener('click', () => {
          const db_tab_el = this.view.querySelector('.extension-infrared-tab[data-tab="database"]');
          if(db_tab_el){
            db_tab_el.click();
          }
        });
      }

      
      const save_delay_button_el = this.view.querySelector('#extension-infrared-save-delay-button');
      if(save_delay_button_el){
        save_delay_button_el.addEventListener('click', () => {
          const delay_input_el = this.view.querySelector('#extension-infrared-delay-input');
          if(delay_input_el){
            const ms = parseInt(delay_input_el.value);
            if (isNaN(ms) || ms <= 0) return;
            this.customMacroSteps.push({ type: 'delay', ms });
            delay_input_el.value = 250;
          }
          this.view.querySelector('#extension-infrared-delay-modal').close();
        })
      }
      
      const save_remote_name_button_el = this.view.querySelector('#extension-infrared-save-remote-name-button');
      if(save_remote_name_button_el){
        save_remote_name_button_el.addEventListener('click', () => {
          const remote_name_input_el = this.view.querySelector('#extension-infrared-remote-name-input');
          if(remote_name_input_el){
            const new_remote_name = remote_name_input_el.value;
            if(new_remote_name){
              console.log("new_remote_name: ", new_remote_name);

              this.savedRemotes.push({ 'name':new_remote_name, 'buttons': this.importedButtons, 'created': Date.now() });
              //localStorage.setItem('iremote_saved', JSON.stringify(this.savedRemotes));
              this.save('iremote_saved', this.savedRemotes);
              this.rendersavedRemotes();
              const remotes_tab_el = this.view.querySelector('.extension-infrared-tab[data-tab="remote"]');
              if(remotes_tab_el){
                remotes_tab_el.click();
              }
              this.toast(`Saved "${new_remote_name}" with ${this.importedButtons.length} buttons`, 'success');
            }
            remote_name_input_el.value = '';
          }
          this.view.querySelector('#extension-infrared-remote-name-modal').close();
        })
      }

      


			this.view.querySelector('#extension-infrared-batchAddName').addEventListener('onkeydown', (event) => {
				if(event.key==='Enter'){this.addBatchButton();event.preventDefault();}
			});

			this.view.querySelector('#extension-infrared-ir-ac-down-btn').addEventListener('click', () => {
				this.adjustTemp(-1);
			});
			this.view.querySelector('#extension-infrared-ir-ac-up-btn').addEventListener('click', () => {
				this.adjustTemp(1);
			});

			const dropzone_el = this.view.querySelector('#extension-infrared-dropzone');
			const file_input_el = this.view.querySelector('#extension-infrared-fileInput');
			dropzone_el.addEventListener('dragover', (event) => {
				event.preventDefault(); 
				dropzone_el.classList.add('extension-infrared-dragover');
			});
			dropzone_el.addEventListener('dragleave', (event) => {
				event.preventDefault(); 
				dropzone_el.classList.remove('extension-infrared-dragover');
			});
			dropzone_el.addEventListener('drop', (event) => {
				this.handleDrop(event);
			});
			dropzone_el.addEventListener('click', (event) => {
				file_input_el.click()
			});
			file_input_el.addEventListener('change', (event) => {
				this.handleFiles(file_input_el.files);
			});
			
			

				

			window.API.postJson(
        `/extensions/${this.id}/api/ajax`, {'action': 'init'}

      ).then((body) => {
				if(typeof body.debug != 'undefined'){
					this.debug = body.debug;
				}
				if(this.debug){
					console.log("infrared debug: early init response: ", body);
				}
				this.parse_body(body);

				// ── Init ──
				this.rendersavedRemotes();
				this.renderHotelMacros();
				this.loadCustomMacrosIntoHotel();
				this.renderMacroSteps();
        this.render_previously_recorded_signals_list();
        this.render_thing_actions_list();
				//this.initSocket();

				this.initHotelTab();

        this.render_thing_actions_list();
				//this.getCatInfo(key) { return this.IRDB_CAT_INFO[key] || { label: key.replace(/_/g, ' '), emoji: '📱' }; }
				//const mode = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'local' : 'GitHub Pages → localhost:7890';
				this.log(`Infrared loaded... connecting...`, 'info');

      }).catch((err) => {
        console.error("Infrared: caught error in show() init call: ", err);
      });

			
    } // end of show function


    hide() {
			try{
				setTimeout(() => {
	                if(document.getElementById('extension-infrared-menu-item').classList.contains('selected') == false){
	                    this.view.innerHTML = "";
	                }
				},5000);
			}
      catch(err){
        console.error("infrared: caught error in hide: ", err);
      }
    }



		learn(){

			window.API.postJson(
        `/extensions/${this.id}/api/ajax`, {'action': 'learn'}
      ).then((body) => {
        if(this.debug){
          console.log("infrared debug: learn response: ", body);
        }
        this.isRecording = false;
        this.view.querySelector('#extension-infrared-recordBtn').classList.remove('extension-infrared-recording');
        if(typeof body.learned_code != 'undefined' && typeof body.learned_code.pulses != 'undefined' && typeof body.learned_code.count == 'number' && typeof body.learned_code.duration_ms == 'number'){
          this.capturedPulses = body.learned_code.pulses;
          this.learned_code = body.learned_code;
          this.view.querySelector('#extension-infrared-recordLabel').textContent = `Captured ${body.learned_code.count} pulses (${body.learned_code.duration_ms}ms)!`;
          this.view.querySelector('#extension-infrared-capturedSignal').style.display = '';
          this.view.querySelector('#extension-infrared-capturedData').textContent = body.learned_code.pulses.slice(0, 30).join(', ') + (body.count > 30 ? '...' : '');
          this.toast('Signal captured!', 'success');
        }
        else{
          this.toast('Learning failed?', 'error');
        }

      }).catch((err) => {
        console.error("Infrared: caught error in call to learn ", err);
				this.isRecording = false;
				this.view.querySelector('#extension-infrared-recordBtn').classList.remove('extension-infrared-recording');
				this.toast('Learning failed!', 'error');
      });

		}


    render_previously_recorded_signals_list(){
      const signals_list_container_el = this.view.querySelector('#extension-infrared-previously-recorded-signals');
      if(signals_list_container_el){
        signals_list_container_el.innerHTML = '';
        for (const [name, details] of Object.entries(this.allCapturedPulses)) {
          const recorded_item_el = document.createElement('div');

          recorded_item_el.classList.add('extension-infrared-previously-recorded-item');

          
          if(typeof details.pulses != 'undefined'){
            const play_button_el = document.createElement('button');
            play_button_el.classList.add('extension-infrared-btn');
            play_button_el.classList.add('extension-infrared-btn-sm');
            play_button_el.classList.add('extension-infrared-play-captured-signal-button');
            play_button_el.textContent = '▶';
            
            play_button_el.addEventListener('click', () => {
              
              this.transmitPulses(details.pulses);
              this.toast('Replayed captured signal', 'success');

            })
            recorded_item_el.appendChild(play_button_el);
          }
          

          const name_el = document.createElement('span');
          name_el.textContent = name;
          recorded_item_el.appendChild(name_el);

          const remove_button_el = document.createElement('button');
          remove_button_el.classList.add('extension-infrared-btn');
          remove_button_el.classList.add('extension-infrared-btn-sm');
          remove_button_el.classList.add('extension-infrared-btn-danger');
          remove_button_el.textContent = "🗑";
          remove_button_el.addEventListener('click', () => {
            if(typeof this.allCapturedPulses[name] != 'undefined'){
              delete this.allCapturedPulses[name];
              this.save("iremote_captured_pulses", this.allCapturedPulses);
              this.toast(`Deleted "${name}"`, 'success');
              recorded_item_el.remove();
            }
          });
          recorded_item_el.appendChild(remove_button_el);

          signals_list_container_el.appendChild(recorded_item_el);
        }
      }
    }



    render_thing_actions_list(){

      function sanitize(text){
        return text.replace(/[^a-zA-Z0-9]/g, '');
      }

      const actions_list_container_el = this.view.querySelector('#extension-infrared-thing-actions-list-container');
      if(actions_list_container_el){
        actions_list_container_el.innerHTML = '';
        
        for(let r = 0; r < this.savedRemotes.length; r++){
          
        
          //for (const [name, details] of Object.entries(this.savedRemotes)) {
          
          if(typeof this.savedRemotes[r].name == 'string' && this.savedRemotes[r].name.length){
            
            const sanitized_remote_name = sanitize(this.savedRemotes[r].name);
            if(sanitized_remote_name){

              const remote_control_el = document.createElement('div');
              remote_control_el.classList.add('extension-infrared-actions-remote-control');
              remote_control_el.setAttribute('data-name',this.savedRemotes[r].name);

              const name_el = document.createElement('h3');
              name_el.textContent = this.savedRemotes[r].name;
              remote_control_el.appendChild(name_el);

              const buttons_container_el = document.createElement('div');
              buttons_container_el.classList.add('extension-infrared-actions-remote-control-button-container');

              for(let b = 0; b < this.savedRemotes[r]['buttons'].length; b++){
                const remote_control_button_el = document.createElement('div');
                remote_control_button_el.classList.add('extension-infrared-actions-remote-control-button');
                
                const button_name_el = document.createElement('span');
                button_name_el.textContent = this.savedRemotes[r]['buttons'][b].name;
                remote_control_button_el.appendChild(button_name_el);

                const sanitized_button_name = sanitize(this.savedRemotes[r]['buttons'][b].name);

                // TODO: ID could still have collisions
                const button_id = sanitized_remote_name + '---x---' + sanitized_button_name;
                console.log("button_id: ", button_id)
                const button_checkbox_el = document.createElement('input');
                button_checkbox_el.setAttribute('type','checkbox');
                button_checkbox_el.setAttribute('id', button_id);

                if(typeof this.thing_actions[sanitized_remote_name] != 'undefined' && typeof this.thing_actions[sanitized_remote_name][sanitized_button_name] != 'undefined' && typeof this.thing_actions[sanitized_remote_name][sanitized_button_name]['enabled'] == 'boolean'){
                  button_checkbox_el.checked = this.thing_actions[sanitized_remote_name][sanitized_button_name]['enabled'];
                }
                button_checkbox_el.addEventListener('change', () => {
                  if(typeof this.thing_actions[sanitized_remote_name] == 'undefined'){
                    this.thing_actions[sanitized_remote_name] = {};
                  }
                  if(typeof this.thing_actions[sanitized_remote_name][sanitized_button_name] == 'undefined'){
                    this.thing_actions[sanitized_remote_name][sanitized_button_name] = {};
                  }
                  this.thing_actions[sanitized_remote_name][sanitized_button_name]['enabled'] = button_checkbox_el.checked;

                  console.warn("changed: ", this.savedRemotes[r]['buttons'][b]);
                  Object.assign(this.thing_actions[sanitized_remote_name][sanitized_button_name], this.savedRemotes[r]['buttons'][b]);

                  console.log("this.thing_actions for this remote is now: ", sanitized_remote_name, this.thing_actions[sanitized_remote_name]);
                  this.save('thing_actions', this.thing_actions);
                })

                remote_control_button_el.appendChild(button_checkbox_el);

                const button_checkbox_label_el = document.createElement('label');
                button_checkbox_label_el.setAttribute('for', button_id);
                remote_control_button_el.appendChild(button_checkbox_label_el);
                buttons_container_el.appendChild(remote_control_button_el);
                
              }
              remote_control_el.appendChild(buttons_container_el);
              actions_list_container_el.appendChild(remote_control_el);

            }

          }
          
        }
      }
    }
        
// ── Toast ──
toast(msg, type = 'info') {
  const c = this.view.querySelector('#extension-infrared-toast-container');
  const t = document.createElement('div');
  t.className = 'extension-infrared-toast ' + type;
  t.innerHTML = (type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warning' ? '⚠' : 'ℹ') + ' ' + msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

// ── Log ──
log(msg, cls = 'info') {
  const box = this.view.querySelector('#extension-infrared-logBox');
  const ts = new Date().toLocaleTimeString();
  box.innerHTML += `<div class="extension-infrared-${cls}">[ ${ts} ] ${msg}</div>`;
  box.scrollTop = box.scrollHeight;
}
clearLog() { this.view.querySelector('#extension-infrared-logBox').innerHTML = ''; }
exportLog() {
  const text = this.view.querySelector('#extension-infrared-logBox').innerText;
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'iremote_log.txt';
  a.click();
}



// ── Device type switcher ──
switchDeviceType() {
  const val = this.view.querySelector('#extension-infrared-deviceType').value;
  ['tv','ac','fan','custom'].forEach(t => {
    this.view.querySelector('#extension-infrared-remote-' + t).style.display = t === val ? '' : 'none';
  });
}

// ═══════════════════════════════════════════════════
//  this.socket.IO CONNECTION
// ═══════════════════════════════════════════════════

/*
initSocket() {
  const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  //const serverUrl = isLocal ? location.origin : 'http://localhost:7890';
  const serverUrl = isLocal ? location.origin : 'http://192.168.0.45:7890';
  
  if(this.socked == null){
  	this.socket = io(serverUrl, { transports: ['websocket', 'polling'], reconnectionAttempts: 5, reconnectionDelay: 2000 });
  }
  

  this.socket.on('connect', () => {
    this.view.querySelector('#extension-infrared-serverBadge').className = 'extension-infrared-server-badge ok';
    this.view.querySelector('#extension-infrared-serverText').textContent = 'Server OK';
    //this.log(''Connected to Python backend', 'tx');
    this.toast('Server connected', 'success');
  });

  this.socket.on('disconnect', () => {
    this.view.querySelector('#extension-infrared-serverBadge').className = 'extension-infrared-server-badge err';
    this.view.querySelector('#extension-infrared-serverText').textContent = 'Offline';
    //this.log(''Server connection lost', 'err');
    this.toast('Server disconnected', 'error');
  });

  this.socket.on('connect_error', () => {
    this.view.querySelector('#extension-infrared-serverBadge').className = 'extension-infrared-server-badge err';
    this.view.querySelector('#extension-infrared-serverText').textContent = 'Offline';
  });

  // Device events
  this.socket.on('connected', (data) => {
    this.isDeviceConnected = true;
    this.view.querySelector('#extension-infrared-statusDot').classList.add('extension-infrared-connected');
    this.view.querySelector('#extension-infrared-statusText').textContent = data.label;
    this.view.querySelector('#extension-infrared-btnDisconnect').style.display = '';
    this.toast(`${data.label} connected!`, 'success');
    //this.log('`Device connected: ${data.label}`, 'tx');
  });

  this.socket.on('disconnected', () => {
    this.isDeviceConnected = false;
    this.view.querySelector('#extension-infrared-statusDot').classList.remove('extension-infrared-connected');
    this.view.querySelector('#extension-infrared-statusText').textContent = 'No device';
    this.view.querySelector('#extension-infrared-btnDisconnect').style.display = 'none';
    this.toast('Device disconnected', 'warning');
    //this.log(''Device disconnected', 'info');
  });

  this.socket.on('status', (data) => {
    if (data.connected) {
      this.isDeviceConnected = true;
      this.view.querySelector('#extension-infrared-statusDot').classList.add('extension-infrared-connected');
      this.view.querySelector('#extension-infrared-statusText').textContent = `${data.type} (${data.variant || 'HID'})`;
      this.view.querySelector('#extension-infrared-btnDisconnect').style.display = '';
    }
    //this.log('`Backend: pyusb=${data.usb_available ? '✓' : '✕'} hidapi=${data.hid_available ? '✓' : '✕'}`, 'info');
  });

  this.socket.on('error', (data) => {
    this.toast(data.msg, 'error');
    //this.log(''ERROR: ' + data.msg, 'err');
  });

  this.socket.on('log', (data) => {
    //this.log('data.msg, data.cls || 'info');
  });

  this.socket.on('transmit_ok', (data) => {
    //this.log('`Transmit OK (${data.pulses} values)`, 'tx');
  });

  this.socket.on('learn_data', (data) => {
    this.isRecording = false;
    this.view.querySelector('#extension-infrared-recordBtn').classList.remove('extension-infrared-recording');
    this.capturedPulses = data.pulses;
    this.view.querySelector('#extension-infrared-recordLabel').textContent = `Captured ${data.count} pulses (${data.duration_ms}ms)!`;
    this.view.querySelector('#extension-infrared-capturedSignal').style.display = '';
    this.view.querySelector('#extension-infrared-capturedData').textContent = data.pulses.slice(0, 30).join(', ') + (data.count > 30 ? '...' : '');
    this.toast('Signal captured!', 'success');
    //this.log('`Captured ${data.count} pulses, ${data.duration_ms}ms`, 'rx');
  });

  this.socket.on('learn_timeout', (data) => {
    this.isRecording = false;
    this.view.querySelector('#extension-infrared-recordBtn').classList.remove('extension-infrared-recording');
    this.view.querySelector('#extension-infrared-recordLabel').textContent = 'No signal detected. Try again.';
    this.toast('No IR signal detected', 'warning');
    //this.log(''Capture timeout', 'err');
  });
}
*/

// ═══════════════════════════════════════════════════
//  DEVICE CONNECTION
// ═══════════════════════════════════════════════════

connectOcrustar() {
  if (!this.socket || !this.socket.connected) { this.toast('Server not connected', 'error'); return; }
  this.toast('Connecting to Ocrustar...', 'info');
  this.socket.emit('connect_ocrustar');
}

connectTiqiaa() {
  if (!this.socket || !this.socket.connected) { this.toast('Server not connected', 'error'); return; }
  this.toast('Connecting to Tiqiaa...', 'info');
  this.socket.emit('connect_tiqiaa');
}

disconnectDevice() {
  if (!this.socket || !this.socket.connected) return;
  this.socket.emit('disconnect_device');
}

// ═══════════════════════════════════════════════════
//  HAPTIC / AUDIO / VISUAL FEEDBACK
// ═══════════════════════════════════════════════════



// ═══════════════════════════════════════════════════
//  TRANSMIT (via server)
// ═══════════════════════════════════════════════════

transmitPulses(pulses, freqHz = 38000) {
  if (!this.isDeviceConnected) { this.toast('No infrared USB dongle detected', 'warning'); return; }
  //if (!this.socket || !this.socket.connected) { this.toast('Server not connected', 'error'); return; }
  // Send signed pulses: positive=mark, negative=space
  // Server handles sign interpretation per device type
  //this.socket.emit('transmit', { pulses: pulses, freq: freqHz });

  window.API.postJson(
                `/extensions/${this.id}/api/ajax`, {'action': 'transmit', 'pulses': pulses, 'freq': freqHz}
            ).then((body) => {
				if(typeof body.state == 'boolean' && body.state == true){
					this.toast('Signal transmitted', 'success');
				}
				else{
					this.toast('Failed to transmit signal', 'error');
				}
				
            }).catch((err) => {
                console.error("Infrared: caught error in call to transmit ", err);
            });
  
}

// ═══════════════════════════════════════════════════
//  IR PROTOCOL ENCODERS (client-side)
// ═══════════════════════════════════════════════════

necEncode(addr, cmd) {
  const p = [9000, -4500];
  function encodeByte(b) { for (let i=0;i<8;i++) { p.push(560); p.push((b>>i)&1 ? -1690 : -560); } }
  encodeByte(addr); encodeByte((~addr) & 0xFF);
  encodeByte(cmd); encodeByte((~cmd) & 0xFF);
  p.push(560, -45000);
  return p;
}

necExtEncode(addrHi, addrLo, cmd) {
  const p = [9000, -4500];
  function encodeByte(b) { for (let i=0;i<8;i++) { p.push(560); p.push((b>>i)&1 ? -1690 : -560); } }
  encodeByte(addrLo); encodeByte(addrHi);
  encodeByte(cmd); encodeByte((~cmd) & 0xFF);
  p.push(560, -45000);
  return p;
}

samsung32Encode(addr, cmd) {
  const p = [4500, -4500];
  function encodeByte(b) { for (let i=0;i<8;i++) { p.push(560); p.push((b>>i)&1 ? -1690 : -560); } }
  encodeByte(addr); encodeByte(addr);
  encodeByte(cmd); encodeByte((~cmd) & 0xFF);
  p.push(560, -45000);
  return p;
}

rc5Encode(addr, cmd) {
  const H = 889;
  const bits = [1, cmd < 64 ? 1 : 0, 0];
  for (let i=4;i>=0;i--) bits.push((addr>>i)&1);
  for (let i=5;i>=0;i--) bits.push(((cmd&0x3F)>>i)&1);
  // Manchester: 0 = mark-then-space, 1 = space-then-mark
  const manchRaw = [];
  for (const b of bits) {
    if (b === 0) { manchRaw.push(H); manchRaw.push(-H); }
    else { manchRaw.push(-H); manchRaw.push(H); }
  }
  const merged = [manchRaw[0]];
  for (let i=1;i<manchRaw.length;i++) {
    if ((merged[merged.length-1]>0&&manchRaw[i]>0)||(merged[merged.length-1]<0&&manchRaw[i]<0))
      merged[merged.length-1]+=manchRaw[i];
    else merged.push(manchRaw[i]);
  }
  return merged;  // Keep signs! positive=mark, negative=space
}

sonyEncode(addr, cmd, bits=12) {
  const p = [];
  for (let rep=0;rep<3;rep++) {
    p.push(2400, -600);
    for (let i=0;i<7;i++) { p.push((cmd>>i)&1 ? 1200 : 600); p.push(-600); }
    const addrBits = bits === 12 ? 5 : bits === 15 ? 8 : 5;s
    for (let i=0;i<addrBits;i++) { p.push((addr>>i)&1 ? 1200 : 600); p.push(-600); }
    p[p.length-1] = -45000;
  }
  return p;
}

encodeProtocol(proto, addr, cmd) {
  switch (proto) {
    case 'nec': case 'nec1': return this.necEncode(addr & 0xFF, cmd & 0xFF);
    case 'necext': case 'necx1': case 'necx2': case 'nec42': return this.necExtEncode((addr >> 8) & 0xFF, addr & 0xFF, cmd & 0xFF);
    case 'samsung32': return this.samsung32Encode(addr & 0xFF, cmd & 0xFF);
    case 'rc5': case 'rc5x': return this.rc5Encode(addr & 0x1F, cmd & 0x3F);
    case 'sirc': case 'sirc12': case 'sony12': return this.sonyEncode(addr, cmd, 12);
    case 'sirc15': case 'sony15': return this.sonyEncode(addr, cmd, 15);
    case 'sirc20': case 'sony20': return this.sonyEncode(addr, cmd, 20);
    default: return this.necEncode(addr & 0xFF, cmd & 0xFF);
  }
}


async sendTV(btn) {
  if (!this.isDeviceConnected) { this.toast('No infrared USB dongle detected', 'warning'); return; }
  const signals = [
    this.samsung32Encode(0x07, this.TV_SAMSUNG[btn]),
    this.necEncode(0x04, this.TV_LG[btn]),
    this.sonyEncode(0x01, this.TV_SONY[btn], 12),
    this.rc5Encode(0x00, this.TV_RC5[btn])
  ];
  //this.log('`Sending TV "${btn}" (multi-blast × ${signals.length})`, 'info');
  for (const pulses of signals) {
    this.transmitPulses(pulses);
    await sleep(80);
  }
  this.toast(`Sent: ${btn}`, 'success');
}

async sendAcPower() {
  if (!this.isDeviceConnected) { this.toast('No infrared USB dongle detected', 'warning'); return; }
  const addrs = [0x04, 0x10, 0x01, 0x08, 0x6D];
  for (const addr of addrs) {
    this.transmitPulses(this.necEncode(addr, 0x02));
    await sleep(60);
  }
  this.toast('AC Power toggle sent', 'success');
}

adjustTemp(d) {
  this.acTemp = Math.max(16, Math.min(30, this.acTemp + d));
  this.view.querySelector('#extension-infrared-acTemp').textContent = this.acTemp + '°C';
}


async sendFan(btn) {
  if (!this.isDeviceConnected) { this.toast('No infrared USB dongle detected', 'warning'); return; }
  const addrs = [0x80, 0x71, 0x60, 0x50, 0x12];
  for (const addr of addrs) {
    this.transmitPulses(this.necEncode(addr, this.FAN_CMDS[btn]));
    await sleep(60);
  }
  this.toast(`Fan: ${btn}`, 'success');
}

async sendProtocolCode() {
  if (!this.isDeviceConnected) { this.toast('No infrared USB dongle detected', 'warning'); return; }
  const proto = this.view.querySelector('#extension-infrared-protoSelect').value;
  const addr = parseInt(this.view.querySelector('#extension-infrared-protoAddr').value) || 0;
  const cmd = parseInt(this.view.querySelector('#extension-infrared-protoCmd').value) || 0;
  let pulses;
  switch (proto) {
    case 'nec': pulses = this.necEncode(addr, cmd); break;
    case 'nec_ext': pulses = this.necExtEncode((addr >> 8) & 0xFF, addr & 0xFF, cmd); break;
    case 'samsung32': pulses = this.samsung32Encode(addr, cmd); break;
    case 'rc5': pulses = this.rc5Encode(addr, cmd); break;
    case 'sony12': pulses = this.sonyEncode(addr, cmd, 12); break;
    case 'sony15': pulses = this.sonyEncode(addr, cmd, 15); break;
    default: pulses = this.necEncode(addr, cmd);
  }
  this.transmitPulses(pulses);
  this.toast(`Sent ${proto.toUpperCase()} addr=0x${addr.toString(16)} cmd=0x${cmd.toString(16)}`, 'success');
}

// ═══════════════════════════════════════════════════
//  RECORDING
// ═══════════════════════════════════════════════════

toggleRecord() {
  if (!this.isDeviceConnected) { this.toast('No infrared USB dongle detected', 'warning'); return; }
  if (!this.isRecording) {
    this.isRecording = true;
    this.view.querySelector('#extension-infrared-recordBtn').classList.add('extension-infrared-recording');
    this.view.querySelector('#extension-infrared-recordLabel').textContent = 'Listening... point your remote at the blaster';
    //this.log(''Learn mode started — waiting for IR signal...', 'info');
    //this.socket.emit('learn', { timeout: 15 });
	this.learn()
  }
}

saveCaptured() {
  if (!this.capturedPulses) return;
  const name = this.view.querySelector('#extension-infrared-capturedName').value || 'Button ' + Date.now();
  this.addToCustomRemote(name, this.capturedPulses);
  if(this.learned_code != null){
    this.allCapturedPulses[name] = this.learned_code;
    this.allCapturedPulses[name]['name'] = name;
    //{"name":name, "pulses":this.capturedPulses}
    this.save("iremote_captured_pulses", this.allCapturedPulses);
    this.toast(`Saved "${name}"`, 'success');
  }
}

replayCaptured() {
  if (!this.capturedPulses || !this.isDeviceConnected) return;
  this.transmitPulses(this.capturedPulses);
  this.toast('Replayed captured signal', 'success');
}

// ═══════════════════════════════════════════════════
//  FILE IMPORT (Flipper .ir, IRDB .csv, raw)
// ═══════════════════════════════════════════════════

handleDrop(e) {
  e.preventDefault();
  e.target.classList.remove('extension-infrared-dragover');
  this.handleFiles(e.dataTransfer.files);
}

async handleFiles(files) {
  for (const file of files) {
    const text = await file.text();
    const name = file.name;
    if (name.endsWith('.ir')) this.parseFlipperIR(text, name);
    else if (name.endsWith('.csv')) this.parseIRDBCsv(text, name);
    else if (name.endsWith('.json')) this.parseIRemoteJson(text, name);
    else this.parseRawText(text, name);
  }
}

// Import iRemote Android app JSON format (from /data/data/com.deadboy.iremote/files/remotes/)
parseIRemoteJson(text, fileName) {
  try {
    const data = JSON.parse(text);
    // Support both single remote and array of remotes
    const remotes = Array.isArray(data) ? data : [data];
    const allButtons = [];
    for (const remote of remotes) {
      const buttons = remote.buttons || [];
      for (const btn of buttons) {
        let pulses = null;
        const freq = btn.carrierFreqHz || 38000;
        // Use rawPulses if available
        if (btn.rawPulses && btn.rawPulses.length > 0) {
          pulses = btn.rawPulses;
        } else if (btn.protocol && btn.address !== undefined && btn.command !== undefined) {
          // Re-encode from protocol info
          const proto = (btn.protocol || '').toLowerCase().replace(/_/g, '');
          const addr = Number(btn.address) || 0;
          const cmd = Number(btn.command) || 0;
          pulses = this.encodeProtocol(proto, addr, cmd);
        }
        if (pulses && pulses.length > 0) {
          allButtons.push({ name: btn.label || btn.name || 'Button', pulses, freq });
        }
      }
    }
    if (allButtons.length > 0) {
      this.importedButtons = allButtons;
      const remoteName = remotes[0]?.name || fileName;
      this.showImported(remoteName, allButtons);
      this.toast(`Imported ${allButtons.length} buttons from ${remoteName}`, 'success');
    } else {
      this.toast('No valid buttons found in JSON', 'warning');
    }
  } catch (e) {
    this.toast('Invalid JSON file: ' + e.message, 'error');
  }
}

parseFlipperIR(text, fileName) {
  const buttons = [];
  const blocks = text.split('#').map(b => b.trim()).filter(Boolean);
  for (const block of blocks) {
    const lines = {};
    block.split('\n').forEach(l => {
      const i = l.indexOf(':');
      if (i > 0) lines[l.substring(0, i).trim().toLowerCase()] = l.substring(i + 1).trim();
    });
    if (lines.filetype) continue;
    const name = lines.name;
    if (!name) continue;
    const type = (lines.type || '').toLowerCase();
    let pulses = null;
    if (type === 'raw') {
      const data = (lines.data || '').split(/\s+/).map(Number).filter(n => !isNaN(n));
      // Flipper raw data alternates mark/space as unsigned; convert to signed
      pulses = data.map((v, i) => i % 2 === 0 ? Math.abs(v) : -Math.abs(v));
    } else if (type === 'parsed') {
      const proto = (lines.protocol || '').toLowerCase();
      const addr = parseFlipperHex(lines.address || '0');
      const cmd = parseFlipperHex(lines.command || '0');
      pulses = this.encodeProtocol(proto, addr, cmd);
    }
    if (pulses && pulses.length > 0) buttons.push({ name: name.replace(/_/g, ' '), pulses, freq: 38000 });
  }
  if (buttons.length > 0) {
    this.importedButtons = buttons;
    this.showImported(fileName, buttons);
    this.toast(`Imported ${buttons.length} buttons from ${fileName}`, 'success');
  } else { this.toast('No valid buttons found', 'warning'); }
}

parseIRDBCsv(text, fileName) {
	try{
		const buttons = [];
		const lines = text.split('\n').slice(1).filter(l => l.trim() && l.includes(','));
		for (const line of lines) {
			const cols = line.split(',').map(s => s.trim());
			if (cols.length < 5) continue;
			const [funcName, protocol, device, subdevice, func] = cols;
			const d = parseInt(device), s = parseInt(subdevice), f = parseInt(func);
			if (isNaN(d) || isNaN(f)) continue;
			const pulses = this.encodeProtocol(protocol.toLowerCase(), d | ((isNaN(s) ? 0 : s) << 8), f);
			if(this.debug){
				console.log("infrared debug: parseIRDBCsv: pulses: ", pulses);
			}
			if (pulses.length > 0) buttons.push({ name: funcName.replace(/_/g, ' '), pulses, freq: 38000 });
		}
		if (buttons.length > 0) {
			this.importedButtons = buttons;
			this.showImported(fileName, buttons);
			this.toast(`Imported ${buttons.length} codes from ${fileName}`, 'success');
		} else { this.toast('No valid codes found in CSV', 'warning'); }
	}
	catch(err){
		console.error("caught error in parseIRDBCsv: ", err);
	}
  
}

parseRawText(text, fileName) {
  const nums = text.match(/[+-]?\d+/g);
  if (nums && nums.length >= 4) {
    const pulses = nums.map((n, i) => {
      const v = parseInt(n);
      // If already signed, keep as-is; if unsigned, alternate mark/space
      if (v < 0) return v;
      return i % 2 === 0 ? Math.abs(v) : -Math.abs(v);
    });
    this.importedButtons = [{ name: fileName.replace(/\.\w+$/, ''), pulses, freq: 38000 }];
    this.showImported(fileName, this.importedButtons);
    this.toast(`Imported raw pulse data from ${fileName}`, 'success');
  } else { this.toast('Could not parse file', 'error'); }
}

parseFlipperHex(hex) {
  const bytes = hex.trim().split(/\s+/).map(b => parseInt(b, 16)).filter(n => !isNaN(n));
  let v = 0;
  for (let i = 0; i < bytes.length; i++) v |= bytes[i] << (i * 8);
  return v;
}

showImported(fileName, buttons) {
  this.view.querySelector('#extension-infrared-importedRemote').style.display = '';
  this.view.querySelector('#extension-infrared-importedFileName').textContent = '📂 ' + fileName;
  const container = this.view.querySelector('#extension-infrared-importedButtons');
  container.innerHTML = '';
  buttons.forEach((btn, i) => {
    const el = document.createElement('button');
    el.className = 'extension-infrared-ir-btn';
    el.style.cssText = 'width:auto; padding:8px 16px; height:auto; font-size:11px;';
    el.textContent = btn.name;
    el.onclick = () => this.sendImportedButton(i);
    container.appendChild(el);
  });
}

sendImportedButton(idx) {
  if (!this.isDeviceConnected) { this.toast('No infrared USB dongle detected', 'warning'); return; }
  const btn = this.importedButtons[idx];
  this.transmitPulses(btn.pulses, btn.freq || 38000);
  this.toast(`Sent: ${btn.name}`, 'success');
}

clearImported() {
  this.importedButtons = [];
  this.view.querySelector('#extension-infrared-importedRemote').style.display = 'none';
}

saveImportedRemote() {
  if (this.importedButtons.length === 0) return;

  const remote_name_modal_el = this.view.querySelector('#extension-infrared-remote-name-modal');
  if(remote_name_modal_el){
    console.log("calling showModal on remote_name_modal_el: ", remote_name_modal_el);
    remote_name_modal_el.showModal();
    const remote_name_input_el = this.view.querySelector('#extension-infrared-remote-name-input');
    if(remote_name_input_el){
      remote_name_input_el.value = this.suggested_remote_name;
    }
    this.suggested_remote_name = '';
  }
  /*
  const name = prompt('Remote name:', 'My Remote');
  if (!name) return;
  this.savedRemotes.push({ name, buttons: this.importedButtons, created: Date.now() });
  //localStorage.setItem('iremote_saved', JSON.stringify(this.savedRemotes));
  this.save('iremote_saved',this.savedRemotes);
  this.rendersavedRemotes();
  this.toast(`Saved "${name}" with ${this.importedButtons.length} buttons`, 'success');
  */
}





initHotelTab() {
  if(this.debug){
    console.log("infrared debug: initHotelTab: this.show_extra_macros: ", this.show_extra_macros);
  }
  
  //if(this.show_extra_macros){
   //this.renderHotelBrandChips();
  //}
  this.renderHotelMacros();
  if(this.show_extra_macros){
    this.renderHotelMacros(true);
  }
}

renderHotelBrandChips() {
  const brands = [...new Set(this.HOTEL_MACROS.map(m => m.brand))];
  const container = this.view.querySelector('#extension-infrared-hotelBrandChips');
  let html = `<div class="extension-infrared-hotel-chip ${!this.hotelSelectedBrand ? 'active' : ''}" data-onclick="this.renderHotelMacros();">All</div>`; // hotelSelectedBrand=null; this.renderHotelBrandChips(); 
  brands.forEach(b => {
    html += `<div class="extension-infrared-hotel-chip ${this.hotelSelectedBrand === b ? 'active' : ''}" data-onclick="this.renderHotelMacros();">${b}</div>`; // hotelSelectedBrand='${b}'; this.renderHotelBrandChips(); 
  });
  container.innerHTML = html;
}

renderHotelMacros(secret=false) {
  if(this.debug){
    console.log("infrared debug: renderHotelMacros: secret: ", secret);
  }
  let filtered = this.hotelSelectedBrand
    ? this.HOTEL_MACROS.filter(m => m.brand === this.hotelSelectedBrand)
    : this.HOTEL_MACROS;

  let container = this.view.querySelector('#extension-infrared-hotelMacroList');

  if(secret){
    filtered = this.HOTEL_TV_MACROS;
    container = this.view.querySelector('#extension-infrared-secretMacrosList');
  }
  else{
    filtered.reverse();
  }
  
  
  container.innerHTML = filtered.map(m => {
    const badgeClass = m.warningLevel === 0 ? 'safe' : m.warningLevel === 1 ? 'caution' : 'danger';
    const badgeLabel = m.warningLevel === 0 ? 'Safe' : m.warningLevel === 1 ? 'Caution' : 'Advanced';
    const stateNote = m.tvState === 'OFF' ? '<div class="extension-infrared-macro-card-note">⚠️ TV must be OFF (standby)</div>' : '';
    const stepsPreview = m.steps.filter(s => s.type !== 'delay').map(s => s.label).join(' → ');
    const desc = m.description.replace(/\n/g, '<br>');
    let secret_modifier = '';
    if(secret){
      secret_modifier = 'Secret';
    }
    return `<div class="extension-infrared-macro-card">
      <div class="extension-infrared-macro-card-info">
        <div class="extension-infrared-macro-card-header">
          <span class="extension-infrared-macro-card-name">${m.name}</span>
          <span class="extension-infrared-macro-badge ${badgeClass}">${badgeLabel}</span>
        </div>
        <div class="extension-infrared-macro-card-brand">${m.brand}</div>
        <div class="extension-infrared-macro-card-desc">${desc}</div>
        <div class="extension-infrared-macro-steps-preview">${stepsPreview}</div>
        ${stateNote}
      </div>
      <button class="extension-infrared-macro-run-btn" data-onclick="run${secret_modifier}HotelMacro('${m.id}')" ${this.macroRunning ? 'disabled' : ''}>
        ▶ Run
      </button>
    </div>`;
    
    
  }).join('');
}

runSecretHotelMacro(id){
  this.runHotelMacro(id,true);
}

async runHotelMacro(id,secret=false) {
  let macro = null;
  if(secret){
    macro = this.HOTEL_TV_MACROS.find(m => m.id === id);
  }
  else{
    macro = this.HOTEL_MACROS.find(m => m.id === id);
  }
  if (!macro) return;
  if (!this.isDeviceConnected) { this.toast('No infrared USB dongle detected', 'warning'); return; }
  if (this.macroRunning) { this.toast('Macro already running', 'warning'); return; }

  // Warning dialog for dangerous macros
  if (macro.warningLevel >= 2) {
    if (!confirm(`⚠️ ${macro.name}\n\nThis accesses the factory service menu. Incorrect changes can permanently damage the TV.\n\nOnly proceed if you know what you're doing.`)) return;
  }

  this.macroRunning = true;
  this.renderHotelMacros(); // disable buttons

  const irSteps = macro.steps.filter(s => s.type !== 'delay');
  const totalSteps = irSteps.length;
  let stepNum = 0;

  const progressDiv = this.view.querySelector('#extension-infrared-macroProgress');
  const progressBar = this.view.querySelector('#extension-infrared-macroProgressBar');
  const progressText = this.view.querySelector('#extension-infrared-macroProgressText');
  const stepLabel = this.view.querySelector('#extension-infrared-macroStepLabel');
  progressDiv.style.display = '';

  //this.log('`🏨 Running macro: ${macro.name} (${macro.brand})`, 'info');

  for (const step of macro.steps) {
    if (step.type === 'delay') {
      await sleep(step.ms);
    } else if (step.type === 'ir') {
      stepNum++;
      progressBar.style.width = (stepNum / totalSteps * 100) + '%';
      progressText.textContent = `${stepNum}/${totalSteps}`;
      stepLabel.textContent = `Sending: ${step.label}`;
      const pulses = step.encode();
      this.transmitPulses(pulses, step.freq || 38000);
      //this.log('`  → ${step.label}`, 'info');
    } else if (step.type === 'hold') {
      stepNum++;
      progressBar.style.width = (stepNum / totalSteps * 100) + '%';
      progressText.textContent = `${stepNum}/${totalSteps}`;
      stepLabel.textContent = `Holding: ${step.label}`;
      //this.log('`  → ${step.label} (hold ${step.durationMs}ms)`, 'info');
      // Send repeated IR commands to simulate holding the button
      const holdEnd = Date.now() + step.durationMs;
      while (Date.now() < holdEnd) {
        const pulses = step.encode();
        this.transmitPulses(pulses, step.freq || 38000);
        await sleep(110); // NEC repeat interval ~110ms
      }
    }
  }

  progressBar.style.width = '100%';
  stepLabel.textContent = 'Done!';
  this.toast(`✅ ${macro.name} completed`, 'success');
  //this.log('`✅ Macro complete: ${macro.name}`, 'info');

  await sleep(1500);
  progressDiv.style.display = 'none';
  progressBar.style.width = '0%';
  this.macroRunning = false;
  this.renderHotelMacros(); // re-enable buttons
}

// Initialize hotel tab
/*
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => this.initHotelTab());
} else {
  initHotelTab();
}
  */

// ═══════════════════════════════════════════════════
//  BROWSABLE IR DATABASE (Android-style, Git Trees API)
// ═══════════════════════════════════════════════════

getCatInfo(key) { return this.IRDB_CAT_INFO[key] || { label: key.replace(/_/g, ' '), emoji: '📱' }; }

async fetchGitTree(url) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.tree || []).filter(t => t.type === 'blob').map(t => t.path);
  } catch (e) { console.warn('Tree fetch error:', e); return []; }
}

async loadirdbIndex(force) {
  if (this.irdbIndex && !force) { this.renderIrdb(); return; }
  if (this.irdbLoading) return;
  this.irdbLoading = true;
  this.renderirdbLoading();

  const [flipperPaths, irdbPaths] = await Promise.all([
    this.fetchGitTree('https://api.github.com/repos/Lucaslhm/Flipper-IRDB/git/trees/main?recursive=1'),
    this.fetchGitTree('https://api.github.com/repos/probonopd/irdb/git/trees/master?recursive=1')
  ]);

  if (flipperPaths.length === 0 && irdbPaths.length === 0) {
    this.irdbLoading = false;
    this.renderIrdbError('No data from either source. Check internet or GitHub rate limits.');
    return;
  }

  const merged = {};

  // Flipper-IRDB: DeviceType/Brand/File.ir
  for (const p of flipperPaths) {
    if (!p.toLowerCase().endsWith('.ir')) continue;
    const s = p.split('/');
    if (s.length < 3) continue;
    const cat = s[0], brand = s[1], file = s[s.length - 1];
    if (!merged[cat]) merged[cat] = {};
    if (!merged[cat][brand]) merged[cat][brand] = [];
    merged[cat][brand].push({
      name: file.replace(/\.ir$/i, '').replace(/_/g, ' '),
      fileName: file, path: p, source: 'flipper'
    });
  }

  // irdb: codes/Brand/DeviceType/device,subdevice.csv
  for (const p of irdbPaths) {
    if (!p.startsWith('codes/') || !p.toLowerCase().endsWith('.csv')) continue;
    const s = p.slice(6).split('/'); // remove "codes/"
    if (s.length < 3) continue;
    const brand = s[0], devType = s[1], file = s[s.length - 1];
    if (!merged[devType]) merged[devType] = {};
    if (!merged[devType][brand]) merged[devType][brand] = [];
    merged[devType][brand].push({
      name: brand + ' ' + file.replace(/\.csv$/i, ''),
      fileName: file, path: p, source: 'irdb'
    });
  }

  // Sort everything
  let total = 0;
  const categories = {};
  Object.keys(merged).sort().forEach(cat => {
    const brands = {};
    Object.keys(merged[cat]).sort().forEach(br => {
      const files = merged[cat][br].sort((a, b) => a.name.localeCompare(b.name));
      total += files.length;
      brands[br] = files;
    });
    categories[cat] = { brands, brandCount: Object.keys(brands).length, fileCount: Object.values(brands).reduce((s, f) => s + f.length, 0) };
  });

  this.irdbIndex = { categories, totalFiles: total };
  this.irdbLoading = false;
  this.irdbNav = { category: null, brand: null, query: '' };
  this.renderIrdb();
  this.toast(`Loaded ${total} IR codes from ${Object.keys(categories).length} categories`, 'success');
}

renderirdbLoading() {
  this.view.querySelector('#extension-infrared-irdbBrowser').innerHTML = `
    <div class="extension-infrared-irdb-loading">
      <div class="extension-infrared-irdb-spinner"></div>
      <div>Loading IR databases...</div>
      <div style="font-size:11px; opacity:0.5; margin-top:4px;">Flipper-IRDB + probonopd/irdb</div>
    </div>`;
}

renderIrdbError(msg) {
  this.view.querySelector('#extension-infrared-irdbBrowser').innerHTML = `
    <div class="extension-infrared-irdb-empty">
      <div class="extension-infrared-irdb-empty-icon">☁️</div>
      <div style="font-size:16px; margin-bottom:4px;">Couldn't load database</div>
      <div style="font-size:12px; opacity:0.6; margin-bottom:16px;">${msg}</div>
      <button class="extension-infrared-btn extension-infrared-btn-primary" data-onclick="loadirdbIndex(true)">Retry</button>
    </div>`;
}

clearrenderIrdb(){
  this.irdbNav.query = '';
  this.renderIrdb();
}


renderIrdb() { // irdbIndex=null
  console.log("in renderIrdb");
  if (!this.irdbIndex) return;
  const { category, brand, query } = this.irdbNav;
  const container = this.view.querySelector('#extension-infrared-irdbBrowser');

  console.log("renderIrdb: this.irdbNav: ", this.irdbNav);
  console.log("renderIrdb: this.irdbIndex.categories: ", this.irdbIndex.categories);

  // Title
  let title = 'IR Database';
  if (brand) title = brand;
  else if (category) title = this.getCatInfo(category).label;

  // Determine what back does
  const backAction = brand ? `this.irdbNav.brand=null; renderIrdb()`
    : category ? `this.irdbNav.category=null; this.irdbNav.query=''; renderIrdb()`
    : null;

  
  let html = `<div class="extension-infrared-irdb-topbar">`;
  if (backAction) {
    html += `<button id="extension-infrared-irdb-back" class="extension-infrared-irdb-back">←</button>`;
  }
  html += `<div class="extension-infrared-irdb-title">${title}</div>`;
  html += `<span class="extension-infrared-irdb-count">${this.irdbIndex.totalFiles} codes</span>`;
  html += `</div>`;

  // Search bar (not in file view)
  if (!brand) {
    const placeholder = category ? `Search ${this.getCatInfo(category).label} brands...` : 'Search all brands...';
    html += `<div class="extension-infrared-irdb-searchbar">
      <span class="extension-infrared-search-icon">🔍</span>
      <input id="extension-infrared-irdbSearchInput" placeholder="${placeholder}" value="${query}">
	  ${query ? '<button class="extension-infrared-clear-btn" data-onclick="clearrenderIrdb()">✕</button>' : ''}
    </div>`;
	// 
  }
  container.innerHTML = html;

  let irdb_list_el = document.createElement('div');
  irdb_list_el.classList.add('extension-infrared-irdb-list');
  irdb_list_el.setAttribute('id','extension-infrared-irdb-list-container');
  container.appendChild(irdb_list_el);

  //html += `<div class="extension-infrared-irdb-list">`;
  let files_html = '';
  if (brand && category) {
    // Files view
    const files = this.irdbIndex.categories[category]?.brands[brand] || [];
	if(this.debug){
		console.log("infrared debug: files: ", files);
	}
    files_html = `<div class="extension-infrared-irdb-hint">ℹ️ Tap to download and add as buttons you can test and save</div>`;
    files.forEach(f => {
      const srcBadge = f.source === 'flipper'
        ? '<span class="extension-infrared-irdb-chip" style="color:var(--orange);">🐬 Flipper</span>'
        : '<span class="extension-infrared-irdb-chip" style="color:var(--success);">📊 IRDB</span>';
	  const file_item_el = document.createElement('div');
	  file_item_el.classList.add('extension-infrared-irdb-file');
	  file_item_el.addEventListener('click', () => {
		if(this.debug){
      console.log("infrared debug: file_item_el: ", file_item_el, file_item_el.textContent);
      this.suggested_remote_name = f.path.split('/')[1] + ' ' + f.path.split('/')[2]; //file_item_el.textContent;
			console.log("infrared debug: irdb: file details:  \n- f.source: ", f.source, "\n- f.path: ",f.path, "\n- f.fileName: ",f.fileName);
		}
		this.loadIrdbFile(f.source,encodeURIComponent(f.path),encodeURIComponent(f.fileName));
		//this.loadIrdbFile(f.source,f.path,f.fileName);
	  })
	  file_item_el.innerHTML = `<span class="extension-infrared-irdb-file-icon">📄</span>
        <div class="extension-infrared-irdb-file-info">
          <div class="extension-infrared-irdb-file-name">${f.name}</div>
          <div>${srcBadge}<span class="extension-infrared-irdb-chip">${f.fileName}</span></div>
        </div>
        <span class="extension-infrared-irdb-file-dl">⬇️</span>`;
	  irdb_list_el.appendChild(file_item_el);
    });
	
  } else if (category && !brand) {
    // Brands view (filtered)
    const data = this.irdbIndex.categories[category];
    if (!data) { irdb_list_el.innerHTML = `<div class="extension-infrared-irdb-empty"><div class="extension-infrared-irdb-empty-icon">🔍</div><div>No data</div></div>`; }
    else {
      let brands = Object.keys(data.brands).sort();
      if (query.length >= 1) {
        const tokens = query.toLowerCase().split(/\s+/).filter(t => t.length >= 1);
        brands = brands.filter(b => {
          const bl = b.toLowerCase();
          const fileText = data.brands[b].map(f => f.name + ' ' + f.fileName).join(' ').toLowerCase();
          return tokens.every(t => bl.includes(t) || fileText.includes(t));
        });
      }
      if (brands.length === 0) {
        irdb_list_el.innerHTML = `<div class="extension-infrared-irdb-empty"><div class="extension-infrared-irdb-empty-icon">🔍</div><div>No brands matching "${query}"</div></div>`;
      } else {
		
        const grouped = {};
        brands.forEach(b => { const l = b[0].toUpperCase(); (grouped[l] = grouped[l] || []).push(b); });
        Object.keys(grouped).sort().forEach(letter => {
			const letter_el = document.createElement('div');
			letter_el.classList.add('extension-infrared-irdb-letter');
			letter_el.textContent = letter;
			irdb_list_el.appendChild(letter_el);
          //brand_item_el.innerHTML = `<div class="extension-infrared-irdb-letter">${letter}</div>`;
          grouped[letter].forEach(b => {
            const count = data.brands[b].length;
			const brand_item_el = document.createElement('div');
			brand_item_el.classList.add('extension-infrared-irdb-brand');
			brand_item_el.addEventListener('click', () => {
				this.irdbNav.brand = b.replace(/'/g,"\\'")
				this.renderIrdb();
			})
			brand_item_el.innerHTML = `<span class="extension-infrared-irdb-brand-name">${b}</span>
              <span class="extension-infrared-irdb-brand-count">${count}</span>
              <span class="extension-infrared-irdb-brand-arrow">›</span>`;
			irdb_list_el.appendChild(brand_item_el);
          });
        });
      }
    }
  } else if (query.length >= 2) {
    // Smart cross-category search: split query into tokens, match against brand + category + files
    const tokens = query.toLowerCase().split(/\s+/).filter(t => t.length >= 1);
    const results = [];
    for (const [cat, data] of Object.entries(this.irdbIndex.categories)) {
      const info = this.getCatInfo(cat);
      const catText = (cat + ' ' + info.label + ' ' + info.emoji).toLowerCase();
      for (const [br, files] of Object.entries(data.brands)) {
        const brLower = br.toLowerCase();
        // Check if ALL tokens match across brand name, category name, or file names
        const fileText = files.map(f => f.name + ' ' + f.fileName).join(' ').toLowerCase();
        const searchable = brLower + ' ' + catText + ' ' + fileText;
        const allMatch = tokens.every(t => searchable.includes(t));
        if (!allMatch) continue;
        // Score: exact brand match > brand starts with first token > brand contains token > category-only match
        let score = 0;
        if (brLower === tokens[0]) score = 100;
        else if (brLower.startsWith(tokens[0])) score = 80;
        else if (brLower.includes(tokens[0])) score = 60;
        else score = 40; // matched via category/files only
        // Bonus if a token matches category (means user is filtering by type)
        if (tokens.some(t => catText.includes(t) && !brLower.includes(t))) score += 10;
        results.push({ category: cat, brand: br, fileCount: files.length, sources: [...new Set(files.map(f => f.source))], score });
      }
    }
    if (results.length === 0) {
      irdb_list_el.innerHTML = `<div class="extension-infrared-irdb-empty"><div class="extension-infrared-irdb-empty-icon">🔍</div><div>No results for "${query}"</div><div style="font-size:12px; opacity:0.5; margin-top:6px;">Try: brand name, category, or both (e.g. "samsung TV")</div></div>`;
    } else {
      results.sort((a, b) => b.score - a.score || a.brand.localeCompare(b.brand));
      irdb_list_el.innerHTML = `<div style="font-size:12px; color:var(--text-dim); padding:4px; margin-bottom:8px;">${results.length} results</div>`;
      results.forEach(r => {
        const info = this.getCatInfo(r.category);
        const srcChips = r.sources.map(s => s === 'flipper' ? '<span class="extension-infrared-irdb-chip" style="color:var(--orange);">Flipper</span>' : '<span class="extension-infrared-irdb-chip" style="color:var(--success);">irdb</span>').join('');
        const search_result_item_el = document.createElement('div');
		search_result_item_el.classList.add('extension-infrared-irdb-search-result');
		search_result_item_el.addEventListener('click', () => {
			this.irdbNav.category=r.category; 
			this.irdbNav.brand=r.brand.replace(/'/g,"\\'"); 
			this.irdbNav.query=''; 
			this.renderIrdb();
		});
		search_result_item_el.innerHTML = `<span class="extension-infrared-irdb-search-emoji">${info.emoji}</span>
          <div class="extension-infrared-irdb-search-info">
            <div class="extension-infrared-irdb-search-brand">${r.brand}</div>
            <div><span class="extension-infrared-irdb-chip">${info.label}</span><span class="extension-infrared-irdb-chip">${r.fileCount} files</span>${srcChips}</div>
          </div>
          <span class="extension-infrared-irdb-brand-arrow">›</span>`;
		irdb_list_el.appendChild(search_result_item_el);
      });
    }
  } else {
    // Categories view
    Object.entries(this.irdbIndex.categories).forEach(([key, data]) => {
      const info = this.getCatInfo(key);
	  const category_item_el = document.createElement('div');
	  category_item_el.classList.add('extension-infrared-irdb-cat');
	  category_item_el.addEventListener('click', () => {
			this.irdbNav.category=key; 
			this.renderIrdb();
		});
	  category_item_el.innerHTML = `<span class="extension-infrared-irdb-cat-emoji">${info.emoji}</span>
        <div class="extension-infrared-irdb-cat-info">
          <div class="extension-infrared-irdb-cat-label">${info.label}</div>
          <div class="extension-infrared-irdb-cat-meta">${data.brandCount} brands · ${data.fileCount} files</div>
        </div>
        <span class="extension-infrared-irdb-cat-arrow">›</span>`;
	  irdb_list_el.appendChild(category_item_el);
    });
  }

  

  	const irdb_search_input_el = this.view.querySelector('#extension-infrared-irdbSearchInput');
	if(irdb_search_input_el){
		irdb_search_input_el.addEventListener('input', () => {
			this.irdbNav.query = irdb_search_input_el.value;
			this.renderIrdb();
		})
		const irdb_back_button_el = this.view.querySelector('#extension-infrared-irdb-back');
		if(irdb_back_button_el){
			irdb_back_button_el.addEventListener('click', () => {
				console.log("clicked on back button");
				if(brand){
					this.irdbNav.brand=null; 
					this.renderIrdb();
				}
				else{
					this.irdbNav.category=null; 
					this.irdbNav.query=''; 
					this.renderIrdb();
				}
			})
		}
		

		// Re-focus search input if it exists
		if (!brand) {
			irdb_search_input_el.focus(); irdb_search_input_el.selectionStart = irdb_search_input_el.selectionEnd = irdb_search_input_el.value.length;
		}
	}
	
}

async loadIrdbFile(source, encodedPath, encodedFileName) {
  //const path = decodeURIComponent(encodedPath);
  const path = encodedPath;
  const fileName = decodeURIComponent(encodedFileName);
  const url = source === 'irdb'
    ? 'https://cdn.jsdelivr.net/gh/probonopd/irdb@master/' + path
    : 'https://raw.githubusercontent.com/Lucaslhm/Flipper-IRDB/main/' + path;
  try {
	console.log("loadIrdbFile: fetching url: ", url);
	console.log("fileName: ", fileName);
    const resp = await fetch(url);
    const text = await resp.text();
	console.log("loadIrdbFile: response text: ", text);
    if (source === 'flipper' || fileName.endsWith('.ir')) {
      this.parseFlipperIR(text, fileName);
    } else {
      this.parseIRDBCsv(text, fileName);
    }
    document.querySelector('[data-tab="import"]').click();
    this.toast(`Loaded ${fileName}`, 'success');
  } catch (e) { this.toast('Failed to load: ' + e.message, 'error'); }
}

// Legacy compat
async searchIRDB() { loadirdbIndex(); }
async searchAllDBs() { loadirdbIndex(); }

// ═══════════════════════════════════════════════════
//  SAVED REMOTES
// ═══════════════════════════════════════════════════

rendersavedRemotes() {
  const list = this.view.querySelector('#extension-infrared-savedList');
  if (this.savedRemotes.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted); font-size:13px; text-align:center; padding:24px;">No saved remotes yet. Import files or record buttons to create one.</p>';
    return;
  }
  list.innerHTML = '';
  this.savedRemotes.forEach((remote, i) => {
    const item = document.createElement('div');
    item.className = 'extension-infrared-remote-item';
    const date = remote.created ? new Date(remote.created).toLocaleDateString() : '';
    item.innerHTML = `
      <div class="extension-infrared-remote-item-info" data-onclick="jumpToRemoteActions('${remote.name}')">
        <div class="extension-infrared-remote-item-name">${remote.name}</div>
        <div class="extension-infrared-remote-item-btns">${remote.buttons.length} buttons${date ? ' · ' + date : ''}</div>
      </div>
      <div style="display:flex; gap:6px;">
        <button class="extension-infrared-btn extension-infrared-btn-sm extension-infrared-btn-primary" data-onclick="openRemote(${i})">Open</button>
        <button class="extension-infrared-btn extension-infrared-btn-sm" data-onclick="exportSingleRemote(${i})" title="Export as JSON">📤</button>
        <button class="extension-infrared-btn extension-infrared-btn-sm extension-infrared-btn-danger" data-onclick="deleteRemote(${i})">🗑</button>
      </div>`;
    list.appendChild(item);
  });
}

openRemote(idx) {
  const remote = this.savedRemotes[idx];
  console.log("openRemote:  remote: ", typeof remote, remote);
  if(typeof remote == 'object' && typeof remote.name == 'string'){
	console.log("openRemote: ok");
	this.view.querySelector('#extension-infrared-modalTitle').textContent = remote.name;
	const container = this.view.querySelector('#extension-infrared-modalButtons');
	container.innerHTML = '';
	remote.buttons.forEach((btn) => {
		const el = document.createElement('button');
		el.className = 'extension-infrared-ir-btn';
		el.style.cssText = 'width:auto; padding:10px 18px; height:auto;';
		el.textContent = btn.name;
		el.onclick = () => {
			if (!this.isDeviceConnected) { this.toast('No infrared USB dongle detected', 'warning'); return; }
			this.transmitPulses(btn.pulses, btn.freq || 38000);
			this.toast(`Sent: ${btn.name}`, 'success');
		};
		container.appendChild(el);
	});
  	this.view.querySelector('#extension-infrared-remoteModal').classList.add('extension-infrared-active');
  }
  else{
	  console.error("did not find index in this.savedRemotes: ", typeof idx, idx, this.savedRemotes);
  }
  
}

closeModal() { this.view.querySelector('#extension-infrared-remoteModal').classList.remove('extension-infrared-active'); }
closeDelayModal() { this.view.querySelector('#extension-infrared-delay-modal').close(); }
closeRemoteNameModal() { this.view.querySelector('#extension-infrared-remote-name-modal').close(); }

deleteRemote(idx) {
  if (!confirm(`Delete "${this.savedRemotes[idx].name}"?`)) return;
  this.savedRemotes.splice(idx, 1);
  //localStorage.setItem('iremote_saved', JSON.stringify(this.savedRemotes));
  this.save('iremote_saved',this.savedRemotes);
  this.rendersavedRemotes();
  this.toast('Remote deleted', 'warning');
}

exportSingleRemote(idx) {
  const remote = this.savedRemotes[idx];
  const blob = new Blob([JSON.stringify(remote, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (remote.name || 'remote').replace(/\s+/g, '_') + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
  this.toast(`Exported "${remote.name}"`, 'success');
}

exportAllRemotes() {
  if (this.savedRemotes.length === 0) { this.toast('No remotes to export', 'warning'); return; }
  const blob = new Blob([JSON.stringify(this.savedRemotes, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'iremote_all_remotes.json';
  a.click();
  URL.revokeObjectURL(a.href);
  this.toast(`Exported ${this.savedRemotes.length} remotes`, 'success');
}

importRemoteFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  file.text().then(text => {
    try {
      const data = JSON.parse(text);
      const remotes = Array.isArray(data) ? data : [data];
      let imported = 0;
      for (const r of remotes) {
        if (r.buttons && r.buttons.length > 0) {
          this.savedRemotes.push({
            name: r.name || 'Imported',
            buttons: r.buttons,
            created: r.created || Date.now()
          });
          imported++;
        }
      }
      if (imported > 0) {
        //localStorage.setItem('iremote_saved', JSON.stringify(this.savedRemotes));
		this.save('iremote_saved',this.savedRemotes);
        this.rendersavedRemotes();
        this.toast(`Imported ${imported} remote(s)`, 'success');
      } else { this.toast('No valid remotes in file', 'warning'); }
    } catch (e) { this.toast('Invalid JSON: ' + e.message, 'error'); }
    event.target.value = '';
  });
}

addToCustomRemote(name, pulses) {
  const container = this.view.querySelector('#extension-infrared-customButtons');
  const el = document.createElement('button');
  el.className = 'extension-infrared-ir-btn';
  el.style.cssText = 'width:auto; padding:10px 18px; height:auto;';
  el.textContent = name;
  el.onclick = () => {
    if (!this.isDeviceConnected) { this.toast('No infrared USB dongle detected', 'warning'); return; }
    this.transmitPulses(pulses);
    this.toast(`Sent: ${name}`, 'success');
  };
  container.appendChild(el);
}

jumpToRemoteActions(remote_name){
  console.log("in jumpToRemoteActions.  remote_name: ", remote_name);
  const remote_item = this.view.querySelector('.extension-infrared-actions-remote-control[data-name="' + remote_name + '"]');
  if(remote_item){
    remote_item.scrollIntoView({ block:'start', behavior:'smooth' });
  }
}

loadBatchPreset(type) {
  this.batchButtons = [...this.BATCH_PRESETS[type]];
  this.renderBatchList();
}

addBatchButton() {
  const inp = this.view.querySelector('#extension-infrared-batchAddName');
  const name = inp.value.trim();
  if (!name) return;
  this.batchButtons.push(name);
  inp.value = '';
  this.renderBatchList();
}

removeBatchButton(idx) {
  this.batchButtons.splice(idx, 1);
  this.renderBatchList();
}

clearbatchButtons() {
  this.batchButtons = [];
  this.batchResults = [];
  this.renderBatchList();
}

renderBatchList() {
  const container = this.view.querySelector('#extension-infrared-batchList');
  const actions = this.view.querySelector('#extension-infrared-batchActions');
  if (this.batchButtons.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted); font-size:12px;">Add button names above, or load a preset.</p>';
    actions.style.display = 'none';
    return;
  }
  actions.style.display = 'flex';
  container.innerHTML = this.batchButtons.map((name, i) => {
    const done = this.batchResults[i] ? ' style="color:var(--success);"' : '';
    const icon = this.batchResults[i] ? '✅' : '⬜';
    return `<div style="display:flex; align-items:center; gap:8px; padding:4px 8px; background:var(--bg-input); border-radius:6px;">
      <span${done}>${icon} ${name}</span>
      <span style="flex:1;"></span>
      ${!this.batchLearning ? `<button class="extension-infrared-btn extension-infrared-btn-sm extension-infrared-btn-danger" data-onclick="removeBatchButton(${i})" style="padding:2px 8px; font-size:11px;">✕</button>` : ''}
    </div>`;
  }).join('');
}

async startBatchLearn() {
  if (!this.isDeviceConnected) { this.toast('No infrared USB dongle detected', 'warning'); return; }
  if (this.batchButtons.length === 0) { this.toast('Add buttons first', 'warning'); return; }

  this.batchLearning = true;
  this.batchIndex = 0;
  this.batchResults = [];
  this.view.querySelector('#extension-infrared-batchStartBtn').disabled = true;
  this.view.querySelector('#extension-infrared-batchProgress').style.display = '';
  this.renderBatchList();

  for (let i = 0; i < this.batchButtons.length; i++) {
    this.batchIndex = i;
    const name = this.batchButtons[i];
    this.view.querySelector('#extension-infrared-batchProgressBar').style.width = (i / this.batchButtons.length * 100) + '%';
    this.view.querySelector('#extension-infrared-batchProgressText').textContent = `${i + 1}/${this.batchButtons.length}`;
    this.view.querySelector('#extension-infrared-batchCurrentLabel').textContent = `Press "${name}" on your remote...`;

    // Start learn mode and wait for signal
    const pulses = await this.batchLearnOne();
    if (!pulses) {
      this.toast(`Timeout on "${name}" — skipping`, 'warning');
      this.batchResults.push(null);
    } else {
      this.batchResults.push({ name, pulses, freq: 38000 });
      //feedbackVibrate(50);
      //feedbackClick();
      this.toast(`✓ Captured "${name}"`, 'success');
    }
    this.renderBatchList();
    await sleep(500); // Brief pause between captures
  }

  // Done — save results
  this.view.querySelector('#extension-infrared-batchProgressBar').style.width = '100%';
  this.view.querySelector('#extension-infrared-batchCurrentLabel').textContent = 'Batch complete!';
  this.batchLearning = false;
  this.view.querySelector('#extension-infrared-batchStartBtn').disabled = false;

  const validButtons = this.batchResults.filter(Boolean);
  if (validButtons.length > 0) {
    const remoteName = this.view.querySelector('#extension-infrared-batchRemoteName').value.trim() || 'Batch Remote';
    this.savedRemotes.push({ name: remoteName, buttons: validButtons, created: Date.now() });
    //localStorage.setItem('iremote_saved', JSON.stringify(this.savedRemotes));
	this.save('iremote_saved',this.savedRemotes);
    this.rendersavedRemotes();
    this.toast(`Saved "${remoteName}" with ${validButtons.length} buttons`, 'success');
  }

  await sleep(2000);
  this.view.querySelector('#extension-infrared-batchProgress').style.display = 'none';
}

batchLearnOne() {
  return new Promise(resolve => {
    this.socket.emit('learn', { timeout: 15 });
    const handler = (data) => {
      this.socket.off('learned', handler);
      this.socket.off('learn_timeout', timeoutHandler);
      if (data && data.pulses && data.pulses.length > 4) {
        resolve(data.pulses);
      } else { resolve(null); }
    };
    const timeoutHandler = () => {
      this.socket.off('learned', handler);
      this.socket.off('learn_timeout', timeoutHandler);
      resolve(null);
    };
    this.socket.on('learned', handler);
    this.socket.on('learn_timeout', timeoutHandler);
  });
}

// ═══════════════════════════════════════════════════
//  CUSTOM MACRO BUILDER
// ═══════════════════════════════════════════════════


addMacroStep(type) {
  if (type === 'delay') {
    const delay_modal_el = this.view.querySelector('#extension-infrared-delay-modal');
    delay_modal_el.showModal();

    //const ms = parseInt(prompt('Delay in milliseconds:', '250'));
    //if (isNaN(ms) || ms <= 0) return;
    //this.customMacroSteps.push({ type: 'delay', ms });
  } else {
    const proto = this.view.querySelector('#extension-infrared-cmProto').value;
    const cmdKey = this.view.querySelector('#extension-infrared-cmCommand').value;
    const cmdCode = this.CM_COMMANDS[proto]?.[cmdKey];
    if (cmdCode === undefined) { this.toast('Invalid command for this protocol', 'warning'); return; }
    const label = this.view.querySelector('#extension-infrared-cmCommand').selectedOptions[0].text;
    this.customMacroSteps.push({ type: 'ir', proto, cmdKey, cmdCode, label, addr: this.CM_ADDRS[proto], freq: this.CM_FREQS[proto] });
  }
  this.renderMacroSteps();
}

removeMacroStep(idx) {
  this.customMacroSteps.splice(idx, 1);
  this.renderMacroSteps();
}

clearMacroSteps() {
  this.customMacroSteps = [];
  this.renderMacroSteps();
}

renderMacroSteps() {
  const container = this.view.querySelector('#extension-infrared-customMacroSteps');
  if (this.customMacroSteps.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted); font-size:12px;">No steps added yet. Use the controls above to add IR commands and delays.</p>';
    return;
  }
  container.innerHTML = this.customMacroSteps.map((s, i) => {
    if (s.type === 'delay') {
      return `<div style="display:flex; align-items:center; gap:8px; padding:6px 10px; background:var(--warning-dim); border-radius:6px; font-size:12px;">
        <span>⏱ Delay ${s.ms}ms</span><span style="flex:1;"></span>
        <button class="extension-infrared-btn extension-infrared-btn-sm extension-infrared-btn-danger" data-onclick="removeMacroStep(${i})" style="padding:2px 8px; font-size:10px;">✕</button>
      </div>`;
    }
    return `<div style="display:flex; align-items:center; gap:8px; padding:6px 10px; background:var(--accent-dim); border-radius:6px; font-size:12px;">
      <span>📡 ${s.label} <span style="color:var(--text-dim);">(${s.proto})</span></span><span style="flex:1;"></span>
      <button class="extension-infrared-btn extension-infrared-btn-sm extension-infrared-btn-danger" data-onclick="removeMacroStep(${i})" style="padding:2px 8px; font-size:10px;">✕</button>
    </div>`;
  }).join('');
}

encodeStep(s) {
  switch (s.proto) {
    case 'samsung32': return this.samsung32Encode(s.addr, s.cmdCode);
    case 'nec': return this.necEncode(s.addr, s.cmdCode);
    case 'rc5': return this.rc5Encode(s.addr, s.cmdCode);
    case 'sony12': return this.sonyEncode(s.addr, s.cmdCode, 12);
    default: return this.necEncode(s.addr, s.cmdCode);
  }
}


save(id,data){ // ,local_only=false
	console.log("infrared debug: in save.  id, data: ", id, data);
	//localStorage.setItem(id, JSON.stringify(data));

  for(let d = 0; d < data.length; d++){
    if(typeof data[d]['steps'] != 'undefined'){
      console.log("save:  item index, steps: ", d, data[d]['steps']);
      for(let s = 0; s < data[d]['steps'].length; s++){
        if(typeof data[d]['steps'][s]['type'] == 'string' && typeof data[d]['steps'][s]['encoded_step'] == 'undefined'){
          console.log("should encode step: ", s, data[d]['steps'][s]);
          if((data[d]['steps'][s]['type'] == 'ir' || data[d]['steps'][s]['type'] == 'hold') && typeof data[d]['steps'][s]['proto'] == 'string'){
            data[d]['steps'][s]['encoded_step'] = this.encodeStep(data[d]['steps'][s]);
            console.log("save:  id, s, encoded_step: ", id, s, data[d]['steps'][s]['encoded_step']);
          }
          else{
            console.log("save:  id, s, other type (probably delay): ", data[d]['steps'][s]['type'], s, "-->" + data[d]['steps'][s]['type'] + "<--");
          }
        }
      }
    }
    /*
    else if(typeof data[d]['pulses'] != 'undefined' && typeof data[d]['encoded_pulses'] == 'undefined'){
      data[d]['encoded_pulses'] = data[d]['pulses']
    }
    */
  }
	//if(local_only == false){
		window.API.postJson(
			`/extensions/${this.id}/api/ajax`, {
				'action': 'save',
				'id':id, 
				'data':data
			}

		).then((body) => {
			if(this.debug){
				console.log("infrared debug: save response: ", body);
			}
      if(typeof body.state == 'boolean'){
        if(body.state == true){
          this.toast('Saved', 'success');
        }
        else{
          this.toast('Failed to save', 'error');
        }

      }
			this.parse_body(body);
      this.render_previously_recorded_signals_list();

		}).catch((err) => {
			console.error("Infrared: caught error in save function: ", err);
		});
	//}
}

saveCustomMacro() {
  const name = this.view.querySelector('#extension-infrared-customMacroName').value.trim();
  if (!name) { this.toast('Enter a macro name', 'warning'); return; }
  if (this.customMacroSteps.length === 0) { this.toast('Add at least one step', 'warning'); return; }
  const brand = this.view.querySelector('#extension-infrared-customMacroBrand').value;
  const macro = {
    id: 'custom_' + Date.now(),
    name, brand,
    description: this.customMacroSteps.filter(s => s.type !== 'delay').map(s => s.label).join(' → '),
    tvState: 'ON', warningLevel: 0,
    steps: this.customMacroSteps.map(s => {
      if (s.type === 'delay') return { type: 'delay', ms: s.ms };
      return { type: 'ir', proto: s.proto, addr: s.addr, cmdCode: s.cmdCode, label: s.label, freq: s.freq };
    }),
    custom: true
  };
  this.customMacros.push(macro);
  //localStorage.setItem('iremote_custom_macros', JSON.stringify(this.customMacros));
  this.save('iremote_custom_macros', this.customMacros);
  // Also add to this.HOTEL_MACROS for immediate use
  this.HOTEL_MACROS.push({
    ...macro,
    steps: macro.steps.map(s => {
      if (s.type === 'delay') return s;
      return { type: 'ir', encode: () => encodeStep(s), label: s.label, freq: s.freq };
    })
  });
  this.renderHotelMacros();
  this.renderCustomMacros();
  this.customMacroSteps = [];
  this.renderMacroSteps();
  this.view.querySelector('#extension-infrared-customMacroName').value = '';
  this.toast(`Saved macro "${name}"`, 'success');
}

deleteCustomMacro(id) {
  if (!confirm('Delete this custom macro?')) return;
  this.customMacros = this.customMacros.filter(m => m.id !== id);
  //localStorage.setItem('iremote_custom_macros', JSON.stringify(this.customMacros));
  this.save('iremote_custom_macros',this.customMacros);
  // Remove from this.HOTEL_MACROS
  const idx = this.HOTEL_MACROS.findIndex(m => m.id === id);
  if (idx >= 0) this.HOTEL_MACROS.splice(idx, 1);
  this.renderHotelMacros();
  this.renderCustomMacros();
  this.toast('Custom macro deleted', 'warning');
}

renderCustomMacros() {
  const container = this.view.querySelector('#extension-infrared-customMacrosList');
  if (this.customMacros.length === 0) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = '<div style="font-size:13px; font-weight:600; margin-bottom:8px; color:var(--text-dim);">Your Custom Macros</div>' +
    this.customMacros.map(m => `<div style="display:flex; align-items:center; gap:8px; padding:8px 12px; background:var(--bg-input); border-radius:8px; margin-bottom:4px;">
      <span style="font-size:13px; font-weight:500; flex:1;">${m.name} <span style="color:var(--accent); font-size:11px;">${m.brand}</span></span>
      <span style="font-size:11px; color:var(--text-dim);">${m.description}</span>
      <button class="extension-infrared-btn extension-infrared-btn-sm extension-infrared-btn-danger" data-onclick="deleteCustomMacro('${m.id}')" style="padding:2px 8px;">🗑</button>
    </div>`).join('');
}

// Load custom macros into this.HOTEL_MACROS on init
loadCustomMacrosIntoHotel() {
  /*
  if(this.show_extra_macros){
     this.HOTEL_MACROS = JSON.parse(JSON.stringify(this.HOTEL_TV_MACROS));
  }
  else{
    this.HOTEL_MACROS = []
  }
  console.warn("loadCustomMacrosIntoHotel: this.HOTEL_MACROS: ", this.HOTEL_MACROS);
  */
  this.HOTEL_MACROS = []
  for (const macro of this.customMacros) {
    this.HOTEL_MACROS.push({
      ...macro,
      steps: macro.steps.map(s => {
        if (s.type === 'delay') return s;
        return { type: 'ir', encode: () => encodeStep(s), label: s.label, freq: s.freq };
      })
    });
  }
  this.renderCustomMacros();
}

// ═══════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════

sleep(ms) { return new Promise(r => setTimeout(r, ms)); }



    }

    new Infrared();

})();