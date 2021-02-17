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
 * The Original Code is Mnenhy.
 *
 * The Initial Developer of the Original Code is Karsten DÃ¼sterloh <mnenhy@tprac.de>.
 *
 * Portions created by the Initial Developer are Copyright (C) 2002-2005
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  James Ashton <jaa@cs.su.oz.au> (author of the original C source of 'uncompface')
 *  Andrew Taylor <ataylor@its.to> (author of the Javascript version of 'uncompface')
 *  Karsten DÃ¼sterloh <mnenhy@tprac.de> (optimizations for use with Mnenhy)
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

// +-
// |  the contents of this file will be loaded into the Mnenhy.headers.xface.* context!
// |  ie. foo() is available as goMnenhy.headers.xface.foo()
// +-

// What is an X-Face?
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
// An X-Face is a black/white icon of 48*48 pixels whose compressed data will be
// transported as a text header in mails or news postings.
//
// How to compress an X-Face? (XXX not quite complete yet)
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
// The icon is divided into 9 areas of 16*16 pixels that will be compressed independently.
// Each area can be entirely black or entirely white or some shade of grey. If grey, it will
// be divided into 4 squares of 8*8 pixels that, again, can be black, white or grey.
// This will be iterated until such a block is either black or white or 2*2.
//
// How to encode the X-Face?
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
// The compressed X-Face needs at most 288 bytes (48*48/8), but due to compression, the size
// is usually much smaller. Nevertheless, this binary data will not pass certain servers
// unharmed, so it needs to be recoded into 7-bit data, using only the 94 printable characters
// from '!' (0x21) to '~' (0x7E). To achieve this, the binary data can be regarded as a single,
// large number with a representation to base 256. This representation will then be converted 
// to use base 94, i.e. each 'digit' now has values from 0 to 93. To become printable, each
// digit is added an offset of '!' (0x21).
// The resulting string is set as the X-Face header.

var LENGTH=48;
var PIXELS=(LENGTH * LENGTH);

var FIRSTPRINT = '!'.charCodeAt(0);
var LASTPRINT  = '~'.charCodeAt(0);
var NUMPRINTS = (LASTPRINT - FIRSTPRINT + 1);

var BITSPERWORD=8;
var WORDCARRY=(1 << BITSPERWORD);
var WORDMASK=(WORDCARRY - 1);
var MAXWORDS=Math.floor(((PIXELS * 2 + BITSPERWORD - 1) / BITSPERWORD));

var BLACK=0;
var GREY =1;
var WHITE=2;

var B = {b_first: 0, b_words: 0, b_word: new Array(MAXWORDS)};
var F = new Array(PIXELS);

var levels = 
  [ /*        BLACK                        GREY                      WHITE  */
    [{p_offset:255, p_range:1  }, {p_offset:0, p_range:251}, {p_offset:251, p_range:4  }],/* Top of tree almost always grey */
    [{p_offset:255, p_range:1  }, {p_offset:0, p_range:200}, {p_offset:200, p_range:55 }],
    [{p_offset:223, p_range:33 }, {p_offset:0, p_range:159}, {p_offset:159, p_range:64 }],
    [{p_offset:0,   p_range:131}, {p_offset:0, p_range:0  }, {p_offset:131, p_range:125}] /* Grey disallowed at bottom */
  ];

/* At the bottom of the octree 2x2 elements are considered black if any
 * pixel is black.  The probabilities below give the distribution of the
 * 16 possible 2x2 patterns.  All white is not really a possibility and
 * has a probability range of zero.  Again, experimentally derived data */
var freqs =
  [
    {p_offset:0,   p_range:0 }, {p_offset:0,   p_range:38}, {p_offset:38,  p_range:38}, {p_offset:152, p_range:13},
    {p_offset:76,  p_range:38}, {p_offset:165, p_range:13}, {p_offset:178, p_range:13}, {p_offset:230, p_range:6 },
    {p_offset:114, p_range:38}, {p_offset:191, p_range:13}, {p_offset:204, p_range:13}, {p_offset:236, p_range:6 },
    {p_offset:217, p_range:13}, {p_offset:242, p_range:6 }, {p_offset:248, p_range:5 }, {p_offset:253, p_range:3 }
  ];

