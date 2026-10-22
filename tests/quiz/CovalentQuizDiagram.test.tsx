/** @vitest-environment jsdom */
import "./setup";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import CovalentQuizDiagram from "@/components/quiz/CovalentQuizDiagram";

afterEach(() => cleanup());

describe("CovalentQuizDiagram", () => {
  it("renders the live diagram for a known compound key", () => {
    render(<CovalentQuizDiagram diagramKey="n2" />);

    expect(screen.getByRole("region", { name: "Nitrogen gas diagram" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Nitrogen gas before bonding/ })).toBeInTheDocument();
  });

  it("renders nothing for an unknown key instead of a blank diagram", () => {
    const { container } = render(<CovalentQuizDiagram diagramKey="not-a-compound" />);

    expect(container).toBeEmptyDOMElement();
  });
});
