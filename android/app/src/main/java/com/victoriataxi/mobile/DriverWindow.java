package com.victoriataxi.mobile;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name="DriverWindow")
public class DriverWindow extends Plugin {
    @PluginMethod public void configure(PluginCall call) {
        MainActivity activity=(MainActivity)getActivity();
        activity.runOnUiThread(()->{
            activity.configureDriverWindow(call.getBoolean("enabled",false));
            call.resolve();
        });
    }
}
