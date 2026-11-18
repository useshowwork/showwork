const { test } = require("node:test");
const assert = require("node:assert/strict");
const sharp = require("sharp");
const { load } = require("./helpers/load-typescript.cjs");

const { IDENTITY_IMAGE_MAX_BYTES } = load("lib/identityImageLimits.ts");
const prefix = "calendars/workspace/logos/";
const oldKey = prefix + "01234567-0123-0123-0123-012345678901.webp";
const publicUrlFor = (key) => "https://media.example.test/" + key;

function fixture() {
  const objects = new Map();
  const removed = [];
  const { updateIdentityImage } = load("lib/identityImages.ts", {
    "@/lib/r2": {
      publicUrlFor,
      putIdentityImage: async (key, image) => objects.set(key, image),
      deleteObject: async (key) => { removed.push(key); objects.delete(key); },
    },
  });
  return { objects, removed, updateIdentityImage };
}

const request = (body, type = "image/png") => new Request("https://example.test", {
  method: "POST",
  headers: { "Content-Type": type },
  body,
  ...(body instanceof ReadableStream ? { duplex: "half" } : {}),
});

test("workspace logos save the selected square and replace the previous stored image", async () => {
  const { objects, removed, updateIdentityImage } = fixture();
  const source = await sharp({ create: { width: 512, height: 512, channels: 4, background: "#ff000080" } }).png().toBuffer();
  let savedUrl;
  const response = await updateIdentityImage(request(source), prefix, publicUrlFor(oldKey), async (url) => {
    savedUrl = url;
    return true;
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { imageUrl: savedUrl });
  const [key, image] = [...objects.entries()][0];
  assert.equal(savedUrl, publicUrlFor(key));
  const { format, width, height, hasAlpha } = await sharp(image).metadata();
  assert.deepEqual({ format, width, height, hasAlpha }, { format: "webp", width: 512, height: 512, hasAlpha: true });
  assert.deepEqual(removed, [oldKey]);
});

test("invalid and oversized uploads never reach storage or change the image", async () => {
  const { objects, updateIdentityImage } = fixture();
  const save = () => { throw new Error("Unexpected save"); };
  for (const [body, type, status] of [
    [Buffer.from("fake image"), "image/png", 400],
    [Buffer.from("<svg/>"), "image/svg+xml", 415],
    [new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(IDENTITY_IMAGE_MAX_BYTES + 1)); controller.close(); } }), "image/png", 413],
  ]) {
    const response = await updateIdentityImage(request(body, type), prefix, null, save);
    assert.equal(response.status, status);
  }
  assert.equal(objects.size, 0);
});

test("an outdated upload is discarded without deleting the active image", async () => {
  const { objects, removed, updateIdentityImage } = fixture();
  const source = await sharp({ create: { width: 20, height: 20, channels: 3, background: "blue" } }).png().toBuffer();
  const response = await updateIdentityImage(request(source), prefix, publicUrlFor(oldKey), async () => false);
  assert.equal(response.status, 409);
  assert.equal(objects.size, 0);
  assert.equal(removed.length, 1);
  assert.notEqual(removed[0], oldKey);
});

test("workspace logo updates require workspace management permission", async () => {
  const { POST, DELETE } = load("app/api/calendars/[id]/logo/route.ts", {
    "@/lib/auth": { getCurrentCreator: async () => ({ id: "member" }) },
    "@/lib/calendarPermissions": {
      hasCalendarPermission: async (...args) => {
        assert.deepEqual(args, ["member", "workspace", "workspace.manage"]);
        return false;
      },
    },
    "@/lib/db": { db: {} },
    "@/lib/identityImages": { updateIdentityImage: () => assert.fail("A viewer cannot change the logo") },
  });
  for (const handler of [POST, DELETE]) {
    const result = await handler(new Request("https://example.test"), { params: Promise.resolve({ id: "workspace" }) });
    assert.equal(result.status, 403);
  }
});
