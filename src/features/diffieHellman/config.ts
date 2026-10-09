/** Opt in only after the workspace and real Backend integration are ready. */
export const isDiffieHellmanEnabled = (): boolean =>
  import.meta.env.VITE_ENABLE_DIFFIE_HELLMAN === "true";
