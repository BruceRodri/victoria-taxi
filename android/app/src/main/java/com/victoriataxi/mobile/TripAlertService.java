package com.victoriataxi.mobile;

import android.app.*;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;
import java.net.*;
import java.io.*;
import java.util.concurrent.*;
import org.json.*;

public class TripAlertService extends Service {
    private static final int TRACKING=73100;
    private final ScheduledExecutorService worker=Executors.newSingleThreadScheduledExecutor();
    private ScheduledFuture<?> polling;
    private volatile int generation;
    private String ride;
    private String displayedCall;
    private static final int CALL=73101;
    private NotificationManager manager;
    @Override public IBinder onBind(Intent intent){return null;}
    @Override public void onCreate(){
        super.onCreate();manager=getSystemService(NotificationManager.class);
        if(Build.VERSION.SDK_INT>=26){
            manager.createNotificationChannel(new NotificationChannel("trip_tracking","Seguimiento del viaje",NotificationManager.IMPORTANCE_LOW));
            manager.createNotificationChannel(new NotificationChannel("trip_events","Avisos del viaje",NotificationManager.IMPORTANCE_HIGH));
        }
    }
    private NotificationCompat.Builder notification(String channel,String body){
        Intent open=new Intent(this,MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
        if(ride!=null)open.putExtra("vtRide",ride);
        PendingIntent tap=PendingIntent.getActivity(this,ride==null?TRACKING:ride.hashCode(),open,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
        return new NotificationCompat.Builder(this,channel).setSmallIcon(R.mipmap.ic_launcher).setContentTitle("Victoria-Taxi").setContentText(body).setContentIntent(tap);
    }
    private PendingIntent callIntent(String id,String action){
        Intent intent=new Intent(this,MainActivity.class).setAction("vt."+action).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP)
            .putExtra("vtCall",id).putExtra("vtAction",action);
        return PendingIntent.getActivity(this,(id+action).hashCode(),intent,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
    }
    private void updateCall(JSONObject call,boolean en,boolean driver) throws JSONException {
        if(call==null){if(displayedCall!=null)manager.cancel(CALL);displayedCall=null;return;}
        String id=call.getString("id");
        if(id.equals(displayedCall))return;
        if(Build.VERSION.SDK_INT>=26){
            NotificationChannel channel=new NotificationChannel("vt_calls","Llamadas de Victoria-Taxi",NotificationManager.IMPORTANCE_HIGH);
            channel.setSound(android.provider.Settings.System.DEFAULT_RINGTONE_URI,new android.media.AudioAttributes.Builder().setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION_RINGTONE).build());
            manager.createNotificationChannel(channel);
        }
        String role=driver?(en?"Passenger":"Pasajero"):(en?"Driver":"Conductor");
        androidx.core.app.Person person=new androidx.core.app.Person.Builder().setName("Victoria-Taxi · "+call.optString("caller")+" · "+role).setImportant(true).build();
        PendingIntent view=callIntent(id,"view");
        manager.notify(CALL,new NotificationCompat.Builder(this,"vt_calls").setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Victoria-Taxi").setContentIntent(view).setFullScreenIntent(view,true)
            .setTimeoutAfter(Math.max(1000,90000-(System.currentTimeMillis()-call.getLong("at"))))
            .setCategory(NotificationCompat.CATEGORY_CALL).setPriority(NotificationCompat.PRIORITY_MAX)
            .setStyle(NotificationCompat.CallStyle.forIncomingCall(person,callIntent(id,"decline"),callIntent(id,"answer")))
            .setOngoing(true).build());
        displayedCall=id;
    }
    private JSONObject read(String url,String token) throws Exception {
        HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();
        try {
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(4500);
            c.setReadTimeout(4500);
            c.setRequestProperty("Authorization","Bearer "+token);
            int code=c.getResponseCode();
            if(code==401 || code==403)throw new SecurityException();
            if(code==404)return null;
            if(code!=200)throw new IOException("HTTP "+code);
            StringBuilder body=new StringBuilder();
            try(BufferedReader reader=new BufferedReader(new InputStreamReader(c.getInputStream(),"UTF-8"))){
                String line;
                while((line=reader.readLine())!=null)body.append(line);
            }
            return new JSONObject(body.toString());
        } finally { c.disconnect(); }
    }
    private JSONArray legacyStatuses(String host,String token,String id) throws Exception {
        JSONArray trips=read(host+"/dispatch/state",token).getJSONArray("trips");
        for(int i=0;i<trips.length();i++){
            JSONObject trip=trips.getJSONObject(i);
            if(!id.equals(trip.getString("id")))continue;
            String current=trip.getString("status");
            JSONArray states=new JSONArray().put("waiting");
            for(String status:new String[]{"accepted","arrived","in_progress","completed"}){
                if(current.equals("waiting") || current.equals("cancelled"))break;
                states.put(status);
                if(current.equals(status))break;
            }
            if(current.equals("cancelled"))states.put(current);
            return states;
        }
        throw new SecurityException();
    }
    @Override public int onStartCommand(Intent intent,int flags,int startId){
        boolean en="en".equals(intent.getStringExtra("lang"));
        startForeground(TRACKING,notification("trip_tracking",en?"Waiting for ride updates":"Esperando avisos de tu viaje").setOngoing(true).build());
        String next=intent.getStringExtra("ride");
        if(next==null){stopSelf();return START_NOT_STICKY;}
        if(next.equals(ride))return START_NOT_STICKY;
        ride=next;int run=++generation;
        if(polling!=null)polling.cancel(false);
        String url=intent.getStringExtra("host")+"/dispatch/trip-alerts/"+next;
        String token=intent.getStringExtra("token");
        boolean driver="driver".equals(intent.getStringExtra("role"));
        boolean alerts=!"false".equals(intent.getStringExtra("systemAlerts"));
        int[] notified={Integer.parseInt(intent.getStringExtra("messageCount")==null?"0":intent.getStringExtra("messageCount"))};
        String[] last={intent.getStringExtra("status")};
        String host=intent.getStringExtra("host");
        boolean[] legacy={false};
        polling=worker.scheduleWithFixedDelay(()->{
            try{
                JSONObject feed=legacy[0]?null:read(url,token);
                if(feed==null)legacy[0]=true;
                JSONArray states=legacy[0]?legacyStatuses(host,token,next):feed.getJSONArray("statuses");
                if(run!=generation)return;
                if(feed!=null && feed.optInt("messageCount")>notified[0]){
                    notified[0]=feed.getInt("messageCount");
                    if(alerts){
                        String sender=feed.optString("messageFrom","Victoria-Taxi");
                        Intent chat=new Intent(this,MainActivity.class).setAction("vt.message").putExtra("vtRide","chat/"+next).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
                        PendingIntent open=PendingIntent.getActivity(this,next.hashCode(),chat,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
                        String reply=feed.optString("pickupReply");
                        String body=reply.equals("outside")?(en?"Your passenger is outside.":"Tu pasajero ya está afuera."):
                            reply.equals("coming")?(en?"Your passenger is coming out.":"Tu pasajero está saliendo."):(en?"New message from ":"Nuevo mensaje de ")+sender;
                        manager.notify(next,73103,notification("trip_events",body).setContentIntent(open).setAutoCancel(true).setPriority(NotificationCompat.PRIORITY_HIGH).build());
                    }
                }
                if(feed!=null)updateCall(feed.optJSONObject("incoming"),en,driver);
                int previous=-1;
                for(int i=0;i<states.length();i++)if(states.getString(i).equals(last[0]))previous=i;
                for(int i=previous+1;i<states.length()&&run==generation;i++){
                    String status=states.getString(i);String body;
                    switch(status){
                        case "accepted":body=en?"Your driver accepted the ride.":"Tu conductor aceptó el viaje.";break;
                        case "arrived":body=en?"Your driver has arrived at pickup.":"Tu conductor llegó al punto de recogida.";break;
                        case "in_progress":body=en?"Your ride has started.":"Tu viaje ha comenzado.";break;
                        case "completed":body=en?"Your ride has finished.":"Tu viaje ha finalizado.";break;
                        case "cancelled":body=en?"Your ride was cancelled.":"Tu viaje fue cancelado.";break;
                        default:continue;
                    }
                    if(!status.equals("arrived"))manager.cancel(next,"arrived".hashCode());
                    if(alerts && !driver && status.equals("arrived") && i==states.length()-1)ArrivalMessaging.show(this,next,en);
                    else if(alerts && !status.equals("arrived") && (!driver || status.equals("completed") || status.equals("cancelled")))manager.notify(next,status.hashCode(),notification("trip_events",body).setPriority(NotificationCompat.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL).setAutoCancel(true).build());
                    last[0]=status;
                    if(status.equals("completed")||status.equals("cancelled"))stopSelf();
                }
            }catch(SecurityException denied){if(run==generation)stopSelf();}
            catch(Exception ignored){/* Retry after network loss using the last delivered status. */}
        },0,3,TimeUnit.SECONDS);
        return START_NOT_STICKY;
    }
    @Override public void onDestroy(){generation++;manager.cancel(CALL);worker.shutdownNow();stopForeground(STOP_FOREGROUND_REMOVE);super.onDestroy();}
}
