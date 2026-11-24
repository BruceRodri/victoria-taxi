package com.victoriataxi.mobile;

import android.content.Context;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name="RideAudio")
public class RideAudio extends Plugin {
    private Ringtone ringtone;
    private int priorMode = -1;
    private AudioManager manager() { return (AudioManager)getContext().getSystemService(Context.AUDIO_SERVICE); }
    @PluginMethod public void ring(PluginCall call) {
        stopRing();
        if(call.getBoolean("on", false)){
            ringtone=RingtoneManager.getRingtone(getContext(),RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE));
            if(ringtone!=null){if(Build.VERSION.SDK_INT>=28)ringtone.setLooping(true);ringtone.play();}
        }
        call.resolve();
    }
    private void stopRing(){if(ringtone!=null){ringtone.stop();ringtone=null;}}
    @PluginMethod public void route(PluginCall call){
        AudioManager audio=manager();
        String route=call.getString("route","earpiece");
        try {
            if(priorMode==-1)priorMode=audio.getMode();
            audio.setMode(AudioManager.MODE_IN_COMMUNICATION);
            if(Build.VERSION.SDK_INT>=31){
                for(AudioDeviceInfo device:audio.getAvailableCommunicationDevices()){
                    int type=device.getType();
                    boolean match=route.equals("speaker")?type==AudioDeviceInfo.TYPE_BUILTIN_SPEAKER:
                        route.equals("bluetooth")?(type==AudioDeviceInfo.TYPE_BLUETOOTH_SCO||type==AudioDeviceInfo.TYPE_BLE_HEADSET):
                        type==AudioDeviceInfo.TYPE_BUILTIN_EARPIECE;
                    if(match && audio.setCommunicationDevice(device)){call.resolve();return;}
                }
                call.reject("Audio device unavailable");return;
            }
            if(route.equals("bluetooth")){
                if(!audio.isBluetoothScoAvailableOffCall() || !audio.isBluetoothScoOn() && !hasBluetooth(audio)){call.reject("Bluetooth unavailable");return;}
                audio.setSpeakerphoneOn(false);audio.startBluetoothSco();audio.setBluetoothScoOn(true);
            } else {audio.stopBluetoothSco();audio.setBluetoothScoOn(false);audio.setSpeakerphoneOn(route.equals("speaker"));}
            call.resolve();
        }catch(RuntimeException e){call.reject("Audio device unavailable",e);}
    }
    private boolean hasBluetooth(AudioManager audio){
        for(AudioDeviceInfo d:audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS))if(d.getType()==AudioDeviceInfo.TYPE_BLUETOOTH_SCO)return true;
        return false;
    }
    private void reset(){
        stopRing();
        if(priorMode<0)return;
        AudioManager audio=manager();
        if(Build.VERSION.SDK_INT>=31)audio.clearCommunicationDevice();
        else {audio.stopBluetoothSco();audio.setBluetoothScoOn(false);audio.setSpeakerphoneOn(false);}
        audio.setMode(priorMode);priorMode=-1;
    }
    @PluginMethod public void end(PluginCall call){reset();if(Build.VERSION.SDK_INT>=27)getActivity().runOnUiThread(()->{getActivity().setShowWhenLocked(false);getActivity().setTurnScreenOn(false);});call.resolve();}
    @Override protected void handleOnDestroy(){reset();}
}
