/**
 * The installed Android app (version 1.1.0 and later) starts the site with
 * ?android_layer=1. Older installs and browsers don't, and have no native
 * screen to open, so they keep the browser's own behaviour.
 */
const FLAG = 'trashdrop_android_layer';

export const noteAndroidLayer = () => {
  try {
    if (new URLSearchParams(window.location.search).has('android_layer')) {
      sessionStorage.setItem(FLAG, '1');
    }
  } catch { /* storage blocked: treated as a browser */ }
};

export const hasAndroidLayer = () => {
  try {
    return sessionStorage.getItem(FLAG) === '1';
  } catch {
    return false;
  }
};

/** Opens Google's "Turn on location" dialog over the app */
export const openLocationDialog = () => {
  window.location.href = 'trashdropcarter://location/enable';
};
