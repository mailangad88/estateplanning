import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ConsultScheduler from "@/components/ConsultScheduler";
import { firm } from "@/config/firm";

const render = (url: string | null) => renderToStaticMarkup(createElement(ConsultScheduler, { url }));

describe("ConsultScheduler", () => {
  it("ships with no scheduler URL, so nothing third-party loads by default", () => {
    expect(firm.schedulerUrl).toBeNull();
    expect(renderToStaticMarkup(createElement(ConsultScheduler))).not.toContain("<iframe");
  });

  it("keeps the intake team message when no scheduler is set", () => {
    const html = render(null);
    expect(html).not.toContain("<iframe");
    expect(html).toContain("intake team will contact you");
  });

  it("embeds the scheduler with a title when a URL is set", () => {
    const html = render("https://cal.example.com/consult");
    expect(html).toMatch(/<iframe[^>]+src="https:\/\/cal\.example\.com\/consult"/);
    expect(html).toMatch(/<iframe[^>]+title="Consult scheduling calendar"/);
  });

  it("ignores a URL that is not https", () => {
    expect(render("javascript:alert(1)")).not.toContain("<iframe");
    expect(render("http://cal.example.com")).not.toContain("<iframe");
  });
});
