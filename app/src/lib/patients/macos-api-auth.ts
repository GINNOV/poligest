export function getMacosAppApiKey() {
  return process.env.MACOS_APP_API_KEY || "poligest_macos_secret";
}

export function isAuthorizedMacosAppRequest(req: Request) {
  const authHeader = req.headers.get("Authorization");
  const apiKey = req.headers.get("x-api-key");
  const expectedToken = getMacosAppApiKey();
  return authHeader === `Bearer ${expectedToken}` || apiKey === expectedToken;
}