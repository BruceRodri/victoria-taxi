package com.victoriataxi.mobile;

import android.content.Intent;
import androidx.core.content.ContextCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name="TripAlerts")
public class TripAlerts extends Plugin {
    @PluginMethod public void start(PluginCall call) {
        Intent intent=new Intent(getContext(), TripAlertService.class);
        for(String key:new String[]{"host","token","ride","status","lang","role","systemAlerts","messageCount"})intent.putExtra(key,call.getString(key));
        try { ContextCompat.startForegroundService(getContext(),intent);call.resolve(); }
        catch(RuntimeException ex){call.reject("No se pudieron iniciar los avisos del viaje.",ex);}
    }
    @PluginMethod public void openedRide(PluginCall call){
        getActivity().runOnUiThread(()->{
            Intent intent=getActivity().getIntent();
            com.getcapacitor.JSObject result=new com.getcapacitor.JSObject();
            if(intent!=null && intent.hasExtra("vtRide")){
                String target=intent.getStringExtra("vtRide");
                boolean reply=target!=null && (target.startsWith("outside/") || target.startsWith("coming/"));
                if(!reply || ArrivalMessaging.actionKey(getContext()).equals(intent.getStringExtra("vtArrivalKey")))
                    result.put("rideId",target);
                intent.removeExtra("vtArrivalKey");
                intent.removeExtra("vtRide");
            }
            call.resolve(result);
        });
    }
    @PluginMethod public void consumeAction(PluginCall call){
        getActivity().runOnUiThread(()->{
            Intent intent=getActivity().getIntent();
            com.getcapacitor.JSObject result=new com.getcapacitor.JSObject();
            if(intent!=null && call.getString("callId","").equals(intent.getStringExtra("vtCall"))){
                result.put("action",intent.getStringExtra("vtAction"));
                intent.removeExtra("vtCall");
                intent.removeExtra("vtAction");
            }
            call.resolve(result);
        });
    }
    @PluginMethod public void stop(PluginCall call){
        getContext().stopService(new Intent(getContext(),TripAlertService.class));call.resolve();
    }
}
