package com.trashdrop.carter;

import android.app.Activity;
import android.content.Intent;
import android.content.IntentSender;
import android.os.Bundle;

import com.google.android.gms.common.api.ResolvableApiException;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.LocationSettingsRequest;
import com.google.android.gms.location.Priority;

/**
 * Opens Google's "Turn on location" dialog over the app, as Uber does. The
 * yellow banner in the web app opens this screen through the
 * trashdropcarter://location link; when the dialog closes, the collector is
 * back in the app, which notices by itself that location is on.
 */
public class TurnOnLocationActivity extends Activity {
    private static final int RESOLVE_REQUEST = 1;
    private static final long INTERVAL_MS = 10000;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        LocationRequest request =
                new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, INTERVAL_MS).build();
        LocationSettingsRequest settings = new LocationSettingsRequest.Builder()
                .addLocationRequest(request)
                .setAlwaysShow(true)
                .build();

        LocationServices.getSettingsClient(this)
                .checkLocationSettings(settings)
                .addOnSuccessListener(this, response -> finish())
                .addOnFailureListener(this, error -> {
                    if (error instanceof ResolvableApiException) {
                        try {
                            ((ResolvableApiException) error)
                                    .startResolutionForResult(this, RESOLVE_REQUEST);
                            return;
                        } catch (IntentSender.SendIntentException ignored) {
                            // Fall through: the web app shows the manual step
                        }
                    }
                    finish();
                });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        finish();
    }
}
