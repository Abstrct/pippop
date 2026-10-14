export interface Ctx {
  /** The part after the room ("#/mat/1-1000" → "1-1000"). */
  param?: string;
  go(path: string): void;
}

export interface Screen {
  el: HTMLElement;
  title?: string;
  leave(): void;
}
