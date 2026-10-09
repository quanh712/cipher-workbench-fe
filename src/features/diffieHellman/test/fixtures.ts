import type {
  DhExchangeRequest,
  DhParameters,
  DhExchangeResult,
  DhPrivateValuesResult,
  DhTrace,
  DhTraceRow,
} from "../types/cipher";

type CannedRow = [0 | 1, string, string, string | null, string];

// Static left-to-right oracle rows. No DH arithmetic in fixtures.
function trace(base: string, exponent: string, result: string, rows: CannedRow[]): DhTrace {
  return {
    base,
    exponent,
    modulus: "23",
    result,
    steps: rows.map(([bit, exponentPrefix, squared, multiplied, result], index): DhTraceRow => ({
      index,
      bit,
      exponentPrefix,
      squared,
      multiplied,
      result,
    })),
  };
}

export function createDhPresetRequest(includeTrace = true): DhExchangeRequest & DhParameters {
  return { q: "23", alpha: "5", privateA: "6", privateB: "15", includeTrace };
}

export function createDhPresetResult(includeTrace = true): DhExchangeResult {
  return {
    q: "23",
    alpha: "5",
    privateA: "6",
    privateB: "15",
    warning: {
      code: "EDUCATIONAL_PRIVATE_KEYS",
      message:
        "Response trả khóa riêng để minh họa và đối chiếu phép tính. Trong hệ thống thực tế, khóa riêng không được gửi hoặc lưu ngoài bên sở hữu; khóa công khai phải được xác thực để chống tấn công người đứng giữa (MITM).",
    },
    publicA: "8",
    publicB: "19",
    sharedA: "2",
    sharedB: "2",
    matched: true,
    traces: includeTrace
      ? {
          publicA: trace("5", "6", "8", [
            [1, "1", "1", "5", "5"],
            [1, "3", "2", "10", "10"],
            [0, "6", "8", null, "8"],
          ]),
          publicB: trace("5", "15", "19", [
            [1, "1", "1", "5", "5"],
            [1, "3", "2", "10", "10"],
            [1, "7", "8", "17", "17"],
            [1, "15", "13", "19", "19"],
          ]),
          sharedA: trace("19", "6", "2", [
            [1, "1", "1", "19", "19"],
            [1, "3", "16", "5", "5"],
            [0, "6", "2", null, "2"],
          ]),
          sharedB: trace("8", "15", "2", [
            [1, "1", "1", "8", "8"],
            [1, "3", "18", "6", "6"],
            [1, "7", "13", "12", "12"],
            [1, "15", "6", "2", "2"],
          ]),
        }
      : null,
  };
}

/** Deterministic response for the random endpoint; does not use an RNG. */
export function createDhRandomValues(): DhPrivateValuesResult {
  return { q: "23", alpha: "5", privateA: "15", privateB: "6" };
}

/** Canned follow-up exchange for the private values returned by the random fixture. */
export function createDhSwappedResult(includeTrace = true): DhExchangeResult {
  const preset = createDhPresetResult(includeTrace);
  return {
    ...preset,
    privateA: "15",
    privateB: "6",
    publicA: "19",
    publicB: "8",
    traces: preset.traces
      ? {
          publicA: preset.traces.publicB,
          publicB: preset.traces.publicA,
          sharedA: preset.traces.sharedB,
          sharedB: preset.traces.sharedA,
        }
      : null,
  };
}

/** Exact canonical BE response for HTTP integration tests. */
export function createDhPresetWireResult() {
  const r = createDhPresetResult();
  return {
    success: true,
    privateKeyA: r.privateA,
    privateKeyB: r.privateB,
    publicKeyA: r.publicA,
    publicKeyB: r.publicB,
    sharedKeyA: r.sharedA,
    sharedKeyB: r.sharedB,
    match: r.matched,
    warning: r.warning,
    steps: {
      publicKeyA: r.traces!.publicA.steps,
      publicKeyB: r.traces!.publicB.steps,
      sharedKeyA: r.traces!.sharedA.steps,
      sharedKeyB: r.traces!.sharedB.steps,
    },
  };
}
