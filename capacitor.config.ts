import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Govinda Tyre Puncture — Android only.
 *
 * The app is a server-rendered Next.js application (Server Actions, Supabase
 * SSR), so the WebView loads it from the Next.js server. Nothing is exported
 * statically and no server secret is ever bundled with the Android project;
 * `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are the
 * only Supabase values the WebView ever sees, and both are already public by
 * design.
 *
 * The development server URL is deliberately *not* written here. It is passed
 * on the command line by `npx cap run android --live-reload --forwardPorts`,
 * which writes it into the config only for that run and reverts it on exit, so
 * a development host can never leak into a build. Add a production `server.url`
 * here when — and only when — there is a real host to point at.
 *
 * `webDir` is required by `cap sync` and must contain an index.html. This
 * project has no static bundle, so it points at `web-fallback/`: a small
 * honest shell page that explains the server has not been configured, instead
 * of a blank WebView. It holds no development URL and no secrets.
 */
const config: CapacitorConfig = {
  appId: 'com.govindatyrepuncture.app',
  appName: 'Govinda Tyre Puncture',
  webDir: 'web-fallback',
  android: {
    // Mixed content stays off: Supabase and the app are https in production,
    // and the only http source (the dev server) is reached over adb reverse on
    // the phone's own loopback, which is not mixed content from the WebView's
    // point of view only while that URL is active.
    allowMixedContent: false,
    // Not enabled here: Capacitor turns WebView remote debugging on
    // automatically while a live-reload run is active, so chrome://inspect
    // works during development without shipping a debugging door in release
    // builds.
  },
};

export default config;
