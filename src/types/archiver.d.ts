declare module "archiver" {
  import type { Readable } from "stream";

  type ArchiverFormat = "zip" | "tar";

  interface Archiver {
    append(source: string | Buffer | Readable, data: { name?: string }): this;
    pipe(destination: NodeJS.WritableStream): this;
    finalize(): Promise<void>;
    on(event: "data", listener: (chunk: Buffer | string | Uint8Array) => void): this;
    on(event: "end", listener: () => void): this;
    on(event: "error", listener: (err: Error) => void): this;
  }

  function archiver(format: ArchiverFormat, options?: Record<string, unknown>): Archiver;

  export default archiver;
}
