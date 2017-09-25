"use strict";

/*var w = Components.classes["@mozilla.org/appshell/window-mediator;1"]
    .getService(Components.interfaces.nsIWindowMediator).getMostRecentWindow("mail:3pane");
w.addEventListener("close", function( event ) {
    window.close();
}, false);*/

// get uri to current profile directory
var mfLocalFolder;
try {
    mfLocalFolder = mfPref.getComplexValue("local.folder", Components.interfaces.nsILocalFile);
}
catch (e) {
    mfLocalFolder = Components.classes["@mozilla.org/file/directory_service;1"]
        .getService(Components.interfaces.nsIProperties)
        .get("ProfD", Components.interfaces.nsIFile);
    var p = mfLocalFolder.permissions;
    mfLocalFolder.append("messagefaces");
    if (!mfLocalFolder.exists()) {
        mfLocalFolder.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, p);
    }
}

// globals for picon searches (mainly used to check if a file exists in the picon database)
var mfIOService = Components.classes["@mozilla.org/network/io-service;1"]
    .getService(Components.interfaces.nsIIOService);
var mfFileHandler = mfIOService.getProtocolHandler("file")
    .QueryInterface(Components.interfaces.nsIFileProtocolHandler);

// global to get account-related information
var acctMgr = Components.classes["@mozilla.org/messenger/account-manager;1"]
    .getService(Components.interfaces.nsIMsgAccountManager);
var accounts = acctMgr.accounts;

// update message counts when new messages are received
Components.utils.import("resource:///modules/gloda/mimemsg.js");
var newNewsListener = {
    msgAdded: function(aMsgHdr) {
	var folder = aMsgHdr.folder;
	newsCheck(folder);
	if(window.name == "Newscheck") { // prevent browser window from resizing if loaded in tab
	    window.resizeTo(container.boxObject.width, container.boxObject.height);
	}
    }
};
var notificationService = Components.classes["@mozilla.org/messenger/msgnotificationservice;1"]
    .getService(Components.interfaces.nsIMsgFolderNotificationService);
notificationService.addListener(newNewsListener, notificationService.msgAdded);

// update message counts when a message is read inside of a folder
Components.utils.import("resource:///modules/mailServices.js", this);
var newsListener = {
    OnItemIntPropertyChanged: function(aItem, aProperty, aOldValue, aNewValue) {
	if (//aProperty.toString() == "FolderSize" ||
	    //aProperty.toString() == "TotalMessages" ||
	    aProperty.toString() == "TotalUnreadMessages") {
	    if(aItem.URI.includes("news://")) {
		newsCheck(aItem);
		if(window.name == "Newscheck") { // prevent browser window from resizing if loaded in tab
		    window.resizeTo(container.boxObject.width, container.boxObject.height);
		}
	    }
	}
    },
};
var notifyFlags = Components.interfaces.nsIFolderListener.intPropertyChanged;
MailServices.mailSession.AddFolderListener(newsListener, notifyFlags);

// used for iterating over msgHdr's in a given Inbox
Components.utils.import("resource:///modules/iteratorUtils.jsm");

// remove all listeners when we kill the window
window.addEventListener("close", function( event ) {
    MailServices.mailSession.RemoveFolderListener(newsListener);
    notificationService.removeListener(newNewsListener);
}, false);

// the container (in our newscheck XUL window) that will be populated with account folder picons
var container = document.getElementById("container");
// denotes whether or not the mailcheck XUL window has been populated
var populate = true;

