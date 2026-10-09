import type {
  DhExchangeRequest,
  DhExchangeResult,
  DhPrivateValuesResult,
  DhPublicParameters,
  DhTrace,
} from "../types/cipher";

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decimal(value: unknown): value is string {
  return typeof value === "string" && /^(0|[1-9][0-9]{0,38})$/.test(value);
}

function bounded(value: unknown, min: bigint, max: bigint): value is string {
  return decimal(value) && BigInt(value) >= min && BigInt(value) <= max;
}

function publicParameters(value: unknown, request: DhPublicParameters) {
  return (
    object(value) &&
    decimal(value.q) &&
    decimal(value.alpha) &&
    value.q === request.q &&
    value.alpha === request.alpha &&
    bounded(value.q, 5n, 2n ** 128n - 1n) &&
    bounded(value.alpha, 2n, BigInt(value.q) - 1n)
  );
}

function trace(
  value: unknown,
  base: string,
  exponent: string,
  q: string,
  result: string,
): value is DhTrace {
  if (
    !object(value) ||
    value.base !== base ||
    value.exponent !== exponent ||
    value.modulus !== q ||
    value.result !== result ||
    !Array.isArray(value.steps) ||
    value.steps.length < 1 ||
    value.steps.length > 128
  )
    return false;
  if (value.steps.length !== BigInt(exponent).toString(2).length) return false;
  const max = BigInt(q) - 1n;
  const steps = value.steps;
  return steps.every((row: unknown, index: number) => {
    if (!object(row)) return false;
    const prefix = BigInt(exponent)
      .toString(2)
      .slice(0, index + 1);
    return (
      row.index === index &&
      row.bit === Number(prefix.at(-1)) &&
      row.exponentPrefix === BigInt(`0b${prefix}`).toString() &&
      bounded(row.squared, 0n, max) &&
      bounded(row.result, 0n, max) &&
      (row.bit === 0 ? row.multiplied === null : bounded(row.multiplied, 0n, max)) &&
      (index !== steps.length - 1 || row.result === result)
    );
  });
}

/** Defensive model checks only; does not recompute DH, primality or trace arithmetic. */
export function isDhExchangeResult(
  value: unknown,
  request: DhExchangeRequest,
): value is DhExchangeResult {
  if (!object(value) || !publicParameters(value, request)) return false;
  const max = BigInt(request.q) - 1n;
  if (
    !bounded(value.privateA, 2n, max - 1n) ||
    (request.privateA !== undefined && value.privateA !== request.privateA)
  )
    return false;
  if (
    !bounded(value.privateB, 2n, max - 1n) ||
    (request.privateB !== undefined && value.privateB !== request.privateB)
  )
    return false;
  if (
    !bounded(value.publicA, 2n, max - 1n) ||
    !bounded(value.publicB, 2n, max - 1n) ||
    !bounded(value.sharedA, 1n, max) ||
    !bounded(value.sharedB, 1n, max) ||
    value.matched !== true ||
    value.sharedA !== value.sharedB
  )
    return false;
  if (
    !object(value.warning) ||
    value.warning.code !== "EDUCATIONAL_PRIVATE_KEYS" ||
    typeof value.warning.message !== "string" ||
    !value.warning.message.trim()
  )
    return false;
  if (value.traces === null) return false;
  return (
    object(value.traces) &&
    Object.keys(value.traces).length === 4 &&
    trace(
      value.traces.publicA,
      request.alpha,
      value.privateA as string,
      request.q,
      value.publicA,
    ) &&
    trace(
      value.traces.publicB,
      request.alpha,
      value.privateB as string,
      request.q,
      value.publicB,
    ) &&
    trace(
      value.traces.sharedA,
      value.publicB,
      value.privateA as string,
      request.q,
      value.sharedA,
    ) &&
    trace(value.traces.sharedB, value.publicA, value.privateB as string, request.q, value.sharedB)
  );
}

export function isDhPrivateValuesResult(
  value: unknown,
  request: DhPublicParameters,
): value is DhPrivateValuesResult {
  return (
    object(value) &&
    publicParameters(value, request) &&
    bounded(value.privateA, 2n, BigInt(request.q) - 2n) &&
    bounded(value.privateB, 2n, BigInt(request.q) - 2n)
  );
}
