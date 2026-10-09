import { useRef, useState } from "react";
import type { DiffieHellmanController } from "./useDiffieHellman";
import {
  dhOperations,
  type DhBits,
  type DhParamsResponse,
  type DhRandomParamsResponse,
  type DhKeypairResponse,
  type DhSharedSecretResponse,
} from "../services/dhOperations";
import { DiffieHellmanGatewayError } from "../services/diffieHellmanGateway";
import { normalizeDhDecimal, validateDhDraft } from "../utils/validation";
import type { DhDraft, DhField } from "../types/cipher";

export type DhSide = "A" | "B";
export type KeyRecord = {
  q: string;
  alpha: string;
  privateKey: string;
  response: DhKeypairResponse;
};
export type SharedRecord = {
  q: string;
  privateKey: string;
  otherPublicKey: string;
  response: DhSharedSecretResponse;
};
type ParamsRecord = {
  q: string;
  alpha: string;
  response: DhParamsResponse | DhRandomParamsResponse;
};
type PracticeState = {
  draft: DhDraft;
  params: ParamsRecord | null;
  keys: Partial<Record<DhSide, KeyRecord>>;
  shared: Partial<Record<DhSide, SharedRecord>>;
  error: string | null;
};
const value = normalizeDhDecimal;
const fieldFor = (side: DhSide): DhField => (side === "A" ? "privateA" : "privateB");
export const otherSide = (side: DhSide): DhSide => (side === "A" ? "B" : "A");

function prune(state: PracticeState, draft: DhDraft): PracticeState {
  const groupChanged =
    value(state.draft.q) !== value(draft.q) || value(state.draft.alpha) !== value(draft.alpha);
  const keys = { ...state.keys };
  for (const side of ["A", "B"] as const) {
    if (groupChanged || value(state.draft[fieldFor(side)]) !== value(draft[fieldFor(side)]))
      delete keys[side];
  }
  const keyChanged =
    groupChanged ||
    value(state.draft.privateA) !== value(draft.privateA) ||
    value(state.draft.privateB) !== value(draft.privateB);
  return {
    draft,
    keys,
    shared: keyChanged ? {} : state.shared,
    params: groupChanged ? null : state.params,
    error: null,
  };
}

export function useDhPractice(cipher: DiffieHellmanController, side: DhSide) {
  const [state, setState] = useState<PracticeState>({
    draft: cipher.draft,
    params: null,
    keys: {},
    shared: {},
    error: null,
  });
  const [bits, setBits] = useState<DhBits>(32);
  const [task, setTask] = useState<string | null>(null);
  const taskRevision = useRef(0);
  if (state.draft !== cipher.draft) setState(prune(state, cipher.draft));
  const current = state.draft === cipher.draft ? state : prune(state, cipher.draft);

  function check(fields: DhField[]) {
    const message = Object.values(validateDhDraft(cipher.draft, fields))[0];
    if (message) throw new DiffieHellmanGatewayError(message, "INVALID_INPUT");
  }
  async function run<T>(
    name: string,
    action: (signal: AbortSignal) => Promise<T>,
    apply: (response: T) => void,
  ) {
    if (cipher.isBusy) return;
    const version = ++taskRevision.current;
    setTask(name);
    setState((previous) => ({ ...previous, error: null }));
    try {
      const response = await cipher.runSupplemental(action);
      if (response !== undefined) apply(response);
    } catch (error) {
      setState((previous) => ({
        ...previous,
        error:
          error instanceof DiffieHellmanGatewayError
            ? error.message
            : "Không thể xử lý yêu cầu. Vui lòng thử lại.",
      }));
    } finally {
      if (version === taskRevision.current) setTask(null);
    }
  }
  const q = value(cipher.draft.q);
  const alpha = value(cipher.draft.alpha);
  const selectedKey = current.keys[side];
  const peer = current.keys[otherSide(side)];
  const exchange =
    cipher.result && cipher.snapshot
      ? {
          q: cipher.snapshot.q,
          privateKey: side === "A" ? cipher.snapshot.privateA : cipher.snapshot.privateB,
          otherPublicKey: side === "A" ? cipher.result.publicB : cipher.result.publicA,
        }
      : null;
  const sharedInput =
    selectedKey && peer
      ? { q, privateKey: selectedKey.privateKey, otherPublicKey: peer.response.publicKey }
      : exchange;

  return {
    ...current,
    bits,
    setBits,
    task,
    canShared: Boolean(sharedInput),
    validateParams: () =>
      run(
        "Kiểm tra tham số",
        (signal) => {
          check(alpha ? ["q", "alpha"] : ["q"]);
          return dhOperations.params({ q, ...(alpha ? { alpha } : {}) }, signal);
        },
        (response) => setState((previous) => ({ ...previous, params: { q, alpha, response } })),
      ),
    randomParams: () =>
      run(
        "Sinh tham số",
        (signal) => dhOperations.randomParams({ bits }, signal),
        (response) => {
          const draft = {
            ...cipher.draft,
            q: response.q,
            alpha: response.alpha,
            privateA: "",
            privateB: "",
          };
          cipher.updateParameters(draft);
          setState({
            draft,
            params: { q: response.q, alpha: response.alpha, response },
            keys: {},
            shared: {},
            error: null,
          });
        },
      ),
    useSuggestion: () => {
      const suggestion = current.params?.response.suggestedAlpha;
      if (suggestion) cipher.setParameter("alpha", suggestion);
    },
    keypair: () =>
      run(
        `Tạo khóa bên ${side}`,
        (signal) => {
          const field = fieldFor(side);
          const privateKey = value(cipher.draft[field]);
          check(["q", "alpha", ...(privateKey ? [field] : [])]);
          return dhOperations.keypair({ q, alpha, ...(privateKey ? { privateKey } : {}) }, signal);
        },
        (response) => {
          const draft = { ...cipher.draft, [fieldFor(side)]: response.privateKey };
          cipher.updateParameters({ [fieldFor(side)]: response.privateKey });
          setState((previous) => ({
            ...prune(previous, draft),
            keys: {
              ...prune(previous, draft).keys,
              [side]: { q, alpha, privateKey: response.privateKey, response },
            },
          }));
        },
      ),
    sharedSecret: () =>
      run(
        `Tính khóa chung bên ${side}`,
        (signal) => {
          if (!sharedInput)
            throw new DiffieHellmanGatewayError(
              "Tạo cặp khóa cho cả A và B hoặc thiết lập bí mật chung phía trên.",
              "INVALID_INPUT",
            );
          return dhOperations.sharedSecret(sharedInput, signal);
        },
        (response) =>
          setState((previous) => ({
            ...previous,
            shared: { ...previous.shared, [side]: { ...sharedInput!, response } },
          })),
      ),
    clearParams: () => {
      cipher.cancelSupplemental();
      cipher.clearResults();
      setState((previous) => ({ ...previous, params: null, keys: {}, shared: {}, error: null }));
    },
    clearKey: (target: DhSide) => {
      cipher.cancelSupplemental();
      cipher.clearResults();
      setState((previous) => {
        const keys = { ...previous.keys };
        delete keys[target];
        return { ...previous, keys, shared: {}, error: null };
      });
    },
    clearShared: (target: DhSide) => {
      cipher.cancelSupplemental();
      setState((previous) => {
        const shared = { ...previous.shared };
        delete shared[target];
        return { ...previous, shared, error: null };
      });
    },
  };
}
export type DhPracticeController = ReturnType<typeof useDhPractice>;
