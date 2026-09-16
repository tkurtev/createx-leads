import { get, list, put } from '@vercel/blob';

/** The three Blob calls the demo stores need, injectable so tests don't hit Vercel. */
export type BlobApi = {
  put: (pathname: string, body: Buffer | string, options: { contentType: string }) => Promise<unknown>;
  list: (options: { prefix: string; cursor?: string }) => Promise<{ blobs: { pathname: string }[]; cursor?: string; hasMore: boolean }>;
  get: (pathname: string) => Promise<{ data: Buffer; contentType: string } | null>;
};

async function readStream(stream: ReadableStream<Uint8Array>) {
  return Buffer.from(await new Response(stream).arrayBuffer());
}

export const vercelBlobApi: BlobApi = {
  put: (pathname, body, { contentType }) =>
    put(pathname, body, { access: 'private', contentType, addRandomSuffix: false }),
  list: ({ prefix, cursor }) => list({ prefix, cursor }),
  get: async (pathname) => {
    const result = await get(pathname, { access: 'private' });
    if (!result || result.statusCode !== 200) return null;
    return { data: await readStream(result.stream), contentType: result.blob.contentType };
  },
};
