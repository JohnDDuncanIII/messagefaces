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
 * The Initial Developer of the Original Code is John Duncan.
 * Portions created by the Initial Developer are Copyright (C) 2016
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s) (alphabetical order):
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
// broken things: internal database does not append values from customDBHeaders pref...

var columnHandlerHeader = {
	isEditable: 			function(aRow, aCol) {return false;},
	  getCellProperties:  	function(row, col, props){ return "compactHeader"; },
   	getImageSrc:         	function(row, col) {return null;},
   	getCellText: 			function(row, col) { 
    	var key = gDBView.getKeyAt(row);
    	if(!key) { return "?"; }
	    var hdr = gDBView.db.GetMsgHdrForKey(key);
	    if(!hdr) { return "?"; }
	   	
	   	var sender = hdr.getStringProperty("sender");
      var fro = hdr.getStringProperty("from");
      var subject = hdr.getStringProperty("subject");
      var date = hdr.getStringProperty("date");
      
      /*
    	if(sender.length > 0) {
    		sender = sender.replace(/^.*\</, "");
    		sender = sender.replace(/\>.*$/, "");
    		sender = sender.toLowerCase();
    	}*/
      return sender + "\n" + fro + "\n" + subject + "\n" + date;
    },
   	cycleCell: 				function(aRow, aCol) { },
   	getSortStringForRow: 	function(hdr) { 
	    var sender = hdr.getStringProperty("sender");
      var fro = hdr.getStringProperty("from");
      var subject = hdr.getStringProperty("subject");
      var date = hdr.getStringProperty("date");
      
      /*
      if(sender.length > 0) {
        sender = sender.replace(/^.*\</, "");
        sender = sender.replace(/\>.*$/, "");
        sender = sender.toLowerCase();
      }*/
      return sender + "\n" + fro + "\n" + subject + "\n" + date;
   	},
   	getSortLongForRow:   	function(hdr) { return 0; },
   	isString:            	function() { return true; }, 
   	getRowProperties:    	function(row, props){ return "compactHeader"; }
}

function addCustomColumnHandler() {
   	if(gDBView != null) {
   		gDBView.addColumnHandler("compactHeader", columnHandlerHeader);
   	}
}

var CreateDbObserverCompact = {
  // Components.interfaces.nsIObserver
  observe: function(aMsgFolder, aTopic, aData) {  
     	addCustomColumnHandler();
  }
}

window.addEventListener("load", doOnceLoaded, false);

function doOnceLoaded() {
	var ObserverService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
	ObserverService.addObserver(CreateDbObserverCompact, "MsgCreateDBView", false);
  window.document.getElementById('folderTree').addEventListener("select",addCustomColumnHandler,false);
}
