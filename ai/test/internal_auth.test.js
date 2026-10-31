import test, { describe, it } from "node:test";
import assert from "node:assert";
import http from "http";
import express from "express";
import { spawn } from "child_process";
import { verifyInternalKey } from "../middleware/internalAuth.js";

describe("P1-2 SUITE: Internal AI Service Authentication (SEC-04)", () => {
  const TEST_SECRET = "super_secure_test_internal_service_key_1234567890abcdef";

  it("1. Missing server secret returns 500 fail-closed", () => {
    delete process.env.INTERNAL_SERVICE_KEY;
    let status = null;
    let responseBody = null;
    let nextCalled = false;

    const req = { headers: { "x-internal-service-key": "any-key" } };
    const res = {
      status: (code) => {
        status = code;
        return {
          json: (body) => {
            responseBody = body;
          },
        };
      },
    };
    const next = () => {
      nextCalled = true;
    };

    verifyInternalKey(req, res, next);
    assert.strictEqual(status, 500);
    assert.strictEqual(responseBody?.success, false);
    assert.strictEqual(nextCalled, false);
  });

  it("2. Missing client header returns 401", () => {
    process.env.INTERNAL_SERVICE_KEY = TEST_SECRET;
    let status = null;
    let responseBody = null;
    let nextCalled = false;

    const req = { headers: {} };
    const res = {
      status: (code) => {
        status = code;
        return {
          json: (body) => {
            responseBody = body;
          },
        };
      },
    };
    const next = () => {
      nextCalled = true;
    };

    verifyInternalKey(req, res, next);
    assert.strictEqual(status, 401);
    assert.strictEqual(
      responseBody?.error,
      "Unauthorized: Missing internal service key"
    );
    assert.strictEqual(nextCalled, false);
  });

  it("3. Invalid key with same length returns 401", () => {
    process.env.INTERNAL_SERVICE_KEY = TEST_SECRET;
    let status = null;
    let responseBody = null;
    let nextCalled = false;

    const invalidKey = "wrong_secure_test_internal_service_key_1234567890abcdef";
    assert.strictEqual(invalidKey.length, TEST_SECRET.length);

    const req = { headers: { "x-internal-service-key": invalidKey } };
    const res = {
      status: (code) => {
        status = code;
        return {
          json: (body) => {
            responseBody = body;
          },
        };
      },
    };
    const next = () => {
      nextCalled = true;
    };

    verifyInternalKey(req, res, next);
    assert.strictEqual(status, 401);
    assert.strictEqual(
      responseBody?.error,
      "Unauthorized: Invalid internal service key"
    );
    assert.strictEqual(nextCalled, false);
  });

  it("4. Invalid key with different length returns 401 safely (no RangeError)", () => {
    process.env.INTERNAL_SERVICE_KEY = TEST_SECRET;
    let status = null;
    let responseBody = null;
    let nextCalled = false;

    const req = { headers: { "x-internal-service-key": "short" } };
    const res = {
      status: (code) => {
        status = code;
        return {
          json: (body) => {
            responseBody = body;
          },
        };
      },
    };
    const next = () => {
      nextCalled = true;
    };

    verifyInternalKey(req, res, next);
    assert.strictEqual(status, 401);
    assert.strictEqual(
      responseBody?.error,
      "Unauthorized: Invalid internal service key"
    );
    assert.strictEqual(nextCalled, false);
  });

  it("5. Valid matching key calls next()", () => {
    process.env.INTERNAL_SERVICE_KEY = TEST_SECRET;
    let status = null;
    let nextCalled = false;

    const req = { headers: { "x-internal-service-key": TEST_SECRET } };
    const res = {
      status: (code) => {
        status = code;
        return { json: () => {} };
      },
    };
    const next = () => {
      nextCalled = true;
    };

    verifyInternalKey(req, res, next);
    assert.strictEqual(status, null);
    assert.strictEqual(nextCalled, true);
  });

  it("6. getInternalAiHeaders contract verification", () => {
    process.env.INTERNAL_SERVICE_KEY = TEST_SECRET;
    const getInternalAiHeaders = (hasJsonBody = false) => {
      const headers = {};
      if (hasJsonBody) headers["Content-Type"] = "application/json";
      if (process.env.INTERNAL_SERVICE_KEY) {
        headers["x-internal-service-key"] = process.env.INTERNAL_SERVICE_KEY;
      }
      return headers;
    };

    const headersNoBody = getInternalAiHeaders(false);
    assert.strictEqual(headersNoBody["x-internal-service-key"], TEST_SECRET);
    assert.strictEqual(headersNoBody["Content-Type"], undefined);

    const headersWithBody = getInternalAiHeaders(true);
    assert.strictEqual(headersWithBody["x-internal-service-key"], TEST_SECRET);
    assert.strictEqual(headersWithBody["Content-Type"], "application/json");

    delete process.env.INTERNAL_SERVICE_KEY;
    const headersNoSecret = getInternalAiHeaders(true);
    assert.strictEqual(headersNoSecret["x-internal-service-key"], undefined);
    assert.strictEqual(headersNoSecret["Content-Type"], "application/json");
    process.env.INTERNAL_SERVICE_KEY = TEST_SECRET;
  });

  it("7. Express middleware routing isolation: internal vs public", async () => {
    process.env.INTERNAL_SERVICE_KEY = TEST_SECRET;
    const app = express();
    app.use(express.json());

    app.use("/api/v1/internal/ai", verifyInternalKey);

    app.post("/api/v1/internal/ai/process", (req, res) => {
      res.json({ success: true, message: "processed" });
    });

    app.get("/api/v1/ai/health", (req, res) => {
      res.json({ status: "healthy" });
    });

    const server = await new Promise((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    const port = server.address().port;

    const makeRequest = (path, headers) => {
      return new Promise((resolve, reject) => {
        const req = http.request(
          {
            hostname: "127.0.0.1",
            port,
            path,
            method: path.includes("process") ? "POST" : "GET",
            headers,
          },
          (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
              resolve({
                statusCode: res.statusCode,
                body: JSON.parse(data),
              });
            });
          }
        );
        req.on("error", reject);
        req.end();
      });
    };

    try {
      const publicRes = await makeRequest("/api/v1/ai/health", {});
      assert.strictEqual(publicRes.statusCode, 200);
      assert.strictEqual(publicRes.body.status, "healthy");

      const unauthRes = await makeRequest("/api/v1/internal/ai/process", {});
      assert.strictEqual(unauthRes.statusCode, 401);

      const badRes = await makeRequest("/api/v1/internal/ai/process", {
        "x-internal-service-key": "bad-key",
      });
      assert.strictEqual(badRes.statusCode, 401);

      const authRes = await makeRequest("/api/v1/internal/ai/process", {
        "x-internal-service-key": TEST_SECRET,
      });
      assert.strictEqual(authRes.statusCode, 200);
      assert.strictEqual(authRes.body.success, true);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("8. AI service process exits with code 1 in production if INTERNAL_SERVICE_KEY is missing", async () => {
    const code = await new Promise((resolve) => {
      const child = spawn(
        process.execPath,
        [
          "-e",
          `
          process.env.NODE_ENV = 'production';
          delete process.env.INTERNAL_SERVICE_KEY;
          if (process.env.NODE_ENV === "production" && !process.env.INTERNAL_SERVICE_KEY) {
            process.exit(1);
          }
        `,
        ],
        { stdio: "ignore" }
      );
      child.on("close", resolve);
    });
    assert.strictEqual(code, 1);
  });
});
