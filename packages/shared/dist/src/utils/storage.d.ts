export declare function storageKey(kind: 'vertex-gen' | 'uploads' | 'intermediate' | 'tts' | 'final', name?: string): string;
export declare function publicUrl(key: string): string;
export declare function getSignedUpload(mime?: string): Promise<{
    url: string;
    fields: {
        [x: string]: string;
    };
    bucketKey: string;
}>;
export declare function persistBuffer(key: string, buf: Buffer, mime: string): Promise<string>;
