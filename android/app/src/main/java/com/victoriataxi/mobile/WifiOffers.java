package com.victoriataxi.mobile;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.net.HttpURLConnection;
import java.net.URL;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;

/** Local Wi-Fi demo: check for offers while the driver's native location shift is running. */
@CapacitorPlugin(name="WifiOffers")
public class WifiOffers extends Plugin {
    private ScheduledExecutorService worker;
    private String shown = "";
    private int generation = 0;
    private static final String CHANNEL = "wifi-ride-offers";
    private static final int OFFER_ID = 71002;

    @PluginMethod public synchronized void start(PluginCall call) {
        String host = call.getString("host", "");
        String key = call.getString("key", "");
        try {
            URL address = new URL(host);
            String ip = address.getHost();
            if (!address.getProtocol().equals("http") || !ip.matches("(192\\.168|10\\.[0-9]{1,3}|172\\.(1[6-9]|2[0-9]|3[01]))\\.[0-9]{1,3}\\.[0-9]{1,3}")
                || !address.getPath().isEmpty() || address.getUserInfo()!=null || address.getQuery()!=null || address.getRef()!=null || !key.matches("[a-f0-9]{36}")) throw new IllegalArgumentException();
            shutdown();
            int active = generation;
            worker = Executors.newSingleThreadScheduledExecutor();
            worker.scheduleWithFixedDelay(() -> poll(host, key, active), 0, 3, TimeUnit.SECONDS);
            call.resolve();
        } catch(Exception e) { call.reject("Invalid Wi-Fi pairing."); }
    }

    private void poll(String host, String key, int active) {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection)new URL(host+"/api/offers").openConnection();
            conn.setConnectTimeout(3500); conn.setReadTimeout(3500);
            conn.setInstanceFollowRedirects(false);
            conn.setRequestProperty("Authorization","Bearer "+key);
            if(conn.getResponseCode()!=200) return;
            try(BufferedReader stream=new BufferedReader(new InputStreamReader(conn.getInputStream()))) {
                String id=new JSONObject(stream.readLine()).getString("id");
                synchronized(this) {
                    if(active!=generation || id.equals(shown)) return;
                    NotificationManager manager=getContext().getSystemService(NotificationManager.class);
                    if(id.isEmpty()) manager.cancel(OFFER_ID);
                    else {
                        if(Build.VERSION.SDK_INT>=26) manager.createNotificationChannel(new NotificationChannel(CHANNEL,"Viajes disponibles",NotificationManager.IMPORTANCE_HIGH));
                        Intent open = new Intent(Intent.ACTION_VIEW,
                            new android.net.Uri.Builder().scheme("victoriataxi").authority("offer").appendPath(id).build(),
                            getContext(), MainActivity.class);
                        open.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                        PendingIntent tap=PendingIntent.getActivity(getContext(),OFFER_ID,open,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
                        manager.notify(OFFER_ID,new NotificationCompat.Builder(getContext(),CHANNEL)
                          .setSmallIcon(android.R.drawable.ic_dialog_map).setContentTitle("Victoria-Taxi")
                          .setContentText("Nuevo viaje de Sof\u00eda. Toca para ver la solicitud.").setContentIntent(tap)
                          .setPriority(NotificationCompat.PRIORITY_HIGH).setAutoCancel(true).build());
                    }
                    shown=id;
                }
            }
        } catch(Exception ignored) { /* Retry after temporary Wi-Fi loss. */ }
        finally { if(conn!=null) conn.disconnect(); }
    }

    private synchronized void shutdown() {
        generation++; shown="";
        if(worker!=null) { worker.shutdownNow(); worker=null; }
        getContext().getSystemService(NotificationManager.class).cancel(OFFER_ID);
    }
    @PluginMethod public void stop(PluginCall call) { shutdown(); call.resolve(); }
    @Override protected void handleOnDestroy() { shutdown(); }
}

