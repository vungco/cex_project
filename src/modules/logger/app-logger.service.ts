import { Injectable, Logger } from '@nestjs/common';

export type LogMeta = Record<string, unknown>;

@Injectable()
export class AppLogger {
  private readonly base = new Logger(AppLogger.name);

  /** Default: debug bật khi NODE_ENV=development */
  private readonly debugEnabled = process.env.NODE_ENV === 'development';

  /**
   * Optional: bật thêm nhóm log theo flag env cụ thể.
   * Ví dụ: SPOT_WS_DEBUG=1|true
   */
  private envFlagEnabled(flagName: string): boolean {
    const v = process.env[flagName];
    return v === '1' || v === 'true' || v === 'TRUE';
  }

  private format(message: string, meta?: LogMeta): string {
    if (!meta || !Object.keys(meta).length) return message;
    const json = JSON.stringify(meta, (_k, v) =>
      typeof v === 'bigint' ? String(v) : v,
    );
    return `${message} | ${json}`;
  }

  setContext(context: string) {
    this.base['context'] = context;
  }

  log(message: string, meta?: LogMeta) {
    this.base.log(this.format(message, meta));
  }

  warn(message: string, meta?: LogMeta) {
    this.base.warn(this.format(message, meta));
  }

  error(message: string, meta?: LogMeta) {
    this.base.error(this.format(message, meta));
  }

  debug(message: string, meta?: LogMeta) {
    if (!this.debugEnabled) return;
    this.base.debug(this.format(message, meta));
  }

  /**
   * Debug theo group/flag (để dev bật riêng từng nhóm).
   * - Nếu NODE_ENV=development: luôn bật
   * - Hoặc bật bằng env flag: e.g. SPOT_WS_DEBUG=1
   */
  debugFlag(flagName: string, message: string, meta?: LogMeta) {
    if (!this.debugEnabled && !this.envFlagEnabled(flagName)) return;
    this.base.debug(this.format(message, meta));
  }
}

