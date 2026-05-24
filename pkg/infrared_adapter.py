try:
    from gateway_addon import Adapter, Device, Property, Action, Event
    #print("succesfully loaded APIHandler and APIResponse from gateway_addon")
except:
    print("ERROR, could not load vital libraries to interact with the controller")



#
# ADAPTER
#

class InfraredAdapter(Adapter):
    """Adapter for Infrared"""

    def __init__(self, api_handler, verbose=False):
        """
        Initialize the object.

        verbose -- whether or not to enable verbose logging
        """
        self.api_handler = api_handler
        self.DEBUG = bool(api_handler.DEBUG)
        self.addon_name = str(self.api_handler.addon_name) #'infrared'
        self.name = self.__class__.__name__
        if self.DEBUG:
            print("adapter: self.name: ", self.name)
        self.ready = False
        Adapter.__init__(self, self.addon_name, self.addon_name, verbose=verbose)
        #print("Adapter ID = " + self.get_id())
        
        try:
            # Create the thing
            self.infrared_device = InfraredDevice(self)
            if 'infrared' in self.devices:
                self.devices['infrared'].connected = True
                self.devices['infrared'].connected_notify(True)
            else:
                if self.DEBUG:
                    print("\nERROR, infrared thing not found in adapter's devices dict")

            self.thing = self.get_device("infrared")
            if self.DEBUG:
                print("infrared device added")
                print("self.infrared_device: ", self.infrared_device)
                print("self.thing: ", self.thing)
        except Exception as ex:
            if self.DEBUG:
                print("infrared adapter: caught error during infrared device init: " + str(ex))

        self.generated_remote_things()

    def generated_remote_things(self):
        if self.DEBUG:
            print("adapter: in generated_remote_things")
        try:
            # Create the remote things
            if 'remotes' in self.api_handler.persistent_data and 'thing_actions' in self.api_handler.persistent_data['remotes']:
                for remote_sanitized_name in list(self.api_handler.persistent_data['remotes']['thing_actions'].keys()):
                    if self.DEBUG:
                        print("remote_sanitized_name: ", remote_sanitized_name)
                    raw_remote_thing = self.api_handler.persistent_data['remotes']['thing_actions'][remote_sanitized_name]

                    thing_id = 'infrared_' + remote_sanitized_name
                    remote_device = InfraredDevice(self,raw_remote_thing)
                    if thing_id in self.devices:
                        if self.DEBUG:
                            print("OK, the thing was added to self.devices")
                        self.devices[thing_id].connected = True
                        self.devices[thing_id].connected_notify(True)
                    else:
                        if self.DEBUG:
                            print("\nERROR: could not find device that was just created.  thing_id, self.devices: ", thing_id, self.devices.keys())

        except Exception as ex:
            if self.DEBUG:
                print("infrared adapter: caught error during infrared remote control device init: " + str(ex))


        self.ready = True

    def remove_thing(self, device_id):
        if self.DEBUG:
            print("Removing infrared thing: " + str(device_id))
    
        try:
            obj = self.get_device(device_id)
            if obj:
                self.handle_device_removed(obj)                     # Remove from device dictionary
            
            
            if device_id.startswith('infrared_'):
                sanitized_remote_name = device_id.removeprefix()

                if 'remotes' in self.adapter.api_handler.persistent_data and \
                  'thing_actions' in self.adapter.api_handler.persistent_data['remotes'] and \
                  sanitized_remote_name in self.adapter.api_handler.persistent_data['remotes']['thing_actions']:
                    if self.DEBUG:
                        print("remove_thing: OK, also removing thing_actions for sanitized_remote_name: ", sanitized_remote_name)
                    del self.adapter.api_handler.persistent_data['remotes']['thing_actions'][sanitized_remote_name]
                    self.save_persistent_data()

        except Exception as ex:
            if self.DEBUG:
                print("caught error: caught error removing thing from Infrared adapter devices: " + str(ex))


    def quick_enable(self):
        if self.DEBUG:
            print("in quick_enable")
        state_property = self.thing.get_property('state')
        if self.DEBUG:
            print("state_property: ", state_property)
        if state_property:
            state_property.set_value(True)


    def generate_remote_thing_actions(self):
        if self.DEBUG:
            print("in generate_remote_thing_actions")






#
# DEVICE
#

