/* eslint-disable max-len */
/* eslint-env node */
"use strict";
// License: MPL-2

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { CDHeaderParser } = require("../lib/cdheaderparser");

const parser = new CDHeaderParser();

function check(header, expected) {
  expect(parser.parse(header)).to.equal(expected);
}

function nocheck(header, expected) {
  expect(parser.parse(header)).not.to.equal(expected);
}

describe("CDHeaderParser", function() {
  it("parse wget", function() {
    // From wget, test_parse_content_disposition
    // http://git.savannah.gnu.org/cgit/wget.git/tree/src/http.c?id=8551ceccfedb4390fbfa82c12f0ff714dab1ac76#n5325
    check("filename=\"file.ext\"", "file.ext");
    check("attachment; filename=\"file.ext\"", "file.ext");
    check("attachment; filename=\"file.ext\"; dummy", "file.ext");
    check("attachment", ""); // wget uses NULL, we use "".
    check("attachement; filename*=UTF-8'en-US'hello.txt", "hello.txt");
    check("attachement; filename*0=\"hello\"; filename*1=\"world.txt\"",
      "helloworld.txt");
    check("attachment; filename=\"A.ext\"; filename*=\"B.ext\"", "B.ext");
    check("attachment; filename*=\"A.ext\"; filename*0=\"B\"; filename*1=\"B.ext\"",
      "A.ext");
    // This test is faulty - https://savannah.gnu.org/bugs/index.php?52531
    //check("filename**0=\"A\"; filename**1=\"A.ext\"; filename*0=\"B\";filename*1=\"B\"", "AA.ext");
  });

  it("parse Firefox", function() {
    // From Firefox
    // https://searchfox.org/mozilla-central/rev/45a3df4e6b8f653b0103d18d97c34dd666706358/netwerk/test/unit/test_MIME_params.js
    // Changed as follows:
    // - Replace error codes with empty string (we never throw).

    const BS = "\\";
    const DQUOTE = "\"";
    // No filename parameter: return nothing
    check("attachment;", "");
    // basic
    check("attachment; filename=basic", "basic");
    // extended
    check("attachment; filename*=UTF-8''extended", "extended");
    // prefer extended to basic (bug 588781)
    check("attachment; filename=basic; filename*=UTF-8''extended", "extended");
    // prefer extended to basic (bug 588781)
    check("attachment; filename*=UTF-8''extended; filename=basic", "extended");
    // use first basic value (invalid; error recovery)
    check("attachment; filename=first; filename=wrong", "first");
    // old school bad HTTP servers: missing 'attachment' or 'inline'
    // (invalid; error recovery)
    check("filename=old", "old");
    check("attachment; filename*=UTF-8''extended", "extended");
    // continuations not part of RFC 5987 (bug 610054)
    check("attachment; filename*0=foo; filename*1=bar", "foobar");
    // Return first continuation (invalid; error recovery)
    check("attachment; filename*0=first; filename*0=wrong; filename=basic", "first");
    // Only use correctly ordered continuations  (invalid; error recovery)
    check("attachment; filename*0=first; filename*1=second; filename*0=wrong", "firstsecond");
    // prefer continuation to basic (unless RFC 5987)
    check("attachment; filename=basic; filename*0=foo; filename*1=bar", "foobar");
    // Prefer extended to basic and/or (broken or not) continuation
    // (invalid; error recovery)
    check("attachment; filename=basic; filename*0=first; filename*0=wrong; filename*=UTF-8''extended", "extended");
    // RFC 2231 not clear on correct outcome: we prefer non-continued extended
    // (invalid; error recovery)
    check("attachment; filename=basic; filename*=UTF-8''extended; filename*0=foo; filename*1=bar", "extended");
    // Gaps should result in returning only value until gap hit
    // (invalid; error recovery)
    check("attachment; filename*0=foo; filename*2=bar", "foo");
    // Don't allow leading 0's (*01) (invalid; error recovery)
    check("attachment; filename*0=foo; filename*01=bar", "foo");
    // continuations should prevail over non-extended (unless RFC 5987)
    check("attachment; filename=basic; filename*0*=UTF-8''multi;\r\n" +
      " filename*1=line;\r\n" +
      " filename*2*=%20extended",
    "multiline extended");
    // Gaps should result in returning only value until gap hit
    // (invalid; error recovery)
    check("attachment; filename=basic; filename*0*=UTF-8''multi;\r\n" +
      " filename*1=line;\r\n" +
      " filename*3*=%20extended",
    "multiline");
    // First series, only please, and don't slurp up higher elements (*2 in this
    // case) from later series into earlier one (invalid; error recovery)
    check("attachment; filename=basic; filename*0*=UTF-8''multi;\r\n" +
      " filename*1=line;\r\n" +
      " filename*0*=UTF-8''wrong;\r\n" +
      " filename*1=bad;\r\n" +
      " filename*2=evil",
    "multiline");
    // RFC 2231 not clear on correct outcome: we prefer non-continued extended
    // (invalid; error recovery)
    check("attachment; filename=basic; filename*0=UTF-8''multi\r\n;" +
      " filename*=UTF-8''extended;\r\n" +
      " filename*1=line;\r\n" +
      " filename*2*=%20extended",
    "extended");
    // sneaky: if unescaped, make sure we leave UTF-8'' in value
    check("attachment; filename*0=UTF-8''unescaped;\r\n" +
      " filename*1*=%20so%20includes%20UTF-8''%20in%20value",
    "UTF-8''unescaped so includes UTF-8'' in value");
    // sneaky: if unescaped, make sure we leave UTF-8'' in value
    check("attachment; filename=basic; filename*0=UTF-8''unescaped;\r\n" +
      " filename*1*=%20so%20includes%20UTF-8''%20in%20value",
    "UTF-8''unescaped so includes UTF-8'' in value");
    // Prefer basic over invalid continuation
    // (invalid; error recovery)
    check("attachment; filename=basic; filename*1=multi;\r\n" +
      " filename*2=line;\r\n" +
      " filename*3*=%20extended",
    "basic");
    // support digits over 10
    check("attachment; filename=basic; filename*0*=UTF-8''0;\r\n" +
      " filename*1=1; filename*2=2;filename*3=3;filename*4=4;filename*5=5;\r\n" +
      " filename*6=6; filename*7=7;filename*8=8;filename*9=9;filename*10=a;\r\n" +
      " filename*11=b; filename*12=c;filename*13=d;filename*14=e;filename*15=f\r\n",
    "0123456789abcdef");
    // support digits over 10 (detect gaps)
    check("attachment; filename=basic; filename*0*=UTF-8''0;\r\n" +
      " filename*1=1; filename*2=2;filename*3=3;filename*4=4;filename*5=5;\r\n" +
      " filename*6=6; filename*7=7;filename*8=8;filename*9=9;filename*10=a;\r\n" +
      " filename*11=b; filename*12=c;filename*14=e\r\n",
    "0123456789abc");
    // return nothing: invalid
    // (invalid; error recovery)
    check("attachment; filename*1=multi;\r\n" +
      " filename*2=line;\r\n" +
      " filename*3*=%20extended",
    "");
    // Bug 272541: Empty disposition type treated as "attachment"
    // sanity check
    check("attachment; filename=foo.html", "foo.html");
    // the actual bug
    check("; filename=foo.html", "foo.html");
    // regression check, but see bug 671204
    check("filename=foo.html", "foo.html");
    // Bug 384571: RFC 2231 parameters not decoded when appearing in reversed order
    // check ordering
    check("attachment; filename=basic; filename*0*=UTF-8''0;\r\n" +
      " filename*1=1; filename*2=2;filename*3=3;filename*4=4;filename*5=5;\r\n" +
      " filename*6=6; filename*7=7;filename*8=8;filename*9=9;filename*10=a;\r\n" +
      " filename*11=b; filename*12=c;filename*13=d;filename*15=f;filename*14=e;\r\n",
    "0123456789abcdef");
    // check non-digits in sequence numbers
    check("attachment; filename=basic; filename*0*=UTF-8''0;\r\n" +
      " filename*1a=1\r\n",
    "0");
    // check duplicate sequence numbers
    check("attachment; filename=basic; filename*0*=UTF-8''0;\r\n" +
      " filename*0=bad; filename*1=1;\r\n",
    "0");
    // check overflow
    check("attachment; filename=basic; filename*0*=UTF-8''0;\r\n" +
      " filename*11111111111111111111111111111111111111111111111111111111111=1",
    "0");
    // check underflow
    check("attachment; filename=basic; filename*0*=UTF-8''0;\r\n" +
      " filename*-1=1",
    "0");
    // check mixed token/quoted-string
    check("attachment; filename=basic; filename*0=\"0\";\r\n" +
      " filename*1=1;\r\n" +
      " filename*2*=%32",
    "012");
    // check empty sequence number
    check("attachment; filename=basic; filename**=UTF-8''0\r\n", "basic");
    // Bug 419157: ensure that a MIME parameter with no charset information
    // fallbacks to Latin-1
    check("attachment;filename=IT839\x04\xB5(m8)2.pdf;", "IT839\u0004\u00b5(m8)2.pdf");
    // Bug 588389: unescaping backslashes in quoted string parameters
    // '\"', should be parsed as '"'
    check(`attachment; filename=${DQUOTE}${BS + DQUOTE}${DQUOTE}`, DQUOTE);
    // 'a\"b', should be parsed as 'a"b'
    check(`attachment; filename=${DQUOTE}a${BS + DQUOTE}b${DQUOTE}`, `a${DQUOTE}b`);
    // '\x', should be parsed as 'x'
    check(`attachment; filename=${DQUOTE}${BS}x${DQUOTE}`, "x");
    // test empty param (quoted-string)
    check(`attachment; filename=${DQUOTE}${DQUOTE}`, "");
    // test empty param
    check("attachment; filename=", "");
    // Bug 601933: RFC 2047 does not apply to parameters (at least in HTTP)
    check("attachment; filename==?ISO-8859-1?Q?foo-=E4.html?=", "foo-\u00e4.html");
    check("attachment; filename=\"=?ISO-8859-1?Q?foo-=E4.html?=\"", "foo-\u00e4.html");
    // format sent by GMail as of 2012-07-23 (5987 overrides 2047)
    check("attachment; filename=\"=?ISO-8859-1?Q?foo-=E4.html?=\"; filename*=UTF-8''5987", "5987");
    // Bug 651185: double quotes around 2231/5987 encoded param
    // Change reverted to backwards compat issues with various web services,
    // such as OWA (Bug 703015), plus similar problems in Thunderbird. If this
    // is tried again in the future, email probably needs to be special-cased.
    // sanity check
    check("attachment; filename*=utf-8''%41", "A");
    // the actual bug
    check(`attachment; filename*=${DQUOTE}utf-8''%41${DQUOTE}`, "A");
    // Bug 670333: Content-Disposition parser does not require presence of "="
    // in params
    // sanity check
    check("attachment; filename*=UTF-8''foo-%41.html", "foo-A.html");
    // the actual bug
    check("attachment; filename *=UTF-8''foo-%41.html", "");
    // the actual bug, without 2231/5987 encoding
    check("attachment; filename X", "");
    // sanity check with WS on both sides
    check("attachment; filename = foo-A.html", "foo-A.html");
    // Bug 685192: in RFC2231/5987 encoding, a missing charset field should be
    // treated as error
    // the actual bug
    check("attachment; filename*=''foo", "foo");
    // sanity check
    check("attachment; filename*=a''foo", "foo");
    // Bug 692574: RFC2231/5987 decoding should not tolerate missing single
    // quotes
    // one missing
    check("attachment; filename*=UTF-8'foo-%41.html", "foo-A.html");
    // both missing
    check("attachment; filename*=foo-%41.html", "foo-A.html");
    // make sure fallback works
    check("attachment; filename*=UTF-8'foo-%41.html; filename=bar.html", "foo-A.html");
    // Bug 693806: RFC2231/5987 encoding: charset information should be treated
    // as authoritative
    // UTF-8 labeled ISO-8859-1
    check("attachment; filename*=ISO-8859-1''%c3%a4", "\u00c3\u00a4");
    // UTF-8 labeled ISO-8859-1, but with octets not allowed in ISO-8859-1
    // accepts x82, understands it as Win1252, maps it to Unicode \u20a1
    check("attachment; filename*=ISO-8859-1''%e2%82%ac", "\u00e2\u201a\u00ac");
    // defective UTF-8
    nocheck("attachment; filename*=UTF-8''A%e4B", "");
    // defective UTF-8, with fallback
    nocheck("attachment; filename*=UTF-8''A%e4B; filename=fallback", "fallback");
    // defective UTF-8 (continuations), with fallback
    nocheck("attachment; filename*0*=UTF-8''A%e4B; filename=fallback", "fallback");
    // check that charsets aren't mixed up
    check("attachment; filename*0*=ISO-8859-15''euro-sign%3d%a4; filename*=ISO-8859-1''currency-sign%3d%a4", "currency-sign=\u00a4");
    // same as above, except reversed
    check("attachment; filename*=ISO-8859-1''currency-sign%3d%a4; filename*0*=ISO-8859-15''euro-sign%3d%a4", "currency-sign=\u00a4");
    // Bug 704989: add workaround for broken Outlook Web App (OWA)
    // attachment handling
    check("attachment; filename*=\"a%20b\"", "a b");
    // Bug 717121: crash nsMIMEHeaderParamImpl::DoParameterInternal
    check("attachment; filename=\"", "");
    // We used to read past string if last param w/o = and ;
    // Note: was only detected on windows PGO builds
    check("attachment; filename=foo; trouble", "foo");
    // Same, followed by space, hits another case
    check("attachment; filename=foo; trouble ", "foo");
    check("attachment", "");
    // Bug 730574: quoted-string in RFC2231-continuations not handled
    check("attachment; filename=basic; filename*0=\"foo\"; filename*1=\"\\b\\a\\r.html\"", "foobar.html");
    // unmatched escape char
    check("attachment; filename=basic; filename*0=\"foo\"; filename*1=\"\\b\\a\\", "fooba\\");
    // Bug 732369: Content-Disposition parser does not require presence of ";" between params
    // optimally, this would not even return the disposition type "attachment"
    check("attachment; extension=bla filename=foo", "");
    check("attachment; filename=foo extension=bla", "foo");
    check("attachment filename=foo", "");
    // Bug 777687: handling of broken %escapes
    nocheck("attachment; filename*=UTF-8''f%oo; filename=bar", "bar");
    nocheck("attachment; filename*=UTF-8''foo%; filename=bar", "bar");
    // Bug 783502 - xpcshell test netwerk/test/unit/test_MIME_params.js fails on AddressSanitizer
    check("attachment; filename=\"\\b\\a\\", "ba\\");
  });

  it("parse extra", function() {
    // Extra tests, not covered by above tests.
    check("inline; FILENAME=file.txt", "file.txt");
    check("INLINE; FILENAME= \"an example.html\"", "an example.html"); // RFC 6266, section 5.
    check("inline; filename= \"tl;dr.txt\"", "tl;dr.txt");
    check("INLINE; FILENAME*= \"an example.html\"", "an example.html");
    check("inline; filename*= \"tl;dr.txt\"", "tl;dr.txt");
    check("inline; filename*0=\"tl;dr and \"; filename*1=more.txt", "tl;dr and more.txt");
  });

  it("parse issue 26", function() {
    // https://github.com/Rob--W/open-in-browser/issues/26
    check("attachment; filename=\xe5\x9c\x8b.pdf", "\u570b.pdf");
  });

  it("parse issue 35", function() {
    // https://github.com/Rob--W/open-in-browser/issues/35
    check("attachment; filename=okre\x9clenia.rtf", "okreœlenia.rtf");
  });
});
