import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources.js";

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

  const messages: ChatCompletionMessageParam[] = [
    { role: "user", content: prompt },
  ];

  while (true) {
    const response = await client.chat.completions.create({
      model: "anthropic/claude-haiku-4.5",
      messages: messages,
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
        {
          type: "function",
          function: {
            name: "Write",
            description: "Write content to a file",
            parameters: {
              type: "object",
              required: ["file_path", "content"],
              properties: {
                file_path: {
                  type: "string",
                  description: "The path of the file to write to",
                },
                content: {
                  type: "string",
                  description: "The content to write to the file",
                },
              },
            },
          },
        },
      ],
    });

    if (!response.choices || response.choices.length === 0) {
      throw new Error("no choices in response");
    }

    const modelResponse = response.choices[0];
    const toolCalls = modelResponse.message.tool_calls;

    messages.push(modelResponse.message);

    if (
      modelResponse.finish_reason === "stop" ||
      !toolCalls ||
      toolCalls.length === 0
    ) {
      console.log(modelResponse.message.content);
      return;
    }

    for (const tc of toolCalls) {
      if (tc.type !== "function") continue;

      const parameters = getToolParameters(tc.function.arguments);
      switch (tc.function.name) {
        case "Read":
          const file = Bun.file(parameters.file_path);
          const content = await file.text();
          messages.push({
            tool_call_id: tc.id,
            content,
            role: "tool",
          });
          break;
        case "Write":
          const filetoWrite = Bun.file(parameters.file_path);
          const result = await filetoWrite.write(parameters.content);
          messages.push({
            tool_call_id: tc.id,
            content: result.toString(),
            role: "tool",
          });
          break;
      }
    }
  }
}

function getToolParameters(params: string) {
  return JSON.parse(params);
}

main();
