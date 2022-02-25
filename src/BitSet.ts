export default class BitSet {
  bits: number[];

  constructor(arg?: BitSet) {
    this.bits = arg instanceof BitSet ? arg.bits.slice() : [];
  }

  add(n: number) {
    this.bits[n >> 5] |= 1 << (n & 31);
  }

  has(n: number) {
    return !!(this.bits[n >> 5] & (1 << (n & 31)));
  }
}