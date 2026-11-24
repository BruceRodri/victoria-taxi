package com.victoriataxi.mobile;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private boolean driverWindowEnabled;
    void configureDriverWindow(boolean enabled){
        if(android.os.Build.VERSION.SDK_INT<26 || !getPackageManager().hasSystemFeature(android.content.pm.PackageManager.FEATURE_PICTURE_IN_PICTURE))return;
        driverWindowEnabled=enabled;
        android.app.PictureInPictureParams.Builder params=new android.app.PictureInPictureParams.Builder()
            .setAspectRatio(new android.util.Rational(4,3));
        if(android.os.Build.VERSION.SDK_INT>=31)params.setAutoEnterEnabled(enabled).setSeamlessResizeEnabled(false);
        setPictureInPictureParams(params.build());
        if(!enabled && isInPictureInPictureMode())moveTaskToBack(true);
    }
    @Override protected void onUserLeaveHint(){
        super.onUserLeaveHint();
        if(driverWindowEnabled && android.os.Build.VERSION.SDK_INT>=26 && android.os.Build.VERSION.SDK_INT<31)
            enterPictureInPictureMode(new android.app.PictureInPictureParams.Builder().setAspectRatio(new android.util.Rational(4,3)).build());
    }
    @Override public void onPictureInPictureModeChanged(boolean compact,android.content.res.Configuration configuration){
        super.onPictureInPictureModeChanged(compact,configuration);
        if(bridge!=null)bridge.triggerWindowJSEvent("vt-driver-window","{\"compact\":"+compact+"}");
    }
    @Override protected void onNewIntent(android.content.Intent intent){
        super.onNewIntent(intent);
        setIntent(intent);
        displayCall(intent);
        if(bridge!=null && intent.hasExtra("vtRide"))bridge.triggerWindowJSEvent("vt-open-trip","{}");
    }
    private void displayCall(android.content.Intent intent){
        if(android.os.Build.VERSION.SDK_INT>=27){
            boolean incoming=intent!=null && intent.hasExtra("vtCall");
            setShowWhenLocked(incoming);
            setTurnScreenOn(incoming);
        }
    }
    @Override public void onCreate(Bundle state) {
        registerPlugin(DriverWindow.class);registerPlugin(WifiOffers.class); registerPlugin(RideAudio.class); registerPlugin(TripAlerts.class);
        super.onCreate(state);displayCall(getIntent());
    }
}

