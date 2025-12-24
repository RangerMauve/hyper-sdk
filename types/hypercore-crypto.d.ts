declare module "hypercore-crypto" {
  import type {KeyPair} from "hypercore-crypto";

  interface KeyPair {
    publicKey: Buffer;
  }
  export default {
    namespace(name: string, count: number[] | number) : Buffer[]
  }   
}