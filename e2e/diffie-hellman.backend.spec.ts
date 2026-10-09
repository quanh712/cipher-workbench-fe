import { expect, test, type APIRequestContext, type APIResponse } from "@playwright/test";

const preset = { q: "23", alpha: "5", privateKeyA: "6", privateKeyB: "15" };
const warning = {
  code: "EDUCATIONAL_PRIVATE_KEYS",
  message:
    "Response trả khóa riêng để minh họa và đối chiếu phép tính. Trong hệ thống thực tế, khóa riêng không được gửi hoặc lưu ngoài bên sở hữu; khóa công khai phải được xác thực để chống tấn công người đứng giữa (MITM).",
};

// Independent arithmetic oracle, confined to integration tests.
function traceOracle(base: string, exponent: string, modulus: string) {
  const q = BigInt(modulus);
  const b = BigInt(base);
  let result = 1n;
  let prefix = 0n;
  return [...BigInt(exponent).toString(2)].map((digit, index) => {
    const bit = digit === "1" ? 1 : 0;
    const squared = (result * result) % q;
    const multiplied = bit ? (squared * b) % q : null;
    result = multiplied ?? squared;
    prefix = prefix * 2n + BigInt(bit);
    return {
      index,
      bit,
      exponentPrefix: String(prefix),
      squared: String(squared),
      multiplied: multiplied === null ? null : String(multiplied),
      result: String(result),
    };
  });
}
function exchangeOracle(q: string, alpha: string, privateKeyA: string, privateKeyB: string) {
  const publicA = traceOracle(alpha, privateKeyA, q);
  const publicB = traceOracle(alpha, privateKeyB, q);
  const publicKeyA = publicA.at(-1)!.result;
  const publicKeyB = publicB.at(-1)!.result;
  const sharedA = traceOracle(publicKeyB, privateKeyA, q);
  const sharedB = traceOracle(publicKeyA, privateKeyB, q);
  return {
    success: true,
    privateKeyA,
    privateKeyB,
    publicKeyA,
    publicKeyB,
    sharedKeyA: sharedA.at(-1)!.result,
    sharedKeyB: sharedB.at(-1)!.result,
    match: true,
    steps: { publicKeyA: publicA, publicKeyB: publicB, sharedKeyA: sharedA, sharedKeyB: sharedB },
    warning,
  };
}
async function readDh(response: APIResponse, status = 200) {
  expect(response.status()).toBe(status);
  expect(response.headers()["content-type"]).toMatch(/^application\/json\b/i);
  // The canonical DH contract does not promise a response size or no-store header.
  return response.json();
}

for (const [a, b] of [
  ["6", "15"],
  ["15", "6"],
]) {
  test(`exchange ${a}/${b}: exact response and four left-to-right traces`, async ({ request }) => {
    expect(
      await readDh(
        await request.post("/api/dh/exchange", {
          data: { ...preset, privateKeyA: a, privateKeyB: b },
        }),
      ),
    ).toEqual(exchangeOracle("23", "5", a, b));
  });
}

test("manual params: missing alpha is a suggestion, explicit alpha has checks", async ({
  request,
}) => {
  expect(await readDh(await request.post("/api/dh/params", { data: { q: "23" } }))).toEqual({
    success: true,
    q: "23",
    alpha: null,
    factors: ["2", "11"],
    primitiveRootChecks: [],
    suggestedAlpha: "5",
  });
  expect(
    await readDh(await request.post("/api/dh/params", { data: { q: "23", alpha: "5" } })),
  ).toEqual({
    success: true,
    q: "23",
    alpha: "5",
    factors: ["2", "11"],
    primitiveRootChecks: [
      { factor: "2", exponent: "11", result: "22", passes: true },
      { factor: "11", exponent: "2", result: "2", passes: true },
    ],
    suggestedAlpha: null,
  });
});

