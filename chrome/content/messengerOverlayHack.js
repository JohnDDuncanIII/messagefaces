window.addEventListener("load", onLoad, false);

function onLoad() {
	this._prefService = (
		Components.classes["@mozilla.org/preferences-service;1"]
			.getService(Components.interfaces.nsIPrefBranch)
	);
	mfColumnEnabled = this._prefService.getBoolPref(
		"extensions.messagefaces.column.enabled"
	);
	mfMailcheckEnabled = this._prefService.getBoolPref(
		"extensions.messagefaces.mailcheck.enabled"
	);
	mfNewscheckEnabled = this._prefService.getBoolPref(
		"extensions.messagefaces.newscheck.enabled"
	);

	// load the current file as an overlay
	callback = {
		observe: function(subject, topic, data) {
			if (topic == "xul-overlay-merged") {
				dump("Overlay loaded successfully");
			}
		}
	};

	if (mfColumnEnabled) {
		window.document.loadOverlay(
			"chrome://messagefaces/content/messengerOverlay.xul",
			callback
		);
	}

	if (mfMailcheckEnabled) {
		window.open(
			"chrome://messagefaces/content/mailcheck.xul",
			"Mailcheck",
			"chrome"
		);
	}

	if (mfNewscheckEnabled) {
		window.open(
			"chrome://messagefaces/content/newscheck.xul",
			"Newscheck",
			"chrome"
		);
	}
}
