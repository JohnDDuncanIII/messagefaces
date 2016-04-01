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
 *  Jens Bannmann <jens.b@web.de>
 *  John Duncan <duncjo01@gettysburg.edu>
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


const BLANK_FACE = "chrome://messagefaces/content/blank.png";
const promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                      .getService(Components.interfaces.nsIPromptService);
const fileHandler = Components.classes["@mozilla.org/network/io-service;1"]
                    .getService(Components.interfaces.nsIIOService)
                    .getProtocolHandler("file")
                    .QueryInterface(Components.interfaces.nsIFileProtocolHandler);
var prefs = Components.classes["@mozilla.org/preferences-service;1"]
              .getService(Components.interfaces.nsIPrefBranch);
var bundle = null;
var listBox = null;
var testImage = null;
var face = null;
var localFolder = null;

function getPref(name) {
  try {
    return prefs.getComplexValue(name, Components.interfaces.nsIPrefLocalizedString).data;
  } catch (e) {
    return null;
  }
}

function getList(name) {
  var p = getPref(name);
  return (p != null) ? p.split(",") : Array();
}

function init() {
  loadPrefs();
  setTimeout("window.sizeToContent();", 0);

  bundle = document.getElementById("bundle");
  listBox = document.getElementById("identities");
  testImage = document.getElementById("testImage");

  var accountList = getList("mail.accountmanager.accounts");
  for (var i = 0; i < accountList.length; i++) {
    var account = accountList[i];
    var serverID = getPref("mail.account." + account + ".server");
    var accountName = getPref("mail.server." + serverID + ".name");
    var identityList = getList("mail.account." + account + ".identities");
    if (getPref("mail.server." + serverID + ".type") != "none") {
      for (var j = 0; j < identityList.length; j++) {
        var identity = identityList[j];
        
        var face = null;
        var idPrefix = "mail.identity." + identity;

        // If no face header pref exists, default to saving as a "face" pref
        var headerID = "face";
        var headerPref = idPrefix + ".header." + headerID;
        var headerValue = "";

        // Find existing Face: header pref
        var headerList = getList(idPrefix + ".headers");
        for (var k = 0; k < headerList.length; k++) {
          var curHeaderID = headerList[k];
          var curHeaderPref = idPrefix + ".header." + curHeaderID;
          var curHeaderValue = getPref(curHeaderPref);
          if (curHeaderValue != null && curHeaderValue.indexOf("Face: ") == 0) {
            headerID = curHeaderID;
            headerPref = curHeaderPref;
            headerValue = curHeaderValue;
            face = headerValue.substr(6);
            face = face.replace(/ /g, "");
            face = "data:image/png;base64," + encodeURIComponent(face);
          }
        }
        
        var data = document.createElement("data");
        data.setAttribute("id", identity + "HeaderNames");
        data.setAttribute("pref", true);
        data.setAttribute("preftype", "string");
        data.setAttribute("prefstring", idPrefix + ".headers");
        data.setAttribute("value", getPref(idPrefix + ".headers"));
        document.getElementById("dataBox").appendChild(data);
        
        var item = document.createElement("listitem");

        // Create an info node. If the face is changed, this node's ID is added
        // to the _elementIDs array so the pref is saved.
        var infoCell = document.createElement("listcell");
        infoCell.setAttribute("id", identity + "Face");
        infoCell.setAttribute("hidden", true);
        infoCell.setAttribute("identity", identity);
        infoCell.setAttribute("headerID", headerID);
        infoCell.setAttribute("headerValue", headerValue);
        infoCell.setAttribute("pref", true);
        infoCell.setAttribute("preftype", "string");
        infoCell.setAttribute("prefstring", headerPref);
        infoCell.setAttribute("prefattribute", "headerValue");
        item.appendChild(infoCell);

        var cell1 = document.createElement("listcell");
        cell1.setAttribute("label", accountName);
        item.appendChild(cell1);

        var cell2 = document.createElement("listcell");
        cell2.setAttribute("label", getPref(idPrefix + ".useremail"));
        item.appendChild(cell2);

        var cell3 = document.createElement("listcell");
        cell3.setAttribute("image", (face != null) ? face : BLANK_FACE);
        cell3.setAttribute("class", "listcell-iconic");
        item.appendChild(cell3);

        listBox.appendChild(item);
      }
    }
  }
}

