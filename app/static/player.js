console.info("RCA PLAYER v0.3.7 - no fixed medium timeout");
class RCAPlayer {
  constructor() {
    this.video = document.querySelector("#video");
    this.staticLayer = document.querySelector("#static");
    this.youtubeLayer = document.querySelector("#youtubeLayer");
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
    this.alertAudioContext = null;
    this.alertToneNodes = [];
    this.alertToneCloseTimer = null;
    this.hls = null;
    this.youtubePlayer = null;
    this.youtubeReady = false;
    this.currentMediaKind = "video";
    this.itemEndTimer = null;
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
    this.video.volume = Math.min(1, Math.max(0, Number((this.video.volume + delta).toFixed(2))));
    if (this.currentMediaKind === "youtube" && this.youtubePlayer?.setVolume) {
      this.youtubePlayer.unMute(); this.youtubePlayer.setVolume(Math.round(this.video.volume*100));
    } else { this.safePlay(); }

    this.showControlOsd(
      delta > 0 ? "volume-up" : "volume-down",
      `VOLUME ${Math.round(this.video.volume * 100)}`,
      this.video.volume,
    );
  }

  toggleMute() {
    this.video.muted = !this.video.muted;
    if (this.currentMediaKind === "youtube" && this.youtubePlayer) {
      if (this.video.muted) this.youtubePlayer.mute(); else { this.youtubePlayer.unMute(); this.youtubePlayer.setVolume(Math.round(this.video.volume*100)); }
    } else if (!this.video.muted) { this.safePlay(); }

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

  async tune(index) {
    this.currentChannelIndex =
      (index + this.channels.length) % this.channels.length;
    const channel = this.channels[this.currentChannelIndex];
    this.showStatic();
    this.channelNumber.textContent = String(channel.number).padStart(2, "0");
    this.channelName.textContent = channel.name;
    this.channelBug.classList.remove("hidden");
    window.setTimeout(() => this.channelBug.classList.add("hidden"), 2500);

    try {
      const now = await this.request(`/api/channels/${channel.id}/now`);
      await this.playNow(now);
    } catch (error) {
      console.error("Could not tune channel:", error);
    }
  }

  async playNow(now) {
    window.clearTimeout(this.itemEndTimer);
    if (!now.item) { this.stopPlayers(); return; }
    const item=now.item;
    if (item.media_kind === "youtube") {
      await this.playYouTube(item, now.offset_seconds || 0);
    } else {
      this.playVideoItem(item, now.offset_seconds || 0, now.live);
    }
    if (!now.live && item.duration_seconds > 0) {
      const remaining=Math.max(1,item.duration_seconds-(now.offset_seconds || 0));
      this.itemEndTimer=window.setTimeout(() => this.tune(this.currentChannelIndex), remaining*1000+500);
    }
  }

  stopPlayers() {
    if (this.hls) { this.hls.destroy(); this.hls=null; }
    this.video.pause(); this.video.classList.add("hidden");
    this.youtubeLayer.classList.add("hidden");
    if (this.youtubePlayer?.stopVideo) this.youtubePlayer.stopVideo();
  }

  playVideoItem(item, offset=0, live=false) {
    this.currentMediaKind="video";
    if (this.youtubePlayer?.stopVideo) {
      try { this.youtubePlayer.stopVideo(); } catch (_) {}
    }
    this.youtubeLayer.classList.add("hidden");
    this.video.classList.remove("hidden");
    this.video.style.visibility = "visible";
    if (this.hls) { this.hls.destroy(); this.hls=null; }
    const afterReady=() => {
      if (!live && offset>0) { try { this.video.currentTime=offset; } catch(_){} }
      this.safePlay();
    };
    if (item.media_url.includes(".m3u8") && window.Hls?.isSupported()) {
      this.hls=new Hls({enableWorker:true,lowLatencyMode:true});
      this.hls.loadSource(item.media_url); this.hls.attachMedia(this.video);
      this.hls.on(Hls.Events.MANIFEST_PARSED, afterReady);
    } else {
      this.video.src=item.media_url; this.video.load();
      this.video.onloadedmetadata=afterReady;
    }
  }

  async ensureYouTubePlayer(videoId, offset) {
    for (let i=0;i<50 && !(window.YT && YT.Player);i++) await new Promise(r=>setTimeout(r,100));
    if (!(window.YT && YT.Player)) throw new Error("YouTube API did not load");
    if (!this.youtubePlayer) {
      this.youtubePlayer=new YT.Player("youtubePlayer", {
        width:"100%",height:"100%",videoId,
        playerVars:{autoplay:1,controls:0,disablekb:1,rel:0,playsinline:1,start:Math.floor(offset)},
        events:{onReady:(e)=>{this.youtubeReady=true;e.target.seekTo(offset,true);e.target.playVideo();},onStateChange:(e)=>{if(e.data===YT.PlayerState.ENDED)this.tune(this.currentChannelIndex);}}
      });
    } else {
      this.youtubePlayer.loadVideoById({videoId,startSeconds:offset});
    }
  }

  async playYouTube(item, offset=0) {
    this.currentMediaKind="youtube";
    if (this.hls) { this.hls.destroy(); this.hls=null; }
    this.video.pause();
    this.video.classList.add("hidden");
    this.youtubeLayer.classList.remove("hidden");
    await this.ensureYouTubePlayer(item.provider_id, offset);
  }

  showStatic(duration = 600) {
    this.staticLayer.classList.remove("hidden");
    window.setTimeout(
      () => this.staticLayer.classList.add("hidden"),
      duration,
    );
  }

  playNextItem() { this.tune(this.currentChannelIndex); }

  playCurrentItem() { this.tune(this.currentChannelIndex); }

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
    const alertMessageElement = element.querySelector(".alert-message");
    const normalizedMessage = alert.level === "medium"
      ? alert.message.replace(/\s*\n+\s*/g, "  •  ").replace(/\s{2,}/g, " ").trim()
      : alert.message;
    alertMessageElement.textContent = normalizedMessage;
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
      const tickerWindow = element.querySelector(".ticker-window");
      const tickerText = element.querySelector(".ticker-text");

      // RCA old-TV crawl: no duration and no precomputed finish time.
      // Move the text at a fixed physical speed and dismiss only when the
      // rendered right edge of the text has actually left the ticker window.
      if (this.mediumTickerAnimation) {
        this.mediumTickerAnimation.cancel();
        this.mediumTickerAnimation = null;
      }
      if (this.mediumTickerRaf) {
        window.cancelAnimationFrame(this.mediumTickerRaf);
        this.mediumTickerRaf = null;
      }

      window.requestAnimationFrame(() => {
        const pixelsPerSecond = 58;
        const windowRect = tickerWindow.getBoundingClientRect();
        let x = tickerWindow.clientWidth + 24;
        let previousTimestamp = null;

        tickerText.style.transform = `translate3d(${x}px, 0, 0)`;

        const crawl = (timestamp) => {
          if (this.activeAlert?.id !== alert.id) {
            this.mediumTickerRaf = null;
            return;
          }

          if (previousTimestamp !== null) {
            const elapsedSeconds = Math.min(
              0.05,
              (timestamp - previousTimestamp) / 1000,
            );
            x -= pixelsPerSecond * elapsedSeconds;
            tickerText.style.transform = `translate3d(${x}px, 0, 0)`;
          }
          previousTimestamp = timestamp;

          const textRect = tickerText.getBoundingClientRect();

          // Only dismiss after the final character is completely past the
          // left boundary of the visible ticker area.
          if (textRect.right <= windowRect.left) {
            this.mediumTickerRaf = null;
            if (this.activeAlert?.id === alert.id) {
              this.dismissAlert();
            }
            return;
          }

          this.mediumTickerRaf = window.requestAnimationFrame(crawl);
        };

        this.mediumTickerRaf = window.requestAnimationFrame(crawl);
      });
    }
  }

  async dismissAlert() {
    if (!this.activeAlert) {
      return;
    }

    if (this.mediumTickerAnimation) {
      this.mediumTickerAnimation.cancel();
      this.mediumTickerAnimation = null;
    }
    if (this.mediumTickerRaf) {
      window.cancelAnimationFrame(this.mediumTickerRaf);
      this.mediumTickerRaf = null;
    }

    document
      .querySelectorAll(".alert")
      .forEach(element => element.classList.add("hidden"));

    this.stopAlertTone();

    await this.request(
      `/api/alerts/${this.activeAlert.id}/dismiss`,
      { method: "POST" },
    );

    this.activeAlert = null;
    this.video.volume = this.previousVolume;
  }

  stopAlertTone() {
    if (this.alertToneCloseTimer) {
      window.clearTimeout(this.alertToneCloseTimer);
      this.alertToneCloseTimer = null;
    }

    for (const node of this.alertToneNodes) {
      try { node.oscillator.stop(); } catch (_) {}
      try { node.oscillator.disconnect(); } catch (_) {}
      try { node.gain.disconnect(); } catch (_) {}
    }
    this.alertToneNodes = [];

    if (this.alertAudioContext) {
      try { this.alertAudioContext.close(); } catch (_) {}
      this.alertAudioContext = null;
    }
  }

  playAlertTone() {
    this.stopAlertTone();

    const AudioContext =
      window.AudioContext || window.webkitAudioContext;
    const context = new AudioContext();
    this.alertAudioContext = context;

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
      this.alertToneNodes.push({ oscillator, gain });
      cursor += pulseDuration + gapDuration;
    }

    this.alertToneCloseTimer = window.setTimeout(() => {
      if (this.alertAudioContext === context) {
        this.stopAlertTone();
      }
    }, (totalDuration + 1) * 1000);
  }}

new RCAPlayer().boot();
