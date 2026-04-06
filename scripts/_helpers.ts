export const requireEnv = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
};

export const hasApplyFlag = () => process.argv.includes("--apply");
