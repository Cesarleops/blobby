export const BLACK_LISTED_COMMANDS: Record<string, string> = {
  rm: "Deleting is not allowed",
  "|": "Piping is not allowed",
};

export const WORKSPACE_ROOT = process.cwd();
