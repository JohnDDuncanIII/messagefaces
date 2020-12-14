function calcMD5(str) {
  // thanks to shaver, biesi and timeless for helping with this
  var cryptoHash = Components.classes["@mozilla.org/security/hash;1"].createInstance(Components.interfaces.nsICryptoHash);
  cryptoHash.init(cryptoHash.MD5);
  var chars = [].map.call(str, (function (v) {return v.charCodeAt(0);}));
  cryptoHash.update(chars, chars.length);
  var bytes = cryptoHash.finish(false);
  var hash = "";
  for (var i =0; i < bytes.length; i++)
  {
    var b = bytes.charCodeAt(i).toString(16);
    hash = hash + (b.length < 2 ? "0" : "") + b;
  }
  return hash;
}
