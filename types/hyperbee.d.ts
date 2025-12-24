declare module "hyperbee" {
  import type Hypercore from "hypercore";
  interface BeeOpts {}
  export default class Hyperbee {
    constructor(core: Hypercore, opts: BeeOpts?);
    ready(): Promise<void>;
  }
}
