import { expect, test } from "../support/fixtures";
import { getUtf8ByteLength } from "../../src/components/assistant-message-render-limit";
import { openAgentRoute, seedMockAgentWorkspace } from "../support/helpers/mock-agent";

// Shaped after a real Claude reply that degenerated into ~32k blank-line-separated `<br>`
// paragraphs. Every paragraph is its own row, so without a cap on the whole message the
// renderer ran out of memory replaying it.
test("caps a message of many short paragraphs without crashing the renderer", async ({ page }) => {
  test.setTimeout(120_000);
  const hiddenTail = "HIDDEN_BLOCK_HEAVY_MESSAGE_TAIL";
  const response = `I opened the PR.${"\n\n<br>".repeat(31_982)}\n\n${hiddenTail}`;
  const agent = await seedMockAgentWorkspace({
    repoPrefix: "assistant-message-block-limit-",
    title: "Assistant message block limit",
    initialPrompt: "Render the configured block-heavy response.",
    featureValues: { mockAssistantResponse: response },
  });

  let crashed = false;
  page.on("crash", () => {
    crashed = true;
  });

  try {
    await agent.client.waitForFinish(agent.agentId, 30_000);
    await openAgentRoute(page, agent);

    const notice = page.getByTestId("assistant-message-capped-notice");
    await expect(notice).toBeVisible({ timeout: 60_000 });
    await expect(notice).toHaveText(
      `This message was capped (${getUtf8ByteLength(response)} bytes).`,
    );
    await expect(page.getByText(hiddenTail)).toHaveCount(0);
    expect(crashed).toBe(false);
  } finally {
    await agent.cleanup();
  }
});
