/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is MessageFaces extension.
 *
 * The Initial Developer of the Original Code is Jens Bannmann.
 * Portions created by the Initial Developer are Copyright (C) 2004
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s) (alphabetical order):
 *  Andrew Taylor <ataylor@its.to>
 *  Hans Christian Saustrup <hc@saustrup.net>
 *  Jens Bannmann <jens.b@web.de>
 *  John Duncan <duncjo01@gettysburg.edu>
 *  Jonas Eckerman <jonas@truls.org>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

addEventListener('messagepane-loaded', mfStartup, true);

const mfIOService = Components.classes["@mozilla.org/network/io-service;1"]
      .getService(Components.interfaces.nsIIOService);
const mfFileHandler = mfIOService.getProtocolHandler("file")
      .QueryInterface(Components.interfaces.nsIFileProtocolHandler);
const mfFileExtensions = new Array("jpg", "png", "gif"); // file extensions for local FACE lookups
const mfPiconDatabases = new Array("domains", "users", "misc", "usenix", "unknown"); // picon database folders


mfSyncStream = Components.Constructor("@mozilla.org/network/sync-stream-listener;1",
                                      Components.interfaces.nsIInputStream);
mfFileInputStream = Components.Constructor("@mozilla.org/network/file-input-stream;1",
                                           Components.interfaces.nsIFileInputStream);
mfScriptableInputStream = Components.Constructor("@mozilla.org/scriptableinputstream;1",
                                                 Components.interfaces.nsIScriptableInputStream);
mfMimeHeaders = Components.Constructor("@mozilla.org/messenger/mimeheaders;1",
                                       Components.interfaces.nsIMimeHeaders);

var mfPref;
var mfGravatarEnabled;
var mfGravatarURL;
var mfXFaceUseJS;
var mfFaceURLEnabled;
var mfLocalImagesEnabled;
var mfLocalPiconImagesEnabled;
var mfMaxSize;
var mfPiconEnabled;
var mfLocalFolder;

// subscript namespaces
var mfMD5 = {};
var mfXFaceJS = {};
var mfLog = {};

var mfImage = null;
var mfXImage = null;
var mfXImageURL = null;
var mfXFaceURL = null;
var mfFaceURL = null;
var mfExtraGravImage = null;
var mfExtraPiconImage = null;
var mfO_UpdateMessageHeaders = null;
var mfX_Cache = new Array();

// globabl preference service for reading in values across functions
var prefService;

// Picons - web lookup code partially lifted from https://bugzilla.mozilla.org/show_bug.cgi?id=60881
var piconsSearchURL = "http://kinzler.com/cgi/piconsearch.cgi/";
var piconsSearchSuffix = "/users+usenix+misc+domains+unknown/up/single/gif/order";

function mfWrapUpdateMessageHeaders() {
    mfO_UpdateMessageHeaders();
    window.setTimeout(mfDisplayFace, 5);
}

