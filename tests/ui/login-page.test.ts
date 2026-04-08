import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("Login page", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("shows the duck mark next to the workspace title", async () => {
    const { default: LoginPage } = await import("@/app/login/page");
    const html = renderToStaticMarkup(createElement(LoginPage));

    expect(html).toContain("채용 작업실");
    expect(html).toContain('alt="오리 아이콘"');
    expect(html).toContain("duck-mark.png");
  });
});
