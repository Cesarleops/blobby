import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources.js";
import { tools } from "./features/tools";

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
      tools: tools,
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
        case "Bash":
          const command = parameters.command as string;
          const commandResult = await Bun.$`${command.split(" ")}`;
          messages.push({
            tool_call_id: tc.id,
            content: commandResult.text(),
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