function mfGetHeaders() {
    //var messageURI = GetFirstSelectedMessage();
    //var messageURI = gFolderDisplay.selectedMessage;
    var messageURI = gFolderDisplay.selectedMessageUris[0]; // new way to GetFirstSelectedMessage();
    mfLog.info("Loading headers for '" + messageURI + "'.");

    var messageStream = null;
    if (messageURI.substring(0,7) == "file://") {
        var msgFile = Components.classes["@mozilla.org/network/io-service;1"]
            .getService(Components.interfaces.nsIIOService)
            .getProtocolHandler("file")
            .QueryInterface(Components.interfaces.nsIFileProtocolHandler)
            .getFileFromURLSpec(messageURI);
        messageStream = new mfFileInputStream();
        messageStream.init(msgFile, 1, 0, false);
    } else {
        try {
            messageStream = new mfSyncStream();
            messenger.messageServiceFromURI(messageURI)
                .streamMessage(messageURI, messageStream, msgWindow, null, false, null);
        } catch (ex) {
            mfLog.warn("Could not stream message '" + messageURI + "'.");
            return null;
        }
    }
    var inputStream = new mfScriptableInputStream();
    inputStream.init(messageStream);

    var content = "";
    inputStream.available();
    while (inputStream.available()) {
        content = content + inputStream.read(512);
        var p = content.indexOf("\r\n\r\n");
        var p1 = content.indexOf("\r\r");
        var p2 = content.indexOf("\n\n");
        if (p > 0) {
            content = content.substring(0, p);
            break;
        }
        if (p1 > 0) {
            content = content.substring(0, p1);
            break;
        }
        if (p2 > 0) {
            content = content.substring(0, p2);
            break;
        }
        if (content.length > 512 * 64) { // PROBLEM LINE: this had to be increased (modern mail servers)
            mfLog.warn("Could not find end-of-headers line in '" + messageURI + "'.");
            content = null;
            alert("ERROR: content.length > 512 * 64");
            break;
        }
    }
    inputStream.close();
    messageStream.close();

    var headers = null;
    if (content) {
        content = content + "\r\n";
        mfLog.fine("Parsing headers.");
        headers = new mfMimeHeaders();
        headers.initialize(content, content.length);
        mfLog.fine("Done. headers=" + headers);
    }
    return headers;
}

