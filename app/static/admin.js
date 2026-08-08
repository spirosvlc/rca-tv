class RCAAdmin {
  constructor() {
    this.channelForm = document.querySelector("#channelForm");
    this.alertForm = document.querySelector("#alertForm");
    this.settingsForm = document.querySelector("#settingsForm");
    this.broadcastSettingsForm = document.querySelector("#broadcastSettingsForm");
    this.youtubeSettingsForm = document.querySelector("#youtubeSettingsForm");
    this.sourceType = this.channelForm.elements.source_type;
    this.sourceInput = this.channelForm.elements.source;
    this.folderPickerButton =
      document.querySelector("#folderPickerButton");
  }

  async boot() {
    document.querySelector("#testWeatherTicker")?.addEventListener("click", () => this.testWeatherTicker());
    this.bindEvents();
    await Promise.all([
      this.loadChannels(),
      this.loadSettings(),
    ]);
  }

  bindEvents() {
    this.channelForm.addEventListener(
      "submit",
      event => this.createChannel(event),
    );
    this.alertForm.addEventListener(
      "submit",
      event => this.createAlert(event),
    );
    this.settingsForm.addEventListener(
      "submit",
      event => this.saveSettings(event),
    );

    this.folderPickerButton.addEventListener(
      "click",
      () => this.selectFolder(),
    );

    this.sourceType.addEventListener(
      "change",
      () => this.updateSourceControls(),
    );

    this.broadcastSettingsForm.addEventListener("submit", event => this.saveExtraSettings(event, this.broadcastSettingsForm, "broadcastStatus"));
    this.youtubeSettingsForm.addEventListener("submit", event => this.saveExtraSettings(event, this.youtubeSettingsForm, "youtubeStatus"));
    document.querySelector("#youtubeConnect").addEventListener("click", () => this.connectYouTube());
    document.querySelector("#youtubeLoadSubs").addEventListener("click", () => this.loadYouTubeSubscriptions());
    this.updateSourceControls();
  }

  async request(url, options = {}) {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(
        body.detail || `Request failed: ${response.status}`,
      );
    }

    return response.status === 204 ? null : response.json();
  }


  updateSourceControls() {
    const isFolder = this.sourceType.value === "folder";
    const isYouTube = this.sourceType.value === "youtube";
    this.folderPickerButton.hidden = !isFolder;
    this.sourceInput.readOnly = isYouTube;
    this.sourceInput.placeholder = isFolder
      ? "/media/rca/cartoons"
      : isYouTube ? "Select YouTube subscriptions below" : "https://example.com/playlist.m3u8";
  }

  async selectFolder() {
    const status = document.querySelector("#channelStatus");
    status.textContent = "Opening folder picker…";

    try {
      const result = await this.request(
        "/api/channels/select-folder",
        { method: "POST" },
      );

      if (result.path) {
        this.sourceInput.value = result.path;
        status.textContent = "Folder selected.";
      } else {
        status.textContent = "Folder selection cancelled.";
      }
    } catch (error) {
      status.textContent = error.message;
    }
  }

  async loadChannels() {
    const channels = await this.request("/api/channels");
    const container = document.querySelector("#channels");

    container.innerHTML = channels.length
      ? ""
      : "<p>No channels configured.</p>";

    channels.forEach(channel => {
      container.appendChild(this.renderChannel(channel));
    });
  }

  renderChannel(channel) {
    const row = document.createElement("article");
    row.className = "channel-row";

    row.innerHTML = `
      <div class="channel-number">
        ${String(channel.number).padStart(2, "0")}
      </div>
      <div class="channel-copy">
        <strong>${this.escapeHtml(channel.name)}</strong>
        <small>
          ${this.escapeHtml(channel.source_type)}
          · ${channel.items.length} items
        </small>
        <code>${this.escapeHtml(channel.source)}</code>
      </div>
      <div class="channel-actions">
        <button data-action="scan">Scan</button>
        <button data-action="delete">Delete</button>
      </div>
    `;

    row.querySelector('[data-action="scan"]').onclick =
      async () => {
        await this.request(
          `/api/channels/${channel.id}/scan`,
          { method: "POST" },
        );
        await this.loadChannels();
      };

    row.querySelector('[data-action="delete"]').onclick =
      async () => {
        await this.request(
          `/api/channels/${channel.id}`,
          { method: "DELETE" },
        );
        await this.loadChannels();
      };

    return row;
  }

  async createChannel(event) {
    event.preventDefault();

    const status = document.querySelector("#channelStatus");
    const data = Object.fromEntries(
      new FormData(this.channelForm),
    );

    data.number = Number(data.number);
    data.enabled = true;

    try {
      const result = await this.request("/api/channels", {
        method: "POST",
        body: JSON.stringify(data),
      });

      status.textContent =
        `Channel added. Imported ${result.items_imported} items.`;

      this.channelForm.reset();
      await this.loadChannels();
    } catch (error) {
      status.textContent = error.message;
    }
  }

  async createAlert(event) {
    event.preventDefault();

    const data = Object.fromEntries(
      new FormData(this.alertForm),
    );

    await this.request("/api/alerts", {
      method: "POST",
      body: JSON.stringify(data),
    });

    this.alertForm.reset();
  }

  async loadSettings() {
    const values = await this.request("/api/settings");

    for (const [key, value] of Object.entries(values)) {
      const input = this.settingsForm.elements[key] || this.broadcastSettingsForm?.elements[key] || this.youtubeSettingsForm?.elements[key];
      if (!input) continue;

      if (input.type === "checkbox") {
        input.checked = value === "true";
      } else if (key !== "telegram_token") {
        input.value = value;
      }
    }
  }

  async saveSettings(event) {
    event.preventDefault();

    const formData = new FormData(this.settingsForm);
    const data = Object.fromEntries(formData);

    data.telegram_enabled =
      formData.has("telegram_enabled");
    data.weather_refresh_minutes =
      Number(data.weather_refresh_minutes || 15);

    const status = document.querySelector("#settingsStatus");

    try {
      await this.request("/api/settings", {
        method: "PUT",
        body: JSON.stringify(data),
      });

      status.textContent =
        "Saved. Restart RCA to reload the Telegram worker.";
    } catch (error) {
      status.textContent = error.message;
    }
  }

  async saveExtraSettings(event, form, statusId) {
    event.preventDefault();
    const current = await this.request("/api/settings");
    const fd = new FormData(form);
    const data = {...current};
    for (const el of form.elements) {
      if (!el.name) continue;
      if (el.type === "checkbox") data[el.name] = el.checked;
      else if (el.type === "number") data[el.name] = Number(el.value);
      else data[el.name] = el.value;
    }
    // Restore secrets if blank: backend keeps existing secret values.
    await this.request("/api/settings", {method:"PUT", body:JSON.stringify(data)});
    document.querySelector(`#${statusId}`).textContent = "Saved.";
  }

  async testWeatherTicker() {
    const status=document.querySelector("#broadcastStatus");
    try {
      await this.request("/api/alerts/test-weather", {method:"POST"});
      status.textContent="Test weather ticker sent to the TV.";
    } catch(error) { status.textContent=error.message; }
  }

  async connectYouTube() {
    const status=document.querySelector("#youtubeStatus");
    try {
      const result=await this.request("/api/youtube/auth-url");
      window.location.href=result.url;
    } catch(error) { status.textContent=error.message; }
  }

  async loadYouTubeSubscriptions() {
    const status=document.querySelector("#youtubeStatus");
    try {
      const subs=await this.request("/api/youtube/subscriptions");
      const box=document.querySelector("#youtubeSubscriptions"); box.innerHTML="";
      subs.forEach(sub => {
        const label=document.createElement("label"); label.className="check subscription-row";
        label.innerHTML=`<input type="checkbox" value="${this.escapeHtml(sub.channel_id)}"><span>${this.escapeHtml(sub.title)}</span>`;
        label.querySelector("input").addEventListener("change", () => this.applyYouTubeSelection());
        box.appendChild(label);
      });
      status.textContent=`Loaded ${subs.length} subscriptions. Select creators, then add a YouTube channel above.`;
    } catch(error) { status.textContent=error.message; }
  }

  applyYouTubeSelection() {
    const ids=[...document.querySelectorAll("#youtubeSubscriptions input:checked")].map(x=>x.value);
    this.sourceInput.value=JSON.stringify(ids);
    if (ids.length) this.sourceType.value="youtube";
    this.updateSourceControls();
  }

  escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }
}

new RCAAdmin().boot();