function news() {
    if (accounts.queryElementAt) {
	// Gecko 17+
	for (var i = 0; i < accounts.length; i++) {
	    var account = accounts.queryElementAt(i, Components.interfaces.nsIMsgAccount);
	    var rootFolder = account.incomingServer.rootFolder; // nsIMsgFolder

	    if (rootFolder.hasSubFolders && rootFolder.URI.includes("news://")) {
		var folderContainer = document.getElementById(rootFolder.abbreviatedName);
		if(!folderContainer) {
		    folderContainer = document.createElement("hbox");
		    folderContainer.setAttribute("id", rootFolder.abbreviatedName);
		    container.appendChild(folderContainer);
		}

		var subFolders = rootFolder.subFolders; // nsIMsgFolder

		var status = document.createElement("hbox");
		status.className = "faces";

		var a = document.createElementNS('http://www.w3.org/1999/xhtml', 'a');
		var vbox = document.createElement("vbox");
		var hbox = document.createElement("hbox");
		var image = document.createElement("image");

		if(rootFolder.getNumUnread(true) != 0 ) {
		    src = "images/news.gif";
		} else {
		    src = "images/news_none.gif";
		}

		vbox.setAttribute("tooltiptext", rootFolder.prettiestName);
		a.href = rootFolder.URI;
		image.setAttribute("src", src);
		image.setAttribute("id", rootFolder.prettiestName + "-image");

		hbox.appendChild(image);
		vbox.appendChild(hbox);
		a.appendChild(vbox);
		status.appendChild(a);
		folderContainer.appendChild(status);

		while(subFolders.hasMoreElements()) {
		    var folder = subFolders.getNext().QueryInterface(Components.interfaces.nsIMsgFolder);
		    var prettyName = folder.prettiestName;
		    var numUnread = folder.getNumUnread(true);
		    var abbrName = folder.abbreviatedName;
		    var URI = folder.URI;

		    var faces = document.getElementById(rootFolder.prettiestName + "-faces");
		    if(!faces) {
			var faces = document.createElement("hbox");
			faces.className = "faces";
			faces.setAttribute("id", rootFolder.prettiestName + "-faces");
			folderContainer.appendChild(faces);
		    }

		    var a = document.createElementNS('http://www.w3.org/1999/xhtml', 'a');
		    var vbox = document.createElement("vbox");
		    var hbox = document.createElement("hbox");
		    var image = document.createElement("image");
		    var label = document.createElement("label");

		    vbox.setAttribute("tooltiptext", prettyName);
		    var src = doNewsSearch(prettyName, numUnread);
		    a.href = URI;
		    var lbl = numUnread + " " + abbrName;
		    label.setAttribute("value", lbl.substring(0, 9));
		    label.setAttribute("id",  URI + "-label");
		    image.setAttribute("src", src);
		    image.setAttribute("id", prettyName);

		    hbox.appendChild(image);
		    vbox.appendChild(hbox);
		    vbox.appendChild(label);
		    a.appendChild(vbox);
		    faces.appendChild(a);

		    newsCheck(folder);
		}
	    }
	}
    } else {
	// Gecko < 17
	for (var i = 0; i < accounts.Count(); i++) {
	    var account = accounts.QueryElementAt(i, Components.interfaces.nsIMsgAccount);
	}
    }
}

news();
populate = false;

function newsCheck(folder) {
    var prettyName = folder.prettiestName;
    var numUnread = folder.getNumUnread(true);
    var abbrName = folder.abbreviatedName;
    var URI = folder.URI;

    var rootFolder = folder.parent;

    var label = document.getElementById(URI + "-label");
    var lbl = numUnread + " " + abbrName;
    if(label) {
	label.setAttribute("value", lbl.substring(0, 10));
    }

    var image = document.getElementById(prettyName);
    var src = doNewsSearch(prettyName, numUnread);
    image.setAttribute("src", src);

    var rootImage = document.getElementById(rootFolder.prettiestName + "-image");
    if(rootFolder.getNumUnread(true) != 0 ) {
	src = "images/news.gif";
    } else {
	src = "images/news_none.gif";
    }
    rootImage.setAttribute("src", src);
}

function doNewsSearch(prettyName, numUnread) {
    var host_pieces = prettyName.split('.');
    var localFile = mfLocalFolder.clone();
    localFile.append("picons");
    localFile.append("news");

    var clonedLocal;
    var src = "";
    for (var j=0; j < host_pieces.length; j++) {
	localFile.append(host_pieces[j]);
	clonedLocal = localFile.clone();
	localFile.append("unknown");
	localFile.append("face.gif");

	if (localFile.exists()) {
	    src = mfFileHandler.getURLSpecFromFile(localFile);
	}
	localFile = clonedLocal.clone(); // revert back to old local URL (before above modifications)
    }

    if(src == "") {
	var defaultMisc = mfLocalFolder.clone();
	defaultMisc.append("picons");

	if(numUnread > 0) {
	    defaultMisc.append("news");
	    defaultMisc.append("MISC");
	    defaultMisc.append("news");
	} else {
	    defaultMisc.append("news");
	    defaultMisc.append("MISC");
	    defaultMisc.append("nonews");
	}

	defaultMisc.append("face.gif");
	src = mfFileHandler.getURLSpecFromFile(defaultMisc);
    }

    return src;
}
