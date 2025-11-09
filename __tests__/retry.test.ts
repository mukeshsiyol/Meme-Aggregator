import axios from "axios";
import { fetchWithBackoff } from "../src/retryHttp";

jest.mock("axios");
const mocked = axios as jest.Mocked<typeof axios>;

test("retries once on 500 then succeeds", async () => {
  mocked.mockImplementationOnce(() =>
    Promise.reject({ response: { status: 500 } })
  );
  mocked.mockImplementationOnce(() => Promise.resolve({ data: { ok: true } }));

  const resp = await fetchWithBackoff("http://example.com");
  expect(resp.data.ok).toBe(true);
});
