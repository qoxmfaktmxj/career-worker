import fs from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

const pageSource = fs.readFileSync(
  path.join(__dirname, "../../src/app/jobs/[jobId]/page.tsx"),
  "utf8"
);

describe("Job detail page source", () => {
  it("does not use escaped unicode in JSX prop strings", () => {
    expect(pageSource).not.toMatch(
      /(?:title|description|label|placeholder|loadingLabel)="[^"]*\\u[0-9A-Fa-f]{4}/
    );
  });
});
