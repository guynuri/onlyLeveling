// The public VAPID key (PLAN Phase 9). Public by design: the push service checks the server with it. It must match
// VAPID_PUBLIC in wrangler.toml [vars]. The private key lives only in the Worker secret VAPID_PRIVATE_JWK.
export const VAPID_PUBLIC_KEY = 'BMalQh-b7Pd3MlEycckDlTHCZaffMNHEBJSKWSBkyqrem4Q0Z-YOYQYggc7zmuN--uCXYlRGrlRBCv4jOovqfz8';
