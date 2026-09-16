export type StoredAudio = { data: Buffer; mime: string };

export interface AudioStore {
  save(data: Buffer, mime: string, name: string): Promise<string>;
  read(id: string): Promise<StoredAudio | null>;
}
