import { renderToStaticMarkup } from "react-dom/server";
import { CosmeticTileAnimationPrototype } from "@/app/cosmetic-tile-animation-prototype";

describe("cosmetic tile animation prototype", () => {
  it.each(["brass-glint", "jewel-sheen", "wildcard-orbit"] as const)(
    "renders the %s treatment as presentation-only markup",
    (treatment) => {
      const html = renderToStaticMarkup(<CosmeticTileAnimationPrototype treatment={treatment} />);

      expect(html).toContain(`cosmetic-animation-${treatment}`);
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('data-prototype-only="true"');
      expect(html).not.toContain("button");
      expect(html).not.toContain("tabindex");
    }
  );
});
