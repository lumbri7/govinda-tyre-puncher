# Android production readiness (Phase A–C)

## Phase A — Inspection

### Project context
- Existing web app is server-rendered Next.js (16.3.8) with Server Actions and Supabase SSR; Android is a Capacitor wrapper only (no static bundle shipped in release sense). 
- package.json: `@capacitor/android ^8.5.2`, `@capacitor/browser ^8.0.5`, `@capacitor/cli ^8.5.2`, `@capacitor/core ^8.5.2`, `@capacitor/share ^8.0.3`. No other native plugins.
- capacitor.config.ts: appId `com.govindatyrepuncture.app`, appName `Govinda Tyre Puncture`, `webDir: 'web-fallback'`, `allowMixedContent: false`. Comment notes dev server passed via CLI (live-reload/forwardPorts) so it never leaks to builds; no `server.url` set. `web-fallback/index.html` is an honest placeholder (no dev URL/secrets).

### Android project
- `android/app/build.gradle`: namespace/applicationId `com.govindatyrepuncture.app`, compileSdk/minSdk/targetSdk from root ext (root values match Capacitor 8 defaults; android-36/37.0 platforms present), `windowSoftInputMode="adjustResize"` (prevents keyboard covering UI), `allowBackup="true"`, INTERNET permission only, no other dangerous permissions. Release build has `minifyEnabled false`, no custom signing config. `google-services.json` optional (push notifications not configured).
- Gradle: wrapper 8.14.3 (distributionUrl uses HTTPS), Kotlin 2.0.21. JVM used by Gradle daemon is JDK 21 (from org.gradle.java.home) while host Java is OpenJDK 25.0.4 — compatible.
- SDK: `ANDROID_HOME=/home/nitin/Android/Sdk`, platform-tools/adb present, build-tools 35.0.0/36.0.0, platforms android-36/android-37.0.
- Icons/splash: default mipmap resources present (ic_launcher/ic_launcher_round). Core splashscreen dependency present.

### How it loads
- App loads hosted website via Capacitor WebView; production must point to the real HTTPS site. Currently no `server.url` in config (intentional). `web-fallback` is only a safety shell. Development uses `npx cap run android --live-reload --forwardPorts` (live URL not baked in).

### Findings (blockers/checks)
- No localhost/preview URL hardcoded in config or Android sources.
- `allowMixedContent: false` correct for HTTPS production; dev uses adb reverse (local loopback) which is acceptable in live-reload context only.
- No server-only secrets in Android app (only public Supabase vars would be browser-exposed if ever bundled; but app loads remote site so secrets remain server-side).
- Keyboard handling set to `adjustResize` — correct.
- Back navigation handled by Capacitor WebView defaults (singleTask launch mode). External links via Capacitor Browser plugin present.
- No release signing configured (debug keystore used by default). 
- No production domain specified in `capacitor.config.ts` (explicitly left unset) — this is a required configuration for a true “production” build pointing to your hosted site.

## Phase B — Fixes (only safe, justified)
No changes required to fix release blockers in the current state. Rationale: 
- Config already avoids baking dev URL; production `server.url` must be the permanent HTTPS URL but that value is unknown/undecided (not guessed). 
- No secrets exposed, no localhost references, auth/roles/RLS unchanged (website untouched). 
- Permissions minimal (INTERNET). No second backend introduced.

If releasing the APK to load the existing deployed website, the minimal release change is to set `server.url` in `capacitor.config.ts` to the permanent HTTPS host (e.g. `https://govinda-tyre-puncher.vercel.app`) before syncing/building a release variant. However per instructions, do not guess the domain — document as blocker if different.

## Phase C — Verification
- Environment: Node v24.19.0, npm 11.19.0, OpenJDK 25.0.4, Gradle 8.14.3, Android SDK at /home/nitin/Android/Sdk (cmdline-tools, platform-tools/adb, build-tools 35.0.0/36.0.0, platforms android-36/37.0).
- Gradle wrapper functional: `./gradlew tasks` succeeded.
- Debug APK built: `./gradlew assembleDebug` succeeded.
- APK path: `/home/nitin/projects/govinda-tyre-puncture/android/app/build/outputs/apk/debug/app-debug.apk` (7.2M, Oct 9 00:06). 
- No `adb devices` required/used (no phone connected). No release signing keys created, no production data modified, no migrations applied.
- TypeScript/unit tests for web unchanged (Phase 3 green). Website logic untouched.

## Missing configuration/dependencies
- Production `server.url` not set (required if you want the release APK to load the deployed site). If the intended permanent URL differs from the current deployed URL, specify it explicitly. Do not assume.
- Release signing (keystore, key alias, passwords) — not configured; debug keystore only (acceptable for internal testing, not for Play Store distribution). 
- `google-services.json` absent (FCM/push notifications disabled; only affects that feature).
- Optional: Play App Signing, target API compliance details, ProGuard/R8 rules if enabling minification later.

## Remaining checks (before production release)
1. Confirm permanent HTTPS URL and set `server.url` in `capacitor.config.ts` (and sync). 
2. Create release keystore and configure signing in `android/app/build.gradle` (or use CI secrets). Never commit keystore. 
3. If loading remote site, verify TLS, deep links (if any), and that Capacitor plugins work on target devices. 
4. Test on physical devices (Android 10+ range) and check back navigation, keyboard, offline behavior, permissions. 
5. Play Console pre-launch, app integrity, versionCode bump. 
6. Consider enabling R8/minification and testing obfuscation impact (current `minifyEnabled false`).
7. Network security config review (allowMixedContent false; no cleartext endpoints intended).

## Next recommended step
Set `server.url` to the confirmed permanent HTTPS URL in `capacitor.config.ts`, run `npx cap sync android`, build `assembleRelease` with proper signing configured, and perform physical-device smoke tests (login, owner/employee flows, billing, reports). Until signing + URL + device tests are done, do not claim production readiness.

All Phase 1–3 website changes preserved. No production data, migrations, or deployments performed.

## Phase D — Build status (post-inspection)

- TypeScript (web): clean
- Unit tests: 8/8 passed
- Next.js build: succeeded with placeholder env vars
- Debug APK: exists at /home/nitin/projects/govinda-tyre-puncture/android/app/build/outputs/apk/debug/app-debug.apk (7.2M)
- Release APK/AAB: not built (requires production server.url + signing). Not claimed.
- Physical device: not tested/claimed.
