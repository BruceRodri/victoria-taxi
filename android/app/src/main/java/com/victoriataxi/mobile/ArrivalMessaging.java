package com.victoriataxi.mobile;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Locale;

public class ArrivalMessaging extends MessagingService {
    @Override public void onMessageReceived(RemoteMessage message) {
        String id = message.getData().get("rideId");
        if (id != null && "arrival".equals(message.getData().get("kind"))) {
            show(this, id, Locale.getDefault().getLanguage().equals("en"));
        } else {
            super.onMessageReceived(message);
        }
    }

    static synchronized String actionKey(Context context) {
        android.content.SharedPreferences prefs = context.getSharedPreferences("arrival", Context.MODE_PRIVATE);
        String key = prefs.getString("key", null);
        if (key == null) {
            key = java.util.UUID.randomUUID().toString();
            prefs.edit().putString("key", key).apply();
        }
        return key;
    }

    private static PendingIntent open(Context context, String target) {
        Intent intent = new Intent(context, MainActivity.class)
            .putExtra("vtArrivalKey", actionKey(context)).setAction("vt.trip." + target).putExtra("vtRide", target)
            .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(context, 0, intent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    static void show(Context context, String id, boolean en) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= 26) {
            manager.createNotificationChannel(new NotificationChannel("trip_events",
                "Avisos del viaje", NotificationManager.IMPORTANCE_HIGH));
        }
        manager.notify(id, "arrived".hashCode(), new NotificationCompat.Builder(context, "trip_events")
            .setSmallIcon(R.mipmap.ic_launcher).setContentTitle("Victoria-Taxi")
            .setContentText(en ? "Your driver is at pickup." : "Tu conductor llegó al punto de recogida.")
            .setPriority(NotificationCompat.PRIORITY_HIGH).setAutoCancel(true)
            .setContentIntent(open(context, id))
            .addAction(0, en ? "I'm outside" : "Ya estoy afuera", open(context, "outside/" + id))
            .addAction(0, en ? "I'm coming out" : "Estoy saliendo", open(context, "coming/" + id))
            .build());
    }
}
