export function loadEnv(): Record<string, string> {
  const path = '../.env';
  const envFile = open(path);
  console.log(`Loading environment variables from ${envFile}`);
  const env: Record<string, string> = {};

  envFile.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return; // skip empty lines and comments

    const [key, ...rest] = trimmed.split("=");
    const value = rest.join("=").trim();
    env[key.trim()] = value;
  });

  console.log(`Loaded environment variables: ${JSON.stringify(env)}`);

  return env;
}
