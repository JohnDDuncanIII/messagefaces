window.addEventListener("load", doOnceLoaded, false);

//var load = {};

function doOnceLoaded() {
	//window.alert("loaded");
	this._prefService = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
	mfColumnEnabled = this._prefService.getBoolPref("extensions.messagefaces.column.enabled");

	//window.removeEventListener("load", load, false);

	// Load an overlay file var 
	callback = { 
		observe : function (subject, topic, data) { 
			if (topic == 'xul-overlay-merged') { 
				dump("Overlay loaded successfully"); 
			} 
		} 
	}; // Load the current file as an overlay 

	if(mfColumnEnabled) {
		window.document.loadOverlay("chrome://messagefaces/content/messengerOverlay.xul", callback);
	}
}
