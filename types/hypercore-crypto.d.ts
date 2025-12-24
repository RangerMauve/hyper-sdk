declare module "hypercore-crypto" {
  interface KeyPair {
   publicKey: Buffer;
 }
 export default {
    namespace(name: string, count: number[] | number) : Buffer[]
 }   
}