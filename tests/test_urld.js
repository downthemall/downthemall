/* eslint-env node */
/* eslint-disable @typescript-eslint/no-var-requires */
"use strict";
// License: CC0 1.0

require("../lib/util");

describe("URLd", function() {
  it("basic domain", function() {
    let u = new URL("https://www.google.de");
    expect(u.domain).to.equal("google.de");
    u = new URL("https://www.google.de:8443");
    expect(u.domain).to.equal("google.de");
  });

  it("plain basic domain", function() {
    const u = new URL("https://google.de");
    expect(u.domain).to.equal("google.de");
  });

  it("special domain", function() {
    let u = new URL("https://www.google.co.uk");
    expect(u.domain).to.equal("google.co.uk");
    u = new URL("https://google.co.uk");
    expect(u.domain).to.equal("google.co.uk");
    u = new URL("https://www.google.co.uk:8443");
    expect(u.domain).to.equal("google.co.uk");
  });

  it("ipv4", function() {
    let u = new URL("https://127.0.0.1:8443");
    expect(u.domain).to.equal("127.0.0.1");
    u = new URL("https://0.0.0.0:8443");
    expect(u.domain).to.equal("0.0.0.0");
  });

  it("ipv6", function() {
    let u = new URL("https://[::1]:8443");
    expect(u.domain).to.equal("[::1]");
    u = new URL("https://[2a00:1450:4005:800::2003]:8443");
    expect(u.domain).to.equal("[2a00:1450:4005:800::2003]");
  });
});
