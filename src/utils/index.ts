export * from './env';

export function parseKafkaBrokers(brokerUrls: string) {
  return brokerUrls.split(',').map((raw) => {
    const url = new URL(raw.trim());
    return `${url.hostname}:${url.port}`;
  });
}