function setFace() {
  var nsIFilePicker = Components.interfaces.nsIFilePicker;
  var fp = Components.classes["@mozilla.org/filepicker;1"]
          .createInstance(nsIFilePicker);
  fp.init(window, bundle.getString("selectfile.title"), nsIFilePicker.modeOpen);
  fp.appendFilter(bundle.getString("selectfile.pngfilter"), "*.png");
  fp.appendFilters(nsIFilePicker.filterAll);

  var res=fp.show();
  if (res == nsIFilePicker.returnOK){
    var thefile = fp.file;
    if (thefile.fileSize > 726) {
      imageError("exceedsMaxSize");
    } else {
      var tmp;
      inputStream = Components.classes["@mozilla.org/network/file-input-stream;1"]
                    .createInstance( Components.interfaces.nsIFileInputStream );
      inputStream.init( thefile, 0x01, 0444, tmp );
      binaryInputStream = Components.classes["@mozilla.org/binaryinputstream;1"]
                          .createInstance( Components.interfaces.nsIBinaryInputStream);
      binaryInputStream.setInputStream( inputStream );
      var dataArray = binaryInputStream.readByteArray(inputStream.available());
      binaryInputStream.close();
      inputStream.close();

      if (dataArray[0] == 0x89
          && dataArray[1] == 0x50
          && dataArray[2] == 0x4E
          && dataArray[3] == 0x47) {
        var png = String.fromCharCode.apply(null, dataArray);
        face = btoa(png);
        var faceURL = "data:image/png;base64," + encodeURIComponent(face);
        testImage.src = faceURL;
        listBox.disabled = true;
        setButtonsEnabled(false);
      } else {
        imageError("invalidPNG");
      }
    }
  }
}

function processImage(success) {
  if (success) {
    if (testImage.boxObject.width == 48
        && testImage.boxObject.height == 48) {
      // Display the image
      var cell = listBox.getSelectedItem(0).lastChild;
      cell.setAttribute("image", testImage.src);

      // Format the face (insert spaces for line breaks)
      var pos = 72;
      var header = "Face: " + face.substring(0, pos);
      while (pos < face.length) {
        header += " ";
        header += face.substring(pos, pos + 76);
        pos += 76;
      }

      // Save the formatted header
      prepareSaveHeader(header);
    } else {
      imageError("wrongDimensions");
    }
  }
  else {
    imageError("invalidPNG");
  }
  testImage.src = "";
  listBox.disabled = false;
  setButtonsEnabled(true);
}

function imageError(type) {
  var msg = bundle.getString("message.invalidFace");
  msg = msg.replace(/%ERROR%/, bundle.getString("error." + type));
  promptService.alert(window,
                      bundle.getString("messagefaces"),
                      msg);
}

function setButtonsEnabled(enabled) {
  document.getElementById("setFaceButton").disabled = !enabled;
  document.getElementById("removeFaceButton").disabled = !enabled;
}

