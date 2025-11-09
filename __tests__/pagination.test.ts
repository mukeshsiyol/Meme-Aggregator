import { Buffer } from "buffer";

test("encodes and decodes cursor correctly", () => {
  const cursor = { offset: 40 };
  const encoded = Buffer.from(JSON.stringify(cursor)).toString("base64");
  const decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  expect(decoded.offset).toBe(40);
});
