import { RsaGatewayError, type RsaGateway } from "../services/rsaGateway";
import type { RsaKeyResult, RsaTask } from "../types/cipher";

// Canned DTOs for UI tests only. This fake implements no RSA arithmetic.
const keys: RsaKeyResult[] = [
  {
    p: "17",
    q: "11",
    e: "7",
    n: "187",
    phi: "160",
    d: "23",
    verification: "1",
    euclidRows: [
      { quotient: null, remainder: "160", coefficient: "0" },
      { quotient: null, remainder: "7", coefficient: "1" },
      { quotient: "22", remainder: "6", coefficient: "-22" },
      { quotient: "1", remainder: "1", coefficient: "23" },
      { quotient: "6", remainder: "0", coefficient: "-160" },
    ],
  },
  {
    p: "61",
    q: "53",
    e: "17",
    n: "3233",
    phi: "3120",
    d: "2753",
    verification: "1",
    euclidRows: [],
  },
  {
    p: "101",
    q: "113",
    e: "3533",
    n: "11413",
    phi: "11200",
    d: "6597",
    verification: "1",
    euclidRows: [],
  },
];

export function createRsaGateway(options: { failOnce?: RsaTask } = {}): RsaGateway {
  let failure = options.failOnce;
  function check(task: RsaTask, signal: AbortSignal) {
    signal.throwIfAborted();
    if (failure === task) {
      failure = undefined;
      throw new RsaGatewayError("Lỗi thử nghiệm <Backend> & yêu cầu thử lại.");
    }
  }
  return {
    async transform(parameters, signal) {
      check(parameters.inputType, signal);
      const encrypt = parameters.operation === "encrypt";
      return {
        operation: parameters.operation,
        inputType: parameters.inputType,
        output: encrypt ? '["11"]' : "88",
        blocks: ["88"],
        cipher: ["11"],
        rows: [{ index: 0, bit: 1, base: "88", before: "1", after: "11" }],
      };
    },
    async generateKey(parameters, signal) {
      check("key", signal);
      const key = keys.find(
        (candidate) =>
          candidate.p === parameters.p &&
          candidate.q === parameters.q &&
          candidate.e === parameters.e,
      );
      if (!key) throw new RsaGatewayError("Bộ tham số chưa có fixture test.");
      return structuredClone(key);
    },
  };
}