test("random safe-prime parameters are usable downstream", async ({ request }) => {
  const params = await readDh(await request.post("/api/dh/params/random", { data: { bits: 16 } }));
  expect(Object.keys(params).sort()).toEqual(
    ["success", "q", "p", "alpha", "factors", "primitiveRootChecks", "suggestedAlpha"].sort(),
  );
  expect(params.success).toBe(true);
  expect(params.suggestedAlpha).toBeNull();
  for (const value of [params.q, params.p, params.alpha, ...params.factors])
    expect(value).toMatch(/^[1-9][0-9]*$/);
  expect(BigInt(params.q)).toBe(2n * BigInt(params.p) + 1n);
  expect(BigInt(params.q).toString(2)).toHaveLength(16);
  expect(params.factors).toEqual(["2", params.p]);
  for (const check of params.primitiveRootChecks)
    expect(check).toEqual({
      factor: check.factor,
      exponent: String((BigInt(params.q) - 1n) / BigInt(check.factor)),
      result: traceOracle(params.alpha, check.exponent, params.q).at(-1)!.result,
      passes: true,
    });
  const result = await readDh(
    await request.post("/api/dh/exchange", { data: { q: params.q, alpha: params.alpha } }),
  );
  expect(result).toEqual(
    exchangeOracle(params.q, params.alpha, result.privateKeyA, result.privateKeyB),
  );
});

test("keypair and shared-secret complete both sides of the known vector", async ({ request }) => {
  for (const [privateKey, publicKey, otherPublicKey] of [
    ["6", "8", "19"],
    ["15", "19", "8"],
  ]) {
    expect(
      await readDh(
        await request.post("/api/dh/keypair", { data: { q: "23", alpha: "5", privateKey } }),
      ),
    ).toEqual({ success: true, privateKey, publicKey, steps: traceOracle("5", privateKey, "23") });
    expect(
      await readDh(
        await request.post("/api/dh/shared-secret", {
          data: { q: "23", privateKey, otherPublicKey },
        }),
      ),
    ).toEqual({
      success: true,
      sharedKey: "2",
      steps: traceOracle(otherPublicKey, privateKey, "23"),
    });
  }
  const pair = await readDh(
    await request.post("/api/dh/keypair", { data: { q: "23", alpha: "5" } }),
  );
  expect(BigInt(pair.privateKey) >= 2n && BigInt(pair.privateKey) <= 21n).toBe(true);
  expect(["1", "22"]).not.toContain(pair.publicKey);
  expect(pair).toEqual({
    success: true,
    privateKey: pair.privateKey,
    publicKey: traceOracle("5", pair.privateKey, "23").at(-1)!.result,
    steps: traceOracle("5", pair.privateKey, "23"),
  });
});

test("shared-secret 353/97/248 vector and Caesar JSON round trip", async ({ request }) => {
  const shared = { q: "353", privateKey: "97", otherPublicKey: "248" };
  expect(await readDh(await request.post("/api/dh/shared-secret", { data: shared }))).toEqual({
    success: true,
    sharedKey: "160",
    steps: traceOracle("248", "97", "353"),
  });
  expect(
    await readDh(
      await request.post("/api/dh/caesar", {
        data: { ...shared, action: "encrypt", data: "Hello World" },
      }),
    ),
  ).toEqual({ success: true, sharedKey: "160", shift: "4", result: "Lipps Asvph" });
  expect(
    await readDh(
      await request.post("/api/dh/caesar", {
        data: { ...shared, action: "decrypt", data: "Lipps Asvph" },
      }),
    ),
  ).toEqual({ success: true, sharedKey: "160", shift: "4", result: "Hello World" });
});

test("Caesar multipart is JSON, preserves Unicode and strips initial BOM", async ({ request }) => {
  const response = await request.post("/api/dh/caesar", {
    multipart: {
      q: "23",
      privateKey: "6",
      otherPublicKey: "19",
      action: "encrypt",
      file: {
        name: "example.TXT",
        mimeType: "text/plain",
        buffer: Buffer.from("\uFEFFHello Việt!\r\n"),
      },
    },
  });
  expect(response.headers()["content-disposition"]).toBeUndefined();
  expect(await readDh(response)).toEqual({
    success: true,
    sharedKey: "2",
    shift: "2",
    result: "Jgnnq Xkệv!\r\n",
  });
});

