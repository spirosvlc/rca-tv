# RCA TV Android client

A minimal Android TV application that opens the RCA TV Python server in a fullscreen WebView.

## Behavior

- First launch asks for the RCA server address.
- The address is saved permanently.
- Later launches open RCA TV immediately.
- JavaScript and DOM storage are enabled.
- Media autoplay does not require a user gesture.
- HTTP LAN addresses are allowed.
- Android TV remote events are translated into the keys expected by RCA TV.

## Remote controls

| Android TV remote | RCA action |
|---|---|
| Channel Up / D-pad Up | Next channel |
| Channel Down / D-pad Down | Previous channel |
| OK / Enter / 0 | RCA OK; dismiss alert |
| Volume Up | RCA volume up and green OSD |
| Volume Down | RCA volume down and green OSD |
| Mute | RCA mute and green OSD |
| Back | RCA back/dismiss |
| Menu / Settings | Open server address |
| Long-press 0 | Open server address |

## Configure the server

On first launch enter:

```text
http://YOUR_MAC_IP:8080
```

For example:

```text
http://192.168.1.45:8080
```

Your Android TV and Mac must be connected to the same network. The RCA Python server must listen on `0.0.0.0`, not only on `127.0.0.1`.

## Build with Android Studio on macOS

1. Install Android Studio.
2. Open this project folder.
3. Allow Gradle sync to complete.
4. Select **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
5. The debug APK will be created under:

```text
app/build/outputs/apk/debug/app-debug.apk
```

## Build from Terminal

Install Android command-line tools using Homebrew:

```bash
brew tap android/tap
brew install android-cli
```

Then, from the project directory:

```bash
gradle wrapper
./gradlew assembleDebug
```

## Install on Android TV with ADB

Enable Developer Options and USB/network debugging on the TV.

Find the TV IP, then:

```bash
adb connect TV_IP:5555
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## Change the default placeholder

Edit:

```text
app/src/main/res/values/strings.xml
```

and replace:

```xml
<string name="default_rca_url">http://192.168.1.45:8080</string>
```

The app still asks for the correct address on first launch.