function mfDisplayFace() {
    var headers = mfGetHeaders();
    if (headers == null) return;
    var face = headers.extractHeader("face", false);
    var xFace = headers.extractHeader("x-face", false);
    var x_image_url = headers.extractHeader("x-image-url", false);
    var x_face_url = headers.extractHeader("x-face-url", false);
    var face_url = headers.extractHeader("face-url", false);

    
    var extraGravFace = null;

    var sender = "";
    if (currentHeaderData["from"] != null) {
        sender = currentHeaderData["from"].headerValue;
    }
    if ((sender == null || sender == "") && currentHeaderData["return-path"] != null) {
        sender = currentHeaderData["return-path"].headerValue;
    }
    sender = sender.replace(/^.*\</, "");
    sender = sender.replace(/\>.*$/, "");
    sender = sender.toLowerCase();
    if (!sender.match(/.+\@.+/)) {
        mfLog.warn("Invalid sender address: '" + sender + "'.");
        return;
    }

    // Gravatar centralized email address images
    if (mfGravatarEnabled) {
        mfLog.info("Falling back to Gravatar.");
        var mfCalcMD5 = mfMD5.calcMD5(sender);

        extraGravFace = mfGravatarURL;
        extraGravFace = extraGravFace.replace("%ID%", mfCalcMD5);
        extraGravFace = extraGravFace.replace("%SIZE%", mfMaxSize);
        mfSetExtraGravImage(extraGravFace);
    }

    var extraPiconFace = [];

    // support picons
    if (mfPiconEnabled) {
        //var item = document.getElementById("masterBox"); // get the master box that contains the vboxs
        //if(item != null) { item.parentNode.removeChild(item); } // if it contains something, remove it..

        mfLog.info("Falling back to Picon.");
        var atSign = sender.indexOf('@');

        // if we have a valid e-mail address..
        if (atSign != -1) {
            var host = sender.substring(atSign + 1)
            var user = sender.substring(0, atSign);

            // do a local search for picons - we don't want to kill kinzler.com!
            if(mfLocalPiconImagesEnabled) {
                var host_pieces = host.split('.'); // split the host up into pieces (we need this since hosts can be different lengths, i.e. cs.gettysburg.edu vs comcast.net, etc.)
                
                // loop through the six different picon database folders
                for (var i in mfPiconDatabases) {
                    //alert(mfPiconDatabases[i]);
                    if(i == 4 && (typeof extraPiconFace !== 'undefined' && extraPiconFace.length > 0)) { break; }

                    var localFile = mfLocalFolder.clone();
                    localFile.append("picons"); // they are stored in $PROFILEPATH$/messagefaces/picons/ by default
                    localFile.append(mfPiconDatabases[i]); // append one of the six database folders
                    if(i == 2) { localFile.append("MISC"); } // special case MISC

                    var l = host_pieces.length; // get number of database folders (probably six, but could theoretically change)
                    var clonedLocal; // we will check to see if we have a match at EACH depth, so keep a cloned version w/o the 'unknown/face.gif' portion
                    while (l >= 0) { // loop through however many pieces we have of the host
                        localFile.append(host_pieces[l]); // add that portion of the host (ex: 'edu' or 'gettysburg' or 'cs')
                        clonedLocal = localFile.clone();
                        if(i == 1) { localFile.append(user); } // username for 'users' db folder (non-standard)
                        else { localFile.append("unknown"); }
                        localFile.append("face.gif");

                        if (localFile.exists()) {
                            mfLog.info("Found local picon image.");
                            extraPiconFace.push(mfFileHandler.getURLSpecFromFile(localFile));
                        } 
                        localFile = clonedLocal.clone();
                        l--;
                    }
                }

                if(!(typeof extraPiconFace !== 'undefined' && extraPiconFace.length > 0)) { // check to see if the array is empty
                    var rnd = Math.round(Math.random());
                    var defaultMisc = mfLocalFolder.clone();
                    defaultMisc.append("picons"); 

                    if(rnd == 0) { 
                        defaultMisc.append("misc");
                        defaultMisc.append("MISC");
                        defaultMisc.append("noface");
                    } 
                    else { 
                        defaultMisc.append("unknown");
                        defaultMisc.append("MISC");
                        defaultMisc.append("unknown");
                    }
                    defaultMisc.append("face.gif");
                    
                    extraPiconFace.push(mfFileHandler.getURLSpecFromFile(defaultMisc));
                }
            } else { // if we are not using a local search, use a web lookup using piconsearch.pl
                extraPiconFace.push(piconsSearchURL + host + "/" + user + piconsSearchSuffix);
            }

            mfSetExtraPiconImage(extraPiconFace);
            //msgPaneData.PiconBox.removeAttribute('collapsed');
        }
    }

    // Simple Face PNG image
    if (face != null) {
        mfLog.info("Face found.");
        face = face.replace(/(\s)+/g, "");
        if (face.length > 966) {
            mfLog.warn("Malformed face header encountered - length is " + face.length + " bytes.");
        }
        else {
            mfSetImage("data:image/png;base64," + encodeURIComponent(face));
        }
    }
    else {
        var face = null;

        // Local icon directory enabled?
        if (mfLocalImagesEnabled) {
            for (var i in mfFileExtensions) {
                var localFile = mfLocalFolder.clone();
                localFile.append(sender + "." + mfFileExtensions[i]);
                if (localFile.exists()) {
                    mfLog.info("Found local image.");
                    face = mfFileHandler.getURLSpecFromFile(localFile);
                    break;
                }
            }
        }

        if (face != null) {
            mfSetImage(face);
        } else {
            mfSetImage("");
        }
    }
    // Older and not so simple X-Face image
    // Cached because it's slow. TODO: persistent cache
    if (xFace != null && mfXFaceUseJS) {
        mfLog.info("X-Face found.");
        xFace = xFace.replace(/ /g, "");
        if (mfX_Cache[xFace] == null) {
            // It'd be nice to do this asyncronously. Wonder how. Me no know.
            mfX_Cache[xFace] = mfXFaceJS.FaceURL(xFace);
        }
        mfSetXImage(mfX_Cache[xFace]);
    } else if (xFace == null) {
        mfSetXImage("");
    }

    // Face that resides on a web server somewhere - POSSIBLE SECURITY/PRIVACY RISK!
    if (mfFaceURLEnabled) {
        if(x_image_url != null) {
            mfLog.info("X-Image-URL found.");
            x_image_url = x_image_url.replace(/ /g, "");

            if (x_image_url.match(/^(http|https|ftp):/)) {
                mfSetXImageURL(x_image_url);
            } else {
                mfLog.warn("Malformed face URL encountered: '" + x_image_url + "'.");
            }
        } else if (x_image_url == null) {
            mfSetXImageURL("");
        }

        if(x_face_url != null) {
            mfLog.info("X-Face-URL found.");
            x_face_url = x_face_url.replace(/ /g, "");

            if (x_face_url.match(/^(http|https|ftp):/)) {
                mfSetXFaceURL(x_face_url);
            } else {
                mfLog.warn("Malformed face URL encountered: '" + x_face_url + "'.");
            }
        } else if (x_face_url == null) {
            mfSetXFaceURL("");
        }

        if(face_url != null) {
            mfLog.info("Face-URL found.");
            face_url = face_url.replace(/ /g, "");

            if (face_url.match(/^(http|https|ftp):/)) {
                mfSetFaceURL(face_url);
            } else {
                mfLog.warn("Malformed face URL encountered: '" + face_url + "'.");
            }
        } else if (face_url == null) {
            mfSetFaceURL("");
        }
    }

    mfLog.fine("exiting mfDisplayFace().");
}

