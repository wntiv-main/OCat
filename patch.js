if(!!ocat) throw new Error("Already Injected");

var ocat = {
	_LAST_SEEN_CCAT_HASH: -582121614,
	_START_TIME: Date.now(),
	_EMPTY_IMAGE_URL: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAA1JREFUGFdjYGBkZAAAAAoAAx9k7/gAAAAASUVORK5CYII=",
	_USER_SEPERATOR: "\n",
	_SAFE_TO_SAVE: false,
	_extractUserMessage(msg, callback) {
		var matched = false;
		msg.replace(/^(?:-?(?<username>.*?)-?(?:\n|: ))?(?<message>(?:.|\n)*)$/, (...args) => {
			var groups = args.pop();
			callback(groups.username, groups.message);
			matched = true;
			return '';
		});
		if(!matched) callback(undefined, msg);
	},
	_decorateName(username) {
		return `-${username}-`;
	},
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
	_favicon: null,
	_getFavicon(callback) {
		if(this._favicon) return callback(this._favicon);
		var favicon = "/favicon.ico";
		var nodeList = document.getElementsByTagName("link");
		for(var i = 0; i < nodeList.length; i++) {
			if(nodeList[i].getAttribute("rel").includes("icon")) {
				favicon = nodeList[i].href;
			}
		}
		var img = new Image();
		img.addEventListener("load", function(e) {
			ocat._favicon = e.currentTarget;
			callback(ocat._favicon);
		});
		img.src = favicon;
	},
	_faviconCanvas: new OffscreenCanvas(32, 32).getContext('2d', {
		willReadFrequently: true
	}),
	_faviconUrl: null,
	_unreads: 0,
	_updateFavicon() {
		this._getFavicon(img => {
			var w = this._faviconCanvas.canvas.width;
			var h = this._faviconCanvas.canvas.height;
			this._faviconCanvas.clearRect(0, 0, w, h);
			this._faviconCanvas.drawImage(img, 0, 0, w, h);
			if(this._unreads) {
				this._faviconCanvas.fillStyle = "#ff0000";
				this._faviconCanvas.arc(w * 2 / 3, h * 2 / 3, (w + h) / 2 / 3, 0, Math.PI * 2);
				this._faviconCanvas.fill();
				this._faviconCanvas.font = `${(w + h) / 2 / 3 * 2 * 3 / 4}px sans-serif`;
				this._faviconCanvas.textAlign = "center";
				this._faviconCanvas.textBaseline = "middle";
				this._faviconCanvas.fillStyle = "#ffffff";
				this._faviconCanvas.fillText(`${this._unreads < 9 ? this._unreads : "9+"}`, w * 2 / 3, h * 2 / 3 + 1);
			}
			this._faviconCanvas.canvas.convertToBlob().then(blob => {
				if(this._faviconUrl) URL.revokeObjectURL(this._faviconUrl);
				this._faviconUrl = URL.createObjectURL(blob);
				var link = document.querySelector("link[rel~='icon']");
				if(!link) {
					link = document.createElement('link');
					link.rel = 'icon';
					document.head.appendChild(link);
				}
				link.href = this._faviconUrl;
			});
		});
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
		if(msg.includes("anti-flow-message")) return;
		this._unreads++;
		this._updateFavicon();
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
		socket.listeners("message").forEach(c => c(null, -1, `[OCat]${ocat._USER_SEPERATOR}${msg}`));
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
	_compactMode: false,
	get compactMode() {
		return this._compactMode;
	},
	set compactMode(value) {
		this._compactMode = value;
		document.body.classList.toggle("ocat-compact-mode", value);
	},
	useMarkdown: false,
	showAllMessages: false,
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
			socket.emit("message", null, `${username} Left The Chat. \u{1F44B}`);
		} else {
			socket.emit("message", null, `${username} Joined The Chat. \u{1F44B}`);
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
			itemEl.addEventListener("click", function(e) {
				e.stopPropagation();
				item.action(e);
				e.currentTarget.parentElement.remove();
			});
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
			this._clientMessage(`Error: ${e.currentTarget.errorCode}`);
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
				const db = e.currentTarget.result;
				db.onversionchange = e => {
					e.currentTarget.close();
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
				this._database = e.currentTarget.result;
				if(!this._database.objectStoreNames.contains("files")) {
					this._dbUnsafe++;
					var req = indexedDB.deleteDatabase("ocat-db");
					req.onsuccess = function() {
						location.reload();
					};
				}
				this._database.onversionchange = e => {
					e.currentTarget.close();
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
					callback(e.currentTarget.result.blob);
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
					const cursor = e.currentTarget.result;
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
					if(this._isLight(e.currentTarget)) {
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
		button.addEventListener("contextmenu", function(e) {
			ocat._showContextMenu(e, [
				{
					label: "Remove",
					classes: ["ocat-important-action"],
					action() {
						ocat._removeFile(hash);
						URL.revokeObjectURL(iconUrl);
						e.currentTarget.remove();
					}
				}
			]);
		});
		button.addEventListener("click", function(e) {
			e.stopPropagation();
			document.getElementById("ocat-theme-tooltip").classList.toggle("ocat-active", false);
			ocat.theme = `custom-background("${hash}")`;
			ocat._saveSettings();
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
		if(!this._SAFE_TO_SAVE) return;
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
		img.classList.add("anti-flow-message");
		img.src = "://__OCAT_IMAGE_SRC_GOES_HERE__";
		img.setAttribute("onload", code);
		if(persistant) img.classList.add("ocat-persistant");
		img.style.width = 0;
		img.style.height = 0;
		socket.emit("html-message", currentRoom, img.outerHTML.replace(/(src\s*=\s*(['"]?)).*?:\/\/__OCAT_IMAGE_SRC_GOES_HERE__\2 /, `$1${this._EMPTY_IMAGE_URL}$2`));
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
	_chatIds: new Set(),
	get chatIds() {
		return this._chatIds;
	},
	set chatIds(value) {
		if(value instanceof Array) value = new Set(value);
		this._chatIds = value;
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
				socket.emit("message", currentRoom, m.substring(5));
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
				ocat._sendJsPayload(`if(username=='${target}'){socket.listeners('message').forEach(c=>c(null, -1, ${JSON.stringify(`[DM] -${username} -> ${target}-${ocat._USER_SEPERATOR}${args.join(" ")}`)}));socket.emit("delete-message", this.parentElement.dataset.messageId)}`, true);
				socket.listeners('message').forEach(c => c(null, -1, `[DM] -${username} -> ${target}-${ocat._USER_SEPERATOR}${args.join(" ")}`))
			},
			description: () => "Send a private message to the specified user."
		},
		{
			name: "html",
			usage: "<content...>",
			action: m => {
				socket.emit("html-message", currentRoom, m.substring(6));
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
			name: "share-ocat",
			action: m => {
				// socket.emit("message", `Install ocat: javascript:fetch('https://raw.githubusercontent.com/wntiv-main/ocat/main/patch.js').then(r=>r.text().then(eval));`, room);
				socket.emit("html-message", currentRoom,
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
		{
			name: "clear-chat-ids",
			action: m => {
				ocat._chatIds.clear();
				ocat._saveSettings();
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
ocat_bannerContainer.id = "ocat-banner-container";
ocat._banner.classList.add("ocat-banner");
ocat_bannerContainer.appendChild(ocat._banner);
document.getElementById("message-container").prepend(ocat_bannerContainer);

document.addEventListener("visibilitychange", () => {
	if(document.visibilityState === "visible") {
		// The tab has become visible so clear the now-stale Notification.
		if(ocat._currentNotification)
			ocat._currentNotification.close();
		ocat._unreads = 0;
		ocat._updateFavicon();
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
addToggleSettingCommand("compactMode", "Shows messages on a single line.", b => `${b ? "Now" : "No longer"} using compact mode.`);
addToggleSettingCommand("useMarkdown", "Allows use of markdown in chat messages.", b => `${b ? "Enabled" : "Disabled"} markdown parser`);
addToggleSettingCommand("antiXss", "Remove XSS payloads.", b => `${b ? "Now" : "No longer"} checking payloads for XSS.`, true);
addToggleSettingCommand("silentTyping", "Do not show users that you are typing.", b => `${b ? "Now" : "No longer"} silently typing.`);
addToggleSettingCommand("showAllMessages", "Show all messages from all channels.", b => `${b ? "Now" : "No longer"} showing all messages.`, true);
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

#message-input {
	width: unset;
	height: unset;
	border-radius: unset;
}

#message-container {
	margin-left: unset;
	padding-left: unset;
}

#message-container > div {
	margin-bottom: unset;
	border: unset;
	width: unset;
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

#message-container > div:not(#ocat-banner-container) {
	max-width: 100%;
	overflow-x: auto;
	white-space: pre-line;
	position: relative;
	padding: 12px 24px;
}

#message-container > div:not(#ocat-banner-container):focus {
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

#typing-users::before,
#typing-users.show-dots::before {
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

#message-container > div:not(#ocat-banner-container) {
	padding: 12px;
}

#message-container > div:not(#ocat-banner-container):nth-of-type(odd) {
	background: #80808020;
}

#message-container > div:not(#ocat-banner-container):hover {
	background: #80808040;
}

#message-container > div > .ocat-left {
	display: block;
}

.ocat-compact-mode #message-container > div:has(> .ocat-left) {
	display: flex;
}

.ocat-compact-mode #message-container > div > .ocat-left {
	display: inline;
	margin-right: 0.5ch;
	min-width: max-content;
}

.ocat-compact-mode #message-container > div > .ocat-left::after {
	content: ":";
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
	display: flex;
	flex-direction: column;
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
	display: flex;
}

#ocat-member-list li::after {
	content: "#" attr(data-ocat-room-id);
	color: #777;
	font-size: 0.8em;
	text-transform: uppercase;
	order: 2;
}

#ocat-member-list li:not(.ocat-typing)::after {
	margin-left: auto;
}

#ocat-member-list li:hover::after {
	text-decoration: underline;
}

#ocat-member-list li:hover {
	background: #80808020;
}

#ocat-member-list li.ocat-online {
	border-left: 10px solid green;
	order: -1;
}

#ocat-member-list li.ocat-typing::before {
	content: "";
	background-image: url(https://assets-v2.lottiefiles.com/a/57f6e96a-117f-11ee-b56d-e33bc9416452/ibgqn49kqf.gif);
	width: 1em;
	height: 1em;
	display: inline-block;
	background-size: contain;
	transform: scale(1.2, -1.2) translateY(-33%);
	margin-right: 0.5em;
	margin-left: auto;
	order: 1;
	filter: invert(1) brightness(0.5) blur(0.3px);
}

.ocat-footer-room-id {
	color: #777;
	font-size: 0.8em;
}

#ocat-banner-container {
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

.ocat-system-message {
	color: #777;
	font-size: 0.8em;
	text-align: center;
	justify-content: center;
	padding: 8px;
}

.opal-footer-room-id::after {
	color: #777;
	font-size: 0.8em;
}

.ocat-room-id::before {
	content: "[#" attr(ocat-room-id);
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
		},
	];
	var sandbox = document.createElement("span");
	sandbox.textContent = msg;

	var namePrefix = document.createElement("span");
	namePrefix.textContent = `${ocat._decorateName(name)}`;
	namePrefix.classList.add('ocat-left');

	var escapedContent = sandbox.outerHTML;
	var matched = false;
	// Special case: block quote
	escapedContent = escapedContent.replace(/(^> .*$\s*)+/gm, match => {
		matched = true;
		var el = document.createElement("blockquote");
		el.style.margin = 0;
		el.style.padding = "8px";
		el.style.borderRadius = "8px";
		el.style.background = "#80808030";
		el.style.borderLeft = "8px solid #202020";
		el.innerHTML = match.replace(/^> /gm, "");
		return el.outerHTML;
	});
	//
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
		socket.emit('html-message', currentRoom, namePrefix.outerHTML + escapedContent);
	} else {
		socket.emit('message', currentRoom, `${ocat._decorateName(name)}${ocat._USER_SEPERATOR}${msg}`);
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
		socket.emit('message', currentRoom, `${ocat._decorateName(username)}${ocat._USER_SEPERATOR}${msg}`);
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
	e.currentTarget.parentNode.dataset.replicatedValue = e.currentTarget.value;
});
messageInput.addEventListener("keypress", e => {
	if(!ocat.silentTyping) {
		socket.emit("typing", currentRoom, username, true);
		clearTimeout(typingIdle);
		typingIdle = setTimeout(() => socket.emit("typing", currentRoom, username, false), 3e3);
	}
	if(e.key == "Enter" && !(e.ctrlKey || e.shiftKey)) {
		if(e.currentTarget.value) {
			ocat._hooks.send(e.currentTarget.value);
			e.currentTarget.value = "";
			e.currentTarget.parentElement.dataset.replicatedValue = "";
			if(!ocat.silentTyping) socket.emit("typing", currentRoom, username, false);
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
		username = e.currentTarget.value;
		localStorage.username = username;
	});
}
ocat._oldUsername = username;
nameInput.id = "ocat-name-selector";
nameInput.setAttribute("spellcheck", false);
nameInput.addEventListener("change", e => {
	if(ocat._oldUsername in ocat._userHistory) {
		ocat._userHistory[ocat._oldUsername].element.remove();
		ocat._hooks.updateUserData(e.currentTarget.value, {
			room: currentRoom,
			online: ocat._userHistory[ocat._oldUsername].online,
		});
		delete ocat._userHistory[ocat._oldUsername];
	}
	ocat._oldUsername = username;
	document.getElementById("message-input").focus();
});
nameSelector.appendChild(nameInput);

messageToolbar.prepend(nameSelector);

var roomSelector = document.createElement("label");
roomSelector.classList.add("ocat-input-container");
roomSelector.classList.add("ocat-room-selector");
roomSelector.setAttribute("for", "ocat-room-selector");

var roomPrefix = document.createElement("span");
roomPrefix.textContent = "#";
roomPrefix.classList.add("ocat-prefix");
roomSelector.appendChild(roomPrefix);

var roomInput = document.createElement("input");
roomInput.type = "text";
roomInput.placeholder = currentRoom;
roomInput.value = "";
roomInput.id = "ocat-room-selector";
roomInput.setAttribute("spellcheck", false);
roomInput.setAttribute("list", "ocat-room-selector-data");
roomSelector.appendChild(roomInput);

var inputData = document.createElement("datalist");
inputData.id = "ocat-room-selector-data";
ocat._hooks.addChatId = function(id) {
	if(!id || ocat._chatIds.has(id)) return;
	ocat._chatIds.add(id);
	ocat._saveSettings();
	var option = document.createElement("option");
	option.value = id;
	inputData.appendChild(option);
};
roomInput.addEventListener("change", e => {
	if(!e.currentTarget.value) return;
	gotoRoom(e.currentTarget.value);
	roomInput.value = "";
	document.getElementById("message-input").focus();
});
ocat._roomInput = roomInput;
roomSelector.appendChild(inputData);
messageToolbar.prepend(roomSelector);

var ocat_patchGotoRoom = gotoRoom.toString()
	.replace(/(location\.replace)/g, "if(!location.href || location.href.substring(1) != room) $1")
	.replace("{", `{
		if(room == currentRoom) return;
		ocat._hooks.addChatId(room);
		ocat._roomInput.placeholder = room;
		document.getElementById("message-container").replaceChildren(document.getElementById("ocat-banner-container"));
		socket.emit("message-history", room);
		ocat._hooks.updateUserData(username, { room: room });`);
gotoRoom = (new Function(`return (${ocat_patchGotoRoom})`))();

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
	e.currentTarget.style.setProperty("--ocat-theme-scroll", `${e.currentTarget.scrollLeft}px`);
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

(async (themeTooltip) => {
	var response = await fetch("/user-settings");
	var userSettingsDoc = (new DOMParser).parseFromString(
		await response.text(),
		response.headers.get("Content-Type"));
	themeTooltip.prepend(...[...userSettingsDoc.querySelectorAll("button.themebutton")].map(el => {
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
		return themeButton;
	}));
})(themeSelectorTooltip);

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
			ocat_iconContext.drawImage(e.currentTarget, hPad, vPad, img.naturalWidth - 2 * hPad, img.naturalHeight - 2 * vPad, 0, 0, 32, 32);
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
	var buttons = [...e.currentTarget.parentElement.querySelectorAll(":scope .ocat-theme-button")];
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
	socket.emit("html-message", null, `<img class="ocat-user-ping-message anti-flow-message" src="${ocat._EMPTY_IMAGE_URL}" onload="socket.emit('pongUser', username, currentRoom);this.parentElement.remove();" style="width:0px;height:0px;"/>`);
};

ocat._hooks.updateUserData = (user, data) => {
	if(!(user in ocat._userHistory)) {
		if(user.startsWith("[DM] ")) return;
		if(user.startsWith("[OCat]") || user == "Help") return;
		var el = document.createElement("li");
		el.textContent = user;
		ocat._userHistory[user] = {
			online: false,
			room: null,
			lastOnline: null,
			lastActive: null,
			element: el,
		};
		el.addEventListener("click", e => {
			gotoRoom(ocat._userHistory[e.currentTarget.textContent]);
		});
		el.addEventListener("contextmenu", e => ocat._showContextMenu(e, [
			{
				label: `DM ${e.currentTarget.textContent}`,
				action: ((user) => {
					var msgInput = document.getElementById("message-input");
					msgInput.value = `/dm ${user} ${msgInput.value}`;
				}).bind(null, e.currentTarget.textContent)
			},
			ocat._userHistory[e.currentTarget.textContent].room ? {
				label: `Go to #${ocat._userHistory[e.currentTarget.textContent].room}`,
				action: ((user) => {
					gotoRoom(ocat._userHistory[user].room);
				}).bind(null, e.currentTarget.textContent)
			} : null,
			{
				label: ocat.blockedUsers.has(e.currentTarget.textContent) ? "Unblock" : "Block",
				action: ((user) => {
					if(!ocat.blockedUsers.delete(user)) {
						ocat.blockedUsers.add(user);
					}
				}).bind(null, e.currentTarget.textContent)
			}
		]));
		memberList.appendChild(el);
	}
	if("online" in data && ocat._userHistory[user].online != data.online) {
		ocat._userHistory[user].online = data.online;
		ocat._userHistory[user].element.classList.toggle("ocat-online", data.online);
		ocat._userHistory[user].lastOnline = Date.now();
	}
	if("room" in data) {
		ocat._userHistory[user].lastActive = Date.now();
		ocat._userHistory[user].room = data.room;
		ocat._userHistory[user].element.dataset.ocatRoomId = data.room;
		if(!ocat._userHistory[user].online) ocat._hooks.pingUsers();
	}
	if("typing" in data && ocat._userHistory[user].typing != data.typing) {
		ocat._userHistory[user].typing = data.typing;
		ocat._userHistory[user].element.classList.toggle("ocat-typing", data.typing);
		ocat._userHistory[user].lastActive = Date.now();
	}
};

ocat._hooks.possibleConnectMessage = (m) => {
	if(/^(.*) joined\s*the\s*chat.*$/i.test(m)) {
		ocat._hooks.pingUsers();
	}
	if(/^(.*) left\s*the\s*chat.*$/i.test(m)) {
		ocat._hooks.updateUserData(m.replace(/^(.*) left\s*the\s*chat.*$/i, "$1"), { online: false });
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

ocat._hooks.htmlMsg = (msg, id, room) => {
	var sandbox = document.createElement("template");
	sandbox.innerHTML = msg;
	var namePrefix = sandbox.content.querySelector(".ocat-left");
	var ping = sandbox.content.querySelector(".ocat-user-ping-message");
	var js = sandbox.content.querySelector("img[onload]");
	if(namePrefix && /^-?(.*?)-?(?::\s*|\n\s*)?$/.test(namePrefix.textContent)) {
		var name = namePrefix.textContent.replace(/^-?(.*?)-?(?::\s*|\n\s*)?$/, "$1");
		ocat._hooks.updateUserData(name, { room: room });
		if(ocat.showAllMessages) {
			namePrefix.dataset.ocatRoomId = room || "GLOBAL";
			namePrefix.classList.add("ocat-room-id");
		}
		if(ocat.blockedUsers.has(name)) {
			namePrefix.classList.add("ocat-blocked");
		}
	} else if(!ping) {
		ocat._hooks.pingUsers();
	}
	if(ping || (js && js.getAttribute("onload").includes("this.parentElement.remove()") && !js.classList.contains("ocat-persistant"))) {
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
	if(type.toUpperCase() == "CHAT"
		&& (/^(.*[^:\n]) joined\s*the\s*chat.*\.?\s*$/i.test(msg)
			|| /^(.*[^:\n]) left\s*the\s*chat.*\.?\s*$/i.test(msg))) {
		el.classList.add("ocat-system-message");
	}
	if(ocat.showAllMessages && !el.classList.contains("anti-flow-message") && type.toUpperCase() == "HTML" && !el.querySelector(":scope > .ocat-left")) {
		el.dataset.ocatRoomId = room || "GLOBAL";
		el.classList.add("ocat-footer-room-id");
	}
	el.addEventListener("contextmenu", e => ocat._showContextMenu(e, [
		{
			label: "Edit",
			action: ((el) => {
				el.setAttribute("contenteditable", true);
				el.addEventListener("keypress", e => {
					if(e.key == "Enter" && !(e.ctrlKey || e.shiftKey)) {
						el.removeAttribute("contenteditable");
						ocat._editMessage(e.currentTarget.dataset.messageId, el.innerHTML);
						e.preventDefault();
					}
				});
			}).bind(null, e.currentTarget)
		},
		{
			label: "Delete",
			classes: ["ocat-important-action"],
			action: ((id) => {
				ocat._deleteMessage(id);
			}).bind(null, e.currentTarget.dataset.messageId)
		}
	]));
	ocat._notify(msg, type, el);
	return !document.querySelector(`#message-container > div[data-message-id="${id}"]`);
}

patch("message",
	c => c.toString().includes("finalContent"),
	c => c.replace(/(?<!function\s*\((?:[a-zA-Z_0-9]+(?:\s*=(?!>)\s*.*?)?,\s*)*)msg(?!(?:,\s*[a-zA-Z_0-9]+(?:\s*=(?!>)\s*.*?)?)*\)?\s*=>)/, `
		var ocat_prefix = null;
		ocat._extractUserMessage(msg, function(uname, newMsg) {
			if(uname) {
				ocat._hooks.updateUserData(uname, {room: room});
				ocat_prefix = document.createElement("span");
				if(ocat.blockedUsers.has(uname)) ocat_prefix.classList.add('ocat-blocked');
				ocat_prefix.classList.add('ocat-left');
				ocat_prefix.textContent = ocat._decorateName(uname);
				if(ocat.showAllMessages) {
					ocat_prefix.dataset.ocatRoomId = room || "GLOBAL";
					ocat_prefix.classList.add("ocat-room-id");
				}
				msg = newMsg;
			} else if (ocat.showAllMessages) {
				ocat_prefix = document.createElement("span");
				ocat_prefix.classList.add('ocat-left');
				ocat_prefix.dataset.ocatRoomId = room || "GLOBAL";
				ocat_prefix.classList.add("ocat-room-id");
			}
		});
		msg`)
		.replace(/if\s*\((.*?)\)/, "if(($1) && !ocat.showAllMessages)")
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
		.replace(/(?<!function\s*\((?:[a-zA-Z_0-9]+(?:\s*=(?!>)\s*.*?)?,\s*)*)msg(?!(?:,\s*[a-zA-Z_0-9]+(?:\s*=(?!>)\s*.*?)?)*\)?\s*=>)/g,
			"((ocat.antiXss ? ocat._hooks.antiXss(ocat._hooks.htmlMsg(msg, id, room)) : ocat._hooks.htmlMsg(msg, id, room)))")
		.replace(/if\s*\((.*?)\)/, "if(($1) && !ocat.showAllMessages)")
		// .replace(/^\s*(function\s*)\(((?:[a-zA-Z_0-9]+(?:\s*=\s*.*?)?),?\s*)*\)/, "$1($2, ocat_id)")
		// .replace(/^\s*\(?((?:[a-zA-Z_0-9]+(?:\s*=(?!>)\s*.*?)?,?\s*)*)\)?(\s*=>)/, "($1, ocat_id)$2")
		.replace(/(document\.getElementById\((['"`])message-container\2\).appendChild)\((.*)\)/,
			`var ocat_messageContainer = ($3);
			if(ocat._hooks.onMessageContainer(ocat_messageContainer, msg, id, "HTML"))
				$1(ocat_messageContainer)`)
);

patch("typing",
	() => true,
	c => c.replace("{", "{if(user==username)return;")
);

['message', 'html-message'].forEach(type => {
	socket.on(type, function(room, id, msg) {
		ocat._hooks.addChatId(room);
		var msgs = document.getElementById("message-container");
		if(msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 100 + msgs.lastElementChild.getBoundingClientRect().height || Date.now() - ocat._START_TIME < 10e3)
			msgs.scrollTop = msgs.scrollHeight;
	});
});

socket.on("typing", (room, user, typing) => {
	ocat._hooks.updateUserData(user, { room: room, typing: !!typing });
});

socket.on("pongUser", (user, id, room) => {
	socket.emit("delete-message", id);
	if(user)
		ocat._hooks.updateUserData(user, { online: true, room: room });
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
ocat._SAFE_TO_SAVE = true;
ocat._saveSettings();
[...ocat.chatIds].forEach(id => {
	var option = document.createElement("option");
	// option.text = `#${id}`;
	option.value = id;
	inputData.appendChild(option);
});
ocat._hooks.addChatId("main");
ocat._hooks.addChatId(currentRoom);

if(!ocat.notificationSound)
	ocat.notificationSound = "https://cdn.pixabay.com/download/audio/2023/03/18/audio_900b6765ed.mp3?filename=the-notification-email-143029.mp3";

window.addEventListener("click", e => {
	[...document.getElementsByClassName("ocat-active")].forEach(el => {
		el.classList.remove("ocat-active");
	});
	[...document.getElementsByClassName("ocat-context-menu")].forEach(el => el.remove());
});

document.getElementById("message-container").scrollTop = document.getElementById("message-container").scrollHeight;

window.addEventListener("hashchange", e => {
	gotoRoom(location.hash ? location.hash.substring(1) : 'main');
});

socket.emit("message-history", currentRoom);
ocat._hooks.updateUserData(username, { room: currentRoom });
setInterval(ocat._hooks.pingUsers, 30000);
ocat._bannerMessage("success", "ocat ready!", 3000);
setTimeout(() => {
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
}, 3000);
