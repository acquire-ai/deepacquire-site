type R2ListObject = {
  key: string;
  size: number;
  uploaded: string | Date;
};

type R2ListResult = {
  objects: R2ListObject[];
};

type DownloadBucket = {
  list: () => Promise<R2ListResult>;
};

export type DownloadFile = {
  name: string;
  url: string;
  size: number;
  date: Date;
};

export type DownloadListResult = {
  files: DownloadFile[];
  errorMessage: string;
};

export function formatBytes(bytes: number, decimals = 2): string {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export async function fetchDownloadFiles(locals: App.Locals): Promise<DownloadListResult> {
  try {
    const runtime = locals?.runtime;
    const env = runtime?.env as Record<string, unknown> | undefined;
    if (!env) {
      throw new Error('Cloudflare runtime environment not found. Please ensure this is running on Cloudflare Pages.');
    }

    const bucket = env.DOWNLOAD_BUCKET;
    const publicUrl = env.R2_PUBLIC_URL as string | undefined;

    if (!bucket) {
      throw new Error('DOWNLOAD_BUCKET binding is missing in the environment.');
    }

    if (typeof bucket === 'string') {
      throw new Error(
        `DOWNLOAD_BUCKET is currently a string ("${bucket}"). ` +
          'In local development, if you put DOWNLOAD_BUCKET in your .env file, it will be loaded as a string, not an R2 Bucket Binding. ' +
          'To test locally, remove DOWNLOAD_BUCKET from .env and configure it in wrangler.toml instead.'
      );
    }

    if (typeof (bucket as DownloadBucket).list !== 'function') {
      throw new Error(
        'DOWNLOAD_BUCKET exists but does not have a .list() method. Ensure it is properly configured as an R2 Bucket Binding.'
      );
    }

    if (!publicUrl) {
      throw new Error('R2_PUBLIC_URL environment variable is missing in the environment.');
    }

    const listed = await (bucket as DownloadBucket).list();
    const baseUrl = publicUrl.replace(/\/$/, '');

    const files = listed.objects
      .filter((obj) => obj.key.endsWith('.zip'))
      .map((obj) => ({
        name: obj.key,
        url: `${baseUrl}/${encodeURIComponent(obj.key)}`,
        size: obj.size,
        date: new Date(obj.uploaded),
      }))
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    return { files, errorMessage: '' };
  } catch (error) {
    console.error('Error fetching downloads:', error);
    const message = error instanceof Error ? error.message : 'An error occurred while fetching the download list.';
    return { files: [], errorMessage: message };
  }
}