function mfSetImage(url) { // set Face image
    mfLog.fine("Setting face: '" + url + "'.");

    if(url=="") {
        mfImage.style.display = "none";
    } else {
        mfImage.style.display = "block";
    }

    mfImage.setAttribute("src", url);
}

function mfSetXImageURL(url) { // set Face image
    mfLog.fine("Setting X-Image-URL: '" + url + "'.");

    if(url=="") {
        mfXImageURL.style.display = "none";
    } else {
        mfXImageURL.style.display = "block";
    }

    mfXImageURL.setAttribute("src", url);
}

function mfSetXFaceURL(url) { // set Face image
    mfLog.fine("Setting X-Face-URL: '" + url + "'.");

    if(url=="") {
        mfXFaceURL.style.display = "none";
    } else {
        mfXFaceURL.style.display = "block";
    }

    mfXFaceURL.setAttribute("src", url);
}

function mfSetFaceURL(url) { // set Face image
    mfLog.fine("Setting Face-URL: '" + url + "'.");

    if(url=="") {
        mfFaceURL.style.display = "none";
    } else {
        mfFaceURL.style.display = "block";
    }

    mfFaceURL.setAttribute("src", url);
}

function mfSetXImage(url) { // set X-Face image
    mfLog.fine("Setting X-Face: '" + url + "'.");

    if(url=="") {
        mfXImage.style.display = "none";
    } else {
        mfXImage.style.display = "block";
    }

    mfXImage.setAttribute("src", url);
}

// check to see if gravatar image exists
// http://stackoverflow.com/questions/11442712/get-width-height-of-remote-image-from-url
function getMeta(url, callback) {
    var img = new Image();
    img.src = url;
    img.onload = function() { callback(this.width, this.height); }
}

function mfSetExtraGravImage(url) { // set Gravatar image
    mfLog.fine("Setting grav: '" + url + "'.");
    
    getMeta(url, function(width, height) { 
        mfExtraGravImage.style.display = "block"; mfExtraGravImage.setAttribute("src", url); return; 
    });

    mfExtraGravImage.style.display = "none"
}