function prepareSaveHeader(value) {
  // Save the new face header to our info cell
  var infoCell = listBox.getSelectedItem(0).firstChild;
  infoCell.setAttribute("headerValue", value);
  var headerID = infoCell.getAttribute("headerID");

  var headerNamesNode = document.getElementById(infoCell.getAttribute("identity") + "HeaderNames");
  var headerNamesList = headerNamesNode.getAttribute("value");
  if (value != null && value != "") {
    // Ensure the face header is listed in the "headers" pref
    var headerNames;
    var headerRegistered = false;
    if (headerNamesList != null && headerNamesList != "") {
      headerNames = headerNamesList.split(",");
      for (var i = 0; i < headerNames.length; i++) {
        if (headerNames[i] == headerID) {
          headerRegistered = true;
        }
      }
    }
    else {
      headerNames = Array();
    }
    if (!headerRegistered) {
      headerNames.push(headerID);
      headerNamesNode.setAttribute("value", headerNames.join(","));
    }
  }
  else {
    // We just removed the face. Ensure the face header is no longer listed.
    eval("headerNamesList = headerNamesList.replace(/" + headerID + ",{0,1}/g, \"\");");
    headerNamesList = headerNamesList.replace(/^,+/, "");
    headerNamesList = headerNamesList.replace(/,+$/, "");
    headerNamesNode.setAttribute("value", headerNamesList);
  }

  // Ensure our pref DOM nodes are listed in _elementIDs
  var infoCellRegistered = false;
  var headerNamesNodeRegistered = false;
  for (var i = 0; i < _elementIDs.length; i++) {
    if (_elementIDs[i] == infoCell.id) {
      infoCellRegistered = true;
    }
    else if (_elementIDs[i] == headerNamesNode.id) {
      headerNamesNodeRegistered = true;
    }
  }
  if (!infoCellRegistered) {
    _elementIDs.push(infoCell.id);
  }
  if (!headerNamesNodeRegistered) {
    _elementIDs.push(headerNamesNode.id);
  }
}

function removeFace() {
  // Display the image
  var cell = listBox.getSelectedItem(0).lastChild;
  cell.setAttribute("image", BLANK_FACE);

  prepareSaveHeader("");
}

function chooseFolder() {
  const nsIFilePicker = Components.interfaces.nsIFilePicker;
  var fp = Components.classes["@mozilla.org/filepicker;1"]
          .createInstance(nsIFilePicker);
  fp.init(window, "Select a File", nsIFilePicker.modeGetFolder);

  fp.displayDirectory = localFolder;

  var res = fp.show();
  if (res == nsIFilePicker.returnOK){
    localFolder = fp.file;
    showFolderPath();
  }
}

function showFolderPath() {
  var dirBox = document.getElementById("localFolder");
  dirBox.value = (/Mac/.test(navigator.platform)) ? localFolder.leafName : localFolder.path;
}  

function loadPrefs() {
  try {
    localFolder = prefs.getComplexValue("extensions.messagefaces.local.folder",
                                        Components.interfaces.nsILocalFile);
  } catch (e) {
    localFolder = Components.classes["@mozilla.org/file/directory_service;1"]
                     .getService(Components.interfaces.nsIProperties)
                     .get("ProfD", Components.interfaces.nsIFile);
    localFolder.append("messagefaces");
  }
  showFolderPath();

  for (var i = 0; i < _elementIDs.length; i++) {
    var curEl = document.getElementById(_elementIDs[i]);
    var prefstring = curEl.getAttribute("prefstring");
    var preftype = curEl.getAttribute("preftype");
    var prefattribute = curEl.getAttribute("prefattribute");
    if (!prefattribute) {
      prefattribute = "value";
    }
    try {
      switch(preftype) {
        case "int": curEl.value = prefs.getIntPref(prefstring); break;
        case "bool": curEl.checked = prefs.getBoolPref(prefstring); break;
        default: curEl.setAttribute("value", prefs.getCharPref(prefattribute)); break;
      }
    } catch(e) {}
  }
}

function savePrefs() {
  prefs.setComplexValue("extensions.messagefaces.local.folder",
                        Components.interfaces.nsILocalFile,
                        localFolder);

  for (var i = 0; i < _elementIDs.length; i++) {
    var curEl = document.getElementById(_elementIDs[i]);
    var prefstring = curEl.getAttribute("prefstring");
    var preftype = curEl.getAttribute("preftype");
    var prefattribute = curEl.getAttribute("prefattribute");
    if (!prefattribute) {
      prefattribute = "value";
    }
    switch(preftype) {
      case "int": prefs.setIntPref(prefstring, curEl.value); break;
      case "bool": prefs.setBoolPref(prefstring, curEl.checked); break;
      default: prefs.setCharPref(prefstring, curEl.getAttribute(prefattribute)); break;
    }
  }
}
