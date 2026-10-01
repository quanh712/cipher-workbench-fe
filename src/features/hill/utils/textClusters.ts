// Match Backend's base character + following Unicode marks, including NFD Vietnamese.
// Only a cluster consisting of one ASCII letter participates in Hill blocks.
export function* hillTextClusters(text: string): Generator<string> {
  let cluster = "";
  for (const character of text) {
    if (cluster && !/\p{M}/u.test(character)) {
      yield cluster;
      cluster = "";
    }
    cluster += character;
  }
  if (cluster) yield cluster;
}

export function isHillLetter(cluster: string): boolean {
  return /^[A-Za-z]$/.test(cluster);
}

export function countHillLetters(text: string): number {
  let count = 0;
  for (const cluster of hillTextClusters(text)) if (isHillLetter(cluster)) count += 1;
  return count;
}
