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
            self.devices['infrared'].connected = True
            self.devices['infrared'].connected_notify(True)
            self.thing = self.get_device("infrared")
            if self.DEBUG:
                print("infrared device added")
                print("self.infrared_device: ", self.infrared_device)
                print("self.thing: ", self.thing)
        except Exception as ex:
            if self.DEBUG:
                print("infrared adapter: caught error during infrared device init: " + str(ex))

        self.ready = True

    def remove_thing(self, device_id):
        if self.DEBUG:
            print("Removing infrared thing: " + str(device_id))
    
        try:
            obj = self.get_device(device_id)
            self.handle_device_removed(obj)                     # Remove from device dictionary

        except Exception as ex:
            if self.DEBUG:
                print("caught error: could not remove thing from Infrared adapter devices: " + str(ex))


    def quick_enable(self):
        print("in quick_enable")
        state_property = self.thing.get_property('state')
        print("state_property: ", state_property)
        if state_property:
            state_property.set_value(True)


#
# DEVICE
#

class InfraredDevice(Device):
    """Infrared device type."""

    def __init__(self, adapter):
        """
        Initialize the object.
        adapter -- the Adapter managing this device
        """

        Device.__init__(self, adapter, 'infrared')
        
        self._id = 'infrared'
        self.id = 'infrared'
        self.name = 'infrared'
        self.adapter = adapter
        self.DEBUG = self.adapter.DEBUG
        
        #self._type = ["OnOffSwitch"]
        
        self.title = 'Infrared'
        self.description = 'Thing to control Infrared'
        #self.night_mode = False
        
        self.properties = {}
        self.events = {}
        self.actions = {}
        self._type = ["OnOffSwitch"]
        
        
        try:
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
            print("in generate_actions");

        try:
            if 'remotes' in self.adapter.api_handler.persistent_data:
                
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


                #self.add_event('Previous photo',{})
                #self.add_event('Next photo',{})
                
                #self.add_action("Previous photo", {})
                #self.add_action("Next photo", {})
                
            self.adapter.handle_device_added(self)
            if self.DEBUG:
                print("infrared device: generate_actions complete")


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
                print("in perform_action")
                #print("- self.events: ", self.events)
            found_action_to_perform = False
            action_to_perform = action.as_dict()
            if self.DEBUG:
                print("perform_action: action as_dict: ", action_to_perform)
            if 'name' in action_to_perform:
                if self.DEBUG:
                    print("action to perform name: ", action_to_perform['name'])
                
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