const errors = [
  [
    "/api/dh/params",
    { q: "4" },
    "Q_OUT_OF_RANGE",
    "q",
    "q phải từ 5 đến 10¹², hoặc dùng sinh tham số ngẫu nhiên.",
  ],
  [
    "/api/dh/params",
    { q: "1000000000001" },
    "Q_OUT_OF_RANGE",
    "q",
    "q phải từ 5 đến 10¹², hoặc dùng sinh tham số ngẫu nhiên.",
  ],
  [
    "/api/dh/params",
    { q: String(2n ** 128n) },
    "Q_OUT_OF_RANGE",
    "q",
    "q phải từ 5 đến 10¹², hoặc dùng sinh tham số ngẫu nhiên.",
  ],
  ["/api/dh/params", { q: "21" }, "NOT_PRIME", "q", "q = 21 không phải số nguyên tố."],
  [
    "/api/dh/params",
    { q: "23", alpha: "1" },
    "ALPHA_OUT_OF_RANGE",
    "alpha",
    "α phải thỏa 1 < α < q = 23.",
  ],
  [
    "/api/dh/params/random",
    { bits: "16" },
    "BITS_INVALID",
    "bits",
    "Chỉ hỗ trợ 16, 32, 64 hoặc 128 bit.",
  ],
  [
    "/api/dh/keypair",
    { q: "23", alpha: "5", privateKey: "1" },
    "PRIVATE_KEY_OUT_OF_RANGE",
    "privateKey",
    "Khóa riêng phải thỏa 2 ≤ X ≤ q − 2 = 21.",
  ],
  [
    "/api/dh/exchange",
    { ...preset, privateKeyA: "11" },
    "PRIVATE_KEY_WEAK",
    "privateKeyA",
    "Khóa riêng tạo khóa công khai không hợp lệ. Hãy chọn khóa riêng khác.",
  ],
  [
    "/api/dh/shared-secret",
    { q: "23", privateKey: "6", otherPublicKey: "22" },
    "PUBLIC_KEY_INVALID",
    "otherPublicKey",
    "Khóa công khai của bên kia không hợp lệ.",
  ],
  [
    "/api/dh/caesar",
    { q: "23", privateKey: "6", otherPublicKey: "19", action: "bad", data: "Hello" },
    "INVALID_ACTION",
    "action",
    "Action phải là encrypt hoặc decrypt.",
  ],
  [
    "/api/dh/caesar",
    { q: "23", privateKey: "6", otherPublicKey: "19", action: "encrypt", data: "" },
    "EMPTY_INPUT",
    "data",
    "Dữ liệu đầu vào đang rỗng.",
  ],
] as const;
for (const [path, data, code, field, message] of errors)
  test(`${path}: ${code} ${JSON.stringify(data)}`, async ({ request }) => {
    expect(await readDh(await request.post(path, { data }), 422)).toEqual({
      success: false,
      code,
      field,
      message,
    });
  });

for (const q of [23, true, "", "２３", "2.5", "1e3", "-6", "00023", " 23 "])
  test(`canonical decimal rejects ${JSON.stringify(q)}`, async ({ request }) => {
    expect(
      await readDh(await request.post("/api/dh/exchange", { data: { ...preset, q } }), 422),
    ).toEqual({
      success: false,
      code: "NOT_INTEGER",
      field: "q",
      message: "Giá trị phải là số nguyên dương.",
    });
  });

for (const [name, data, field] of [
  ["malformed", "{", null],
  ["array", "[]", null],
  ["duplicate", '{"q":"23","q":"23","alpha":"5"}', "q"],
  ["missing", '{"q":"23"}', "alpha"],
  ["extra", JSON.stringify({ ...preset, unexpected: true }), "unexpected"],
] as const)
  test(`strict request ${name}`, async ({ request }) => {
    expect(
      await readDh(
        await request.post("/api/dh/exchange", {
          data,
          headers: { "Content-Type": "application/json" },
        }),
        422,
      ),
    ).toEqual({
      success: false,
      code: "INVALID_REQUEST",
      field,
      message: "Dữ liệu gửi lên không hợp lệ.",
    });
  });

test("media rejection has canonical four-field error", async ({ request }) => {
  expect(
    await readDh(
      await request.post("/api/dh/exchange", {
        data: "{}",
        headers: { "Content-Type": "text/plain" },
      }),
      415,
    ),
  ).toEqual({
    success: false,
    code: "UNSUPPORTED_MEDIA_TYPE",
    field: null,
    message: "Kiểu nội dung không được hỗ trợ.",
  });
});

async function historySnapshot(request: APIRequestContext) {
  const items: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;
  do {
    const response = await request.get("/api/history", {
      params: { limit: "100", ...(cursor ? { cursor } : {}) },
    });
    expect(response.status(), "Acceptance requires isolated, enabled history").toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    items.push(...body.result.items);
    cursor = body.result.nextCursor;
    expect(cursor === null || typeof cursor === "string").toBe(true);
    if (cursor !== null) {
      expect(seen.has(cursor)).toBe(false);
      seen.add(cursor);
    }
  } while (cursor !== null);
  return items;
}

