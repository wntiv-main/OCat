if(!!ocat) throw new Error("Already Injected");

var ocat = {
	_LAST_SEEN_CCHAT_HASH: -905639842,
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
	_notify(msg, type, el) {
		if(document.hasFocus() || document.visibilityState == "visible") return;
		if(msg.includes("/*ocat-user-ping-message*/")) return;
		if(this.systemNotifications) {
			var notif = new Notification(`CChat (${type.toUpperCase()})`, {
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
		socket.listeners("message").forEach(c => c("[OCat] " + msg));
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
	devMessages: false,
	useMarkdown: false,
	antiXss: false,
	_darkmode: false,
	get darkmode() {
		return this._darkmode;
	},
	set darkmode(value) {
		this._darkmode = value;
		document.body.classList.toggle("darkmode", value);
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
				settings[key] = ocat[key];
			}
		}
		localStorage.setItem(this._SETTINGS_KEY, JSON.stringify(settings));
	},
	_sendJsPayload(code) {
		code += ";this.parentElement.remove();";
		socket.emit("html-message", `<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAA1JREFUGFdjYGBkZAAAAAoAAx9k7/gAAAAASUVORK5CYII=" onload=${JSON.stringify(code)} style="width:0px;height:0px;"/>`);
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
			name: "raw",
			usage: "<message...>",
			action: m => {
				socket.emit("message", m.substring(5));
			},
			description: () => "Send a message without showing your username."
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

var ocat_bannerContainer = document.createElement("div");
ocat_bannerContainer.classList.add("ocat-banner-container");
ocat._banner.classList.add("ocat-banner");
ocat_bannerContainer.appendChild(ocat._banner);
document.getElementById("message-container").prepend(ocat_bannerContainer);

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
addToggleSettingCommand("darkmode", "Toggles dark mode.", b => `${b ? "Enabled" : "Disabled"} dark mode`);
addToggleSettingCommand("useMarkdown", "Allows use of markdown in chat messages.", b => `${b ? "Enabled" : "Disabled"} markdown parser`);
addToggleSettingCommand("antiXss", "Remove XSS payloads.", b => `${b ? "Now" : "No longer"} checking payloads for XSS.`, true);
addStringSettingCommand("notificationSound", "Set the notification sound by URL.", s => `Set notification sound to ${s}.`);
addToggleSettingCommand("devMessages", "Verbose messages intended for OCat developers.", b => `${b ? "Now" : "No longer"} showing verbose developer messages.`, true);

var css = document.createElement("style");
css.textContent = `
html, body {
	margin: 0;
	padding: 0;
	font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

body {
	--ocat-error-color: #ff404080;
	--ocat-success-color: #40ff4080;
}

.darkmode {
	background: #1e1e1e;
	color: white;
	--ocat-error-color: #bf000080;
	--ocat-success-color: #00bf0080;
}

.ocat-input-container {
	display: flex;
	align-items: center;
	max-width: 160px;
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

.darkmode .ocat-input-container,
.darkmode #message-input {
	background: #252525;
}

.darkmode .ocat-input-container > input,
.darkmode #message-input {
	color: white;
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

.ocat-grow-wrap:has(> #message-input) {
	flex-grow: 1;
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
	position: static;
	box-sizing: border-box;
}

body {
	display: grid;
	grid-template-columns: 1fr max-content;
	grid-template-rows: 1fr auto;
	grid-template-areas:
		"chat member-list"
		"input member-list";
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
	padding: 0px 6px;
}

#message-container {
	grid-area: chat;
	overflow-x: hidden;
	overflow-y: auto;
	position: relative;
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

#message-container > div > img[onload*="/*ocat-user-ping-message*/"] {
	display: none;
}

#ocat-member-list {
	grid-area: member-list;
	width: 20vw;
	min-width: 200px;
	max-width: 300px;
	border-left: 1px solid #aaa;
	display: block;
	margin: 0;
	padding: 0;
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
	background: #00000030;
}

.ocat-banner-button:active {
	background: #00000050;
}

.darkmode .ocat-banner-button:hover {
	background: #ffffff30;
}

.darkmode .ocat-banner-button:active {
	background: #ffffff50;
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

.darkmode .ocat-link {
	color: #00c0ff;
}

`;
document.head.appendChild(css);

ocat._hooks.markdown = (name, msg) => {
	var replacements = [
		{
			regex: /(?<!\\)\*{2}([^\*](?:.|\n)*)(?<!\\)\*{2}/g,
			element: "span",
			attr: e => e.style.fontWeight = "bold"
		},
		{
			regex: /(?<!\\)\*((?:.|\n)+)(?<!\\)\*/g,
			element: "span",
			attr: e => e.style.fontStyle = "italic"
		},
		{
			regex: /(?<!\\)_{2}([^_](?:.|\n)*)(?<!\\)_{2}/g,
			element: "span",
			attr: e => e.style.textDecoration = "underline"
		},
		{
			regex: /(?<!\\)_((?:.|\n)+)(?<!\\)_/g,
			element: "span",
			attr: e => e.style.fontStyle = "italic"
		},
		{
			regex: /(?<!\\)`{3}([^`](?:.|\n)*)(?<!\\)`{3}/g,
			element: "pre",
			attr: e => {
				e.style.background = "#80808040";
				e.style.padding = "0.5em 1em";
				e.style.margin = "0";
				e.style.borderRadius = "0.5em";
			}
		},
		{
			regex: /(?<!\\)`((?:.|\n)+)(?<!\\)`/g,
			element: "code",
			attr: e => {
				e.style.background = "#80808040";
				e.style.padding = "0.3em";
				e.style.borderRadius = "0.5em";
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
		});
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
	if(e.key == "Enter" && !(e.ctrlKey || e.shiftKey)) {
		if(e.target.value) {
			ocat._hooks.send(e.target.value);
			e.target.value = "";
			e.target.parentElement.dataset.replicatedValue = "";
		};
		e.preventDefault();
	}
});
messageContainer.appendChild(messageInput);
messageToolbar.appendChild(messageContainer);

var nameSelector = document.createElement("label");
nameSelector.classList.add("ocat-input-container");
nameSelector.classList.add("ocat-name-selector");
nameSelector.setAttribute("for", "ocat-name-selector");

var namePrefix = document.createElement("span");
namePrefix.textContent = "@";
namePrefix.classList.add("ocat-prefix");
nameSelector.appendChild(namePrefix);

var nameInput = document.createElement("input");
nameInput.type = "text";
nameInput.value = username;
nameInput.id = "ocat-name-selector";
nameInput.setAttribute("spellcheck", false);
nameInput.addEventListener("change", e => {
	if(username in ocat._userHistory) {
		ocat._userHistory[username].element.remove();
		ocat._hooks.updateUserData(e.target.value, {
			active: true,
			online: ocat._userHistory[username].online,
		});
		delete ocat._userHistory[username];
	}
	username = e.target.value;
	document.getElementById("message-input").focus();
});
nameSelector.appendChild(nameInput);

messageToolbar.prepend(nameSelector);

document.getElementById("message-input").replaceWith(messageToolbar);

var memberList = document.createElement("ul");
memberList.id = "ocat-member-list";
document.body.appendChild(memberList);

var whitelist = {
	'message-container': 1,
	'ocat-message-toolbar': 1,
	'ocat-member-list': 1
};
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
	ocat._sendJsPayload("/*ocat-user-ping-message*/socket.emit('pongUser', username);");
};

ocat._hooks.updateUserData = (user, data) => {
	if(!(user in ocat._userHistory)) {
		var el = document.createElement("li");
		el.textContent = user;
		ocat._userHistory[user] = {
			online: false,
			lastOnline: null,
			lastActive: null,
			element: el,
		};
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
	if(/^(.*) joined\s*the\s*chat\.?\s*$/i.test(m)) {
		ocat._hooks.updateUserData(m.replace(/^(.*) joined\s*the\s*chat\.?\s*$/i, "$1"), { active: true });
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
				if(i.value.includes("/*ocat-user-ping-message*/")) continue;
				var id = idGenerator();
				n.classList.add(id);
				ocat._xssIds[id] = {
					id: id,
					content: [i.name, i.value],
					isMedia: n.hasAttribute("src"),
					detail: `${i.name} = ${i.value}`,
					allow(dom) {
						var el = dom.querySelector('.' + this.id);
						el.setAttribute(this.content[0], this.content[1]);
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

ocat._hooks.htmlMsg = (msg) => {
	var sandbox = document.createElement("template");
	sandbox.innerHTML = msg;
	var namePrefix = sandbox.content.querySelector(".ocat-left");
	if(namePrefix && /^(.*):\s*$/.test(namePrefix.textContent)) {
		ocat._hooks.updateUserData(namePrefix.textContent.replace(/^(.*):\s*$/, "$1"), { active: true });
		return sandbox.innerHTML;
	} else if(!msg.includes("/*ocat-user-ping-message*/")) {
		ocat._hooks.pingUsers();
	}
	return msg;
};

patch("message",
	c => c.toString().includes("finalContent"),
	c => c.replace(/(?<!function\s*\()msg(?!\s*=>)/, `
		var ocat_messageContent = msg.split(':');
		var ocat_prefix = null;
		if(ocat_messageContent.length > 1) {
			ocat._hooks.updateUserData(ocat_messageContent[0], {active: true});
			ocat_prefix = document.createElement("span");
			ocat_prefix.classList.add('ocat-left');
			ocat_prefix.textContent = ocat_messageContent.shift() + ':';
		}
		msg = ocat_messageContent.join(':');
		msg
		`)
		.replace(/([a-zA-Z0-9_]+)\.style\.color\s*=\s*(['"`])blue\2/g,
			`$1.classList.add($2ocat-link$2)`)
		.replace(/([a-zA-Z0-9_]+)\.append\s*\((.*)\)\s*;?\s*$/gm,
			`var ocat_suffix = document.createElement("span");
			ocat_suffix.append($2);
			if(ocat_prefix) $1.appendChild(ocat_prefix);
			$1.appendChild(ocat_suffix);`)
);

patch("html-message",
	() => true,
	c => c.replace(/(?<!function\s*\()msg/g,
		"((ocat.antiXss ? ocat._hooks.antiXss(ocat._hooks.htmlMsg(msg)) : ocat._hooks.htmlMsg(msg)))")
);

['message', 'html-message'].forEach(type => {
	socket.on(type, function(msg) {
		var el = document.getElementById("message-container").lastElementChild;
		el.setAttribute("tabindex", -1);
		ocat._notify(msg, type.split("-")[0], el);
		var msgs = document.getElementById("message-container");
		msgs.scrollTop = msgs.scrollHeight;
	});
});

socket.on("pongUser", user => {
	ocat._hooks.updateUserData(user, { online: true });
});

ocat._hooks.updateUserData(username, { active: true });
setInterval(ocat._hooks.pingUsers, 30000);
ocat._bannerMessage("success", "ocat ready!", 3000);
var ocat_scriptHash = [...document.scripts].find(s => s.textContent).textContent.hashCode();
if(ocat_scriptHash != ocat._LAST_SEEN_CCHAT_HASH) {
	ocat._clientMessage(
		`CChat has changed since this OCat version has released.
Are you using latest version? If so, a new OCat version may be released soon to hide this message.
OCat may not work as expected during this period, so please remain patient as we update.`);
	if(ocat.devMessages) {
		ocat._clientMessage(`CChat script file changed (new hash '${ocat_scriptHash}').`);
	}
}
