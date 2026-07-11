import assert from "assert";
import { buildPrompt } from "../services/ai/promptManager.js";
import { getCurrentModel, switchModel } from "../services/ai/modelManager.js";
import { detectIntent } from "../services/ai/index.js";
import { getAIProvider } from "../services/ai/providers.js";

async function runTests() {
  console.log("🚀 Starting AI Subsystem Verification Tests...");
  let passed = 0;
  let failed = 0;

  const test = (name, fn) => {
    try {
      fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}: ${err.message}`);
      failed++;
    }
  };

  // Test 1: Prompt Builder validation
  test("Prompt Builder - study template formatting", () => {
    const res = buildPrompt("study", {
      query: "What is a transaction?",
      context: "A transaction is a unit of program execution.",
      history: "User: Hello\nAssistant: Hi",
      userContext: "Streak: 5 days"
    });
    assert.ok(res.prompt.includes("What is a transaction?"));
    assert.ok(res.prompt.includes("A transaction is a unit of program execution."));
    assert.strictEqual(res.templateType, "study");
  });

  // Test 2: Model switching constraints
  test("Model Manager - switch active model", () => {
    switchModel("phi3");
    assert.strictEqual(getCurrentModel(), "phi3");
    switchModel("mistral");
    assert.strictEqual(getCurrentModel(), "mistral");
  });

  // Test 3: Unsupported model switching rejection
  test("Model Manager - reject unsupported models", () => {
    assert.throws(() => {
      switchModel("invalid_model");
    }, /Unsupported model/);
  });

  // Test 4: Intent Detection mapping
  test("Intent Detection - classify platform queries", () => {
    const intent = detectIntent("How do I deposit coins into my wallet?");
    assert.strictEqual(intent, "platform");
  });

  // Test 5: Intent Detection mapping (academic)
  test("Intent Detection - classify study queries", () => {
    const intent = detectIntent("Explain dynamic programming in detail.");
    assert.strictEqual(intent, "study");
  });

  // Test 6: Disabled provider returns graceful answers
  test("Disabled AI Provider - fallback responses", async () => {
    process.env.AI_PROVIDER = "disabled";
    const provider = getAIProvider();
    const res = await provider.chat("Hello", { domain: "platform" });
    assert.ok(res.answer.includes("disabled by the system administrator"));
    assert.strictEqual(res.confidence, 0.0);
    delete process.env.AI_PROVIDER;
  });

  console.log(`\n======================================`);
  console.log(`Test Execution Complete: ${passed} Passed, ${failed} Failed.`);
  console.log(`======================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