class InfraredDevice(Device):
    """Infrared device type."""

    def __init__(self, adapter, remote=None):
        """
        Initialize the object.
        adapter -- the Adapter managing this device
        """

        my_id = 'infrared'
        my_title = 'Infrared'
        if remote:
            
            print("InfraredDevice:  remote: ", remote)

            if 'sanitized_name' in remote:
                my_id = 'infrared_' +str(remote['sanitized_name'])
                my_title = str(remote['sanitized_name'])
            else:
                print("ERROR, no sanitized name in remote")
                return

            if 'name' in remote:
                my_title = str(remote['name'])

        Device.__init__(self, adapter, my_id)
        
        self._id = my_id
        self.id = my_id
        self.name = my_id
        self.sanitized_name = None
        self.adapter = adapter
        self.DEBUG = self.adapter.DEBUG



        if remote:
            if self.DEBUG:
                print("InfraredDevice:  self.id, remote: ", self.id, remote)
            if 'sanitized_name' in remote:
                self.sanitized_name = str(remote['sanitized_name'])
        
        if self.DEBUG:
            print("infrared thing: id, self.sanitized_name: ", self.id, self.sanitized_name)

        
        #self._type = ["OnOffSwitch"]
        
        self.title = my_title
        self.description = 'Thing to control Infrared'
        #self.night_mode = False
        
        self.properties = {}
        self.events = {}
        self.actions = {}
        if self.id == 'infrared':
            try:
                self._type = ["OnOffSwitch"]
                self.properties['state'] = InfraredProperty(
                                    self,
                                    'state',
                                    {
                                        'title': 'State',
                                        'type': 'boolean',
                                        'readOnly': False,
                                        '@type': 'OnOffProperty',
                                    },
                                    self.adapter.api_handler.persistent_data['state'])
            except Exception as ex:
                if self.DEBUG:
                    print("caught error adding infrared device state property: " + str(ex))

        self.generate_actions()


    def generate_actions(self):
        if self.DEBUG:
            print("in generate_actions.  self.id: ", self.id);
        
        self.events = {}
        self.actions = {}

        try:
            if 'remotes' in self.adapter.api_handler.persistent_data:
                
                if self.id == 'infrared':
                    if self.DEBUG:
                        print("generating actions for main infrared thing")
                    if 'iremote_custom_macros' in self.adapter.api_handler.persistent_data['remotes']:
                        #if self.DEBUG:
                        #    print("Device: spotted saved macros: ", self.adapter.api_handler.persistent_data['remotes']['iremote_custom_macros'])
                        for macro in self.adapter.api_handler.persistent_data['remotes']['iremote_custom_macros']:
                            if self.DEBUG:
                                print("\nmacro: ", macro)
                            #macro = self.adapter.api_handler.persistent_data['remotes']['iremote_custom_macros'][macro_index]
                            if 'id' in macro and 'name' in macro:
                                macro_name = macro['name']
                                #if not 'macro' in macro_name.lower():
                                #    macro_name = macro_name + ' macro'
                                if self.DEBUG:
                                    print("adding macro event and action with macro_name: ", macro_name)

                                self.add_event(macro_name, {})
                                self.add_action(macro_name, macro)

                    if 'iremote_captured_pulses' in self.adapter.api_handler.persistent_data['remotes']:
                        #if self.DEBUG:
                        #    print("Device: spotted saved captured pulses: ", self.adapter.api_handler.persistent_data['remotes']['iremote_captured_pulses'])
                        for captured_name in list(self.adapter.api_handler.persistent_data['remotes']['iremote_captured_pulses'].keys()):
                            if self.DEBUG:
                                print("\ncaptured_name: ", captured_name)
                            captured = self.adapter.api_handler.persistent_data['remotes']['iremote_captured_pulses'][captured_name]
                            if self.DEBUG:
                                print("\ncaptured dict: ", captured)
                            if 'name' in captured and 'pulses' in captured:
                                if self.DEBUG:
                                    print("adding captured event and action with name: ", captured['name'])
                                self.add_event(captured['name'], {})
                                self.add_action(captured['name'], captured)

                else:
                    if self.DEBUG:
                        print("generating actions for infrared remote control thing")
                    if self.sanitized_name and 'thing_actions' in self.adapter.api_handler.persistent_data['remotes'] and self.sanitized_name in self.adapter.api_handler.persistent_data['remotes']['thing_actions']:
                        my_remote = self.adapter.api_handler.persistent_data['remotes']['thing_actions'][self.sanitized_name]
                        if self.DEBUG:
                            print("remote thing:  my_remote: ", my_remote)

                        if 'buttons' in my_remote:
                            for sanitized_button_name in list(my_remote['buttons'].keys()):
                                if self.DEBUG:
                                    print("\nremote thing: sanitized_button_name: ", sanitized_button_name)
                                button = my_remote['buttons'][sanitized_button_name]
                                if self.DEBUG:
                                    print("\nbutton: ", button)
                                if 'name' in button and 'enabled' in button and 'pulses' in button:
                                    if button['enabled'] == True:
                                        if self.DEBUG:
                                            print("adding enabled action button to remote thing, with button name: ", button['name'])
                                        self.add_event(button['name'], {})
                                        self.add_action(button['name'], button)
                                    else:
                                        if self.DEBUG:
                                            print("skipping disabled action button: ", button['name'])

                
            self.adapter.handle_device_added(self)
            if self.DEBUG:
                print("infrared device: generate_actions complete.   self.id: ", self.id)


        except Exception as ex:
            if self.DEBUG:
                print("caught error adding infrared device actions: " + str(ex))

        if self.DEBUG:
            print("\ndebug: Infrared thing: generate actions DONE\n")


    def enable_state(self):
        if self.properties['state']:
            self.properties['state'].set_value(True,None)



		
    def perform_action(self,action):
        try:
            if self.DEBUG:
                print("\nin perform_action")
                print("- thing id: ", self.id)
                #print("- self.events: ", self.events)
            found_action_to_perform = False
            action_to_perform = action.as_dict()
            if self.DEBUG:
                print("perform_action: action as_dict: ", action_to_perform)
            if 'name' in action_to_perform:
                if self.DEBUG:
                    print("action to perform name: ", action_to_perform['name'])
                
                if self.id == 'infrared':
                    if 'iremote_captured_pulses' in self.adapter.api_handler.persistent_data['remotes']:
                        for captured_name in list(self.adapter.api_handler.persistent_data['remotes']['iremote_captured_pulses'].keys()):
                            if self.DEBUG:
                                print("perform_action: captured_name: ", captured_name)
                            captured = self.adapter.api_handler.persistent_data['remotes']['iremote_captured_pulses'][captured_name]
                            if self.DEBUG:
                                print("perform_action: captured: ", captured)
                            if 'name' in captured and str(captured_name) == str(action_to_perform['name']):
                                if self.DEBUG:
                                    print("infrared: found captured pulses for action to performs")
                                self.adapter.api_handler.transmit_captured_pulses(captured)
                                action_event = Event(self,str(captured['name']))
                                self.event_notify(action_event)
                                found_action_to_perform = True

                    if 'iremote_custom_macros' in self.adapter.api_handler.persistent_data['remotes']:
                        for macro in self.adapter.api_handler.persistent_data['remotes']['iremote_custom_macros']:
                            #if self.DEBUG:
                            #    print("perform_action: macro: ", macro)
                            #macro = self.adapter.api_handler.persistent_data['remotes']['iremote_custom_macros'][macro_index]
                            if 'id' in macro and 'name' in macro and str(macro['name']) == str(action_to_perform['name']):
                                if self.DEBUG:
                                    print("infrared: found macro for action to perform: ")
                                self.adapter.api_handler.transmit_macro(macro)
                                action_event = Event(self,str(macro['name']))
                                self.event_notify(action_event)
                                found_action_to_perform = True
                else:
                    if self.DEBUG:
                        print("performing action on remote control thing: ", self.id)
                    if 'thing_actions' in self.adapter.api_handler.persistent_data['remotes'] and self.id in self.adapter.api_handler.persistent_data['remotes']['thing_actions']:
                        my_remote = self.adapter.api_handler.persistent_data['remotes']['thing_actions'][self.id]
                        if self.DEBUG:
                            print("perform_action:  ID, my_remote: ", self.id, my_remote)
                        if 'buttons' in my_remote:
                            for button in my_remote['buttons']:
                                #if self.DEBUG:
                                #    print("perform_action: macro: ", macro)
                                #macro = self.adapter.api_handler.persistent_data['remotes']['iremote_custom_macros'][macro_index]
                                if 'name' in button and str(button['name']) == str(action_to_perform['name']):
                                    if self.DEBUG:
                                        print("infrared: perform_action: OK, found remote control button on thing: ", self.id, button['name'])
                                    if 'pulses' in button:
                                        self.adapter.api_handler.transmit(button['pulses'])
                                        action_event = Event(self,str(button['name']))
                                        self.event_notify(action_event)
                                        found_action_to_perform = True

                    
            if found_action_to_perform:
                if self.DEBUG:
                    print("\nperform_action: action was performed\n")
            else:
                if self.DEBUG:
                    print("\nERROR, perform_action: fell through\n")

        except Exception as ex:
            print("caught error in perform_action: ", ex)
        
        
        

#
# PROPERTY
#

class InfraredProperty(Property):

    def __init__(self, device, name, description, value):
        Property.__init__(self, device, name, description)
        self.device = device
        self.DEBUG = self.device.DEBUG
        
        self.id = name
        self.name = name
        self.title = name
        self.description = description # dictionary
        self.value = value
        self.set_cached_value(value)
        self.device.notify_property_changed(self)
        
        self.device.adapter.state_property = self

    def set_value(self, value, meta=None):
        if self.DEBUG and meta != None:
            print("property: set_value: received meta data.  self.title, meta: ", self.title, meta)
        #print("property: set_value called for " + str(self.title))
        #print("property: set value to: " + str(value))
        try:
            if self.id == 'state':
                self.device.adapter.api_handler.persistent_data['state'] = bool(value)
                self.device.adapter.api_handler.save_persistent_data()
                self.update(bool(value))

        except Exception as ex:
             if self.DEBUG:
                 print("property: caught set_value error: " + str(ex))



    def update(self, value, meta=None):
        if self.DEBUG and meta != None:
            print("property: update: received meta data.  self.title, meta: ", self.title, meta)
        #print("property -> update")
        if value != self.value:
            self.value = value
            self.set_cached_value(value)
            self.device.notify_property_changed(self)