// table for Gen()
var G =
{
  g_00:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
        1,1,1,0,0,0,1,1,1,1,0,1,1,1,1,1,0,0,0,0,0,1,0,1,0,0,0,1,0,1,1,1,0,0,0,0,0,1,0,1,0,0,0,0,1,1,1,1,
        0,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,0,0,0,0,1,1,1,1,1,1,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,1,0,0,0,0,1,1,1,1,0,0,0,0,0,0,1,1,0,1,1,1,1,1,1,1,
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,1,
        0,1,0,0,0,1,0,1,0,0,1,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,1,
        0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,
        0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0,1,0,0,1,1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,1,1,1,1,1,
        0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,1,1,0,0,1,0,0,1,0,0,0,0,1,1,1,1,0,0,0,0,1,1,1,1,
        1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
        0,0,0,1,1,0,1,1,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,0,0,1,1,1,1,0,1,0,1,0,1,0,0,
        0,0,0,0,0,1,1,1,0,0,0,1,1,1,1,1,0,1,0,1,0,1,1,1,0,1,0,0,0,1,1,1,1,1,0,1,0,1,1,1,0,0,1,1,1,1,0,1,
        1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,0,1,1,1,1,1,0,0,0,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
        0,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,0,0,0,0,0,1,0,1,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,1,0,0,0,0,1,1,1,1,
        0,0,0,0,1,1,1,1,0,1,0,1,1,1,1,1,1,0,0,1,1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
        0,1,0,1,1,1,1,1,0,0,0,1,1,1,0,1,0,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,1,1,1,1,0,0,0,1,1,1,1,1,
        0,0,0,0,1,1,1,1,0,1,0,1,1,1,1,1,0,0,0,0,0,0,1,1,0,0,0,1,1,1,1,1,0,1,0,0,1,1,1,1,0,1,0,1,1,1,1,1,
        1,1,1,1,0,1,1,1,0,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,1,1,0,1,0,0,0,0,1,1,1,1,
        1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,0,1,1,1,1,1,1,0,0,0,0,1,1,1,1,0,1,0,0,1,1,1,1,
        1,1,0,1,0,1,1,1,0,0,1,1,1,1,1,1,0,1,0,0,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
        0,1,1,0,0,1,1,1,1,0,1,1,1,1,1,1,0,1,0,1,0,1,1,0,0,0,1,0,0,1,0,1,0,0,0,1,1,1,1,1,0,1,1,1,1,1,1,1,
        1,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,
        0,1,0,1,1,1,1,1,0,1,1,1,1,1,1,1,0,0,0,0,0,0,0,1,1,1,0,1,1,1,1,1,0,0,0,1,0,1,0,0,0,0,0,0,0,0,0,0,
        0,0,0,0,0,1,0,1,0,0,0,0,1,1,1,1,0,0,0,0,0,1,1,1,1,0,1,0,0,0,1,0,0,0,0,0,1,0,0,1,0,0,0,0,1,1,1,1,
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,1,0,1,1,1,1,1,
        0,0,0,1,1,0,0,0,1,1,0,1,0,1,1,1,1,0,0,1,0,1,0,0,0,1,1,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,
        0,0,0,1,1,1,1,1,1,0,1,1,0,1,1,1,0,0,0,0,1,1,0,0,0,0,0,0,0,1,1,1,0,0,0,0,1,1,1,1,0,0,0,0,1,1,1,1,
        0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,1,1,1,1,0,0,0,1,1,1,1,1,1,0,0,0,0,1,0,0,1,0,0,0,1,1,1,1,
        0,0,0,0,0,1,0,1,0,0,0,1,0,1,0,1,0,0,0,0,0,1,0,1,0,0,0,0,1,1,1,1,0,1,0,0,1,1,1,1,1,1,1,1,1,1,1,1,
        1,0,0,0,0,1,1,1,1,1,0,1,1,1,1,1,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,
        0,0,0,0,1,1,1,1,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,1,0,0,
        0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,1,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,0,0,0,1,1,1,1,
        0,1,0,0,1,0,1,0,0,1,0,0,0,0,0,0,0,1,0,1,1,1,1,1,0,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
        1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,
        1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0,1,1,1,1,1,1,1,1,1,1,0,1,
        1,1,0,1,0,1,1,1,0,1,0,1,1,1,1,1,0,1,0,0,1,1,1,1,0,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,
        1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,0,1,1,1,
        1,1,0,1,1,1,1,1,0,1,1,1,1,1,1,1,0,1,0,0,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
        0,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,
        0,0,0,0,1,1,1,1,0,1,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,1,1,1,0,1,1,1,1,1,1,1,1,1,
        0,0,0,0,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,
        1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,1,1,0,1,0,0,0,0,1,1,1,1,
        0,1,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,1,0,0,0,0,0,1,0,1,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,1,1,1,1,
        0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,1,0,
        0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
        0,0,0,0,0,1,0,1,0,0,0,0,1,1,1,1,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1,1,0,0,0,0,0,0,1,1,1,1,
        0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
        1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,1,
        0,0,0,0,0,0,0,1,0,0,0,1,0,1,0,1,1,0,1,0,1,1,1,1,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
        0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,1,0,0,0,0,0,1,1,0,0,
        0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,1,0,1,0,1,
        1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,
        0,1,1,1,1,1,1,1,0,1,0,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,1,1,0,1,0,0,1,1,1,1,0,0,1,1,1,1,1,0,
        0,0,0,0,0,1,0,1,0,0,0,0,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,0,0,1,0,1,0,1,0,1,0,0,1,1,1,1,
        0,0,0,0,1,1,0,1,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,1,0,0,0,0,1,1,1,1,0,1,0,0,1,1,1,1,0,1,0,1,1,1,1,1,
        1,0,0,1,1,1,1,1,1,1,0,1,1,1,1,1,0,0,1,0,0,1,0,1,0,0,0,0,1,1,1,0,0,0,0,0,1,1,0,1,0,0,0,0,1,1,0,1,
        0,1,0,0,1,1,1,1,0,1,1,1,1,1,1,1,1,0,0,0,1,1,1,1,0,0,0,0,1,1,1,1,0,0,0,0,1,1,1,1,1,1,1,1,1,0,1,0,
        0,0,0,0,0,1,0,0,0,1,0,0,1,1,1,1,0,1,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,0,1,1,1,0,1,1,1,
        0,1,0,0,0,1,1,1,1,1,1,0,1,1,0,1,0,0,0,0,0,1,0,1,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
        1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,0,0,1,1,1,1,0,1,1,0,1,1,1,1,1,1,0,1,1,0,0,0,0,1,0,1,1,1,1,1,
        0,0,0,0,1,1,1,1,0,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,0,1,0,1,1,1,1,1,0,0,0,0,0,1,1,1,0,0,0,0,1,1,1,1,
        1,0,0,1,0,1,0,0,0,0,0,0,1,1,0,1,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,1,0,0,0,1,1,0,0,1,0,1,0,1,1,1,
        0,0,0,0,0,0,0,1,0,0,0,0,1,1,0,1,0,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1,1,1,1,
        0,1,0,0,0,1,1,1,0,1,1,0,1,1,0,0,0,0,0,0,1,1,0,1,0,0,0,0,1,1,1,1,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,1,0,1,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,
        0,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,1,0,0,1,0,1,0,1,0,0,0,0,0,0,0,1,0,0,0,0,1,1,1,1,0,1,1,1,1,1,1,1,
        0,0,0,0,1,1,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,1,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
        0,0,0,0,1,1,1,1,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1,0,0,1,0,0,
        0,0,0,0,1,1,0,1,0,0,0,0,1,1,1,1,0,0,0,0,1,1,1,1,0,1,1,1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,0,1,1,1,1,1,
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,1,0,0,1,1,0,1,1,0,0,1,1,1,1,0,0,0,0,0,1,0,1,
        1,1,0,0,1,1,1,1,0,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
        0,0,0,1,0,1,1,1,0,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
        0,1,0,0,0,1,1,0,0,0,0,0,1,0,0,1,0,1,0,0,1,1,1,1,0,1,0,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,
        1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,1,0,1,0,1,0,0,0,1,0,0,0,1,0,1,0,0,1,1,1,0,1,1,1,1,1,1,1,
        0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,1,1,1,1,0,0,0,0,0,1,0,0,
        1,1,0,1,1,1,1,1,0,1,1,1,1,1,1,1,0,1,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,
        0,0,0,0,1,1,1,0,1,1,1,0,0,1,1,0,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
        1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,1,1,1,1,1,1,1,0,1,1,0,0,1,0,0,0,1,1,1,1,0,1,0,0,1,1,1,1,
        0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,1,1,1,1,1,1,0,0,1,1,1,1,
        1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
        0,0,0,0,0,0,1,1,0,0,0,0,1,1,0,0,1,0,0,1,1,1,0,1,0,0,0,0,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
        1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  g_01:[0,0,1,1,0,1,1,1,0,1,1,1,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,1,0,1,0,1,0,1,1,1,0,1,1,1,1,1,1,1,
        1,1,1,1,0,1,0,1,1,1,1,1,1,0,1,1,0,1,1,1,0,0,0,0,0,0,1,1,0,0,1,1,1,1,1,1,0,0,0,0,1,1,1,1,1,0,0,1,
        0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  g_02:[0,1,0,1],
  g_10:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,
        1,1,1,1,0,0,1,1,0,1,0,1,1,1,1,1,1,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,1,1,1,1,0,0,1,1,1,1,1,
        0,0,0,0,0,1,0,0,0,0,1,0,0,0,1,1,0,0,0,0,0,1,0,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,1,1,0,0,1,1,1,1,0,1,0,1,1,1,
        0,0,0,0,0,1,0,1,0,0,0,0,0,0,1,1,0,1,0,1,1,1,1,1,0,0,1,1,1,1,1,1,0,0,0,1,0,1,1,1,0,0,1,1,0,0,1,1,
        1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,
        0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,1,0,1,0,1,1,1,0,0,0,0,0,1,0,1,0,0,1,0,0,1,0,1,
        0,0,0,0,0,1,0,1,0,0,0,0,0,0,1,1,0,0,1,1,0,1,0,1,1,0,1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,
        0,0,0,0,0,1,1,1,0,1,1,0,1,1,1,1,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,1,1,1,0,0,0,0,0,1,1,0,
        1,1,1,1,1,0,1,0,1,1,1,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,1,1,0,0,0,1,1,1,1,1,1,0,0,1,1,1,1,1,
        0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  g_20:[0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,1,0,0,0,0,1,1,0,0,1,0,1,1,1,0,
        1,1,1,1,1,1,1,1,0,0,1,1,1,1,1,1],
  g_30:[0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,1,0,1,0,0,0,1,0,0,0,1,0,0,0,1,
        0,0,0,1,0,0,1,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,1,1,0,0,0,1,0,0,0,1,
        0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,1,1,0,0,1,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,1,1,0,0,0,1,0,0,0,1,
        0,0,0,1,0,0,1,1,0,0,0,1,0,0,1,1,0,0,0,1,0,0,1,1,0,0,0,1,0,0,1,1,0,0,1,1,0,0,0,1,0,0,1,1,0,0,0,1,
        0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,1,1,1,0,0,0,1,0,0,0,1,0,0,0,1,
        0,0,0,1,0,0,0,1,0,1,1,1,0,1,0,1],
  g_40:[0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,1,
        0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,1,0,0,1,1,1,0,
        1,1,1,0,0,1,0,0,0,0,0,0,1,1,0,1,0,0,0,1,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,
        0,1,0,0,0,1,0,0,0,1,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,1,1,1,1,0,0,0,0,1,1,1,1,
        1,0,1,0,1,1,1,0,1,0,1,0,1,1,1,1,0,1,0,0,0,1,0,1,0,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,
        0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,1,1,0,0,1,1,0,1,1,1,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,1,0,1,
        0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,0,1,
        0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,1,0,0,1,1,1,1,0,1,0,1,1,1,1,1,0,0,1,1,1,1,0,1,1,1,1,1,1,1,1,1,
        1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,1,1,1,0,0,1,1,1,1,1,1,1,1,
        1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,1,
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,1,1,1,
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,
        0,0,0,0,0,1,0,1,0,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,1,0,0,0,0,0,1,0,1,0,1,0,1,1,1,
        0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,1,0,1,0,1,1,1,0,1,1,1,0,0,0,0,1,1,0,1,0,1,0,1,1,1,1,1,
        0,1,0,0,1,1,0,1,1,1,1,1,1,1,1,1,0,1,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,
        0,0,0,0,0,1,0,1,0,1,1,1,1,1,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,1,0,1,0,0,1,0,1,1,1,1,1,1,1,1,1,1,1,1,
        0,1,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,1,1,0,1,1,1,1,1,1,1,0,1,0,0,0,0,0,1,0,0,0,0,0,0,1,1,1,1,
        0,0,0,0,0,1,1,1,0,0,0,1,1,1,1,1,0,0,0,0,0,1,1,1,0,1,1,1,1,1,1,1,0,0,0,0,1,1,1,1,1,0,1,1,1,1,1,1,
        0,0,0,0,1,1,0,1,0,1,1,1,1,1,1,1,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,1,0,0,1,1,0,1,0,1,1,1,1,1,0,1,
        0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1],
  g_11:[0,0,0,0,0,0,0,1,0,0,0,1,0,0,1,1,0,0,0,0,0,0,1,1,0,1,1,1,1,1,1,1],
  g_21:[0,0,0,1,0,1,1,1],
  g_31:[0,1,0,1,0,1,0,1,0,1,0,1,0,1,1,1,0,1,0,1,0,1,1,1,0,1,1,1,1,1,1,1],
  g_41:[0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,1,1,1,1,0,0,0,0,0,0,1,1,0,0,0,1,1,1,1,1,
        0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  g_12:[0,1],
  g_22:[0],
  g_32:[0,0,0,1],
  g_42:[0,0,0,1]
};


function BigMul(a) { // multiply B.b_word by a (B.b_word[0]=LSB)
  var i;
  if (a == 1 || !B.b_words)
    return;
  /* Treat this as a == WORDCARRY and just shift everything left a WORD */
  if (!a) {
    B.b_words++;
    if (B.b_first > 0)
        B.b_first--;
    else
    {
      for (i = B.b_words - 1; i >= 1; i--)
        B.b_word[i] = B.b_word[i - 1];
    }
    B.b_word[B.b_first] = 0;
    return;
  }

  var c = 0;
  var last = B.b_words + B.b_first - 1;
  var word = B.b_word;
  for (i = B.b_first; i <= last; i++) {
    c += word[i] * a;
    word[i] = (c & WORDMASK);
    c >>= BITSPERWORD;
  }
  if (c)
    word[B.b_first + B.b_words++] = c & WORDMASK;
}


function BigAdd(a) { // add a to B.b_word
  var i;
  a &= WORDMASK;
  if (!a)
    return;

  var c = a;
  var last = B.b_words + B.b_first - 1;
  for(i = B.b_first; i <= last; i++) {
    c += B.b_word[i];
    B.b_word[i] = c & WORDMASK;
    c >>= BITSPERWORD;
    if (!c)
      break;
  }
  if ((i > last) && c) {
    B.b_word[i] = c & WORDMASK;
    B.b_words++;
  }
}


function BigPop(p) { // p is freqs oder levels[lev]
  var r = B.b_word[B.b_first]; // r = LSB; B >> 8
  B.b_first++;
  B.b_words--;

  var i = 0;
  while ((r < p[i].p_offset) || (r >= p[i].p_range + p[i].p_offset))
    i++;
  BigMul(p[i].p_range);
  BigAdd(r - p[i].p_offset);
  return i;
}


function PopGreys(off, len) {
  if (len > 3) {
    len /= 2;
    PopGreys(off,                      len);
    PopGreys(off + len,                len);
    PopGreys(off + LENGTH * len,       len);
    PopGreys(off + LENGTH * len + len, len);
  } else {
    len = BigPop(freqs);
    if (len & 1)
      F[off] = 1;
    if (len & 2)
      F[off + 1] = 1;
    if (len & 4)
      F[off + LENGTH] = 1;
    if (len & 8)
      F[off + LENGTH + 1] = 1;
  }
}


function UnCompress(off, len, lev) {
  switch (BigPop(levels[lev])) {
    case WHITE:
      return;
    case BLACK:
      PopGreys(off, len);
      return;
    default :
      len /= 2;
      lev++;
      UnCompress(off,                      len, lev);
      UnCompress(off + len,                len, lev);
      UnCompress(off + len * LENGTH,       len, lev);
      UnCompress(off + len * LENGTH + len, len, lev);
      return;
  }
}

function UnCompAll(fbuf) {
  var i;
  B.b_words = B.b_first = 0;
  // convert base 94 to base 256
  var kl = fbuf.length;
  for (i = 0; i < kl; ++i) {
    BigMul(NUMPRINTS);
    BigAdd(fbuf.charCodeAt(i) - FIRSTPRINT);
  }
  // empty icon
  for (i = 0; i < PIXELS; i++)
      F[i] = 0;
  // uncompress
  UnCompress(0,    16, 0);
  UnCompress(16,   16, 0);
  UnCompress(32,   16, 0);
  UnCompress(768,  16, 0);
  UnCompress(784,  16, 0);
  UnCompress(800,  16, 0);
  UnCompress(1536, 16, 0);
  UnCompress(1552, 16, 0);
  UnCompress(1568, 16, 0);
}

function Gen() {
  var m, l, k, j, i, h=0;
  for (j = 0; j < LENGTH;  j++) {
    for (i = 0; i < LENGTH;  i++) {
      k = 0;
      for (l = i - 2; l <= i + 2; l++)
        for (m = j - 2; m <= j; m++) {
          if ((l >= i) && (m == j))
            continue;
          if ((l > 0) && (l <= LENGTH) && (m > 0))
            k = F[l + m * LENGTH] ? k * 2 + 1 : k * 2;
        }
      switch (i) {
        case 1 :
            switch (j) {
                case 1 : F[h] ^= G.g_22[k]; break;
                case 2 : F[h] ^= G.g_21[k]; break;
                default: F[h] ^= G.g_20[k]; break;
            }
            break;
        case 2 :
            switch (j) {
                case 1 : F[h] ^= G.g_12[k]; break;
                case 2 : F[h] ^= G.g_11[k]; break;
                default: F[h] ^= G.g_10[k]; break;
            }
            break;
        case LENGTH - 1 :
            switch (j) {
                case 1 : F[h] ^= G.g_42[k]; break;
                case 2 : F[h] ^= G.g_41[k]; break;
                default: F[h] ^= G.g_40[k]; break;
            }
            break;
        case LENGTH :
            switch (j) {
                case 1 : F[h] ^= G.g_32[k]; break;
                case 2 : F[h] ^= G.g_31[k]; break;
                default: F[h] ^= G.g_30[k]; break;
            }
            break;
        default :
            switch (j) {
                case 1 : F[h] ^= G.g_02[k]; break;
                case 2 : F[h] ^= G.g_01[k]; break;
                default: F[h] ^= G.g_00[k]; break;
            }
            break;
      }
      ++h;
    }
  }
}
/*
function FaceURL(face) {
  var i;
  UnCompAll(face.replace(/[^!-~]/g, "")); // eliminate illegal chars
  Gen();
  var bmp = "BM\xBE\1\0\0\0\0\0\0>\0\0\0(\0\0\0\x30\0\0\0\x30\0\0\0\1\0\1\0\0\0\0\0\x80\1\0\0\xC4\x0E\0\0\xC4\x0E\0\0\0\0\0\0\0\0\0\0\xFF\xFF\xFF\0\0\0\0\0";
  var ff = F.join("").replace(/(.{48})/g, "$1,").split(",").reverse().join("")
            .replace(/(.{8})(.{8})(.{8})(.{8})(.{8})(.{8})/g,
            function(s,a,b,c,d,e,f) {
              return String.fromCharCode(parseInt(a,2))
                   + String.fromCharCode(parseInt(b,2))
                   + String.fromCharCode(parseInt(c,2))
                   + String.fromCharCode(parseInt(d,2))
                   + String.fromCharCode(parseInt(e,2))
                   + String.fromCharCode(parseInt(f,2)) + "\0\0";
            });
  bmp = "data:image/bmp;base64," + btoa(bmp + ff);
  return bmp;
}
*/
//
// PNG transformation
//

// call this only once, just use output with different xfaces!
function PNGFace()
{
  // array of one byte strings, initialized to zero bytes
  this.png = new Array(2444);
  for (let n = 0; n < 2444; n++)
    this.png[n] = String.fromCharCode(0);

  this.Insert(   0, '\x00\x00\x00\rIHDR\x00\x00\x000\x00\x00\x000\b\x03');
  this.Insert(  25, '\x00\x00\x00\x06PLTE');
  this.Insert(  43, '\x00\x00\x00\x02tRNS');
  this.Insert(  57, '\x00\x00\t;IDATx\xDA\x010\t\xCF\xF6');
  this.Insert(2432, '\x00\x00\x00\x00IEND');

  /* Table of CRCs of all 8-bit messages. */
  this.crc32_table = new Array(256);
  for (let n = 0; n < 256; n++)
  {
    let c = n;
    for (let k = 0; k < 8; k++)
    {
      if (c & 1)
        c = -306674912 ^ ((c >> 1) & 0x7fffffff);
      else
        c = (c >> 1) & 0x7fffffff;
    }
    this.crc32_table[n] = c;
  }
}

// set color in PNG - with alpha in byte format (0-255)!
// index 0 = background
// index 1 = foreground
PNGFace.prototype.Color = function(index, asRGBA)
{
  let oRGBA = asRGBA.split(",");
  this.png[33+index*3+0] = String.fromCharCode(Number(oRGBA[0]));
  this.png[33+index*3+1] = String.fromCharCode(Number(oRGBA[1]));
  this.png[33+index*3+2] = String.fromCharCode(Number(oRGBA[2]));
  this.png[51+index]     = String.fromCharCode(Number(oRGBA[3]) * 255);
}

// insert string into array
PNGFace.prototype.Insert = function(offs, str)
{
  for (let j = 0; j < str.length; ++j)
    this.png[offs++] = str.charAt(j);
}
PNGFace.prototype.Insert4 = function(offs, w)
{
  this.Insert(offs, String.fromCharCode((w>>24)&255, (w>>16)&255, (w>>8)&255, w&255));
}

// compute crc32 of the PNG chunks
PNGFace.prototype.CRC32 = function(offs, size)
{
  let crc = -1; // initialize crc
  for (let i = 4; i < size - 4; ++i)
    crc = this.crc32_table[(crc ^ this.png[offs + i].charCodeAt(0)) & 0xff] ^ ((crc >> 8) & 0x00ffffff);
  this.Insert4(offs + size - 4, crc ^ -1);
}

// output a PNG string
PNGFace.prototype.URL = function(xface)
{
  // compute adler32 of output pixels + row filter bytes
  let BASE = 65521; /* largest prime smaller than 65536 */
  let NMAX = 5552;  /* NMAX is the largest n such that 255n(n+1)/2 + (n+1)(BASE-1) <= 2^32-1 */
  let s1 = 1;
  let s2 = 0;
  let n = NMAX;
  for (let y = 0; y < 48; ++y)
    for (let x = -1; x < 48; ++x)
    {
      let i = y * 49 + x + 73;
      if (x >= 0)
        this.png[i] = String.fromCharCode(xface[x + y * 48]); // set X-Face dot
      s1 += this.png[i].charCodeAt(0);
      s2 += s1;
      if (!(n -= 1))
      {
        s1 %= BASE;
        s2 %= BASE;
        n = NMAX;
      }
    }
  s1 %= BASE;
  s2 %= BASE;
  this.Insert4(2424, (s2 << 16) | s1);

  this.CRC32(   0,   25);
  this.CRC32(  25,   18);
  this.CRC32(  43,   14);
  this.CRC32(  57, 2375);
  this.CRC32(2432,   12);

  // convert PNG to string
  return "\211PNG\r\n\032\n"+this.png.join('');
}


function ReadCSSColor(aoComputedStyle, asColorName, asDefaultValue)
{
  let sColor = aoComputedStyle.getPropertyCSSValue(asColorName).cssText;
  if (/^rgba\(/.test(sColor))
  {
    // have rgba values
    sColor = sColor.substr(5, sColor.length - 6);
  }
  else if (/^rgb\(/.test(sColor))
  {
    // only rgb values, assume opaque
    sColor = sColor.substr(4, sColor.length - 5) + ",1";
  }
  else if (sColor == "transparent")
  {
    // special value
    sColor = "0,0,0,0";
  }
  else
  {
    // default: plain opaque white
    sColor = asDefaultValue;
  }
  return sColor;
}


//
//  Create data URL for X-Face-PNG
//
let goPNGFace = new PNGFace();

function FaceURL(asFace, aoComputedStyle)
{
  UnCompAll(asFace.replace(/[^!-~]/g, "")); // eliminate illegal chars
  Gen();

  // set colour values:
  //  #fromBuddyIconXFace
  //  {
  //    color:            green;
  //    color:            -moz-rgba(50%, 50%, 50%, 0.5);
  //    background-color: red;
  //    background-color: transparent;
  //    padding:          0 ! important;
  //    margin:           5px;
  //  }
  // Unfortunately, the alpha channel value of -moz-rgba is retrievable
  // only on trunk since about 2007-01-24...

  // background; defaults to plain opaque white
  let sBackColors = ReadCSSColor(aoComputedStyle, "background-color", "255,255,255,1");
  goPNGFace.Color(0, sBackColors);
  // foreground; defaults to plain opaque black
  let oForeColors = ReadCSSColor(aoComputedStyle, "color", "0,0,0,1");
  goPNGFace.Color(1, oForeColors);

  return "data:image/png;base64," + btoa(goPNGFace.URL(F));
}
