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

// the container (in our newscheck XUL window) that will be populated with account folder picons
var container = document.getElementById("container");
// whether or not the newscheck XUL window has been populated already
var populate = true;


// update message counts when new messages are received
Components.utils.import("resource:///modules/gloda/mimemsg.js");
var newMailListener = {
    msgAdded: function(aMsgHdr) {
	/*if( !aMsgHdr.isRead ){
	  MsgHdrToMimeMessage(aMsgHdr, null, function (aMsgHdr, aMimeMessage) {
	  alert("the message body : " + aMimeMessage.coerceBodyToPlaintext());
	  alert(aMimeMessage.allUserAttachments.length);
	  alert(aMimeMessage.size);
	  }, true);
	  }*/
	newsCheck();
    }
};
var notificationService =
    Components.classes["@mozilla.org/messenger/msgnotificationservice;1"]
    .getService(Components.interfaces.nsIMsgFolderNotificationService);
notificationService.addListener(newMailListener, notificationService.msgAdded);

// update message counts when a message is read inside of a folder
Components.utils.import("resource:///modules/mailServices.js", this);
var folderListener = {
    OnItemIntPropertyChanged: function(aItem, aProperty, aOldValue, aNewValue) {
	if (aProperty.toString() == "TotalMessages" ||
            aProperty.toString() == "TotalUnreadMessages") {
	    newsCheck();
	}
    },
};
var notifyFlags = Components.interfaces.nsIFolderListener.intPropertyChanged;
MailServices.mailSession.AddFolderListener(folderListener, notifyFlags);

// populate the window
newsCheck();

function newsCheck() {
    if (accounts.queryElementAt) {
	// Gecko 17+
	for (var i = 0; i < accounts.length; i++) {
	    var account = accounts.queryElementAt(i, Components.interfaces.nsIMsgAccount);
	    //console.log(account.key);
	    var rootFolder = account.incomingServer.rootFolder; // nsIMsgFolder

	    if (rootFolder.hasSubFolders && rootFolder.URI.includes("news://")) {
		var faces = document.createElement("vbox");
		faces.className = "faces table";

		var subFolders = rootFolder.subFolders; // nsIMsgFolder
		var j = 0;
		while(subFolders.hasMoreElements()) {
		    var folder = subFolders.getNext().QueryInterface(Components.interfaces.nsIMsgFolder);
		    var prettyName = folder.prettiestName;
		    var abbrName = folder.abbreviatedName;
		    var numUnread = folder.getNumUnread(true);
		    var URI = folder.URI;

		    if(populate) {
			var a = document.createElementNS('http://www.w3.org/1999/xhtml', 'a');
			var vbox = document.createElement("vbox");
			var hbox = document.createElement("hbox");
			var image = document.createElement("image");
			var label = document.createElement("label");

			var src = doNewsSearch(prettyName, numUnread);
			a.href = URI;
			a.setAttribute("title", prettyName);
			var lbl = numUnread + " " + abbrName;
			label.setAttribute("value", lbl.substring(0, 10));
			label.setAttribute("id",  i + ":" + j);
			image.setAttribute("src", src);
			image.setAttribute("id", prettyName);

			hbox.appendChild(image);
			vbox.appendChild(hbox);
			vbox.appendChild(label);
			a.appendChild(vbox);
			faces.appendChild(a);
			container.appendChild(faces);
		    } else {
			var label = document.getElementById(i + ":" + j);
			if(label) {
			    var lbl = numUnread + " " + abbrName;
			    console.log(lbl);
			    label.setAttribute("value", lbl.substring(0, 10));
			}
		    }
		    j++;
		}
	    } else {
		console.log(rootFolder.getNumUnread(true));
	    }
	}
    } else {
	// Gecko < 17
	for (var i = 0; i < accounts.Count(); i++) {
	    var account = accounts.QueryElementAt(i, Components.interfaces.nsIMsgAccount);
	}
    }
    if(populate) {
	populate = false;
    }
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



function doPiconSearch(account) {
    var mfPiconDatabases = new Array("domains", "users", "misc", "usenix", "unknown"); // picon database folders
    var atSign = account.indexOf('@');
    var src = "";

    // if we have a valid e-mail address..
    if (atSign != -1) {
        var host = account.substring(atSign + 1);
        var user = account.substring(0, atSign);

        // do a local search for picons - we don't want to kill kinzler.com!
        var host_pieces = host.split('.'); // split the host up into pieces (we need this since hosts can be different lengths, i.e. cs.gettysburg.edu vs comcast.net, etc.)
        // loop through the six different picon database folders
        for (var i in mfPiconDatabases) {
            // kill the 'unknown' lookup if we already have a picon..
            if(mfPiconDatabases[i] == "unknown" &&
               (src !== "")) { break; }

            // clone the current URL, as we will need to use it for the next val in the array
            var localFile = mfLocalFolder.clone();
            localFile.append("picons"); // they are stored in $PROFILEPATH$/messagefaces/picons/ by default
            localFile.append(mfPiconDatabases[i]); // append one of the six database folders
            if(mfPiconDatabases[i] == "misc") { localFile.append("MISC"); } // special case MISC

            var l = host_pieces.length; // get number of database folders (probably six, but could theoretically change)
            var clonedLocal; // we will check to see if we have a match at EACH depth, so keep a cloned version w/o the 'unknown/face.gif' portion
            while (l >= 0) { // loop through however many pieces we have of the host
                localFile.append(host_pieces[l]); // add that portion of the host (ex: 'edu' or 'gettysburg' or 'cs')
                clonedLocal = localFile.clone();
                if(mfPiconDatabases[i] == "users") { localFile.append(user); } // username for 'users' db folder (non-standard)
                else { localFile.append("unknown"); }
                localFile.append("face.gif");

                if (localFile.exists()) {
                    src = mfFileHandler.getURLSpecFromFile(localFile);
                }
                localFile = clonedLocal.clone(); // revert back to old local URL (before above modifications)
                l--;
            }
        }

        if(src == "") { // check to see if the array is empty
	    var rnd = Math.round(Math.random()); // random value between 0 and 1
	    var defaultMisc = mfLocalFolder.clone();
	    defaultMisc.append("picons");

	    if(rnd == 0) {
                defaultMisc.append("misc");
                defaultMisc.append("MISC");
                defaultMisc.append("noface");
	    }
	    defaultMisc.append("face.gif");
	    src = mfFileHandler.getURLSpecFromFile(defaultMisc);
        }
	return src;
    }
}