function mfSetExtraPiconImage(extraPiconFace) { // set Picon image
    mfLog.fine("Setting picon: '" + extraPiconFace[i] + "'.");

    //var masterBox = document.createElement("hbox");
    //masterBox.setAttribute("id", "masterBox");

    for (var i = extraPiconFace.length - 1; i >= 0; i--) {
        // get all of the existing piconBoxes for however many picons we found
        var item = document.getElementById("piconBox" + i); 

        if(item == null) { // if it does not already exist, create it
            var piconBox = document.createElement("vbox");
            piconBox.setAttribute("id", "piconBox" + i);
            
            var spacer = document.createElement("spacer");
            spacer.setAttribute("flex", "1");
            piconBox.appendChild(spacer);

            mfExtraPiconImage = document.createElement("image");
            mfExtraPiconImage.setAttribute("style", "padding: 5px");
            mfExtraPiconImage.setAttribute("id", "fromBuddyIconPicon" + i);
            mfExtraPiconImage.setAttribute("src", extraPiconFace[i]);
            piconBox.appendChild(mfExtraPiconImage);

            spacer = document.createElement("spacer");
            spacer.setAttribute("flex", "1");
            piconBox.appendChild(spacer);
            //masterBox.appendChild(piconBox);
            
            if((i > 0) && (document.getElementById("piconBox" + (i-1)) != null)) { // if we are re-adding box, add it before the earlier ones (ordering)
                document.getElementById("expandedHeaderView").insertBefore(piconBox, document.getElementById("piconBox" + (i-1)));
            } else {
                document.getElementById("expandedHeaderView").appendChild(piconBox); // normal add
            }
        } else { // if it does already exists, use it
            document.getElementById("fromBuddyIconPicon" + i).setAttribute("src", extraPiconFace[i]);
        }   
    }

    // remove extra piconBoxes that could have previously been created
    var count = extraPiconFace.length;
    var rmBox = document.getElementById("piconBox" + count);

    while(rmBox != null) {        
        while (rmBox.firstChild) { // remove all children from the vbox
            rmBox.removeChild(rmBox.firstChild);
        }

        rmBox.parentNode.removeChild(rmBox);
        count++;
        rmBox = document.getElementById("piconBox" + count);
    }
    //document.getElementById("expandedHeaderView").appendChild(masterBox);
}

function mfStartup() {
    const jsLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
          .getService(Components.interfaces.mozIJSSubScriptLoader);

    var md5Type = "nsICryptoHash" in Components.interfaces ? "call" : "impl";
    jsLoader.loadSubScript("chrome://messagefaces/content/md5-" + md5Type + ".js", mfMD5);
    jsLoader.loadSubScript("chrome://messagefaces/content/xface.js", mfXFaceJS);
    jsLoader.loadSubScript("chrome://messagefaces/content/logging.js", mfLog);

    prefService = Components.classes["@mozilla.org/preferences-service;1"]
        .getService(Components.interfaces.nsIPrefService);
    mfPref = prefService.getBranch("extensions.messagefaces.");
    mfLoadPrefs();
    mfPrefObserver.register();

    mfO_UpdateMessageHeaders = window.UpdateMessageHeaders;
    window.UpdateMessageHeaders = mfWrapUpdateMessageHeaders;

    mfCheckLocale();
}

