"use strict";
// License: CC0 1.0

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {MimeDB} = require("../lib/mime");

describe("MIME", function() {
  it("general", function() {
    expect(MimeDB.getMime("image/jpeg").major).to.equal("image");
    expect(MimeDB.getMime("image/jpeg").minor).to.equal("jpeg");
    expect(MimeDB.getMime("iMage/jPeg").major).to.equal("image");
    expect(MimeDB.getMime("imAge/jpEg").minor).to.equal("jpeg");
  });

  it("exts", function() {
    expect(MimeDB.getMime("image/jpeg").primary).to.equal("jpg");
    expect(MimeDB.getMime("image/jpeg").primary).to.equal(
      MimeDB.getPrimary("image/jpeg"));
    expect(MimeDB.getMime("iMage/jPeg").primary).to.equal("jpg");
    expect(MimeDB.getMime("imAge/jpEg").primary).to.equal(
      MimeDB.getPrimary("image/jpeg"));
    expect(Array.from(MimeDB.getMime("imAge/jpEg").extensions)).to.deep.equal(
      ["jpg", "jpeg", "jpe", "jfif"]);
  });

  it("application/octet-stream should not yield results", function() {
    expect(MimeDB.getPrimary("application/octet-stream")).to.equal("");
    expect(MimeDB.getMime("application/octet-Stream")).to.be.undefined;
  });
});
