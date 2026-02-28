import OpenAI from "openai";

async function main() {
  const [, , flag, prompt] = process.argv;
  const apiKey = process.env.OPENROUTER_API_KEY;
  const baseURL =
    process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }
  if (flag !== "-p" || !prompt) {
    throw new Error("error: -p flag is required");
  }

  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: baseURL,
  });

  const response = await client.chat.completions.create({
    model: "anthropic/claude-haiku-4.5",
    messages: [{ role: "user", content: prompt }],
    tools: [
      {
        type: "function", // tools are always functions
        function: {
          // this is like the function definition, like a programming language.
          name: "Read",
          description: "Read and return the contents of a file", // describes the function use case
          parameters: {
            type: "object",
            properties: {
              file_path: {
                type: "string",
                description: "The path to the file to read",
              },
            },
            required: ["file_path"],
          },
        },
      },
    ],
  });

  if (!response.choices || response.choices.length === 0) {
    throw new Error("no choices in response");
  }

  const data = response.choices[0];
  const toolCalls = data.message.tool_calls;
  if (!toolCalls || toolCalls.length === 0) {
    console.log(data.message.content);
    return;
  }
  const tool = toolCalls[0];
  if (tool.type !== "function") {
    console.log(data.message.content);
    return;
  }

  const functionCall = tool.function.name;
  const args = JSON.parse(tool.function.arguments);
  switch (functionCall) {
    case "Read":
      // console.log("reading", functionCall);
      const file = Bun.file(args.file_path);
      const fileContent = await file.text();
      console.log(fileContent);
      break;
  }
}

main();
