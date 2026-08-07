class RCAPlayer {
  constructor() {
    this.video = document.querySelector("#video");
    this.staticLayer = document.querySelector("#static");
    this.channelBug = document.querySelector("#channelBug");
    this.emptyState = document.querySelector("#emptyState");
    this.channelNumber = document.querySelector("#channelNumber");
    this.channelName = document.querySelector("#channelName");
    this.channelNumberEntry = document.querySelector("#channelNumberEntry");
    this.channelNumberEntryValue = document.querySelector("#channelNumberEntryValue");
    this.controlOsd = document.querySelector("#controlOsd");
    this.controlIcon = document.querySelector("#controlIcon");
    this.controlLabel = document.querySelector("#controlLabel");
    this.volumeMeterFill = document.querySelector("#volumeMeterFill");
    this.keyDebug = document.querySelector("#keyDebug");

    this.channels = [];
    this.currentChannelIndex = 0;
    this.currentItemIndex = 0;
    this.latestAlertId = 0;
    this.activeAlert = null;
    this.hls = null;
    this.previousVolume = 1;
    this.hasUserInteraction = false;
    this.osdTimer = null;
    this.keyDebugTimer = null;
    this.channelEntryTimer = null;
    this.channelEntryBuffer = "";

    // Browsers permit reliable autoplay when media starts muted.
    this.video.muted = true;
    this.video.autoplay = true;
  }

  async boot() {
    this.channels = await this.request("/api/channels");

    if (!this.channels.length) {
      return;
    }

    this.emptyState.classList.add("hidden");
    this.bindEvents();
    this.tune(0);

    window.setInterval(
      () => this.checkAlerts(),
      2000,
    );
  }

  bindEvents() {
    this.video.addEventListener(
      "ended",
      () => this.playNextItem(),
    );

    document.addEventListener(
      "keydown",
      event => this.handleKey(event),
    );
  }

  async request(url, options = {}) {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    return response.status === 204 ? null : response.json();
  }

  handleKey(event) {
    this.registerUserInteraction();

    const key = event.key || "";
    const keyCode = event.keyCode || event.which || 0;

    const nextChannelKeys = new Set([
      "ArrowUp", "PageUp", "ChannelUp", "MediaTrackNext", "TVChannelUp",
    ]);
    const previousChannelKeys = new Set([
      "ArrowDown", "PageDown", "ChannelDown", "MediaTrackPrevious", "TVChannelDown",
    ]);
    const okKeys = new Set([
      "Enter", "Accept", "Select", "OK", "MediaPlayPause", "0",
    ]);
    const backKeys = new Set([
      "Escape", "Back", "BrowserBack", "GoBack", "Exit",
    ]);
    const volumeUpKeys = new Set([
      "ArrowRight", "AudioVolumeUp", "VolumeUp", "+", "=",
    ]);
    const volumeDownKeys = new Set([
      "ArrowLeft", "AudioVolumeDown", "VolumeDown", "-", "_",
    ]);
    const muteKeys = new Set([
      "AudioVolumeMute", "VolumeMute", "Mute", "m", "M",
    ]);

    const nextChannelCodes = new Set([33, 427]);
    const previousChannelCodes = new Set([34, 428]);
    const okCodes = new Set([13, 23, 48, 415]);
    const backCodes = new Set([27, 461, 10009]);
    const volumeUpCodes = new Set([175, 447]);
    const volumeDownCodes = new Set([174, 448]);
    const muteCodes = new Set([173, 449]);

    if (
      this.activeAlert &&
      (
        okKeys.has(key) ||
        backKeys.has(key) ||
        key === " " ||
        okCodes.has(keyCode) ||
        backCodes.has(keyCode)
      )
    ) {
      event.preventDefault();
      event.stopPropagation();
      this.dismissAlert();
      return;
    }

    if (/^[1-9]$/.test(key)) {
      event.preventDefault();
      event.stopPropagation();
      this.showChannelNumberEntry(key);
      return;
    }

    if (nextChannelKeys.has(key) || nextChannelCodes.has(keyCode)) {
      event.preventDefault();
      event.stopPropagation();
      this.tune(this.currentChannelIndex + 1);
      return;
    }

    if (previousChannelKeys.has(key) || previousChannelCodes.has(keyCode)) {
      event.preventDefault();
      event.stopPropagation();
      this.tune(this.currentChannelIndex - 1);
      return;
    }

    if (volumeUpKeys.has(key) || volumeUpCodes.has(keyCode)) {
      event.preventDefault();
      event.stopPropagation();
      this.changeVolume(0.1);
      return;
    }

    if (volumeDownKeys.has(key) || volumeDownCodes.has(keyCode)) {
      event.preventDefault();
      event.stopPropagation();
      this.changeVolume(-0.1);
      return;
    }

    if (muteKeys.has(key) || muteCodes.has(keyCode)) {
      event.preventDefault();
      event.stopPropagation();
      this.toggleMute();
      return;
    }

    if (key.toLowerCase() === "f") {
      document.documentElement.requestFullscreen?.();
      return;
    }

    this.showKeyDebug(event);
  }

  showChannelNumberEntry(digit) {
    window.clearTimeout(this.channelEntryTimer);

    this.channelEntryBuffer += digit;
    this.channelEntryBuffer = this.channelEntryBuffer.slice(-3);

    this.channelNumberEntryValue.textContent = this.channelEntryBuffer;
    this.channelNumberEntry.classList.remove("hidden");

    this.channelEntryTimer = window.setTimeout(() => {
      const requestedNumber = Number.parseInt(this.channelEntryBuffer, 10);
      const targetIndex = this.channels.findIndex(
        channel => channel.number === requestedNumber,
      );

      if (targetIndex >= 0) {
        this.tune(targetIndex);
      }

      this.channelEntryBuffer = "";
      this.channelNumberEntry.classList.add("hidden");
    }, 1400);
  }

  registerUserInteraction() {
    if (this.hasUserInteraction) {
      return;
    }

    this.hasUserInteraction = true;
    this.video.muted = false;

    if (this.video.paused) {
      this.safePlay();
    }
  }

  async safePlay() {
    try {
      await this.video.play();
      return true;
    } catch (error) {
      if (error?.name === "NotAllowedError") {
        // Retry muted. The first remote/key interaction will restore sound.
        this.video.muted = true;
        try {
          await this.video.play();
          return true;
        } catch (mutedError) {
          console.error("Muted autoplay failed:", mutedError);
        }
      } else if (error?.name !== "AbortError") {
        console.error("Video playback failed:", error);
      }
      return false;
    }
  }


  changeVolume(delta) {
    this.video.muted = false;
    this.video.volume = Math.min(
      1,
      Math.max(0, Number((this.video.volume + delta).toFixed(2))),
    );

    this.safePlay();

    this.showControlOsd(
      delta > 0 ? "volume-up" : "volume-down",
      `VOLUME ${Math.round(this.video.volume * 100)}`,
      this.video.volume,
    );
  }

  toggleMute() {
    this.video.muted = !this.video.muted;

    if (!this.video.muted) {
      this.safePlay();
    }

    this.showControlOsd(
      this.video.muted ? "mute" : "volume-up",
      this.video.muted
        ? "MUTE"
        : `VOLUME ${Math.round(this.video.volume * 100)}`,
      this.video.muted ? 0 : this.video.volume,
    );
  }

  showControlOsd(icon, label, level) {
    window.clearTimeout(this.osdTimer);

    const icons = {
      "volume-up": "◖)))",
      "volume-down": "◖))",
      mute: "◖×",
      ok: "✓",
    };

    this.controlIcon.textContent = icons[icon] || "◖";
    this.controlLabel.textContent = label;
    this.volumeMeterFill.style.width =
      `${Math.round(Math.max(0, Math.min(1, level)) * 100)}%`;

    this.controlOsd.classList.remove("hidden");
    this.osdTimer = window.setTimeout(
      () => this.controlOsd.classList.add("hidden"),
      2000,
    );
  }

  tune(index) {
    this.currentChannelIndex =
      (index + this.channels.length) % this.channels.length;
    this.currentItemIndex = 0;

    const channel = this.channels[this.currentChannelIndex];

    this.showStatic();
    this.channelNumber.textContent =
      String(channel.number).padStart(2, "0");
    this.channelName.textContent = channel.name;

    this.channelBug.classList.remove("hidden");
    window.setTimeout(
      () => this.channelBug.classList.add("hidden"),
      2500,
    );

    this.playCurrentItem();
  }

  showStatic(duration = 600) {
    this.staticLayer.classList.remove("hidden");
    window.setTimeout(
      () => this.staticLayer.classList.add("hidden"),
      duration,
    );
  }

  playNextItem() {
    const channel = this.channels[this.currentChannelIndex];
    if (!channel?.items.length) {
      return;
    }

    this.currentItemIndex =
      (this.currentItemIndex + 1) % channel.items.length;
    this.playCurrentItem();
  }

  playCurrentItem() {
    const channel = this.channels[this.currentChannelIndex];

    if (!channel.items.length) {
      this.video.removeAttribute("src");
      this.video.load();
      return;
    }

    const item =
      channel.items[this.currentItemIndex % channel.items.length];

    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }

    if (
      item.media_url.includes(".m3u8") &&
      window.Hls?.isSupported()
    ) {
      this.hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });

      this.hls.loadSource(item.media_url);
      this.hls.attachMedia(this.video);

      this.hls.on(
        Hls.Events.MANIFEST_PARSED,
        () => this.safePlay(),
      );

      this.hls.on(
        Hls.Events.ERROR,
        (_event, data) => {
          console.error("HLS playback error:", data);
        },
      );
    } else {
      this.video.src = item.media_url;
      this.video.load();
      this.safePlay();
    }
  }

  async checkAlerts() {
    const alert = await this.request(
      `/api/alerts/latest?after_id=${this.latestAlertId}`,
    );

    if (!alert) {
      return;
    }

    this.latestAlertId = alert.id;
    this.showAlert(alert);
  }

  showAlert(alert) {
    this.activeAlert = alert;

    const element = document.querySelector(
      `#${alert.level}Alert`,
    );
    element.querySelector(".alert-message").textContent =
      alert.message;
    element.classList.remove("hidden");

    if (alert.level === "critical") {
      this.previousVolume = this.video.volume;
      this.video.volume = Math.max(
        0.1,
        this.video.volume * 0.25,
      );
      this.playAlertTone();
    }

    if (alert.level === "medium") {
      window.setTimeout(
        () => this.dismissAlert(),
        12000,
      );
    }
  }

  async dismissAlert() {
    if (!this.activeAlert) {
      return;
    }

    document
      .querySelectorAll(".alert")
      .forEach(element => element.classList.add("hidden"));

    await this.request(
      `/api/alerts/${this.activeAlert.id}/dismiss`,
      { method: "POST" },
    );

    this.activeAlert = null;
    this.video.volume = this.previousVolume;
  }

  playAlertTone() {
    const AudioContext =
      window.AudioContext || window.webkitAudioContext;
    const context = new AudioContext();

    const startTime = context.currentTime;
    const totalDuration = 10;
    const pulseDuration = 0.55;
    const gapDuration = 0.25;
    let cursor = 0;

    while (cursor < totalDuration) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "square";
      oscillator.frequency.value = 853;
      gain.gain.setValueAtTime(0.08, startTime + cursor);
      gain.gain.setValueAtTime(0.08, startTime + cursor + pulseDuration - 0.02);
      gain.gain.linearRampToValueAtTime(0, startTime + cursor + pulseDuration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(startTime + cursor);
      oscillator.stop(startTime + cursor + pulseDuration);
      cursor += pulseDuration + gapDuration;
    }

    window.setTimeout(() => context.close(), (totalDuration + 1) * 1000);
  }
}

new RCAPlayer().boot();
