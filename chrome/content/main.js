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
const mfFileExtensions = new Array("jpg", "png", "gif");

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
var mfMaxSize;

// subscript namespaces
var mfMD5 = {};
var mfXFaceJS = {};
var mfLog = {};

var mfImage = null;
var mfO_UpdateMessageHeaders = null;
var mfX_Cache = new Array();

// globabl preference service for reading in values across functions
var prefService;

function mfWrapUpdateMessageHeaders() {
    mfO_UpdateMessageHeaders();
    window.setTimeout(mfDisplayFace, 5);
}

function mfGetHeaders() {
    //var messageURI = GetFirstSelectedMessage();
    //var messageURI = gFolderDisplay.selectedMessage;
    var messageURI = gFolderDisplay.selectedMessageUris[0];
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
        if (content.length > 512 * 32) { // PROBLEM LINE: this had to be increased (modern mail servers)
            mfLog.warn("Could not find end-of-headers line in '" + messageURI + "'.");
            content = null;
            alert("ERROR: content.length > 512 * 8");
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
    var faceURL = headers.extractHeader("x-image-url", false);
    
    if (faceURL == null) faceURL = headers.extractHeader("x-face-url", false);
    if (faceURL == null) faceURL = headers.extractHeader("face-url", false);

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
    // Older and not so simple X-Face image
    // Cached because it's slow. TODO: persistent cache
    else if (xFace != null && mfXFaceUseJS) {
        mfLog.info("X-Face found.");
        xFace = xFace.replace(/ /g, "");
        if (mfX_Cache[xFace] == null) {
            // It'd be nice to do this asyncronously. Wonder how. Me no know.
            mfX_Cache[xFace] = mfXFaceJS.FaceURL(xFace);
        }
        mfSetImage(mfX_Cache[xFace]);
    }
    // Face that resides on a web server somewhere - POSSIBLE SECURITY/PRIVACY RISK!
    else if (faceURL != null && mfFaceURLEnabled) {
        mfLog.info("Face-URL found.");
        faceURL = faceURL.replace(/ /g, "");
        if (faceURL.match(/^(http|ftp):/)) {
            mfSetImage(faceURL);
        }
        else {
            mfLog.warn("Malformed face URL encountered: '" + faceURL + "'.");
        }
    }
    else {
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

        // Gravatar centralized email address images
        if (face == null && mfGravatarEnabled) {
            mfLog.info("Falling back to Gravatar.");
            face = mfGravatarURL;
            //alert("sender: " + sender);
            //alert("md5: " + mfMD5.calcMD5(sender));
            face = face.replace("%ID%", mfMD5.calcMD5(sender));
            face = face.replace("%SIZE%", mfMaxSize);
        }

        if (face != null) {
            mfSetImage(face);
        }
        else {
            mfSetImage("");
        }
    }
    mfLog.fine("exiting mfDisplayFace().");
}


function mfSetImage(url) {
    mfLog.fine("Setting face: '" + url + "'.");
    mfImage.setAttribute("src", url);
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

    mfMaxSize = mfGetPref("maxsize", "Int");

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
        mfImage.setAttribute("id", "fromBuddyIcon");
        vbox.appendChild(mfImage);
        console.log(mfImage);
        spacer = document.createElement("spacer");
        spacer.setAttribute("flex", "1");
        vbox.appendChild(spacer);
        document.getElementById("expandedHeaderView").appendChild(vbox);
    }
    //mfImage.setAttribute("src", ksFaceURL);

    // Set maximum width/height, add 5px padding on each side
    mfImage.style.maxWidth = (mfMaxSize + 10) + "px";
    mfImage.style.maxHeight = (mfMaxSize + 10) + "px";
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
