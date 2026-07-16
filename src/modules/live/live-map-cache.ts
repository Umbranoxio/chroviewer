import type { BeatSaverMapSource } from '../../sources/source-types';

const liveMapCacheSize = 2;

export class LiveMapCache {
  private readonly maps = new Map<string, BeatSaverMapSource>();

  has(hash: string) {
    return this.maps.has(hash.toUpperCase());
  }

  get(hash: string) {
    const key = hash.toUpperCase();
    const source = this.maps.get(key);
    if (source === undefined) return undefined;
    this.maps.delete(key);
    this.maps.set(key, source);
    return source;
  }

  set(source: BeatSaverMapSource) {
    const key = source.hash.toUpperCase();
    this.maps.delete(key);
    this.maps.set(key, source);
    if (this.maps.size <= liveMapCacheSize) return;
    const oldest = this.maps.keys().next().value;
    if (oldest !== undefined) this.maps.delete(oldest);
  }
}