test("history records only safe Caesar text/file metadata", async ({ request }) => {
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect((await health.json()).result).toMatchObject({ database: "ok", history: "enabled" });
  const before = await historySnapshot(request);
  for (const [path, data] of [
    ["/api/dh/params", { q: "23" }],
    ["/api/dh/params/random", { bits: 16 }],
    ["/api/dh/keypair", { q: "23", alpha: "5", privateKey: "6" }],
    ["/api/dh/shared-secret", { q: "23", privateKey: "6", otherPublicKey: "19" }],
    ["/api/dh/exchange", preset],
  ] as const)
    await readDh(await request.post(path, { data }));
  expect(await historySnapshot(request)).toEqual(before);
  await readDh(
    await request.post("/api/dh/caesar", {
      data: { q: "23", privateKey: "6", otherPublicKey: "19", action: "encrypt", data: "Hello" },
    }),
  );
  await readDh(
    await request.post("/api/dh/caesar", {
      multipart: {
        q: "23",
        privateKey: "15",
        otherPublicKey: "8",
        action: "decrypt",
        file: { name: "private-name.txt", mimeType: "text/plain", buffer: Buffer.from("Jgnnq") },
      },
    }),
  );
  await expect
    .poll(
      async () =>
        (await historySnapshot(request)).filter((item) => !before.some((old) => old.id === item.id))
          .length,
    )
    .toBe(2);
  const added = (await historySnapshot(request)).filter(
    (item) => !before.some((old) => old.id === item.id),
  );
  expect(added).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        cipher: "dh",
        operation: "encrypt",
        source: "text",
        responseMode: null,
      }),
      expect.objectContaining({
        cipher: "dh",
        operation: "decrypt",
        source: "file",
        responseMode: null,
      }),
    ]),
  );
  const forbidden =
    /^(q|alpha|privateKey.*|publicKey.*|sharedKey.*|otherPublicKey|shift|data|result|file|filename|content|steps|trace|warning)$/i;
  for (const row of added) for (const key of Object.keys(row)) expect(key).not.toMatch(forbidden);
});

test("Caesar SHIFT_ZERO is a successful warning", async ({ request }) => {
  const body = await readDh(
    await request.post("/api/dh/caesar", {
      data: {
        q: "53",
        privateKey: "2",
        otherPublicKey: "23",
        action: "encrypt",
        data: "Hello Việt!",
      },
    }),
  );
  expect(body).toEqual({
    success: true,
    sharedKey: "52",
    shift: "0",
    result: "Hello Việt!",
    warning: { code: "SHIFT_ZERO", message: expect.any(String) },
  });
  expect(body.warning.message.length).toBeGreaterThan(0);
});

for (const privateKeyA of [null, "1", "22"] as const)
  test(`exchange invalid private key ${privateKeyA}`, async ({ request }) => {
    const body = await readDh(
      await request.post("/api/dh/exchange", { data: { ...preset, privateKeyA } }),
      422,
    );
    expect(Object.keys(body).sort()).toEqual(["success", "code", "message", "field"].sort());
    expect(body).toMatchObject({
      success: false,
      field: "privateKeyA",
      code: privateKeyA === null ? "NOT_INTEGER" : "PRIVATE_KEY_OUT_OF_RANGE",
    });
  });

test("non-primitive alpha is rejected with suggestion", async ({ request }) => {
  expect(
    await readDh(await request.post("/api/dh/params", { data: { q: "23", alpha: "4" } }), 422),
  ).toEqual({
    success: false,
    code: "NOT_PRIMITIVE_ROOT",
    field: "alpha",
    message: "α = 4 không phải nguyên căn của 23. Gợi ý α = 5.",
  });
});

for (const [name, buffer, status, code] of [
  ["invalid.txt", Buffer.from([0xff]), 415, "UNSUPPORTED_ENCODING"],
  ["empty.txt", Buffer.alloc(0), 422, "EMPTY_INPUT"],
  ["wrong.csv", Buffer.from("hello"), 415, "FILE_INVALID"],
  ["large.txt", Buffer.alloc(5 * 1024 * 1024 + 1, 65), 413, "FILE_INVALID"],
] as const)
  test(`Caesar file rejects ${name}`, async ({ request }) => {
    const body = await readDh(
      await request.post("/api/dh/caesar", {
        multipart: {
          q: "23",
          privateKey: "6",
          otherPublicKey: "19",
          action: "encrypt",
          file: { name, buffer, mimeType: "text/plain" },
        },
      }),
      status,
    );
    expect(Object.keys(body).sort()).toEqual(["success", "code", "message", "field"].sort());
    expect(body).toMatchObject({
      success: false,
      code,
      field: "file",
      message: expect.any(String),
    });
  });