function mfLoadPrefs() {
    mfGravatarEnabled = mfGetPref("gravatar.enabled", "Bool");
    mfGravatarURL = mfGetPref("gravatar.url", "Char");
    mfXFaceUseJS = mfGetPref("xface.useJS", "Bool");
    mfFaceURLEnabled = mfGetPref("faceURL.enabled", "Bool");
    mfLocalImagesEnabled = mfGetPref("local.enabled", "Bool");
    mfLocalPiconImagesEnabled = mfGetPref("localPicon.enabled", "Bool");
    mfPiconEnabled = mfGetPref("picon.enabled", "Bool");

    mfLog.init("MessageFaces", mfGetPref("loglevel", "Int"));

    try {
        mfLocalFolder = mfPref.getComplexValue("local.folder",
                                               Components.interfaces.nsILocalFile);
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

    var gravBox = document.createElement("vbox");
    var spacer = document.createElement("spacer");
    spacer.setAttribute("flex", "1");
    gravBox.appendChild(spacer);
    mfExtraGravImage = document.createElement("image");
    mfExtraGravImage.setAttribute("style", "padding: 5px");
    mfExtraGravImage.setAttribute("id", "fromBuddyIconGrav");
    gravBox.appendChild(mfExtraGravImage);
    console.log(mfExtraGravImage);
    spacer = document.createElement("spacer");
    spacer.setAttribute("flex", "1");
    gravBox.appendChild(spacer);
    document.getElementById("expandedHeaderView").appendChild(gravBox);

    // Get face image element
    //mfXImage = document.getElementById("fromBuddyIconXFace");
    console.log(mfXImage);
    if (mfXImage == null) {
        // Thunderbird 2 no longer ships a "fromBuddyIcon" image, so we create our own
        var vbox = document.createElement("vbox");
        var spacer = document.createElement("spacer");
        spacer.setAttribute("flex", "1");
        vbox.appendChild(spacer);
        mfXImage = document.createElement("image");
        mfXImage.setAttribute("style", "padding: 5px");
        mfXImage.setAttribute("id", "fromBuddyIconXFace");
        vbox.appendChild(mfXImage);
        console.log(mfXImage);
        spacer = document.createElement("spacer");
        spacer.setAttribute("flex", "1");
        vbox.appendChild(spacer);
        document.getElementById("expandedHeaderView").appendChild(vbox);
    }

    console.log(mfXImageURL);
    if (mfXImageURL == null) {
        // Thunderbird 2 no longer ships a "fromBuddyIcon" image, so we create our own
        var vbox = document.createElement("vbox");
        var spacer = document.createElement("spacer");
        spacer.setAttribute("flex", "1");
        vbox.appendChild(spacer);
        mfXImageURL = document.createElement("image");
        mfXImageURL.setAttribute("style", "padding: 5px");
        mfXImageURL.setAttribute("id", "fromBuddyIconXImageURL");
        vbox.appendChild(mfXImageURL);
        console.log(mfXImageURL);
        spacer = document.createElement("spacer");
        spacer.setAttribute("flex", "1");
        vbox.appendChild(spacer);
        document.getElementById("expandedHeaderView").appendChild(vbox);
    }

    console.log(mfXFaceURL);
    if (mfXFaceURL == null) {
        // Thunderbird 2 no longer ships a "fromBuddyIcon" image, so we create our own
        var vbox = document.createElement("vbox");
        var spacer = document.createElement("spacer");
        spacer.setAttribute("flex", "1");
        vbox.appendChild(spacer);
        mfXFaceURL = document.createElement("image");
        mfXFaceURL.setAttribute("style", "padding: 5px");
        mfXFaceURL.setAttribute("id", "fromBuddyIconXFaceURL");
        vbox.appendChild(mfXFaceURL);
        console.log(mfXFaceURL);
        spacer = document.createElement("spacer");
        spacer.setAttribute("flex", "1");
        vbox.appendChild(spacer);
        document.getElementById("expandedHeaderView").appendChild(vbox);
    }

    console.log(mfFaceURL);
    if (mfFaceURL == null) {
        // Thunderbird 2 no longer ships a "fromBuddyIcon" image, so we create our own
        var vbox = document.createElement("vbox");
        var spacer = document.createElement("spacer");
        spacer.setAttribute("flex", "1");
        vbox.appendChild(spacer);
        mfFaceURL = document.createElement("image");
        mfFaceURL.setAttribute("style", "padding: 5px");
        mfFaceURL.setAttribute("id", "fromBuddyIconFaceURL");
        vbox.appendChild(mfFaceURL);
        console.log(mfFaceURL);
        spacer = document.createElement("spacer");
        spacer.setAttribute("flex", "1");
        vbox.appendChild(spacer);
        document.getElementById("expandedHeaderView").appendChild(vbox);
    }
    
    // Get face image element
    mfImage = document.getElementById("fromBuddyIcon");
    console.log(mfImage);
    if (mfImage == null) {
        // Thunderbird 2 no longer ships a "fromBuddyIcon" image, so we create our own
        var vbox = document.createElement("vbox");
        var spacer = document.createElement("spacer");
        spacer.setAttribute("flex", "1");
        vbox.appendChild(spacer);
        mfImage = document.createElement("image");
        mfImage.setAttribute("style", "padding: 5px");
        mfImage.setAttribute("id", "fromBuddyIconFace");
        vbox.appendChild(mfImage);
        console.log(mfImage);
        spacer = document.createElement("spacer");
        spacer.setAttribute("flex", "1");
        vbox.appendChild(spacer);
        document.getElementById("expandedHeaderView").appendChild(vbox);
    }
    //mfImage.setAttribute("src", ksFaceURL);
    // Set maximum width/height, add 5px padding on each side
    //mfImage.style.maxWidth = (mfMaxSize + 10) + "px";
    //mfImage.style.maxHeight = (mfMaxSize + 10) + "px";

    mfMaxSize = mfGetPref("maxsize", "Int");
}

var mfPrefObserver = {
    // nsIPrefBranchInternal = pre-Gecko 1.8
    PBI: "nsIPrefBranchInternal" in Components.interfaces ? Components.interfaces.nsIPrefBranchInternal
        : Components.interfaces.nsIPrefBranch2,

    register: function() {
        prefService = Components.classes["@mozilla.org/preferences-service;1"]
            .getService(Components.interfaces.nsIPrefService);

        mfPref.QueryInterface(this.PBI).addObserver("", this, false);
    },

    unregister: function() {
        mfPref.QueryInterface(this.PBI).removeObserver("", this);
    },

    observe: function(aSubject, aTopic, aData) {
        if(aTopic == "nsPref:changed") {
            mfLoadPrefs();
        }
    }
}

function mfGetPref(name, type) {
    //return mfGetPrefImpl("extensions.messagefaces." + name, type, null);
    return mfGetPrefImpl(name, type, null);
}

function mfGetXPref(name, type, defaultValue) {
    return mfGetPrefImpl(name, type, defaultValue);
}

function mfGetPrefImpl(name, type, defaultValue, setIt) {
    if ((type != "Bool" && type != "Char" && type != "Int") || !name) {
        return null;
    }
    var value;
    try {
        value = eval("mfPref.get" + type + "Pref(\"" + name + "\");"); // switch out gPrefBranch for mfPref...
    } catch (e) {
        value = defaultValue;
    }
    return value;
}

// Work around (or at least detect) locale-related bugs in TB
function mfCheckLocale() {
    const chromeRegistry = Components.classes["@mozilla.org/chrome/chrome-registry;1"]
          .getService(Components.interfaces.nsIXULChromeRegistry);
    if (!("selectLocaleForPackage" in chromeRegistry)) {
        var myLocale = chromeRegistry.getSelectedLocale("messagefaces");
        var chromeLocale = chromeRegistry.getSelectedLocale("global");
        var prefLocale = mfGetXPref("general.useragent.locale", "Char", "");

        const bundleService = Components.classes["@mozilla.org/intl/stringbundle;1"]
              .getService()
              .QueryInterface(Components.interfaces.nsIStringBundleService);

        var properties = bundleService.createBundle("chrome://messagefaces/content/mfbuild.properties");
        var supportedLocales = properties.GetStringFromName("messagefaces.supportedLocales");
        var appLocaleSupported = (","+supportedLocales+",").indexOf( (","+chromeLocale+",") ) > -1;
        var mfVersion = properties.GetStringFromName("messagefaces.release");
        var warningShown = mfGetPref("localeWarningShown", "Char");

        const url = "http://tecwizards.de/mozilla/messagefaces/localeproblems.html"
              + "?app=" + chromeLocale + "&ver=" + mfVersion;
        const inf = "\n\nPlease visit the following web site for more information.";
        const warningFlag = "v" + mfVersion + ":" + chromeLocale + ":p";

        if (appLocaleSupported && myLocale != chromeLocale) {
            // Some TB builds don't include the global locale pref
            if (chromeLocale != prefLocale) {
                mfPref.setCharPref("general.useragent.locale", chromeLocale); // change gPrefBranch to mfPref
                // Our pref window will pick up the change when it's opened, so we
                // don't need to tell the user to restart Thunderbird.
            }
            else if (warningShown != warningFlag + "1") {
                mfPref.setCharPref("localeWarningShown", warningFlag + "1");
                prompt("MessageFaces supports your language ('" + chromeLocale
                       + "'), but Thunderbird\nchose another language for the "
                       + "extension. " + inf, url + "&problem=1");
            }
        }
        else if (!appLocaleSupported && myLocale != "en-US" && warningShown != warningFlag + "2") {
            mfPref.setCharPref("localeWarningShown", warningFlag + "2");
            prompt("Although Thunderbird is supposed to select english texts for\n"
                   + "MessageFaces, it chose another language for the extension. "
                   + inf, url + "&problem=2");
        }
    }
}
