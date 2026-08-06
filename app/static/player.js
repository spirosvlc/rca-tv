class RCAPlayer {
  constructor() {
    this.video = document.querySelector("#video");
    this.staticLayer = document.querySelector("#static");
    this.channelBug = document.querySelector("#channelBug");
    this.emptyState = document.querySelector("#emptyState");
    this.channelNumber = document.querySelector("#channelNumber");
    this.channelName = document.querySelector("#channelName");

    this.channels = [];
    this.currentChannelIndex = 0;
    this.currentItemIndex = 0;
    this.latestAlertId = 0;
    this.activeAlert = null;
    this.hls = null;
    this.previousVolume = 1;
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
    if (
      this.activeAlert &&
      ["Enter", "Escape", " "].includes(event.key)
    ) {
      this.dismissAlert();
      return;
    }

    if (["ArrowUp", "PageUp"].includes(event.key)) {
      this.tune(this.currentChannelIndex + 1);
    }

    if (["ArrowDown", "PageDown"].includes(event.key)) {
      this.tune(this.currentChannelIndex - 1);
    }

    if (event.key.toLowerCase() === "m") {
      this.video.muted = !this.video.muted;
    }

    if (event.key.toLowerCase() === "f") {
      document.documentElement.requestFullscreen?.();
    }
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
      this.hls = new Hls();
      this.hls.loadSource(item.media_url);
      this.hls.attachMedia(this.video);
      this.hls.on(
        Hls.Events.MANIFEST_PARSED,
        () => this.video.play().catch(() => {}),
      );
    } else {
      this.video.src = item.media_url;
      this.video.play().catch(() => {});
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
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "square";
    oscillator.frequency.value = 853;
    gain.gain.value = 0.08;

    oscillator.connect(gain).connect(context.destination);
    oscillator.start();

    window.setTimeout(() => {
      oscillator.stop();
      context.close();
    }, 1100);
  }
}

new RCAPlayer().boot();
